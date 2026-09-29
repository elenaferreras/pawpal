import { useEffect, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import { Group, TextRow, DateRow, NumberRow, SelectRow, ToggleRow, NotesField } from "./SheetForm";
import { today } from "../lib/date";
import { CARE_KINDS } from "../lib/care";
import type { CareCadence, CareCadenceUnit, CareItem, CareKind } from "../types";

/** Payload emitted when a care item is saved. */
export interface CareDraft {
  kind: CareKind;
  name: string;
  dose: string;
  cadence: CareCadence | null;
  nextDue: string;
  notes: string;
}

const KIND_OPTIONS: { value: CareKind; label: string }[] = (
  Object.keys(CARE_KINDS) as CareKind[]
).map((k) => ({ value: k, label: CARE_KINDS[k].label }));

const UNIT_OPTIONS: { value: CareCadenceUnit; label: string }[] = [
  { value: "day", label: "days" },
  { value: "week", label: "weeks" },
  { value: "month", label: "months" },
  { value: "year", label: "years" },
];

/**
 * "Add / edit care item" bottom sheet. Captures the kind, name, optional dose,
 * a repeat cadence (toggle off = one-off), the next-due date and a note.
 * `onSubmit` returns whether the draft was accepted; the sheet stays open when
 * it isn't (e.g. a missing name).
 */
export function LogCareSheet({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial?: CareItem;
  onSubmit: (draft: CareDraft) => boolean;
}): React.ReactElement {
  const todayIso = today();
  const [kind, setKind] = useState<CareKind>("medication");
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [repeats, setRepeats] = useState(false);
  const [every, setEvery] = useState("1");
  const [unit, setUnit] = useState<CareCadenceUnit>("month");
  const [nextDue, setNextDue] = useState(todayIso);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind(initial?.kind ?? "medication");
    setName(initial?.name ?? "");
    setDose(initial?.dose ?? "");
    setRepeats(!!initial?.cadence);
    setEvery(initial?.cadence ? String(initial.cadence.every) : "1");
    setUnit(initial?.cadence?.unit ?? "month");
    setNextDue(initial?.nextDue ?? todayIso);
    setNotes(initial?.notes ?? "");
  }, [open, initial, todayIso]);

  const submit = (): void => {
    const everyN = Math.max(1, Math.round(Number(every) || 1));
    const cadence: CareCadence | null = repeats ? { every: everyN, unit } : null;
    const ok = onSubmit({ kind, name: name.trim(), dose: dose.trim(), cadence, nextDue, notes: notes.trim() });
    if (ok) onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={initial ? "Edit care item" : "Add care item"}
      scrimClassName="walk-sheet-scrim"
      scrimStyle={{ zIndex: 1300 }}
      sheetClassName="form-sheet care-sheet"
      title={initial ? "Edit item" : "New item"}
      confirmLabel={initial ? "Save" : "Add"}
      onConfirm={submit}
      body={
        <div className="wts-form">
          <Group title="Details">
            <SelectRow
              label="Type"
              hideEmpty
              value={kind}
              onChange={(v) => setKind(v as CareKind)}
              placeholder="Type"
              options={KIND_OPTIONS}
            />
            <TextRow label="Name" value={name} onChange={setName} placeholder="Internal Deworming" />
            <TextRow label="Dose" value={dose} onChange={setDose} placeholder="1 tablet (optional)" />
          </Group>

          <Group title="Schedule">
            <ToggleRow label="Repeats" value={repeats} onChange={setRepeats} />
            {repeats && (
              <>
                <NumberRow label="Every" value={every} onChange={setEvery} inputMode="numeric" />
                <SelectRow
                  label="Unit"
                  hideEmpty
                  value={unit}
                  onChange={(v) => setUnit(v as CareCadenceUnit)}
                  placeholder="Unit"
                  options={UNIT_OPTIONS}
                />
              </>
            )}
            <DateRow label={repeats ? "Next due" : "Due"} value={nextDue} onChange={setNextDue} />
          </Group>

          <section className="wts-group">
            <h3 className="wts-group-title">Notes</h3>
            <div className="wts-group-card">
              <NotesField value={notes} onChange={setNotes} placeholder="Anything worth remembering…" />
            </div>
          </section>
        </div>
      }
    />
  );
}
