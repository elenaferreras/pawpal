import { useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { HealthDetailScreen } from "./HealthDetailScreen";
import { SwipeableRow } from "./SwipeableRow";
import { RevealItem } from "./Reveal";
import { Eyebrow, Headline, Footnote } from "./Typography";
import { Group, NavRow, ActionRow, DateRow, NotesField } from "./SheetForm";
import { MotionSheet } from "./MotionSheet";
import { LogCareSheet, type CareDraft } from "./LogCareSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "./ConfirmDialog";
import { Icons } from "../lib/icons";
import { today } from "../lib/date";
import {
  CARE_KINDS,
  addCadence,
  cadenceLabel,
  isOverdue,
  lastDone,
  relFuture,
  relPast,
} from "../lib/care";
import type { CareItem } from "../types";

const HERO = "var(--color-pawpal-hero)";
const MUTED = "var(--color-pawpal-muted)";
const SURFACE = "var(--color-dash-surface)";
const DARK = "var(--color-pawpal-page)";
const OVERDUE = "#E96A41";

type Tab = "active" | "completed";

function careId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `care_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function fullDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Recompute a recurring item's next due date from its latest logged entry. */
function recomputeNextDue(item: CareItem): void {
  if (!item.cadence || item.history.length === 0) return;
  const latest = item.history.map((h) => h.date).sort()[item.history.length - 1];
  item.nextDue = addCadence(latest, item.cadence);
}

/**
 * Unified care hub. One list of recurring health items (meds, vaccines,
 * treatments, reminders) split into Active / Completed tabs. The header + button
 * adds an item; tapping the circle logs it as done today (and reschedules the
 * next due date); tapping a card opens its detail screen with the full history.
 */
export function CareHub({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const todayIso = today();
  const [tab, setTab] = useState<Tab>("active");
  const [logOpen, setLogOpen] = useState(false);
  const [editItem, setEditItem] = useState<CareItem | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = db.careItems ?? [];
  const active = items
    .filter((it) => !it.archived)
    .sort((a, b) => {
      const ad = a.nextDue ?? "9999-12-31";
      const bd = b.nextDue ?? "9999-12-31";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    });
  const completed = items.filter((it) => it.archived);
  const shown = tab === "active" ? active : completed;
  const selected = selectedId ? items.find((it) => it.id === selectedId) : undefined;

  const complete = (item: CareItem): void => {
    update((d) => {
      const it = d.careItems?.find((x) => x.id === item.id);
      if (!it) return;
      it.history.push({ date: todayIso });
      if (it.cadence) it.nextDue = addCadence(todayIso, it.cadence);
      else {
        it.archived = true;
        it.nextDue = undefined;
      }
    });
    toast(item.cadence ? "Logged · next due updated" : "Logged · marked done");
  };

  const saveDraft = (draft: CareDraft): boolean => {
    if (!draft.name) {
      toast("Add a name");
      return false;
    }
    update((d) => {
      d.careItems ??= [];
      if (editItem) {
        const it = d.careItems.find((x) => x.id === editItem.id);
        if (it) {
          it.kind = draft.kind;
          it.name = draft.name;
          it.dose = draft.dose || undefined;
          it.cadence = draft.cadence;
          it.nextDue = draft.nextDue || undefined;
          it.notes = draft.notes || undefined;
        }
      } else {
        d.careItems.push({
          id: careId(),
          kind: draft.kind,
          name: draft.name,
          dose: draft.dose || undefined,
          notes: draft.notes || undefined,
          cadence: draft.cadence,
          nextDue: draft.nextDue || undefined,
          history: [],
          created: new Date().toISOString(),
        });
      }
    });
    toast(editItem ? "Saved" : "Added");
    return true;
  };

  const removeItem = async (item: CareItem): Promise<void> => {
    const ok = await confirm({
      title: "Delete this item?",
      message: "This care item and its history will be removed.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    let removedIndex = -1;
    let snap: CareItem | undefined;
    update((d) => {
      const i = d.careItems?.findIndex((x) => x.id === item.id) ?? -1;
      if (i >= 0) {
        removedIndex = i;
        snap = { ...d.careItems![i] };
        d.careItems?.splice(i, 1);
      }
    });
    setSelectedId(null);
    const undo = (): void => {
      if (!snap) return;
      update((d) => {
        d.careItems ??= [];
        d.careItems.splice(Math.min(removedIndex, d.careItems.length), 0, snap!);
      });
    };
    toast("Deleted", { label: "Undo", onClick: undo });
  };

  const setArchived = (item: CareItem, archived: boolean): void => {
    update((d) => {
      const it = d.careItems?.find((x) => x.id === item.id);
      if (it) it.archived = archived;
    });
    toast(archived ? "Marked finished" : "Restored");
  };

  const removeLog = (item: CareItem, logIndex: number): void => {
    update((d) => {
      const it = d.careItems?.find((x) => x.id === item.id);
      it?.history.splice(logIndex, 1);
      if (it) recomputeNextDue(it);
    });
    toast("Entry removed");
  };

  const logAt = (item: CareItem, date: string, note: string): void => {
    update((d) => {
      const it = d.careItems?.find((x) => x.id === item.id);
      if (!it) return;
      it.history.push({ date, note: note || undefined });
      recomputeNextDue(it);
    });
    toast("Logged");
  };

  const editLog = (item: CareItem, logIndex: number, date: string, note: string): void => {
    update((d) => {
      const it = d.careItems?.find((x) => x.id === item.id);
      const entry = it?.history[logIndex];
      if (!it || !entry) return;
      entry.date = date;
      entry.note = note || undefined;
      recomputeNextDue(it);
    });
    toast("Updated");
  };

  const openEdit = (item: CareItem): void => {
    setEditItem(item);
    setLogOpen(true);
  };

  const renderCard = (item: CareItem, i: number): React.ReactElement => {
    const meta = CARE_KINDS[item.kind];
    const done = lastDone(item);
    const overdue = isOverdue(item, todayIso);
    const hero = done ? relPast(done, todayIso) : item.nextDue ? "Not yet given" : "No history";
    const dueLine = item.nextDue
      ? overdue
        ? "Overdue"
        : `Due ${relFuture(item.nextDue, todayIso)}`
      : undefined;

    return (
      <RevealItem key={item.id} index={i}>
        <button
          type="button"
          onClick={() => setSelectedId(item.id)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: 16,
            background: SURFACE,
            border: "none",
            borderRadius: 24,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: 14,
              background: meta.accent,
              color: DARK,
              flexShrink: 0,
            }}
          >
            <Icon icon={Icons[meta.icon]} color="inherit" />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
            <Headline color={HERO}>{item.name}</Headline>
            <Footnote color={MUTED}>
              {cadenceLabel(item.cadence)}
              {item.dose ? ` · ${item.dose}` : ""}
            </Footnote>
            <Footnote color={overdue ? OVERDUE : MUTED}>
              {tab === "completed" ? (done ? `Last given ${fullDate(done)}` : "Finished") : dueLine ?? hero}
            </Footnote>
          </div>
        </button>
      </RevealItem>
    );
  };

  return (
    <>
      <HealthDetailScreen
        open={open}
        onClose={onClose}
        title="Reminders & meds"
        subtitle="Medications, vaccines & treatments"
        action={
          <button
            type="button"
            aria-label="Add care item"
            className="glass-btn"
            onClick={() => {
              setEditItem(undefined);
              setLogOpen(true);
            }}
          >
            <Icon icon={Icons.plus} color="inherit" />
          </button>
        }
      >
        <div className="groom-tabs" role="tablist" aria-label="Care items">
          {(["active", "completed"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`groom-tab${tab === t ? " groom-tab--on" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "active" ? "Active" : "Completed"}
            </button>
          ))}
        </div>

        {shown.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 40 }}>
            <Icon icon={Icons.pill} size="lg" color="disabled" />
            <Footnote color={MUTED}>
              {tab === "active" ? "Nothing scheduled — tap + to add." : "No finished items yet."}
            </Footnote>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((item, i) => renderCard(item, i))}
          </div>
        )}
      </HealthDetailScreen>

      {selected && (
        <CareDetail
          item={selected}
          todayIso={todayIso}
          onClose={() => setSelectedId(null)}
          onComplete={() => complete(selected)}
          onEdit={() => openEdit(selected)}
          onDelete={() => void removeItem(selected)}
          onArchive={(v) => setArchived(selected, v)}
          onRemoveLog={(idx) => removeLog(selected, idx)}
          onLog={(date, note) => logAt(selected, date, note)}
          onEditLog={(idx, date, note) => editLog(selected, idx, date, note)}
        />
      )}

      <LogCareSheet
        open={logOpen}
        initial={editItem}
        onClose={() => {
          setLogOpen(false);
          setEditItem(undefined);
        }}
        onSubmit={saveDraft}
      />
    </>
  );
}

/** Detail screen for a single care item: summary, actions and full history. */
function CareDetail({
  item,
  todayIso,
  onClose,
  onComplete,
  onEdit,
  onDelete,
  onArchive,
  onRemoveLog,
  onLog,
  onEditLog,
}: {
  item: CareItem;
  todayIso: string;
  onClose: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: (archived: boolean) => void;
  onRemoveLog: (logIndex: number) => void;
  onLog: (date: string, note: string) => void;
  onEditLog: (logIndex: number, date: string, note: string) => void;
}): React.ReactElement {
  const meta = CARE_KINDS[item.kind];
  const overdue = isOverdue(item, todayIso);
  const history = item.history
    .map((h, index) => ({ ...h, index }))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  // Log/edit-history sheet: `index === null` adds a new entry, otherwise edits.
  const [logEntry, setLogEntry] = useState<{ index: number | null } | null>(null);
  const [logDate, setLogDate] = useState(todayIso);
  const [logNote, setLogNote] = useState("");

  const openAddLog = (): void => {
    setLogDate(todayIso);
    setLogNote("");
    setLogEntry({ index: null });
  };
  const openEditLog = (index: number, date: string, note: string): void => {
    setLogDate(date);
    setLogNote(note);
    setLogEntry({ index });
  };
  const submitLog = (): void => {
    if (!logEntry) return;
    if (logEntry.index === null) onLog(logDate, logNote.trim());
    else onEditLog(logEntry.index, logDate, logNote.trim());
    setLogEntry(null);
  };

  const last = lastDone(item);
  const nextDue = item.nextDue;
  const statusWord = item.archived ? "Finished" : overdue ? "Overdue" : nextDue ? "On track" : "No schedule";
  const statusDetail = item.archived
    ? last
      ? `Last done ${fullDate(last)}`
      : "No longer tracked"
    : overdue && nextDue
      ? `Was due ${fullDate(nextDue)} · ${relPast(nextDue, todayIso)}`
      : nextDue
        ? `Next due ${fullDate(nextDue)} · ${relFuture(nextDue, todayIso)}`
        : "One-off reminder";
  const statusColor = overdue ? OVERDUE : MUTED;

  return (
    <HealthDetailScreen
      open
      onClose={onClose}
      title={item.name}
      subtitle={cadenceLabel(item.cadence)}
      action={
        <button type="button" aria-label="Edit" className="glass-btn glass-btn--health" onClick={onEdit}>
          <Icon icon={Icons.pencilSimple} color="inherit" />
        </button>
      }
    >
      {/* Status summary */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: 18,
          background: SURFACE,
          borderRadius: 24,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 16,
            background: meta.accent,
            color: DARK,
            flexShrink: 0,
          }}
        >
          <Icon icon={Icons[meta.icon]} color="inherit" />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
          <Headline color={HERO}>{statusWord}</Headline>
          <Footnote color={statusColor}>{statusDetail}</Footnote>
          {item.notes && <Footnote color={MUTED}>{item.notes}</Footnote>}
        </div>
      </div>

      {/* Primary action */}
      {!item.archived && (
        <button
          type="button"
          onClick={() => (item.cadence ? openAddLog() : onComplete())}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            width: "100%",
            marginTop: 14,
            padding: "14px 16px",
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            background: HERO,
            color: DARK,
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          <Icon icon={Icons.check} color="inherit" />
          {item.cadence ? "Log now" : "Mark done"}
        </button>
      )}

      {/* Details */}
      <div className="wts-form wts-form--dark" style={{ margin: 0, paddingTop: 18 }}>
        <Group title="Details">
          <NavRow label="Schedule" value={cadenceLabel(item.cadence)} readOnly />
          {item.dose && <NavRow label="Dose" value={item.dose} readOnly />}
          <NavRow
            label="Last done"
            value={last ? `${fullDate(last)} · ${relPast(last, todayIso)}` : "Never"}
            readOnly
          />
        </Group>
      </div>

      <Eyebrow style={{ display: "block", margin: "24px 4px 10px" }}>History</Eyebrow>

      {history.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 32 }}>
          <Icon icon={Icons.clipboardText} size="lg" color="disabled" />
          <Footnote color={MUTED}>Nothing logged yet.</Footnote>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {history.map((h, i) => (
            <RevealItem key={`${h.date}-${h.index}`} index={i}>
              <SwipeableRow
                background={SURFACE}
                style={{ borderRadius: 20 }}
                actions={[
                  {
                    label: "Edit",
                    color: "#5B6EE1",
                    icon: <Icon icon={Icons.pencilSimple} color="inherit" />,
                    onAction: () => openEditLog(h.index, h.date, h.note ?? ""),
                  },
                  {
                    label: "Delete",
                    color: "#ff3b30",
                    icon: <Icon icon={Icons.trash} color="inherit" />,
                    onAction: () => onRemoveLog(h.index),
                  },
                ]}
              >
                <button
                  type="button"
                  onClick={() => openEditLog(h.index, h.date, h.note ?? "")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    padding: 14,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: meta.accent,
                      color: DARK,
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={Icons.check} color="inherit" />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                    <Headline color={HERO}>{fullDate(h.date)}</Headline>
                    <Footnote color={MUTED}>{relPast(h.date, todayIso)}</Footnote>
                    {h.note && <Footnote color={MUTED}>{h.note}</Footnote>}
                  </div>
                </button>
              </SwipeableRow>
            </RevealItem>
          ))}
        </div>
      )}

      {/* Manage */}
      <div className="wts-form wts-form--dark" style={{ margin: 0, paddingTop: 24 }}>
        <Group title="Manage">
          <ActionRow
            label={item.archived ? "Restore tracking" : "Finish tracking"}
            danger={false}
            onClick={() => onArchive(!item.archived)}
          />
          <ActionRow label="Delete item" onClick={onDelete} />
        </Group>
      </div>

      <MotionSheet
        open={logEntry != null}
        onClose={() => setLogEntry(null)}
        ariaLabel={logEntry?.index == null ? "Log entry" : "Edit entry"}
        scrimClassName="walk-sheet-scrim"
        scrimStyle={{ zIndex: 1300 }}
        sheetClassName="form-sheet vet-sheet"
        title={logEntry?.index == null ? "Log entry" : "Edit entry"}
        confirmLabel="Save"
        onConfirm={submitLog}
        body={
          <div className="wts-form">
            <Group title="Entry">
              <DateRow label="Date" value={logDate} max={todayIso} onChange={setLogDate} />
            </Group>
            <Group title="Note">
              <NotesField value={logNote} onChange={setLogNote} placeholder="Anything worth remembering?" />
            </Group>
          </div>
        }
      />
    </HealthDetailScreen>
  );
}
