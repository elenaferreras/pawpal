import { useEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { MotionSheet } from "./MotionSheet";

const DARK = "var(--color-pawpal-page)"; // #352B25
const SHEET = "var(--color-pawpal-hero)"; // cream sheet surface
const PRIMARY = "var(--color-data-yellow-3)"; // #FFFF83 confirm button

export type FieldEditType = "text" | "number" | "decimal" | "tel" | "date";

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
  onSave: (value: string) => void;
  onClose: () => void;
}

/**
 * Bottom sheet for editing a single profile field (Figma node 223:2507).
 *
 * Cream sheet with a grabber and a toolbar: a dark X on the left to dismiss, the
 * field name centred, and a yellow check on the right to confirm. The body holds
 * a labelled, dark-bordered input for the value.
 */
export function FieldEditSheet({
  open,
  title,
  value,
  type = "text",
  unit,
  placeholder,
  onSave,
  onClose,
}: FieldEditSheetProps): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    // Focus the field as soon as it mounts so the correct keyboard pops up with
    // the sheet. For dates, also open the native picker (wheel on iOS).
    const el = inputRef.current;
    const raf = requestAnimationFrame(() => {
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
  }, [open, value, type]);

  const confirm = (): void => onSave(draft);

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

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={title}
      scrimClassName="walk-sheet-scrim"
      sheetClassName="field-sheet"
    >
        {/* Toolbar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0 10px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "0 16px",
            }}
          >
            <button
              type="button"
              aria-label="Cancel"
              onClick={onClose}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
                borderRadius: 100,
                border: "none",
                background: DARK,
                color: SHEET,
                cursor: "pointer",
              }}
            >
              <Icon icon={Icons.x} width={16} height={16} color="inherit" />
            </button>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 590,
                fontSize: 16,
                lineHeight: "22px",
                color: DARK,
              }}
            >
              {title}
            </span>
            <button
              type="button"
              aria-label="Save"
              onClick={confirm}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 12,
                borderRadius: 100,
                border: "none",
                background: PRIMARY,
                color: DARK,
                cursor: "pointer",
              }}
            >
              <Icon icon={Icons.check} width={16} height={16} color="inherit" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "8px 16px 16px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 400,
                fontSize: 16,
                color: DARK,
              }}
            >
              {title}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${DARK}`,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <input
                ref={inputRef}
                autoFocus
                type={inputType}
                inputMode={inputMode}
                value={draft}
                placeholder={placeholder}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirm();
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: "none",
                  outline: "none",
                  background: "none",
                  fontFamily: "var(--font-ui)",
                  fontWeight: 400,
                  fontSize: 16,
                  color: DARK,
                  padding: 0,
                }}
              />
              {unit && (
                <span
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontWeight: 400,
                    fontSize: 16,
                    color: DARK,
                    opacity: 0.6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {unit}
                </span>
              )}
            </span>
          </label>
        </div>
    </MotionSheet>
  );
}
