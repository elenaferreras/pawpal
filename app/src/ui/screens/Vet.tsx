import type { CSSProperties, ReactNode } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { SwipeableRow } from "../components/SwipeableRow";
import { RevealItem } from "../components/Reveal";
import { PageTitle, Eyebrow, Headline, Footnote } from "../components/Typography";
import { Icons } from "../lib/icons";
import { fmtDate } from "../lib/date";
import type { Priority, VetNote } from "../types";

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
} as const;

const PRIORITY_COLOR: Record<Priority, string> = {
  High: "#E96A41",
  Medium: "#F2B84B",
  Low: "#9DBA9C",
};

interface VetProps {
  onAdd: () => void;
  onEditReminder: (index: number) => void;
}

type Collection = "checkups" | "vaccines" | "reminders" | "medications";

export function Vet({ onAdd, onEditReminder }: VetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const { checkups, vaccines, reminders, medications } = db.vetRecords;
  const name = db.profile.name.trim() || "Zipi";

  const noteItems = db.vetRecords.noteItems ?? [];
  const [draft, setDraft] = useState("");

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

  const sortedReminders = reminders
    .map((r, index) => ({ r, index }))
    .sort((a, b) => new Date(a.r.date).getTime() - new Date(b.r.date).getTime());
  const sortedVaccines = vaccines
    .map((v, index) => ({ v, index }))
    .sort((a, b) => new Date(b.v.date).getTime() - new Date(a.v.date).getTime());
  const sortedCheckups = checkups
    .map((c, index) => ({ c, index }))
    .sort((a, b) => new Date(b.c.date).getTime() - new Date(a.c.date).getTime());

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        padding:
          "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Header — title + add button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PageTitle style={{ margin: "4px 0 0" }}>{name}&rsquo;s Health</PageTitle>
          <Eyebrow style={{ padding: "6px 0 0", color: MUTED }}>Checkups, vaccines &amp; meds</Eyebrow>
        </div>
        <button
          type="button"
          aria-label="Add record"
          onClick={onAdd}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            flexShrink: 0,
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
      </div>

      {/* Notes for the vet — a checklist of topics to discuss, matching the home card */}
      <div style={{ marginTop: 20, borderRadius: 32, overflow: "hidden", background: HERO }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--color-dash-pooped)",
            padding: "16px 24px",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontWeight: 700,
              fontSize: 18,
              color: DARK,
            }}
          >
            Notes for the vet
          </span>
          {noteItems.length > 0 && (
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 700,
                fontSize: 12,
                color: DARK,
                opacity: 0.7,
              }}
            >
              {noteItems.filter((n) => !n.done).length} open
            </span>
          )}
        </div>

        <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
          {noteItems.length === 0 && (
            <Footnote color={DARK} style={{ opacity: 0.55, padding: "4px 8px" }}>
              Add topics to raise at your next visit, then tick them off as you discuss them.
            </Footnote>
          )}

          {noteItems.map((item, index) => (
            <NoteRow
              key={index}
              item={item}
              onToggle={() => toggleNote(index)}
              onEdit={(text) => editNote(index, text)}
              onDelete={() => deleteNote(index)}
            />
          ))}

          {/* Add a new topic */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              borderRadius: 16,
              color: DARK,
              border: "1.5px dashed rgba(53, 43, 37, 0.35)",
            }}
          >
            <Icon icon={Icons.plusCircle} color="inherit" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNote();
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
                color: DARK,
              }}
            />
            {draft.trim() && (
              <button
                type="button"
                aria-label="Add topic"
                onClick={addNote}
                style={{
                  border: "none",
                  cursor: "pointer",
                  background: DARK,
                  color: HERO,
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
        </div>
      </div>

      {/* Reminders */}
      <SectionLabel>Reminders</SectionLabel>
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

      {/* Medications */}
      <SectionLabel>Medications</SectionLabel>
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

      {/* Vaccinations */}
      <SectionLabel>Vaccinations</SectionLabel>
      <GroupCard>
        {sortedVaccines.length === 0 ? (
          <Empty icon={Icons.syringe} text="No vaccinations recorded." />
        ) : (
          sortedVaccines.map(({ v, index }, i) => (
            <RecordRow
              key={index}
              index={i}
              icon={Icons.syringe}
              accent={ACCENT.vaccine}
              isFirst={i === 0}
              title={v.name}
              meta={`${v.date ? `Given ${fmtDate(v.date)}` : ""}${
                v.nextDue ? ` · Next: ${fmtDate(v.nextDue)}` : ""
              }`}
              onDelete={() => del("vaccines", index)}
            />
          ))
        )}
      </GroupCard>

      {/* Checkups */}
      <SectionLabel>Checkups</SectionLabel>
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
    </div>
  );
}

/** Uppercase muted section label — matches settings/dashboard eyebrows. */
function SectionLabel({ children }: { children: ReactNode }): React.ReactElement {
  return <Eyebrow style={{ display: "block", margin: "24px 4px 8px" }}>{children}</Eyebrow>;
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
