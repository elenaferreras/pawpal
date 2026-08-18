import { useEffect, useMemo, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { nowTime } from "../lib/date";
import type { Database, Walk } from "../types";

interface WalkTrackSheetProps {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet edits this existing walk instead of adding a new one. */
  editIndex?: number | null;
}

const DARK = "var(--color-pawpal-page)"; // #352B25
const WALK = "#8592E0"; // blue walk accent
const DAYS_SHOWN = 5;

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Track walk" bottom sheet (Figma node 31:925).
 *
 * Orange sheet that slides up when logging a walk in the new design. Dark fields
 * on the orange surface; selected toggles invert to a dark fill with a check.
 */
export function WalkTrackSheet({ open, onClose, editIndex }: WalkTrackSheetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();

  const editWalk =
    editIndex != null && editIndex >= 0 && editIndex < db.walks.length ? db.walks[editIndex] : null;

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const base = Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (DAYS_SHOWN - 1 - i));
      return d;
    });
    // When editing an older walk, make sure its date is selectable.
    if (editWalk?.date && !base.some((d) => localISO(d) === editWalk.date)) {
      base.unshift(new Date(editWalk.date + "T12:00:00"));
    }
    return base;
  }, [editWalk?.date]);

  const [dateISO, setDateISO] = useState(localISO(new Date()));
  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState("");
  const [distance, setDistance] = useState("");
  const [pooped, setPooped] = useState(false);
  const [socialised, setSocialised] = useState(false);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sendToVet, setSendToVet] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editWalk) {
      setDateISO(editWalk.date || localISO(new Date()));
      setDuration(String(editWalk.duration ?? ""));
      setSteps(String(editWalk.steps ?? ""));
      setDistance(String(editWalk.distance ?? ""));
      setPooped(!!editWalk.popo);
      setSocialised(!!editWalk.friends);
      setAssignee(editWalk.assignee ?? null);
      setNotes(editWalk.notes ?? "");
      setSendToVet(!!editWalk.sentToVet);
    } else {
      setDateISO(localISO(new Date()));
      setDuration("");
      setSteps("");
      setDistance("");
      setPooped(false);
      setSocialised(false);
      setAssignee(null);
      setNotes("");
      setSendToVet(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  const save = (): void => {
    const trimmedNotes = notes.trim();
    // Keep a linked "Notes for the vet" checklist item in sync with this walk's
    // note: create it when the toggle is on, update its text when the note
    // changes, and remove it when the toggle is turned off or the note cleared.
    const syncVetNote = (d: Database, walkCreated: string): void => {
      const items = (d.vetRecords.noteItems ??= []);
      const idx = items.findIndex((n) => n.source === walkCreated);
      if (sendToVet && trimmedNotes) {
        const stamp = new Date(dateISO + "T12:00:00").toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        });
        const text = `${stamp} (walk): ${trimmedNotes}`;
        if (idx >= 0) items[idx].text = text;
        else items.push({ text, done: false, source: walkCreated });
      } else if (idx >= 0) {
        items.splice(idx, 1);
      }
    };
    if (editWalk && editIndex != null) {
      update((d) => {
        const existing = d.walks[editIndex];
        if (!existing) return;
        d.walks[editIndex] = {
          ...existing,
          date: dateISO,
          duration: duration.trim(),
          steps: steps.trim(),
          distance: distance.trim(),
          popo: pooped,
          friends: socialised,
          assignee: assignee ?? undefined,
          notes: notes.trim(),
          sentToVet: sendToVet && trimmedNotes !== "",
        };
        syncVetNote(d, existing.created);
      });
      toast("Walk updated! 🦮");
      onClose();
      return;
    }
    const walk: Walk = {
      date: dateISO,
      time: nowTime(),
      duration: duration.trim(),
      steps: steps.trim(),
      distance: distance.trim(),
      pipi: false,
      popo: pooped,
      friends: socialised,
      weather: "",
      notes: notes.trim(),
      assignee: assignee ?? undefined,
      sentToVet: sendToVet && trimmedNotes !== "",
      created: new Date().toISOString(),
    };
    update((d) => {
      d.walks.push(walk);
      syncVetNote(d, walk.created);
    });
    toast("Walk saved! 🦮");
    onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel="Track walk"
      scrimClassName="walk-sheet-scrim"
      sheetClassName="walk-sheet"
    >
      <div className="walk-sheet-body">
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 32,
            color: DARK,
          }}
        >
          {editWalk ? "Edit walk" : "Track walk"}
        </p>

        {/* Date picker */}
        <Field label="Date">
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: 6,
              borderRadius: 16,
              background: DARK,
              overflow: "hidden",
            }}
          >
            {days.map((d) => {
              const iso = localISO(d);
              const active = iso === dateISO;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setDateISO(iso)}
                  aria-pressed={active}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "8px 2px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-ui)",
                    fontWeight: 500,
                    fontSize: 14,
                    whiteSpace: "nowrap",
                    background: active ? WALK : "transparent",
                    color: active ? DARK : WALK,
                  }}
                >
                  {d.toLocaleDateString(undefined, { day: "2-digit", month: "short" })}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Duration">
          <SheetInput value={duration} onChange={setDuration} placeholder="40 minutes" inputMode="numeric" />
        </Field>

        <Field label="Steps">
          <SheetInput value={steps} onChange={setSteps} placeholder="12000 steps" inputMode="numeric" />
        </Field>

        <Field label="Distance (km)">
          <SheetInput value={distance} onChange={setDistance} placeholder="2.5 km" inputMode="decimal" />
        </Field>

        <Field label="Extras">
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceButton label="Pooped" selected={pooped} onClick={() => setPooped((v) => !v)} />
            <ChoiceButton label="Socialised" selected={socialised} onClick={() => setSocialised((v) => !v)} />
          </div>
        </Field>

        <Field label="Assignee">
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceButton
              label="Person A"
              selected={assignee === "Person A"}
              onClick={() => setAssignee((v) => (v === "Person A" ? null : "Person A"))}
            />
            <ChoiceButton
              label="Person B"
              selected={assignee === "Person B"}
              onClick={() => setAssignee((v) => (v === "Person B" ? null : "Person B"))}
            />
          </div>
        </Field>

        <Field label="Notes">
          <SheetTextarea value={notes} onChange={setNotes} placeholder="Anything worth remembering?" />
          {notes.trim() !== "" && (
            <ChoiceButton
              label="Send note to vet"
              selected={sendToVet}
              onClick={() => setSendToVet((v) => !v)}
            />
          )}
        </Field>

        </div>

        <div className="walk-sheet-footer">
          <button
            type="button"
            onClick={save}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: 16,
              border: "none",
              cursor: "pointer",
              background: DARK,
              color: WALK,
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {editWalk ? "Save changes" : "Save walk"}
          </button>
        </div>
    </MotionSheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 16, color: DARK }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function SheetInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: "numeric" | "decimal";
}): React.ReactElement {
  return (
    <input
      className="wts-field"
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: 16,
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        background: "transparent",
        color: DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
        outline: "none",
      }}
    />
  );
}

function SheetTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}): React.ReactElement {
  return (
    <textarea
      className="wts-field"
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: 16,
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        background: "transparent",
        color: DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
        outline: "none",
        resize: "vertical",
      }}
    />
  );
}

function ChoiceButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "14px 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        cursor: "pointer",
        background: selected ? DARK : "transparent",
        color: selected ? WALK : DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
      }}
    >
      <span>{label}</span>
      {selected && <Icon icon={Icons.checkCircle} color="inherit" />}
    </button>
  );
}
