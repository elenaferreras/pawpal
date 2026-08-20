import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { MotionSheet } from "./MotionSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Database, Meal } from "../types";

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
}

const DARK = "var(--color-pawpal-page)"; // #352B25
const FOOD = "var(--color-food)"; // #E96A41 meals accent
const TYPES = ["Dry kibble", "Wet food", "Raw", "Treats", "Other"];

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const sheetFieldStyle: CSSProperties = {
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
  boxSizing: "border-box",
  minWidth: 0,
  maxWidth: "100%",
};

/**
 * "Log a meal" bottom sheet (new design).
 *
 * Red meals-accent sheet that slides up from the bottom, matching the Track-walk
 * sheet: dark outlined fields on the accent surface, wrapping type chips that
 * invert to a dark fill when selected, and a pinned dark "Save meal" action.
 */
export function FoodFormModal({ open, onClose }: FoodFormModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [dateISO, setDateISO] = useState(localISO(new Date()));
  const [time, setTime] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [sendToVet, setSendToVet] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDateISO(localISO(new Date()));
    setTime(nowTime());
    setType(TYPES[0]);
    setAmount("");
    setNotes("");
    setSendToVet(false);
  }, [open]);

  const save = (): void => {
    if (!amount) {
      toast("Enter an amount");
      return;
    }
    const trimmedNotes = notes.trim();
    const created = new Date().toISOString();
    const meal: Meal = {
      date: dateISO,
      time,
      type,
      amount: parseInt(amount) || 0,
      notes: trimmedNotes,
      sentToVet: sendToVet && trimmedNotes !== "",
      created,
    };
    // Keep a linked "Notes for the vet" checklist item in sync with this meal's
    // note: create it when the toggle is on and the note is non-empty.
    const syncVetNote = (d: Database): void => {
      const items = (d.vetRecords.noteItems ??= []);
      const idx = items.findIndex((n) => n.source === created);
      if (sendToVet && trimmedNotes) {
        const stamp = new Date(dateISO + "T12:00:00").toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
        });
        const text = `${stamp} (meal): ${trimmedNotes}`;
        if (idx >= 0) items[idx].text = text;
        else items.push({ text, done: false, source: created });
      } else if (idx >= 0) {
        items.splice(idx, 1);
      }
    };
    update((d) => {
      d.meals.push(meal);
      syncVetNote(d);
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
      sheetClassName="meal-sheet"
      title="Log a meal"
      body={
        <>
        <Field label="Date">
          <input
            className="wts-field"
            type="date"
            value={dateISO}
            max={localISO(new Date())}
            onChange={(e) => setDateISO(e.target.value)}
            style={{ ...sheetFieldStyle, colorScheme: "light" }}
          />
        </Field>

        <Field label="Time">
          <input
            className="wts-field"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            style={{ ...sheetFieldStyle, colorScheme: "light" }}
          />
        </Field>

        <Field label="Amount (g)">
          <input
            className="wts-field"
            value={amount}
            placeholder="120 g"
            inputMode="numeric"
            onChange={(e) => setAmount(e.target.value)}
            style={sheetFieldStyle}
          />
        </Field>

        <Field label="Type">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TYPES.map((t) => (
              <ChoiceChip key={t} label={t} selected={type === t} onClick={() => setType(t)} />
            ))}
          </div>
        </Field>

        <Field label="Notes">
          <textarea
            className="wts-field"
            value={notes}
            placeholder="Optional"
            rows={3}
            onChange={(e) => setNotes(e.target.value)}
            style={{ ...sheetFieldStyle, resize: "none" }}
          />
          {notes.trim() !== "" && (
            <ChoiceChip
              label="Send note to vet"
              selected={sendToVet}
              onClick={() => setSendToVet((v) => !v)}
            />
          )}
        </Field>
        </>
      }
      footer={
        <button
          type="button"
          onClick={save}
          style={{
            width: "100%",
            padding: 16,
            borderRadius: 16,
            border: "none",
            cursor: "pointer",
            background: DARK,
            color: FOOD,
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          Save meal
        </button>
      }
    />
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

function ChoiceChip({
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
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "12px 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        cursor: "pointer",
        background: selected ? DARK : "transparent",
        color: selected ? FOOD : DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
      }}
    >
      <span>{label}</span>
      {selected && <Icon icon={Icons.checkCircle} color="inherit" size="sm" />}
    </button>
  );
}
