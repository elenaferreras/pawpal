import { useEffect, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import { Group, TimeRow, NumberRow, SelectRow, NotesField } from "./SheetForm";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Meal } from "../types";

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
}

const TYPES = ["Dry kibble", "Wet food", "Raw", "Treats", "Other"];

/**
 * "Log a meal" bottom sheet — iOS grouped-list form on the meals (orange) glass
 * surface. Time + amount + type in one card, an optional note below.
 */
export function FoodFormModal({ open, onClose }: FoodFormModalProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const [time, setTime] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    // Carry the last meal's amount + type forward so repeat feedings are one tap.
    const last = db.meals
      .filter((m) => m.created)
      .sort((a, b) => (b.created || "").localeCompare(a.created || ""))[0];
    setTime(nowTime());
    setType(last?.type || TYPES[0]);
    setAmount(last?.amount ? String(last.amount) : "");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = (): void => {
    if (!amount) {
      toast("Enter an amount");
      return;
    }
    const meal: Meal = {
      date: new Date().toISOString().split("T")[0],
      time,
      type,
      amount: parseInt(amount) || 0,
      notes,
      created: new Date().toISOString(),
    };
    update((d) => {
      d.meals.push(meal);
    });
    toast("Meal logged! 🍖");
    onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel="Log a meal"
      scrimClassName="walk-sheet-scrim"
      sheetClassName="form-sheet meal-sheet"
      title="Log a meal"
      confirmLabel="Save meal"
      onConfirm={save}
      body={
        <div className="wts-form">
          <Group title="Meal">
            <TimeRow label="Time" value={time} onChange={setTime} />
            <NumberRow label="Amount" value={amount} onChange={setAmount} suffix="g" inputMode="numeric" />
            <SelectRow
              label="Type"
              hideEmpty
              value={type}
              onChange={setType}
              placeholder="Type"
              options={TYPES.map((t) => ({ value: t, label: t }))}
            />
          </Group>

          <section className="wts-group">
            <h3 className="wts-group-title">Notes</h3>
            <div className="wts-group-card">
              <NotesField value={notes} onChange={setNotes} placeholder="Optional" />
            </div>
          </section>
        </div>
      }
    />
  );
}
