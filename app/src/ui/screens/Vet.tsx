import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { SwipeableRow } from "../components/SwipeableRow";
import { RevealItem } from "../components/Reveal";
import { BathReminder } from "../components/BathReminder";
import { HealthDetailScreen } from "../components/HealthDetailScreen";
import type { RecordType } from "../components/VetAddModal";
import { WeightChart } from "../components/WeightChart";
import { PageTitle, Eyebrow, Headline, Footnote } from "../components/Typography";
import { Icons } from "../lib/icons";
import { fmtDate, today } from "../lib/date";
import type { GroomingLog, GroomingType, HealthDocument, Priority, Profile, Vaccine, VetNote, WeightEntry } from "../types";

type IconComponent = (typeof Icons)[keyof typeof Icons];

// Dashboard design tokens (mirrors screens/Dashboard.tsx & settings/shared.tsx).
const DARK = "var(--color-pawpal-page)"; // #352B25 page background
const HERO = "var(--color-pawpal-hero)"; // cream
const SURFACE = "var(--color-dash-surface)"; // #3E332C dark card
const MUTED = "var(--color-pawpal-muted)"; // muted label text

// Icon-chip accent colours per section (pastel chips, dark glyphs).
const ACCENT = {
  reminder: "var(--color-track-vet)", // blue
  medication: "var(--color-track-meds)", // green
  vaccine: "var(--color-track-notes)", // light blue
  checkup: "var(--color-dash-trained)", // yellow
  document: "var(--color-track-vet)", // blue
  haircut: "var(--color-bath)", // teal
  nails: "var(--color-track-notes)", // light blue
  weight: "var(--color-track-meds)", // green
  petid: "var(--color-track-notes)", // light blue
  notes: "var(--color-dash-pooped)", // warm sand
  bath: "var(--color-bath)", // teal
} as const;

// Documents are stored inline as base64, so keep uploads small.
const MAX_DOC_BYTES = 2 * 1024 * 1024;

const PRIORITY_COLOR: Record<Priority, string> = {
  High: "#E96A41",
  Medium: "#F2B84B",
  Low: "#9DBA9C",
};

/** Keep the single `profile.weight` in step with the newest weight-log entry. */
function syncProfileWeight(log: WeightEntry[], profile: Profile): void {
  if (log.length === 0) return;
  const latest = [...log].sort((a, b) => (a.date < b.date ? -1 : 1))[log.length - 1];
  if (latest) profile.weight = String(latest.kg);
}

interface VetProps {
  onAdd: (types?: RecordType[]) => void;
  onEditReminder: (index: number) => void;
  onEditVaccine: (index: number) => void;
}

type Collection = "checkups" | "vaccines" | "reminders" | "medications";

export function Vet({ onAdd, onEditReminder, onEditVaccine }: VetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const { checkups, vaccines, reminders, medications } = db.vetRecords;
  const name = db.profile.name.trim() || "Zipi";

  const noteItems = db.vetRecords.noteItems ?? [];
  const [draft, setDraft] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [detail, setDetail] = useState<"care" | "vaccines" | "checkups" | null>(null);
  const [docsOpen, setDocsOpen] = useState(false);
  const [openVaccineGroups, setOpenVaccineGroups] = useState<Set<string>>(new Set());

  const documents = db.vetRecords.documents ?? [];
  const insuranceDoc = documents.find((d) => d.kind === "insurance");

  const groomingLogs = db.grooming ?? [];
  const [groomingType, setGroomingType] = useState<GroomingType | null>(null);
  const groomingOf = (type: GroomingType): { g: GroomingLog; index: number }[] =>
    groomingLogs
      .map((g, index) => ({ g, index }))
      .filter((x) => x.g.type === type)
      .sort((a, b) => new Date(b.g.date).getTime() - new Date(a.g.date).getTime());
  const lastGroomingDate = (type: GroomingType): string | undefined => {
    const dates = groomingLogs
      .filter((g) => g.type === type)
      .map((g) => g.date)
      .sort();
    return dates[dates.length - 1];
  };

  const weightLog = db.weightLog ?? [];
  const [weightOpen, setWeightOpen] = useState(false);
  const [petIdOpen, setPetIdOpen] = useState(false);
  const [bathOpen, setBathOpen] = useState(false);
  const weightAsc = [...weightLog].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const weightDesc = weightLog
    .map((e, index) => ({ e, index }))
    .sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0));
  const currentWeight = weightAsc.length ? weightAsc[weightAsc.length - 1].kg : undefined;
  const prevWeight = weightAsc.length >= 2 ? weightAsc[weightAsc.length - 2].kg : undefined;
  const weightDelta =
    currentWeight !== undefined && prevWeight !== undefined ? currentWeight - prevWeight : undefined;

  const bathDates = (db.baths ?? []).map((b) => b.date).sort();
  const lastBath = bathDates.length ? bathDates[bathDates.length - 1] : undefined;

  // One-time migration: seed the checklist from any legacy free-text notes.
  useEffect(() => {
    if (db.vetRecords.noteItems !== undefined) return;
    update((d) => {
      const legacy = (d.vetRecords.notes ?? "").trim();
      d.vetRecords.noteItems = legacy
        ? legacy
            .split("\n")
            .map((line) => line.replace(/^[-•✅☑️✔️\s]+/, "").trim())
            .filter(Boolean)
            .map((text) => ({ text, done: false }))
        : [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One-time migration: fold legacy vaccine `nextDue` into `validUntil`, and
  // seed the weight log from the single numeric `profile.weight` if empty.
  useEffect(() => {
    update((d) => {
      d.vetRecords.vaccines.forEach((v) => {
        if (v.validUntil === undefined && v.nextDue) v.validUntil = v.nextDue;
      });
      d.weightLog ??= [];
      if (d.weightLog.length === 0) {
        const kg = parseFloat((d.profile.weight ?? "").replace(",", "."));
        if (Number.isFinite(kg) && kg > 0) {
          const today = new Date().toISOString().split("T")[0];
          d.weightLog.push({ date: today, kg, created: new Date().toISOString() });
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addNote = (): void => {
    const text = draft.trim();
    if (!text) return;
    update((d) => {
      (d.vetRecords.noteItems ??= []).push({ text, done: false });
    });
    setDraft("");
  };

  const toggleNote = (index: number): void => {
    update((d) => {
      const item = d.vetRecords.noteItems?.[index];
      if (item) item.done = !item.done;
    });
  };

  const editNote = (index: number, text: string): void => {
    update((d) => {
      const item = d.vetRecords.noteItems?.[index];
      if (item) item.text = text;
    });
  };

  const deleteNote = (index: number): void => {
    update((d) => {
      d.vetRecords.noteItems?.splice(index, 1);
    });
  };

  const del = async (collection: Collection, index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this record?",
      message: "This record will be permanently removed.",
      confirmLabel: "Delete Record",
    });
    if (!ok) return;
    update((d) => {
      d.vetRecords[collection].splice(index, 1);
    });
    toast("Deleted");
  };

  const setMicrochip = (value: string): void => {
    update((d) => {
      d.profile.microchip = value;
    });
  };

  // Store a picked file inline as a base64 data URL (kept small — see the cap).
  const uploadDocument = (kind: "insurance" | "other"): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > MAX_DOC_BYTES) {
        toast("File too large — keep it under 2 MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        update((d) => {
          (d.vetRecords.documents ??= []).push({
            name: kind === "insurance" ? "Pet insurance" : file.name,
            kind,
            mime: file.type || "application/octet-stream",
            fileName: file.name,
            data: String(reader.result),
            size: file.size,
            created: new Date().toISOString(),
          });
        });
        toast(kind === "insurance" ? "Insurance saved" : "Document saved");
      };
      reader.onerror = () => toast("Couldn't read that file");
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const openDocument = (doc: HealthDocument): void => {
    fetch(doc.data)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      })
      .catch(() => toast("Couldn't open that file"));
  };

  const deleteDocument = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this document?",
      message: "The file will be permanently removed from this device.",
      confirmLabel: "Delete Document",
    });
    if (!ok) return;
    update((d) => {
      d.vetRecords.documents?.splice(index, 1);
    });
    toast("Deleted");
  };

  const addGrooming = (type: GroomingType, date: string): void => {
    if (!date) return;
    update((d) => {
      (d.grooming ??= []).push({ type, date, created: new Date().toISOString() });
    });
    toast("Logged");
  };

  const deleteGrooming = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this entry?",
      message: "This grooming entry will be removed.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    update((d) => {
      d.grooming?.splice(index, 1);
    });
    toast("Deleted");
  };

  const addWeight = (date: string, kgStr: string, note: string): void => {
    const kg = parseFloat(kgStr.replace(",", "."));
    if (!date || !Number.isFinite(kg) || kg <= 0) {
      toast("Enter a valid weight");
      return;
    }
    update((d) => {
      const log = (d.weightLog ??= []);
      log.push({ date, kg, note: note.trim() || undefined, created: new Date().toISOString() });
      syncProfileWeight(d.weightLog, d.profile);
    });
    toast("Weight logged");
  };

  const deleteWeight = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this entry?",
      message: "This weight entry will be removed.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    update((d) => {
      d.weightLog?.splice(index, 1);
      if (d.weightLog) syncProfileWeight(d.weightLog, d.profile);
    });
    toast("Deleted");
  };

  const sortedReminders = reminders
    .map((r, index) => ({ r, index }))
    .sort((a, b) => new Date(a.r.date).getTime() - new Date(b.r.date).getTime());
  const sortedVaccines = vaccines
    .map((v, index) => ({ v, index }))
    .sort((a, b) => new Date(b.v.date).getTime() - new Date(a.v.date).getTime());
  const sortedCheckups = checkups
    .map((c, index) => ({ c, index }))
    .sort((a, b) => new Date(b.c.date).getTime() - new Date(a.c.date).getTime());

  const renderReminders = (): React.ReactElement => (
    <GroupCard>
      {sortedReminders.length === 0 ? (
        <Empty icon={Icons.bell} text="No upcoming reminders." />
      ) : (
        sortedReminders.map(({ r, index }, i) => (
          <RecordRow
            key={index}
            index={i}
            icon={Icons.bell}
            accent={ACCENT.reminder}
            isFirst={i === 0}
            title={r.title}
            meta={r.date ? fmtDate(r.date) : "No date set"}
            extra={<PriorityPill priority={r.priority} />}
            onEdit={() => onEditReminder(index)}
            onDelete={() => del("reminders", index)}
          />
        ))
      )}
    </GroupCard>
  );

  const renderMedications = (): React.ReactElement => (
    <GroupCard>
      {medications.length === 0 ? (
        <Empty icon={Icons.pill} text="No medications logged." />
      ) : (
        medications.map((m, index) => {
          const daysLeft = m.end
            ? Math.ceil((new Date(m.end + "T12:00:00").getTime() - Date.now()) / 86400000)
            : null;
          const progress =
            m.days && m.start
              ? Math.min(
                  100,
                  Math.round(
                    ((Date.now() - new Date(m.start + "T12:00:00").getTime()) / 86400000 / m.days) * 100,
                  ),
                )
              : 0;
          const urgent = daysLeft !== null && daysLeft <= 2;
          return (
            <RevealItem
              key={index}
              index={index}
              style={{ borderTop: index === 0 ? undefined : "1px solid rgba(255,255,255,0.07)" }}
            >
              <SwipeableRow
                background={SURFACE}
                actions={[
                  {
                    label: "Delete",
                    color: "#ff3b30",
                    icon: <Icon icon={Icons.trash} color="inherit" />,
                    onAction: () => del("medications", index),
                  },
                ]}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <IconChip icon={Icons.pill} accent={ACCENT.medication} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      <Headline color={HERO}>{m.name}</Headline>
                      <Footnote color={MUTED}>
                        {m.dose} {m.freq ? `· ${m.freq}` : ""}
                      </Footnote>
                      {m.notes && <Footnote color={MUTED}>{m.notes}</Footnote>}
                    </div>
                  </div>
                  {m.days > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Footnote color={MUTED}>
                          {m.start ? fmtDate(m.start) : ""} → {m.end ? fmtDate(m.end) : ""}
                        </Footnote>
                        <Footnote color={urgent ? "#E96A41" : HERO} weight={600}>
                          {daysLeft !== null
                            ? daysLeft <= 0
                              ? "Completed"
                              : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                            : "Ongoing"}
                        </Footnote>
                      </div>
                      <ProgressTrack value={progress} color={urgent ? "#E96A41" : "#F2B84B"} />
                    </div>
                  ) : (
                    <Footnote color={MUTED}>Ongoing — no end date</Footnote>
                  )}
                </div>
              </SwipeableRow>
            </RevealItem>
          );
        })
      )}
    </GroupCard>
  );

  const renderVaccines = (): React.ReactElement => {
    if (sortedVaccines.length === 0) {
      return (
        <GroupCard>
          <Empty icon={Icons.syringe} text="No vaccinations recorded." />
        </GroupCard>
      );
    }
    // Group boosters by vaccine name; sortedVaccines is date-desc, so within
    // each group the most recent boost stays first.
    const groups: { name: string; entries: { v: Vaccine; index: number }[] }[] = [];
    for (const item of sortedVaccines) {
      const group = groups.find((g) => g.name === item.v.name);
      if (group) group.entries.push(item);
      else groups.push({ name: item.v.name, entries: [item] });
    }
    const toggle = (name: string): void =>
      setOpenVaccineGroups((prev) => {
        const next = new Set(prev);
        if (next.has(name)) next.delete(name);
        else next.add(name);
        return next;
      });
    return (
      <GroupCard>
        {groups.map((group, gi) => (
          <VaccineGroup
            key={group.name}
            name={group.name}
            entries={group.entries}
            isFirst={gi === 0}
            open={openVaccineGroups.has(group.name)}
            onToggle={() => toggle(group.name)}
            onEdit={onEditVaccine}
            onDelete={(index) => del("vaccines", index)}
          />
        ))}
      </GroupCard>
    );
  };

  const renderDocuments = (): React.ReactElement => {
    const ordered = documents
      .map((doc, index) => ({ doc, index }))
      .sort((a, b) => (a.doc.kind === "insurance" ? -1 : 0) - (b.doc.kind === "insurance" ? -1 : 0));
    return (
      <>
        <button
          type="button"
          onClick={() => uploadDocument("other")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "12px 14px",
            marginBottom: 10,
            borderRadius: 16,
            color: HERO,
            cursor: "pointer",
            background: "transparent",
            border: "1.5px dashed rgba(233, 228, 196, 0.35)",
          }}
        >
          <Icon icon={Icons.upload} color="inherit" />
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 15 }}>
            Add a document
          </span>
        </button>
        <GroupCard>
          {ordered.length === 0 ? (
            <Empty icon={Icons.fileText} text="No documents uploaded." />
          ) : (
            ordered.map(({ doc, index }, i) => (
              <DocumentRow
                key={doc.created}
                index={i}
                doc={doc}
                onOpen={() => openDocument(doc)}
                onDelete={() => deleteDocument(index)}
              />
            ))
          )}
        </GroupCard>
      </>
    );
  };

  const renderCheckups = (): React.ReactElement => (
    <GroupCard>
      {sortedCheckups.length === 0 ? (
        <Empty icon={Icons.clipboardText} text="No checkups recorded." />
      ) : (
        sortedCheckups.map(({ c, index }, i) => (
          <RecordRow
            key={index}
            index={i}
            icon={Icons.clipboardText}
            accent={ACCENT.checkup}
            isFirst={i === 0}
            title={c.reason}
            meta={`${c.date ? fmtDate(c.date) : ""}${c.clinic ? ` · ${c.clinic}` : ""}`}
            extra={
              <>
                {c.notes && <Footnote color={MUTED}>{c.notes}</Footnote>}
                {c.hasFile && <Footnote color={HERO}>📎 {c.fileName}</Footnote>}
              </>
            }
            onDelete={() => del("checkups", index)}
          />
        ))
      )}
    </GroupCard>
  );

  const nextReminder = sortedReminders[0];
  const nextVaccineDue = sortedVaccines
    .map(({ v }) => v.validUntil ?? v.nextDue)
    .filter((d): d is string => Boolean(d))
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .find((d) => new Date(d).getTime() >= Date.now() - 86400000);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        padding:
          "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Header — title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageTitle style={{ margin: "4px 0 0" }}>{name}&rsquo;s Health</PageTitle>
        </div>
      </div>

      {/* Overview widgets — Pet ID, Vet notes & Weight */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
        <HubCard
          icon={Icons.idCard}
          accent={ACCENT.petid}
          title="Pet ID"
          summary={
            db.profile.microchip?.trim()
              ? documents.length > 0
                ? `Chip & ${documents.length} file${documents.length !== 1 ? "s" : ""}`
                : "Microchip on file"
              : "Add chip & docs"
          }
          onClick={() => setPetIdOpen(true)}
        />
        <HubCard
          icon={Icons.note}
          accent={ACCENT.notes}
          title="Vet notes"
          summary={
            noteItems.length === 0
              ? "No notes yet"
              : `${noteItems.filter((n) => !n.done).length} open · ${noteItems.length} total`
          }
          onClick={() => setNotesOpen(true)}
        />
        <button
          type="button"
          onClick={() => setWeightOpen(true)}
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: 18,
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            background: SURFACE,
            borderRadius: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-brand)",
                  fontWeight: 700,
                  fontSize: 26,
                  lineHeight: 1.1,
                  color: HERO,
                }}
              >
                {currentWeight !== undefined ? `${currentWeight} kg` : "Weight"}
              </span>
              <Footnote color={MUTED} style={{ marginTop: 3 }}>
                {currentWeight === undefined
                  ? "Not logged yet"
                  : weightAsc.length
                    ? `Updated ${fmtDate(weightAsc[weightAsc.length - 1].date)}`
                    : "Weight over time"}
              </Footnote>
            </div>
            {weightDelta !== undefined && weightDelta !== 0 && (
              <span
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: "var(--font-ui)",
                  fontWeight: 700,
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 100,
                  background: "rgba(255,255,255,0.08)",
                  color: weightDelta > 0 ? "#F2B84B" : "#9DBA9C",
                }}
              >
                {weightDelta > 0 ? "▲" : "▼"} {Math.abs(weightDelta).toFixed(1)} kg
              </span>
            )}
          </div>
          {weightAsc.length >= 2 && (
            <WeightChart data={weightAsc} height={132} showAxis color="var(--color-track-meds)" />
          )}
        </button>
      </div>

      {/* Grooming — bath rhythm + haircut & nail-trim logs */}
      <SectionLabel>Grooming</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <HubCard
          icon={Icons.droplet}
          accent={ACCENT.bath}
          title="Bath time"
          summary={lastBath ? `Last ${fmtDate(lastBath)}` : "Not logged yet"}
          onClick={() => setBathOpen(true)}
        />
        <HubCard
          icon={Icons.scissors}
          accent={ACCENT.haircut}
          title="Haircuts"
          summary={
            lastGroomingDate("haircut") ? `Last ${fmtDate(lastGroomingDate("haircut")!)}` : "Not logged yet"
          }
          onClick={() => setGroomingType("haircut")}
        />
        <HubCard
          icon={Icons.pawPrint}
          accent={ACCENT.nails}
          title="Nail trimming"
          summary={
            lastGroomingDate("nails") ? `Last ${fmtDate(lastGroomingDate("nails")!)}` : "Not logged yet"
          }
          onClick={() => setGroomingType("nails")}
        />
      </div>

      {/* Summary cards — each opens its full detail screen */}
      <SectionLabel>Health records</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <HubCard
          icon={Icons.bell}
          accent={ACCENT.reminder}
          title="Reminders & meds"
          summary={
            nextReminder
              ? `Next: ${nextReminder.r.title}${nextReminder.r.date ? ` · ${fmtDate(nextReminder.r.date)}` : ""}`
              : medications.length > 0
                ? `${medications.length} medication${medications.length !== 1 ? "s" : ""}`
                : "Nothing scheduled"
          }
          onClick={() => setDetail("care")}
        />
        <HubCard
          icon={Icons.syringe}
          accent={ACCENT.vaccine}
          title="Vaccinations"
          summary={
            sortedVaccines.length === 0
              ? "None recorded"
              : `${sortedVaccines.length} recorded${
                  nextVaccineDue ? ` · next due ${fmtDate(nextVaccineDue)}` : ""
                }`
          }
          onClick={() => setDetail("vaccines")}
        />
        <HubCard
          icon={Icons.clipboardText}
          accent={ACCENT.checkup}
          title="Checkups"
          summary={sortedCheckups.length === 0 ? "None recorded" : `${sortedCheckups.length} recorded`}
          onClick={() => setDetail("checkups")}
        />
      </div>

      <VetNotesScreen
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        noteItems={noteItems}
        draft={draft}
        setDraft={setDraft}
        onAdd={addNote}
        onToggle={toggleNote}
        onEdit={editNote}
        onDelete={deleteNote}
      />

      <HealthDetailScreen
        open={detail === "care"}
        onClose={() => setDetail(null)}
        title="Reminders & meds"
        subtitle={
          sortedReminders.length + medications.length > 0
            ? `${sortedReminders.length} reminder${sortedReminders.length !== 1 ? "s" : ""} · ${medications.length} med${medications.length !== 1 ? "s" : ""}`
            : undefined
        }
        action={<AddRecordButton onClick={() => onAdd(["reminder", "medication"])} />}
      >
        <SectionLabel>Reminders</SectionLabel>
        {renderReminders()}
        <SectionLabel>Medications</SectionLabel>
        {renderMedications()}
      </HealthDetailScreen>

      <HealthDetailScreen
        open={detail === "vaccines"}
        onClose={() => setDetail(null)}
        title="Vaccinations"
        subtitle={sortedVaccines.length > 0 ? `${sortedVaccines.length} recorded` : undefined}
        action={<AddRecordButton onClick={() => onAdd(["vaccine"])} />}
      >
        {renderVaccines()}
      </HealthDetailScreen>

      <HealthDetailScreen
        open={detail === "checkups"}
        onClose={() => setDetail(null)}
        title="Checkups"
        subtitle={sortedCheckups.length > 0 ? `${sortedCheckups.length} recorded` : undefined}
        action={<AddRecordButton onClick={() => onAdd(["checkup"])} />}
      >
        {renderCheckups()}
      </HealthDetailScreen>

      <HealthDetailScreen
        open={docsOpen}
        onClose={() => setDocsOpen(false)}
        title="Documents"
        subtitle={documents.length > 0 ? `${documents.length} file${documents.length !== 1 ? "s" : ""}` : undefined}
      >
        {renderDocuments()}
      </HealthDetailScreen>

      <GroomingScreen
        open={groomingType === "haircut"}
        onClose={() => setGroomingType(null)}
        title="Haircuts"
        icon={Icons.scissors}
        accent={ACCENT.haircut}
        items={groomingOf("haircut")}
        onAdd={(date) => addGrooming("haircut", date)}
        onDelete={deleteGrooming}
      />

      <GroomingScreen
        open={groomingType === "nails"}
        onClose={() => setGroomingType(null)}
        title="Nail trimming"
        icon={Icons.pawPrint}
        accent={ACCENT.nails}
        items={groomingOf("nails")}
        onAdd={(date) => addGrooming("nails", date)}
        onDelete={deleteGrooming}
      />

      <WeightScreen
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        chartData={weightAsc}
        entries={weightDesc}
        current={currentWeight}
        onAdd={addWeight}
        onDelete={deleteWeight}
      />

      <PetIdScreen
        open={petIdOpen}
        onClose={() => setPetIdOpen(false)}
        microchip={db.profile.microchip ?? ""}
        onMicrochip={setMicrochip}
        insuranceDoc={insuranceDoc}
        documentsCount={documents.length}
        onOpenInsurance={() => insuranceDoc && openDocument(insuranceDoc)}
        onUploadInsurance={() => uploadDocument("insurance")}
        onOpenDocuments={() => setDocsOpen(true)}
      />

      <HealthDetailScreen open={bathOpen} onClose={() => setBathOpen(false)} title="Bath time">
        <BathReminder />
      </HealthDetailScreen>
    </div>
  );
}

/**
 * Full-screen "Notes for the vet" detail screen. Reads and manages the whole
 * checklist — toggle discussed, edit inline, swipe to remove, and add topics —
 * while the Health-tab card only previews the latest note.
 */
function VetNotesScreen({
  open,
  onClose,
  noteItems,
  draft,
  setDraft,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  noteItems: VetNote[];
  draft: string;
  setDraft: (v: string) => void;
  onAdd: () => void;
  onToggle: (index: number) => void;
  onEdit: (index: number, text: string) => void;
  onDelete: (index: number) => void;
}): React.ReactElement {
  const openCount = noteItems.filter((n) => !n.done).length;

  return (
    <HealthDetailScreen
      open={open}
      onClose={onClose}
      title="Notes for the vet"
      subtitle={noteItems.length > 0 ? `${openCount} open · ${noteItems.length} total` : undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Add a new topic */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 12px",
            borderRadius: 16,
            color: HERO,
            border: "1.5px dashed rgba(233, 228, 196, 0.35)",
            marginBottom: 6,
          }}
        >
          <Icon icon={Icons.plusCircle} color="inherit" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="Add a topic…"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-ui)",
              fontSize: 16,
              color: HERO,
            }}
          />
          {draft.trim() && (
            <button
              type="button"
              aria-label="Add topic"
              onClick={onAdd}
              style={{
                border: "none",
                cursor: "pointer",
                background: HERO,
                color: DARK,
                borderRadius: 100,
                padding: "6px 14px",
                fontFamily: "var(--font-ui)",
                fontWeight: 600,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              Add
            </button>
          )}
        </div>

        {noteItems.length === 0 && (
          <Footnote color={MUTED} style={{ padding: "8px 8px 0" }}>
            Add topics to raise at your next visit, then tick them off as you discuss them.
          </Footnote>
        )}

        {noteItems.map((item, index) => (
          <NoteRow
            key={index}
            item={item}
            onToggle={() => onToggle(index)}
            onEdit={(text) => onEdit(index, text)}
            onDelete={() => onDelete(index)}
          />
        ))}
      </div>
    </HealthDetailScreen>
  );
}

/** Uppercase muted section label — matches settings/dashboard eyebrows. */
function SectionLabel({ children }: { children: ReactNode }): React.ReactElement {
  return <Eyebrow style={{ display: "block", margin: "24px 4px 8px" }}>{children}</Eyebrow>;
}

/** Widget-style tile on the Health hub — opens a detail screen. Sits in a grid. */
function HubCard({
  icon,
  accent,
  title,
  summary,
  onClick,
}: {
  icon: IconComponent;
  accent: string;
  title: string;
  summary: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        width: "100%",
        minHeight: 128,
        padding: 16,
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        background: SURFACE,
        borderRadius: 24,
      }}
    >
      <IconChip icon={icon} accent={accent} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: "auto", minWidth: 0 }}>
        <Headline color={HERO}>{title}</Headline>
        <Footnote
          color={MUTED}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {summary}
        </Footnote>
      </div>
    </button>
  );
}

/** Pet ID detail screen: microchip field + insurance & documents actions. */
function PetIdScreen({
  open,
  onClose,
  microchip,
  onMicrochip,
  insuranceDoc,
  documentsCount,
  onOpenInsurance,
  onUploadInsurance,
  onOpenDocuments,
}: {
  open: boolean;
  onClose: () => void;
  microchip: string;
  onMicrochip: (v: string) => void;
  insuranceDoc: HealthDocument | undefined;
  documentsCount: number;
  onOpenInsurance: () => void;
  onUploadInsurance: () => void;
  onOpenDocuments: () => void;
}): React.ReactElement {
  return (
    <HealthDetailScreen open={open} onClose={onClose} title="Pet ID">
      <label style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Microchip number
        </span>
        <input
          value={microchip}
          onChange={(e) => onMicrochip(e.target.value)}
          inputMode="numeric"
          placeholder="Not set"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 16px",
            borderRadius: 16,
            border: "1px solid rgba(233, 228, 196, 0.35)",
            background: "transparent",
            color: HERO,
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            fontSize: 16,
            outline: "none",
          }}
        />
      </label>
      <GroupCard>
        <DarkActionRow
          icon={Icons.shieldCheck}
          accent={ACCENT.document}
          title="Insurance"
          value={insuranceDoc ? insuranceDoc.fileName : "Add insurance PDF"}
          isFirst
          onClick={insuranceDoc ? onOpenInsurance : onUploadInsurance}
        />
        <DarkActionRow
          icon={Icons.paperclip}
          accent={ACCENT.document}
          title="Documents"
          value={documentsCount === 0 ? "None yet" : `${documentsCount} file${documentsCount !== 1 ? "s" : ""}`}
          onClick={onOpenDocuments}
        />
      </GroupCard>
    </HealthDetailScreen>
  );
}

/** Tappable action row on a dark GroupCard: icon chip + title + value + chevron. */
function DarkActionRow({
  icon,
  accent,
  title,
  value,
  isFirst,
  onClick,
}: {
  icon: IconComponent;
  accent: string;
  title: string;
  value: string;
  isFirst?: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: 14,
        border: "none",
        borderTop: isFirst ? undefined : "1px solid rgba(255,255,255,0.07)",
        cursor: "pointer",
        textAlign: "left",
        background: SURFACE,
      }}
    >
      <IconChip icon={icon} accent={accent} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <Headline color={HERO}>{title}</Headline>
        <Footnote
          color={MUTED}
          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          {value}
        </Footnote>
      </div>
      <span style={{ display: "flex", color: MUTED, flexShrink: 0 }}>
        <Icon icon={Icons.caretRight} color="inherit" />
      </span>
    </button>
  );
}

/** A single uploaded-document row: tap to open, swipe to delete. */
function DocumentRow({
  index,
  doc,
  onOpen,
  onDelete,
}: {
  index: number;
  doc: HealthDocument;
  onOpen: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const size =
    doc.size >= 1024 * 1024
      ? `${(doc.size / 1024 / 1024).toFixed(1)} MB`
      : `${Math.max(1, Math.round(doc.size / 1024))} KB`;
  return (
    <RevealItem
      index={index}
      style={{ borderTop: index === 0 ? undefined : "1px solid rgba(255,255,255,0.07)" }}
    >
      <SwipeableRow
        background={SURFACE}
        actions={[
          {
            label: "Delete",
            color: "#ff3b30",
            icon: <Icon icon={Icons.trash} color="inherit" />,
            onAction: onDelete,
          },
        ]}
      >
        <button
          type="button"
          onClick={onOpen}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            width: "100%",
            padding: 14,
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            background: SURFACE,
          }}
        >
          <IconChip
            icon={doc.kind === "insurance" ? Icons.shieldCheck : Icons.fileText}
            accent={ACCENT.document}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <Headline color={HERO}>{doc.name}</Headline>
            <Footnote color={MUTED}>
              {doc.fileName} · {size}
            </Footnote>
          </div>
          <span style={{ display: "flex", color: MUTED, flexShrink: 0 }}>
            <Icon icon={Icons.caretRight} color="inherit" />
          </span>
        </button>
      </SwipeableRow>
    </RevealItem>
  );
}

/** Small circular "add record" button shown in a detail screen's header. */
function AddRecordButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      aria-label="Add record"
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        background: SURFACE,
        color: HERO,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon icon={Icons.plusCircle} color="inherit" />
    </button>
  );
}

/** Grooming history screen (haircuts / nail trims): log a dated entry, list, swipe-delete. */
function GroomingScreen({
  open,
  onClose,
  title,
  icon,
  accent,
  items,
  onAdd,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  icon: IconComponent;
  accent: string;
  items: { g: GroomingLog; index: number }[];
  onAdd: (date: string) => void;
  onDelete: (index: number) => void;
}): React.ReactElement {
  const [date, setDate] = useState(today());
  return (
    <HealthDetailScreen
      open={open}
      onClose={onClose}
      title={title}
      subtitle={items.length ? `${items.length} logged` : undefined}
    >
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            boxSizing: "border-box",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid rgba(233, 228, 196, 0.35)",
            background: "transparent",
            color: HERO,
            colorScheme: "dark",
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            fontSize: 16,
            outline: "none",
            WebkitAppearance: "none",
            appearance: "none",
          }}
        />
        <button
          type="button"
          onClick={() => onAdd(date)}
          style={{
            flexShrink: 0,
            border: "none",
            cursor: "pointer",
            background: HERO,
            color: DARK,
            borderRadius: 14,
            padding: "0 22px",
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Log
        </button>
      </div>
      <GroupCard>
        {items.length === 0 ? (
          <Empty icon={icon} text="Nothing logged yet." />
        ) : (
          items.map(({ g, index }, i) => (
            <RecordRow
              key={g.created}
              index={i}
              icon={icon}
              accent={accent}
              isFirst={i === 0}
              title={fmtDate(g.date)}
              meta={g.notes}
              onDelete={() => onDelete(index)}
            />
          ))
        )}
      </GroupCard>
    </HealthDetailScreen>
  );
}

/** Weight detail screen: evolution graph on top, add-entry form, then the dated list. */
function WeightScreen({
  open,
  onClose,
  chartData,
  entries,
  current,
  onAdd,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  chartData: readonly { date: string; kg: number }[];
  entries: { e: WeightEntry; index: number }[];
  current: number | undefined;
  onAdd: (date: string, kg: string, note: string) => void;
  onDelete: (index: number) => void;
}): React.ReactElement {
  const [date, setDate] = useState(today());
  const [kg, setKg] = useState("");
  const [note, setNote] = useState("");

  const submit = (): void => {
    onAdd(date, kg, note);
    setKg("");
    setNote("");
  };

  const fieldStyle: CSSProperties = {
    minWidth: 0,
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(233, 228, 196, 0.35)",
    background: "transparent",
    color: HERO,
    colorScheme: "dark",
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    fontSize: 16,
    outline: "none",
    WebkitAppearance: "none",
    appearance: "none",
  };

  return (
    <HealthDetailScreen
      open={open}
      onClose={onClose}
      title="Weight"
      subtitle={current !== undefined ? `Currently ${current} kg` : undefined}
    >
      {chartData.length > 0 ? (
        <div style={{ background: SURFACE, borderRadius: 24, padding: "16px 12px", marginBottom: 14 }}>
          <WeightChart data={chartData} height={200} showAxis color="var(--color-track-meds)" />
        </div>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <Empty icon={Icons.chartColumn} text="Log a few weights to see the trend." />
        </div>
      )}

      {/* Add entry */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...fieldStyle, flex: 1 }} />
          <input
            type="number"
            inputMode="decimal"
            value={kg}
            onChange={(e) => setKg(e.target.value)}
            placeholder="kg"
            style={{ ...fieldStyle, width: 96 }}
          />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            style={{ ...fieldStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={submit}
            style={{
              flexShrink: 0,
              border: "none",
              cursor: "pointer",
              background: HERO,
              color: DARK,
              borderRadius: 14,
              padding: "0 22px",
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Add
          </button>
        </div>
      </div>

      <GroupCard>
        {entries.length === 0 ? (
          <Empty icon={Icons.chartColumn} text="No weights logged." />
        ) : (
          entries.map(({ e, index }, i) => {
            const older = entries[i + 1]?.e.kg;
            const delta = older !== undefined ? e.kg - older : undefined;
            return (
              <RecordRow
                key={e.created}
                index={i}
                icon={Icons.chartColumn}
                accent={ACCENT.weight}
                isFirst={i === 0}
                title={`${e.kg} kg`}
                meta={fmtDate(e.date)}
                extra={
                  <>
                    {delta !== undefined && delta !== 0 && (
                      <Footnote color={delta > 0 ? "#F2B84B" : "#9DBA9C"} weight={600}>
                        {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} kg
                      </Footnote>
                    )}
                    {e.note && <Footnote color={MUTED}>{e.note}</Footnote>}
                  </>
                }
                onDelete={() => onDelete(index)}
              />
            );
          })
        )}
      </GroupCard>
    </HealthDetailScreen>
  );
}

/** Rounded dark surface that groups a set of record rows. */
function GroupCard({ children }: { children: ReactNode }): React.ReactElement {
  return <div style={{ background: SURFACE, borderRadius: 24, overflow: "hidden" }}>{children}</div>;
}

/** A single vet-notes checklist row: tap circle to toggle discussed, tap text to edit, swipe to remove. */
function NoteRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: VetNote;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <SwipeableRow
      background={HERO}
      style={{ borderRadius: 16 }}
      actions={[
        {
          label: "Delete",
          color: "#ff3b30",
          icon: <Icon icon={Icons.trash} color="inherit" />,
          onAction: onDelete,
        },
      ]}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          padding: "8px 10px",
          background: HERO,
        }}
      >
        <button
          type="button"
          aria-pressed={item.done}
          aria-label={item.done ? `Mark "${item.text}" as open` : `Mark "${item.text}" as discussed`}
          onClick={onToggle}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: DARK,
            padding: 0,
            height: 21,
            flexShrink: 0,
          }}
        >
          {item.done ? (
            <Icon icon={Icons.checkCircle} color="inherit" />
          ) : (
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: `2px solid ${DARK}`,
                opacity: 0.5,
              }}
            />
          )}
        </button>
        <NoteTextarea item={item} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </SwipeableRow>
  );
}

/** Auto-growing, multi-line note field (no horizontal scroll). */
function NoteTextarea({
  item,
  onEdit,
  onDelete,
}: {
  item: VetNote;
  onEdit: (text: string) => void;
  onDelete: () => void;
}): React.ReactElement {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [item.text]);

  return (
    <textarea
      ref={ref}
      value={item.text}
      rows={1}
      aria-label={`Edit topic "${item.text}"`}
      onChange={(e) => onEdit(e.target.value)}
      onBlur={(e) => {
        if (!e.target.value.trim()) onDelete();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      style={{
        flex: 1,
        minWidth: 0,
        border: "none",
        outline: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        resize: "none",
        overflow: "hidden",
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
        lineHeight: "21px",
        color: DARK,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        textDecoration: item.done ? "line-through" : "none",
        opacity: item.done ? 0.55 : 1,
      }}
    />
  );
}

/** Pastel icon chip with a dark glyph. */
function IconChip({ icon, accent }: { icon: IconComponent; accent: string }): React.ReactElement {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 38,
        height: 38,
        borderRadius: 12,
        background: accent,
        color: DARK,
        flexShrink: 0,
      }}
    >
      <Icon icon={icon} color="inherit" />
    </span>
  );
}

function PriorityPill({ priority }: { priority: Priority }): React.ReactElement {
  return (
    <span
      style={{
        alignSelf: "flex-start",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 11,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        color: DARK,
        background: PRIORITY_COLOR[priority],
        borderRadius: 100,
        padding: "3px 10px",
        marginTop: 2,
      }}
    >
      {priority} priority
    </span>
  );
}

function ProgressTrack({ value, color }: { value: number; color: string }): React.ReactElement {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 100,
        background: "rgba(255,255,255,0.12)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(100, value))}%`,
          height: "100%",
          borderRadius: 100,
          background: color,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

function RecordRow({
  icon,
  accent,
  title,
  meta,
  extra,
  isFirst,
  index,
  onEdit,
  onDelete,
}: {
  icon: IconComponent;
  accent: string;
  title: string;
  meta?: string;
  extra?: ReactNode;
  isFirst: boolean;
  index: number;
  onEdit?: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const style: CSSProperties = {
    borderTop: isFirst ? undefined : "1px solid rgba(255,255,255,0.07)",
  };
  return (
    <RevealItem index={index} style={style}>
      <SwipeableRow
        background={SURFACE}
        actions={[
          ...(onEdit
            ? [
                {
                  label: "Edit",
                  color: "#5B6EE1",
                  icon: <Icon icon={Icons.pencilSimple} color="inherit" />,
                  onAction: onEdit,
                },
              ]
            : []),
          {
            label: "Delete",
            color: "#ff3b30",
            icon: <Icon icon={Icons.trash} color="inherit" />,
            onAction: onDelete,
          },
        ]}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: 14 }}>
          <IconChip icon={icon} accent={accent} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
            <Headline color={HERO}>{title}</Headline>
            {meta && <Footnote color={MUTED}>{meta}</Footnote>}
            {extra}
          </div>
        </div>
      </SwipeableRow>
    </RevealItem>
  );
}

/** Derives the "valid" label + expiry colour/suffix shown for a vaccine boost. */
function vaccineExpiry(v: Vaccine): {
  until?: string;
  validText: string | null;
  color: string;
  suffix: string;
} {
  const until = v.validUntil ?? v.nextDue;
  const from = v.validFrom;
  const validText =
    from && until
      ? `Valid ${fmtDate(from)} – ${fmtDate(until)}`
      : until
        ? `Valid until ${fmtDate(until)}`
        : from
          ? `Valid from ${fmtDate(from)}`
          : null;
  const daysLeft = until
    ? Math.ceil((new Date(until + "T12:00:00").getTime() - Date.now()) / 86400000)
    : null;
  const color =
    daysLeft === null ? MUTED : daysLeft < 0 ? "#E96A41" : daysLeft <= 30 ? "#F2B84B" : MUTED;
  const suffix =
    daysLeft === null ? "" : daysLeft < 0 ? " · Expired" : daysLeft <= 30 ? ` · ${daysLeft}d left` : "";
  return { until, validText, color, suffix };
}

/** Collapsible group of one vaccine's boosters; header shows the latest expiry. */
function VaccineGroup({
  name,
  entries,
  isFirst,
  open,
  onToggle,
  onEdit,
  onDelete,
}: {
  name: string;
  entries: { v: Vaccine; index: number }[];
  isFirst: boolean;
  open: boolean;
  onToggle: () => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}): React.ReactElement {
  const recent = entries[0].v;
  const { until, color, suffix } = vaccineExpiry(recent);
  const headerMeta = until ? `Valid until ${fmtDate(until)}` : "No expiry set";
  return (
    <div style={{ borderTop: isFirst ? undefined : "1px solid rgba(255,255,255,0.07)" }}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: 14,
          width: "100%",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <IconChip icon={Icons.syringe} accent={ACCENT.vaccine} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
          <Headline color={HERO}>{name}</Headline>
          <Footnote color={color} weight={suffix ? 600 : undefined}>
            {headerMeta}
            {suffix}
          </Footnote>
        </div>
        {entries.length > 1 && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 600,
              fontSize: 12,
              color: MUTED,
              background: "rgba(255,255,255,0.08)",
              borderRadius: 100,
              padding: "2px 9px",
              flexShrink: 0,
            }}
          >
            {entries.length}
          </span>
        )}
        <span
          aria-hidden
          style={{
            display: "flex",
            color: MUTED,
            flexShrink: 0,
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <Icon icon={Icons.chevronDown} color="inherit" size="sm" />
        </span>
      </button>
      {open &&
        entries.map(({ v, index }, i) => (
          <VaccineEntryRow
            key={index}
            v={v}
            index={i}
            onEdit={() => onEdit(index)}
            onDelete={() => onDelete(index)}
          />
        ))}
    </div>
  );
}

/** A single booster inside an expanded vaccine group (indented under the header). */
function VaccineEntryRow({
  v,
  index,
  onEdit,
  onDelete,
}: {
  v: Vaccine;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  const { validText, color, suffix } = vaccineExpiry(v);
  return (
    <RevealItem index={index} style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
      <SwipeableRow
        background={SURFACE}
        actions={[
          {
            label: "Edit",
            color: "#5B6EE1",
            icon: <Icon icon={Icons.pencilSimple} color="inherit" />,
            onAction: onEdit,
          },
          {
            label: "Delete",
            color: "#ff3b30",
            icon: <Icon icon={Icons.trash} color="inherit" />,
            onAction: onDelete,
          },
        ]}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 2,
            minHeight: 64,
            padding: "12px 14px 12px 66px",
          }}
        >
          <Headline color={HERO}>{v.date ? `Given ${fmtDate(v.date)}` : "Given"}</Headline>
          {v.manufacturer && <Footnote color={MUTED}>{v.manufacturer}</Footnote>}
          {validText && (
            <Footnote color={color} weight={suffix ? 600 : undefined}>
              {validText}
              {suffix}
            </Footnote>
          )}
          {v.clinic && <Footnote color={MUTED}>{v.clinic}</Footnote>}
          {v.notes && <Footnote color={MUTED}>{v.notes}</Footnote>}
        </div>
      </SwipeableRow>
    </RevealItem>
  );
}

function Empty({ icon, text }: { icon: IconComponent; text: string }): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: 32,
      }}
    >
      <Icon icon={icon} size="lg" color="disabled" />
      <Footnote color={MUTED}>{text}</Footnote>
    </div>
  );
}
