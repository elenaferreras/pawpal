import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { SwipeableRow } from "../components/SwipeableRow";
import { RevealItem } from "../components/Reveal";
import { CardStagger } from "../components/CardStagger";
import { Group, NavRow, DateRow, NumberRow, NotesField } from "../components/SheetForm";
import { MotionSheet } from "../components/MotionSheet";
import { GroomingHub } from "../components/GroomingHub";
import { CareHub } from "../components/CareHub";
import { FieldEditSheet } from "../components/FieldEditSheet";
import { HealthDetailScreen } from "../components/HealthDetailScreen";
import { SettingsRow } from "./settings/shared";
import { DogFace } from "../avatar/DogAvatar";
import type { RecordType } from "../components/VetAddModal";
import { WeightChart } from "../components/WeightChart";
import { Eyebrow, Headline, Footnote } from "../components/Typography";
import { TopBar } from "../components/TopBar";
import { Icons } from "../lib/icons";
import { fmtDate, today } from "../lib/date";
import type { Avatar, Checkup, HealthDocument, Profile, Vaccine, VetNote, WeightEntry } from "../types";

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

/** Read a file as a base64 data URL. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

/** Approximate byte size of a base64 data URL's payload. */
function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  return Math.ceil((dataUrl.length - comma - 1) * 0.75);
}

/**
 * Downscale + JPEG-compress an image so it fits under `maxBytes` (gallery photos
 * are routinely larger than the inline-storage cap). Returns null if it can't.
 */
async function compressImageToDataUrl(
  file: File,
  maxBytes: number,
): Promise<{ dataUrl: string; size: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    let scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
    for (let attempt = 0; attempt < 5; attempt++) {
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, w, h);
      for (const quality of [0.82, 0.65, 0.5, 0.38]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        const size = dataUrlBytes(dataUrl);
        if (size <= maxBytes) return { dataUrl, size };
      }
      scale *= 0.7;
    }
    return null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

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
  onEditCheckup: (index: number) => void;
  /** When true, open the "Notes for the vet" detail screen on entry. */
  openNotes?: boolean;
  /** Called once the notes screen has been auto-opened, to clear the request. */
  onNotesOpened?: () => void;
}

type Collection = "checkups" | "vaccines" | "reminders" | "medications";

export function Vet({
  onAdd,
  onEditVaccine,
  onEditCheckup,
  openNotes,
  onNotesOpened,
}: VetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const { checkups, vaccines } = db.vetRecords;
  const name = db.profile.name.trim() || "Zipi";

  const noteItems = db.vetRecords.noteItems ?? [];
  const [draft, setDraft] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [detail, setDetail] = useState<"vaccines" | "checkups" | null>(null);
  const [careOpen, setCareOpen] = useState(false);
  const [renameIndex, setRenameIndex] = useState<number | null>(null);
  const [openVaccineGroups, setOpenVaccineGroups] = useState<Set<string>>(new Set());

  const documents = db.vetRecords.documents ?? [];
  const insuranceDoc = documents.find((d) => d.kind === "insurance");

  const groomingLogs = db.grooming ?? [];
  const [groomingOpen, setGroomingOpen] = useState(false);

  const weightLog = db.weightLog ?? [];
  const [weightOpen, setWeightOpen] = useState(false);
  const [petIdOpen, setPetIdOpen] = useState(false);
  const weightAsc = [...weightLog].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const weightDesc = weightLog
    .map((e, index) => ({ e, index }))
    .sort((a, b) => (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0));
  const currentWeight = weightAsc.length ? weightAsc[weightAsc.length - 1].kg : undefined;
  const prevWeight = weightAsc.length >= 2 ? weightAsc[weightAsc.length - 2].kg : undefined;
  const weightDelta =
    currentWeight !== undefined && prevWeight !== undefined ? currentWeight - prevWeight : undefined;

  const groomingActivityDates = [
    ...(db.baths ?? []).map((b) => b.date),
    ...groomingLogs.map((g) => g.date),
  ].sort();
  const lastGroomingActivity = groomingActivityDates.length
    ? groomingActivityDates[groomingActivityDates.length - 1]
    : undefined;

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

  // Deep-link from the dashboard "Notes for the vet" card: open the detail
  // screen straight away, then clear the request so it doesn't re-open.
  useEffect(() => {
    if (!openNotes) return;
    setNotesOpen(true);
    onNotesOpened?.();
  }, [openNotes, onNotesOpened]);

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
    let snap: unknown;
    update((d) => {
      snap = d.vetRecords[collection][index] ? { ...d.vetRecords[collection][index] } : undefined;
      d.vetRecords[collection].splice(index, 1);
    });
    const undo = (): void => {
      if (!snap) return;
      update((d) => {
        const list = d.vetRecords[collection] as unknown[];
        list.splice(Math.min(index, list.length), 0, snap);
      });
    };
    toast("Deleted", { label: "Undo", onClick: undo });
  };

  const setMicrochip = (value: string): void => {
    update((d) => {
      d.profile.microchip = value;
    });
  };

  // Store a picked file inline as a base64 data URL (kept small — see the cap).
  // Images are downscaled/compressed to fit; other files must be under the cap.
  const uploadDocument = (kind: "insurance" | "other"): void => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      let data: string;
      let mime: string;
      let size: number;
      if (file.type.startsWith("image/")) {
        const out = await compressImageToDataUrl(file, MAX_DOC_BYTES);
        if (!out) {
          toast("Couldn't add that image");
          return;
        }
        data = out.dataUrl;
        mime = "image/jpeg";
        size = out.size;
      } else {
        if (file.size > MAX_DOC_BYTES) {
          toast("File too large — keep it under 2 MB");
          return;
        }
        try {
          data = await readFileAsDataUrl(file);
        } catch {
          toast("Couldn't read that file");
          return;
        }
        mime = file.type || "application/octet-stream";
        size = file.size;
      }
      update((d) => {
        (d.vetRecords.documents ??= []).push({
          name: kind === "insurance" ? "Pet insurance" : file.name,
          kind,
          mime,
          fileName: file.name,
          data,
          size,
          created: new Date().toISOString(),
        });
      });
      toast(kind === "insurance" ? "Insurance saved" : "Document saved");
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

  // Opens a checkup's inline attachment (stored as a base64 data URL).
  const openCheckupFile = (checkup: Checkup): void => {
    if (!checkup.fileData) return;
    fetch(checkup.fileData)
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      })
      .catch(() => toast("Couldn't open that file"));
  };

  const renameDocument = (index: number, value: string): void => {
    const name = value.trim();
    if (!name) return;
    update((d) => {
      const doc = d.vetRecords.documents?.[index];
      if (doc) doc.name = name;
    });
    toast("Renamed");
  };

  const deleteDocument = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this document?",
      message: "The file will be permanently removed from this device.",
      confirmLabel: "Delete Document",
    });
    if (!ok) return;
    let snap: HealthDocument | undefined;
    update((d) => {
      snap = d.vetRecords.documents?.[index] ? { ...d.vetRecords.documents[index] } : undefined;
      d.vetRecords.documents?.splice(index, 1);
    });
    const undo = (): void => {
      if (!snap) return;
      update((d) => {
        d.vetRecords.documents ??= [];
        d.vetRecords.documents.splice(Math.min(index, d.vetRecords.documents.length), 0, snap!);
      });
    };
    toast("Deleted", { label: "Undo", onClick: undo });
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
    let snap: WeightEntry | undefined;
    update((d) => {
      snap = d.weightLog?.[index] ? { ...d.weightLog[index] } : undefined;
      d.weightLog?.splice(index, 1);
      if (d.weightLog) syncProfileWeight(d.weightLog, d.profile);
    });
    const undo = (): void => {
      if (!snap) return;
      update((d) => {
        d.weightLog ??= [];
        d.weightLog.splice(Math.min(index, d.weightLog.length), 0, snap!);
        syncProfileWeight(d.weightLog, d.profile);
      });
    };
    toast("Deleted", { label: "Undo", onClick: undo });
  };

  const sortedVaccines = vaccines
    .map((v, index) => ({ v, index }))
    .sort((a, b) => new Date(b.v.date).getTime() - new Date(a.v.date).getTime());
  const sortedCheckups = checkups
    .map((c, index) => ({ c, index }))
    .sort((a, b) => new Date(b.c.date).getTime() - new Date(a.c.date).getTime());

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
                {c.hasFile &&
                  (c.fileData ? (
                    <button
                      type="button"
                      onClick={() => openCheckupFile(c)}
                      style={{
                        alignSelf: "flex-start",
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        cursor: "pointer",
                        textDecoration: "underline",
                        textAlign: "left",
                      }}
                    >
                      <Footnote color={HERO}>📎 {c.fileName}</Footnote>
                    </button>
                  ) : (
                    <Footnote color={MUTED}>📎 {c.fileName}</Footnote>
                  ))}
              </>
            }
            onEdit={() => onEditCheckup(index)}
            onDelete={() => del("checkups", index)}
          />
        ))
      )}
    </GroupCard>
  );

  const careList = db.careItems ?? [];
  const activeCare = careList.filter((c) => !c.archived);
  const nextCare = activeCare
    .filter((c) => c.nextDue)
    .sort((a, b) => (a.nextDue! < b.nextDue! ? -1 : a.nextDue! > b.nextDue! ? 1 : 0))[0];
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
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      <TopBar title={`${name}\u2019s Health`} />
      <div style={{ padding: "0 16px" }}>

      <CardStagger>
      {/* Overview — identity, notes & grooming as a grouped list */}
      <SectionLabel>Overview</SectionLabel>
      <GroupCard>
        <SettingsRow
          isFirst
          icon={Icons.idCard}
          iconBg={ACCENT.petid}
          label="Pet ID"
          subtitle={
            db.profile.microchip?.trim()
              ? documents.length > 0
                ? `Chip & ${documents.length} file${documents.length !== 1 ? "s" : ""}`
                : "Microchip on file"
              : "Add chip & docs"
          }
          onClick={() => setPetIdOpen(true)}
        />
        <SettingsRow
          icon={Icons.note}
          iconBg={ACCENT.notes}
          label="Vet notes"
          subtitle={
            noteItems.length === 0
              ? "No notes yet"
              : `${noteItems.filter((n) => !n.done).length} open · ${noteItems.length} total`
          }
          onClick={() => setNotesOpen(true)}
        />
        <SettingsRow
          icon={Icons.scissors}
          iconBg={ACCENT.bath}
          label="Grooming"
          subtitle={lastGroomingActivity ? `Last ${fmtDate(lastGroomingActivity)}` : "Not logged yet"}
          onClick={() => setGroomingOpen(true)}
        />
      </GroupCard>

      {/* Weight — chart widget */}
      <SectionLabel>Weight</SectionLabel>
        <button
          type="button"
          onClick={() => setWeightOpen(true)}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
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

      {/* Summary rows — each opens its full detail screen */}
      <SectionLabel>Health records</SectionLabel>
      <GroupCard>
        <SettingsRow
          isFirst
          icon={Icons.bell}
          iconBg={ACCENT.reminder}
          label="Reminders & meds"
          subtitle={
            nextCare
              ? `Next: ${nextCare.name}${nextCare.nextDue ? ` · ${fmtDate(nextCare.nextDue)}` : ""}`
              : activeCare.length > 0
                ? `${activeCare.length} active`
                : "Nothing scheduled"
          }
          onClick={() => setCareOpen(true)}
        />
        <SettingsRow
          icon={Icons.syringe}
          iconBg={ACCENT.vaccine}
          label="Vaccinations"
          subtitle={
            sortedVaccines.length === 0
              ? "None recorded"
              : `${sortedVaccines.length} recorded${
                  nextVaccineDue ? ` · next due ${fmtDate(nextVaccineDue)}` : ""
                }`
          }
          onClick={() => setDetail("vaccines")}
        />
        <SettingsRow
          icon={Icons.clipboardText}
          iconBg={ACCENT.checkup}
          label="Checkups"
          subtitle={sortedCheckups.length === 0 ? "None recorded" : `${sortedCheckups.length} recorded`}
          onClick={() => setDetail("checkups")}
        />
      </GroupCard>
      </CardStagger>

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

      <CareHub open={careOpen} onClose={() => setCareOpen(false)} />

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

      <GroomingHub open={groomingOpen} onClose={() => setGroomingOpen(false)} />

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
        avatar={db.profile.avatar}
        emoji={db.profile.emoji}
        name={db.profile.name}
        breed={db.profile.breed}
        birthday={db.profile.birthday ?? ""}
        vetName={db.profile.vet}
        vetPhone={db.profile.vetPhone}
        microchip={db.profile.microchip ?? ""}
        onMicrochip={setMicrochip}
        insuranceDoc={insuranceDoc}
        onOpenInsurance={() => insuranceDoc && openDocument(insuranceDoc)}
        onUploadInsurance={() => uploadDocument("insurance")}
        documents={documents}
        onOpenDocument={openDocument}
        onRenameDocument={(index) => setRenameIndex(index)}
        onDeleteDocument={(index) => void deleteDocument(index)}
        onAddDocument={() => uploadDocument("other")}
      />

      <FieldEditSheet
        open={renameIndex !== null}
        title="Document name"
        value={renameIndex !== null ? (documents[renameIndex]?.name ?? "") : ""}
        type="text"
        placeholder="e.g. Vaccination record"
        onSave={(v) => {
          if (renameIndex !== null) renameDocument(renameIndex, v);
          setRenameIndex(null);
        }}
        onClose={() => setRenameIndex(null)}
      />

      </div>
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
      title="Vet notes"
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

/** Pet ID detail screen: pet identity header, microchip & vet, and documents. */
function PetIdScreen({
  open,
  onClose,
  avatar,
  emoji,
  name,
  breed,
  birthday,
  vetName,
  vetPhone,
  microchip,
  onMicrochip,
  insuranceDoc,
  onOpenInsurance,
  onUploadInsurance,
  documents,
  onOpenDocument,
  onRenameDocument,
  onDeleteDocument,
  onAddDocument,
}: {
  open: boolean;
  onClose: () => void;
  avatar: Avatar | undefined;
  emoji: string;
  name: string;
  breed: string;
  birthday: string;
  vetName: string;
  vetPhone: string;
  microchip: string;
  onMicrochip: (v: string) => void;
  insuranceDoc: HealthDocument | undefined;
  onOpenInsurance: () => void;
  onUploadInsurance: () => void;
  documents: HealthDocument[];
  onOpenDocument: (doc: HealthDocument) => void;
  onRenameDocument: (index: number) => void;
  onDeleteDocument: (index: number) => void;
  onAddDocument: () => void;
}): React.ReactElement {
  const [microOpen, setMicroOpen] = useState(false);
  // Insurance is pinned as its own row, so list only the other documents.
  const otherDocs = documents
    .map((doc, index) => ({ doc, index }))
    .filter(({ doc }) => doc.kind !== "insurance");
  const title = [name.trim(), breed.trim()].filter(Boolean).join(", ");
  return (
    <HealthDetailScreen
      open={open}
      onClose={onClose}
      title="Pet ID"
      action={
        <button
          type="button"
          aria-label="Add a document"
          className="glass-btn"
          onClick={onAddDocument}
        >
          <Icon icon={Icons.plus} color="inherit" />
        </button>
      }
    >
      {/* Identity header: avatar, name + breed, birthday. */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "4px 24px 8px",
        }}
      >
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            overflow: "hidden",
            background: avatar?.bg ?? "var(--color-dash-pooped)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 6,
          }}
        >
          {avatar ? <DogFace avatar={avatar} size={72} /> : <span style={{ fontSize: 40 }}>{emoji || "🐕"}</span>}
        </span>
        <span style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 17, color: HERO, textAlign: "center" }}>
          {title || "Your pup"}
        </span>
        {birthday && (
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 17, color: MUTED }}>
            {formatBirthday(birthday)}
          </span>
        )}
      </div>

      <div className="wts-form wts-form--dark" style={{ margin: 0, paddingTop: 8 }}>
        <Group title="Vet details">
          <NavRow label="Microchip" value={microchip || "Add"} onClick={() => setMicroOpen(true)} />
          <NavRow label="Vet name" value={vetName.trim() || "—"} readOnly />
          <NavRow label="Vet phone" value={vetPhone.trim() || "—"} readOnly />
        </Group>
        <Group title="Documents">
          {insuranceDoc ? (
            <DocRow
              label={insuranceDoc.name}
              value={fmtDocSize(insuranceDoc.size)}
              onOpen={onOpenInsurance}
              onEdit={() => onRenameDocument(documents.indexOf(insuranceDoc))}
              onDelete={() => onDeleteDocument(documents.indexOf(insuranceDoc))}
            />
          ) : (
            <NavRow label="Insurance" value="Add insurance PDF" onClick={onUploadInsurance} />
          )}
          {otherDocs.map(({ doc, index }) => (
            <DocRow
              key={doc.created}
              label={doc.name}
              value={fmtDocSize(doc.size)}
              onOpen={() => onOpenDocument(doc)}
              onEdit={() => onRenameDocument(index)}
              onDelete={() => onDeleteDocument(index)}
            />
          ))}
        </Group>
      </div>

      <FieldEditSheet
        open={microOpen}
        title="Microchip"
        value={microchip}
        type="tel"
        placeholder="Add microchip number"
        onSave={(v) => {
          onMicrochip(v.trim());
          setMicroOpen(false);
        }}
        onClose={() => setMicroOpen(false)}
      />
    </HealthDetailScreen>
  );
}

/** A single grouped-list document row (wts style): tap to open, swipe to rename
    or delete. Used for both the pinned Insurance row and other documents. */
function DocRow({
  label,
  value,
  onOpen,
  onEdit,
  onDelete,
}: {
  label: string;
  value: string;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
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
      <NavRow label={label} value={value} onClick={onOpen} />
    </SwipeableRow>
  );
}

/** DD/MM/YYYY for a stored `YYYY-MM-DD` birthday, or the raw value / em dash. */
function formatBirthday(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value || "—";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/** Human-readable file size for a stored document. */
function fmtDocSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Small circular "add record" button shown in a detail screen's header. */
function AddRecordButton({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button type="button" aria-label="Add record" className="glass-btn" onClick={onClick}>
      <Icon icon={Icons.plus} color="inherit" />
    </button>
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
  const [addOpen, setAddOpen] = useState(false);

  // Reset the form each time the add sheet opens.
  useEffect(() => {
    if (!addOpen) return;
    setDate(today());
    setKg("");
    setNote("");
  }, [addOpen]);

  const submit = (): void => {
    if (!kg.trim()) return;
    onAdd(date, kg, note);
    setKg("");
    setNote("");
    setAddOpen(false);
  };

  return (
    <HealthDetailScreen
      open={open}
      onClose={onClose}
      title="Weight"
      subtitle={current !== undefined ? `Currently ${current} kg` : undefined}
      action={<AddRecordButton onClick={() => setAddOpen(true)} />}
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

      <MotionSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        ariaLabel="Log weight"
        scrimClassName="walk-sheet-scrim"
        scrimStyle={{ zIndex: 1300 }}
        sheetClassName="form-sheet vet-sheet"
        title="Log weight"
        confirmLabel="Log weight"
        onConfirm={submit}
        body={
          <div className="wts-form">
            <Group title="Entry">
              <DateRow label="Date" value={date} max={today()} onChange={setDate} />
              <NumberRow label="Weight" value={kg} onChange={setKg} suffix="kg" inputMode="decimal" />
            </Group>
            <Group title="Note">
              <NotesField value={note} onChange={setNote} placeholder="Anything worth remembering?" />
            </Group>
          </div>
        }
      />
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
