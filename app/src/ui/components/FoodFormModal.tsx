import { useEffect, useState, type CSSProperties } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Meal } from "../types";

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
}

const DARK = "var(--color-pawpal-page)"; // #352B25
const TYPES = ["Dry kibble", "Wet food", "Raw", "Treats", "Other"];

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
};

/**
 * "Log a meal" bottom sheet (new design).
 *
 * Orange sheet that slides up from the bottom, matching the Track-walk sheet:
 * dark outlined fields on the orange surface, wrapping type chips that invert to
 * a dark fill when selected, and a pinned dark "Save meal" action.
 */
export function FoodFormModal({ open, onClose }: FoodFormModalProps): React.ReactElement | null {
  const { update } = useDb();
  const toast = useToast();
  const [time, setTime] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setTime(nowTime());
    setType(TYPES[0]);
    setAmount("");
    setNotes("");
  }, [open]);

  if (!open) return null;

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
    <div className="walk-sheet-scrim" onClick={onClose}>
      <div
        className="walk-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Log a meal"
        onClick={(e) => e.stopPropagation()}
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
            Log a meal
          </p>

          <Field label="Time">
            <input
              className="wts-field"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={sheetFieldStyle}
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
          </Field>
        </div>

        <div className="walk-sheet-footer">
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
              color: "var(--color-track-poop)",
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Save meal
          </button>
        </div>
      </div>
    </div>
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
        color: selected ? "var(--color-track-poop)" : DARK,
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
