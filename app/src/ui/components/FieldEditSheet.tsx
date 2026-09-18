import { useEffect, useRef, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import { SelectRow } from "./SheetForm";

export type FieldEditType = "text" | "number" | "decimal" | "tel" | "date";

// Sentinel select value that reveals the free-text "other" row.
const OTHER = "__other__";

interface FieldEditSheetProps {
  open: boolean;
  /** Toolbar + input label (e.g. "Name"). */
  title: string;
  /** Current value shown in the field when the sheet opens. */
  value: string;
  type?: FieldEditType;
  /** Suffix shown inside the field, e.g. "kg" or "g / day". */
  unit?: string;
  placeholder?: string;
  /** When set, the field is a native select of these options plus an "Other…"
      free-text fallback (mirrors the onboarding breed picker). */
  options?: string[];
  onSave: (value: string) => void;
  onClose: () => void;
}

/**
 * Bottom sheet for editing a single profile field (Figma node 223:2507).
 *
 * Cream sheet with a grabber and a toolbar: a dark X on the left to dismiss, the
 * field name centred, and a yellow check on the right to confirm. The body holds
 * a single grouped-list row whose value is edited inline (focused on open). When
 * `options` is given it becomes a select with an "Other…" free-text fallback.
 */
export function FieldEditSheet({
  open,
  title,
  value,
  type = "text",
  unit,
  placeholder,
  options,
  onSave,
  onClose,
}: FieldEditSheetProps): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const [otherActive, setOtherActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const otherRef = useRef<HTMLInputElement>(null);
  const selectMode = options != null;

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    const custom = selectMode && value !== "" && !options!.includes(value);
    setOtherActive(custom);
    // Focus the right control so the correct keyboard/picker pops with the
    // sheet. A plain select waits for a tap, so only focus text inputs.
    const raf = requestAnimationFrame(() => {
      if (selectMode) {
        if (custom) otherRef.current?.focus();
        return;
      }
      const el = inputRef.current;
      el?.focus();
      if (type === "date") {
        try {
          (el as (HTMLInputElement & { showPicker?: () => void }) | null)?.showPicker?.();
        } catch {
          // showPicker can require a user gesture in some browsers — tapping the
          // field still opens the picker in that case.
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open, value, type, selectMode, options]);

  useEffect(() => {
    if (otherActive) otherRef.current?.focus();
  }, [otherActive]);

  const confirm = (): void => onSave(draft.trim());

  const handleSelect = (v: string): void => {
    if (v === OTHER) {
      setOtherActive(true);
      if (options!.includes(draft)) setDraft("");
    } else {
      setOtherActive(false);
      setDraft(v);
    }
  };

  // Map each field to the right input control + on-screen keyboard.
  const inputType = type === "date" ? "date" : type === "tel" ? "tel" : "text";
  const inputMode: React.HTMLAttributes<HTMLInputElement>["inputMode"] =
    type === "number"
      ? "numeric"
      : type === "decimal"
        ? "decimal"
        : type === "tel"
          ? "tel"
          : undefined;

  const selectValue = otherActive ? OTHER : options?.includes(draft) ? draft : "";

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={title}
      scrimClassName="walk-sheet-scrim"
      sheetClassName="form-sheet field-sheet"
      title={title}
      confirmLabel="Save"
      onConfirm={confirm}
      body={
        <div className="wts-form" style={{ margin: 0 }}>
          <div className="wts-group">
            <div className="wts-group-card">
              {selectMode ? (
                <>
                  <SelectRow
                    label={title}
                    options={[
                      ...options!.map((o) => ({ value: o, label: o })),
                      { value: OTHER, label: "Other…" },
                    ]}
                    value={selectValue}
                    onChange={handleSelect}
                    placeholder={placeholder ?? "Select…"}
                    emptyLabel={placeholder ?? "Select…"}
                  />
                  {otherActive && (
                    <label className="wts-row" style={{ cursor: "text" }}>
                      <input
                        ref={otherRef}
                        className="wts-row-input"
                        type="text"
                        autoComplete="off"
                        value={draft}
                        placeholder="Type a breed"
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirm();
                        }}
                      />
                    </label>
                  )}
                </>
              ) : (
                <label className="wts-row" style={{ cursor: "text" }}>
                  <input
                    ref={inputRef}
                    autoFocus
                    className="wts-row-input"
                    type={inputType}
                    inputMode={inputMode}
                    value={draft}
                    placeholder={placeholder ?? title}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirm();
                    }}
                  />
                  {unit && <span className="wts-chip-suffix">{unit}</span>}
                </label>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}
