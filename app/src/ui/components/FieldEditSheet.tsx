import { useEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";

const DARK = "var(--color-pawpal-page)"; // #352B25
const SHEET = "var(--color-pawpal-hero)"; // cream sheet surface
const PRIMARY = "var(--color-data-yellow-3)"; // #FFFF83 confirm button

export type FieldEditType = "text" | "number" | "date";

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
}: FieldEditSheetProps): React.ReactElement | null {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(value);
    // Focus the field once the slide-up settles.
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open, value]);

  if (!open) return null;

  const confirm = (): void => onSave(draft);

  return (
    <div className="walk-sheet-scrim" onClick={onClose}>
      <div
        className="field-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toolbar */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 10 }}>
          <span
            aria-hidden
            style={{
              width: 36,
              height: 5,
              borderRadius: 100,
              background: "rgba(53,43,37,0.3)",
              marginTop: 5,
              marginBottom: 11,
            }}
          />
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
                type={type === "number" ? "text" : type}
                inputMode={type === "number" ? "decimal" : undefined}
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
      </div>
    </div>
  );
}
