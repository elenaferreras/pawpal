import { useEffect, useMemo, useState } from "react";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { nowTime } from "../lib/date";
import type { Walk } from "../types";

interface WalkTrackSheetProps {
  open: boolean;
  onClose: () => void;
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
export function WalkTrackSheet({ open, onClose }: WalkTrackSheetProps): React.ReactElement | null {
  const { update } = useDb();
  const toast = useToast();

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Array.from({ length: DAYS_SHOWN }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (DAYS_SHOWN - 1 - i));
      return d;
    });
  }, []);

  const [dateISO, setDateISO] = useState(localISO(new Date()));
  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState("");
  const [distance, setDistance] = useState("");
  const [pooped, setPooped] = useState(false);
  const [socialised, setSocialised] = useState(false);
  const [assignee, setAssignee] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDateISO(localISO(new Date()));
    setDuration("");
    setSteps("");
    setDistance("");
    setPooped(false);
    setSocialised(false);
    setAssignee(null);
  }, [open]);

  if (!open) return null;

  const save = (): void => {
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
      notes: "",
      assignee: assignee ?? undefined,
      created: new Date().toISOString(),
    };
    update((d) => {
      d.walks.push(walk);
    });
    toast("Walk saved! 🦮");
    onClose();
  };

  return (
    <div className="walk-sheet-scrim" onClick={onClose}>
      <div className="walk-sheet" role="dialog" aria-modal="true" aria-label="Track walk" onClick={(e) => e.stopPropagation()}>
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
          Track walk
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
            Save walk
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
