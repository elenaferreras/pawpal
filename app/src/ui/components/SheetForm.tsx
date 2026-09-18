import { useEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons, type AppIconName } from "../lib/icons";
import { Toggle } from "./Toggle";

// Shared iOS grouped-list form primitives (Figma 5923:4497). Rendered inside a
// `.form-sheet` MotionSheet body: a bold section title above a translucent
// rounded card of hairline-separated rows, each with a value chip or native
// picker on the trailing edge. Styling lives under the `.wts-*` classes in
// global.css. Category-specific rows (e.g. the walk "Walked by") stay in their
// own sheet; everything reusable lives here.

/** Section wrapper — bold title above a rounded card of hairline-separated rows. */
export function Group({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="wts-group">
      <h3 className="wts-group-title">{title}</h3>
      <div className="wts-group-card">{children}</div>
    </section>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  icon?: AppIconName;
}

/** Row whose value opens the platform's native picker (via an invisible
    <select> over the chip). */
export function SelectRow({
  label,
  options,
  value,
  onChange,
  placeholder,
  emptyLabel = "None",
  hideEmpty = false,
}: {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  emptyLabel?: string;
  hideEmpty?: boolean;
}): React.ReactElement {
  const selected = value ? options.find((o) => o.value === value) : undefined;
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      <span className={`wts-chip${selected ? "" : " wts-chip--empty"}`} style={{ position: "relative" }}>
        {selected?.icon && <Icon icon={Icons[selected.icon]} width={18} height={18} color="inherit" />}
        <span className="wts-chip-text">{selected ? selected.label : placeholder}</span>
        <Icon icon={Icons.chevronUpDown} width={14} height={14} color="inherit" style={{ opacity: 0.5 }} />
        <select
          className="wts-native-select"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {!hideEmpty && <option value="">{emptyLabel}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

/** Numeric row — the value chip becomes an inline input while being edited. */
export function NumberRow({
  label,
  value,
  onChange,
  suffix,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  inputMode?: "numeric" | "decimal";
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      {editing ? (
        <span className="wts-chip">
          <span className="wts-chip-autosize" data-value={value || "0"}>
            <input
              ref={inputRef}
              className="wts-chip-input"
              value={value}
              inputMode={inputMode}
              placeholder="0"
              size={1}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </span>
          {suffix && <span className="wts-chip-suffix">{suffix}</span>}
        </span>
      ) : (
        <button
          type="button"
          className={`wts-chip${value ? "" : " wts-chip--empty"}`}
          style={{ border: "none", cursor: "pointer" }}
          onClick={() => setEditing(true)}
        >
          <span className="wts-chip-text">{value ? (suffix ? `${value} ${suffix}` : value) : "Add"}</span>
        </button>
      )}
    </div>
  );
}

/** Single-line text row — chip becomes an inline text input while editing. */
export function TextRow({
  label,
  value,
  onChange,
  placeholder = "Add",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "text" | "numeric";
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      {editing ? (
        <span className="wts-chip" style={{ maxWidth: "62vw" }}>
          <span className="wts-chip-autosize" data-value={value || placeholder}>
            <input
              ref={inputRef}
              className="wts-chip-input"
              value={value}
              placeholder={placeholder}
              inputMode={inputMode}
              size={1}
              style={{ textAlign: "left" }}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
          </span>
        </span>
      ) : (
        <button
          type="button"
          className={`wts-chip${value ? "" : " wts-chip--empty"}`}
          style={{ border: "none", cursor: "pointer" }}
          onClick={() => setEditing(true)}
        >
          <span className="wts-chip-text">{value || placeholder}</span>
        </button>
      )}
    </div>
  );
}

/** Date row — the chip opens the platform's native date picker. */
export function DateRow({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: string;
  max?: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const display = value
    ? new Date(value + "T12:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Pick a date";
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      <label className="wts-chip" style={{ position: "relative", cursor: "pointer" }}>
        <span className="wts-chip-text">{display}</span>
        <input
          className="wts-date-input"
          type="date"
          value={value}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

/** Time row — the chip opens the platform's native time picker. */
export function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  const display = value
    ? new Date(`2000-01-01T${value}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "Now";
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      <label className="wts-chip" style={{ position: "relative", cursor: "pointer" }}>
        <span className="wts-chip-text">{display}</span>
        <input
          className="wts-date-input"
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    </div>
  );
}

/** Row with a trailing iOS switch. */
export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}): React.ReactElement {
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      <Toggle label={label} value={value} onChange={onChange} />
    </div>
  );
}

/** Row with a trailing −/＋ stepper for a small non-negative count. */
export function StepperRow({
  label,
  value,
  onChange,
  min = 0,
  max = 99,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}): React.ReactElement {
  const clamp = (n: number): number => Math.max(min, Math.min(max, n));
  return (
    <div className="wts-row">
      <span className="wts-row-label">
        {label}: <span className="wts-stepper-value">{value}</span>
      </span>
      <span className="wts-stepper">
        <button
          type="button"
          className="wts-stepper-btn"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          <Icon icon={Icons.minus} width={18} height={18} color="inherit" />
        </button>
        <span className="wts-stepper-sep" aria-hidden />
        <button
          type="button"
          className="wts-stepper-btn"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + 1))}
        >
          <Icon icon={Icons.plus} width={18} height={18} color="inherit" />
        </button>
      </span>
    </div>
  );
}

/** Block row: a label above a horizontal grid of toggleable chips (multiselect). */
export function MultiSelectRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: SelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
}): React.ReactElement {
  const toggle = (v: string): void =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="wts-multi">
      <span className="wts-row-label wts-multi-label">{label}</span>
      <div className="wts-multi-grid">
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              className={`wts-multi-chip${on ? " wts-multi-chip--on" : ""}`}
              aria-pressed={on}
              onClick={() => toggle(o.value)}
            >
              {o.icon && <Icon icon={Icons[o.icon]} width={22} height={22} color="inherit" />}
              <span className="wts-multi-chip-text">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Full-width multiline notes field (sits inside a Group card). */
export function NotesField({
  value,
  onChange,
  placeholder = "Anything worth remembering?",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.ReactElement {
  return (
    <div className="wts-notes">
      <textarea value={value} placeholder={placeholder} rows={3} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** Grouped-list nav row: label, optional plain-text value, and a trailing
    chevron. Used for screen-forms that drill into a sub-screen, open an edit
    sheet, or trigger an action. Set `disabled` for a dimmed, inert row, or
    `readOnly` for a non-interactive display row (label + value, no chevron). */
export function NavRow({
  label,
  value,
  onClick,
  disabled = false,
  readOnly = false,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  disabled?: boolean;
  readOnly?: boolean;
}): React.ReactElement {
  if (readOnly) {
    return (
      <div className="wts-row">
        <span className="wts-row-label">{label}</span>
        {value && <span className="wts-nav-value">{value}</span>}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="wts-row"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={disabled ? { opacity: 0.55, cursor: "default" } : undefined}
    >
      <span className="wts-row-label">{label}</span>
      {value && <span className="wts-nav-value">{value}</span>}
      {!disabled && (
        <span
          style={{
            display: "flex",
            flexShrink: 0,
            color: "color-mix(in srgb, var(--color-pawpal-hero) 45%, transparent)",
          }}
        >
          <Icon icon={Icons.caretRight} color="inherit" />
        </span>
      )}
    </button>
  );
}

/** Centred action row (e.g. Sign out) in a group card; danger-coloured by default. */
export function ActionRow({
  label,
  onClick,
  danger = true,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      className="wts-row"
      onClick={onClick}
      style={{ justifyContent: "center", color: danger ? "var(--btn-danger)" : undefined }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em" }}>
        {label}
      </span>
    </button>
  );
}
