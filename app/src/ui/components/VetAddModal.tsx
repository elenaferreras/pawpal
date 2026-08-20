import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { fmtDate } from "../lib/date";
import type { Checkup, Medication, Priority, Reminder, Vaccine } from "../types";

type RecordType = "checkup" | "vaccine" | "reminder" | "medication";

const DARK = "var(--color-pawpal-page)"; // #352B25
const VET = "#8592E0"; // blue health accent (matches the sheet surface)

const RECORD_TYPES: { value: RecordType; label: string }[] = [
  { value: "checkup", label: "Checkup" },
  { value: "vaccine", label: "Vaccine" },
  { value: "reminder", label: "Reminder" },
  { value: "medication", label: "Medication" },
];

const FREQS = ["Once a day", "Twice a day", "3× a day", "Every 2 days", "Weekly", "Monthly"];
const DOSES_PER_DAY: Record<string, number> = {
  "Once a day": 1,
  "Twice a day": 2,
  "3× a day": 3,
  "Every 2 days": 0.5,
  Weekly: 1 / 7,
  Monthly: 1 / 30,
};

const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

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

interface VetAddModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet edits this existing reminder instead of adding a new record. */
  editReminderIndex?: number | null;
}

/**
 * "Add health record" bottom sheet (new design).
 *
 * Blue sheet that slides up from the bottom, matching the Track-walk and
 * Log-a-meal sheets: dark outlined fields on the blue surface, wrapping chips
 * that invert to a dark fill when selected, and a pinned dark save action.
 */

export function VetAddModal({ open, onClose, editReminderIndex }: VetAddModalProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const [type, setType] = useState<RecordType>("checkup");

  const editReminder =
    editReminderIndex != null &&
    editReminderIndex >= 0 &&
    editReminderIndex < db.vetRecords.reminders.length
      ? db.vetRecords.reminders[editReminderIndex]
      : null;

  // Checkup
  const [reason, setReason] = useState("");
  const [cDate, setCDate] = useState("");
  const [clinic, setClinic] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [fileName, setFileName] = useState("");

  // Vaccine
  const [vName, setVName] = useState("");
  const [vDate, setVDate] = useState("");
  const [vNext, setVNext] = useState("");

  // Reminder
  const [rTitle, setRTitle] = useState("");
  const [rDate, setRDate] = useState("");
  const [rPriority, setRPriority] = useState<Priority>("Medium");

  // Medication
  const [mName, setMName] = useState("");
  const [mDose, setMDose] = useState("");
  const [mFreq, setMFreq] = useState(FREQS[0]);
  const [mDays, setMDays] = useState(7);
  const [mStart, setMStart] = useState("");
  const [mNotes, setMNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().split("T")[0];
    setType("checkup");
    setReason("");
    setCDate(today);
    setClinic("");
    setCNotes("");
    setFileName("");
    setVName("");
    setVDate(today);
    setVNext("");
    setRTitle("");
    setRDate(today);
    setRPriority("Medium");
    setMName("");
    setMDose("");
    setMFreq(FREQS[0]);
    setMDays(7);
    setMStart(today);
    setMNotes("");
    // Editing an existing reminder: lock the sheet to the reminder form and prefill.
    if (editReminder) {
      setType("reminder");
      setRTitle(editReminder.title);
      setRDate(editReminder.date || today);
      setRPriority(editReminder.priority);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editReminderIndex]);

  const medEnd = useMemo<string | null>(() => {
    if (mDays === 0 || !mStart) return null;
    const d = new Date(mStart + "T12:00:00");
    d.setDate(d.getDate() + mDays - 1);
    return d.toISOString().split("T")[0];
  }, [mDays, mStart]);

  const totalDoses = useMemo<number | null>(() => {
    if (mDays === 0) return null;
    return Math.ceil(mDays * (DOSES_PER_DAY[mFreq] || 1));
  }, [mDays, mFreq]);

  const save = (): void => {
    if (type === "checkup") {
      const rec: Checkup = {
        reason: reason || "Visit",
        date: cDate,
        clinic,
        notes: cNotes,
        hasFile: fileName !== "",
        fileName,
        created: new Date().toISOString(),
      };
      update((d) => {
        d.vetRecords.checkups.push(rec);
      });
    } else if (type === "vaccine") {
      if (!vName) {
        toast("Enter a vaccine name");
        return;
      }
      const rec: Vaccine = { name: vName, date: vDate, nextDue: vNext, created: new Date().toISOString() };
      update((d) => {
        d.vetRecords.vaccines.push(rec);
        if (vNext) {
          d.vetRecords.reminders.push({
            title: vName + " booster due",
            date: vNext,
            priority: "High",
            created: new Date().toISOString(),
          });
        }
      });
    } else if (type === "reminder") {
      if (!rTitle) {
        toast("Enter a reminder title");
        return;
      }
      if (editReminder && editReminderIndex != null) {
        update((d) => {
          const existing = d.vetRecords.reminders[editReminderIndex];
          if (existing) {
            existing.title = rTitle;
            existing.date = rDate;
            existing.priority = rPriority;
          }
        });
        toast("Reminder updated! 📋");
        onClose();
        return;
      }
      const rec: Reminder = { title: rTitle, date: rDate, priority: rPriority, created: new Date().toISOString() };
      update((d) => {
        d.vetRecords.reminders.push(rec);
      });
    } else {
      if (!mName) {
        toast("Enter a medication name");
        return;
      }
      const rec: Medication = {
        name: mName,
        dose: mDose,
        freq: mFreq,
        days: mDays,
        start: mStart,
        end: medEnd,
        totalDoses,
        notes: mNotes,
        created: new Date().toISOString(),
      };
      update((d) => {
        d.vetRecords.medications.push(rec);
        if (medEnd) {
          d.vetRecords.reminders.push({
            title: mName + " course ends",
            date: medEnd,
            priority: "Medium",
            created: new Date().toISOString(),
          });
        }
      });
    }
    toast("Record saved! 📋");
    onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={editReminder ? "Edit reminder" : "Add health record"}
      scrimClassName="walk-sheet-scrim"
      sheetClassName="walk-sheet"
      title={editReminder ? "Edit reminder" : "Add health record"}
      body={
        <>
        {!editReminder && (
          <Field label="Record type">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {RECORD_TYPES.map((t) => (
                <ChoiceChip
                  key={t.value}
                  label={t.label}
                  selected={type === t.value}
                  onClick={() => setType(t.value)}
                />
              ))}
            </div>
          </Field>
        )}

        {type === "checkup" && (
          <>
            <Field label="Reason">
              <SheetInput value={reason} onChange={setReason} placeholder="Annual checkup" />
            </Field>
            <Field label="Date">
              <SheetInput value={cDate} onChange={setCDate} type="date" />
            </Field>
            <Field label="Clinic">
              <SheetInput value={clinic} onChange={setClinic} placeholder="Clinic name" />
            </Field>
            <Field label="Notes">
              <SheetTextarea value={cNotes} onChange={setCNotes} placeholder="Optional" />
            </Field>
            <Field label="Attach file (PDF)">
              <FileButton fileName={fileName} onPick={setFileName} accept=".pdf" />
            </Field>
          </>
        )}

        {type === "vaccine" && (
          <>
            <Field label="Vaccine name">
              <SheetInput value={vName} onChange={setVName} placeholder="Rabies" />
            </Field>
            <Field label="Given">
              <SheetInput value={vDate} onChange={setVDate} type="date" />
            </Field>
            <Field label="Next due">
              <SheetInput value={vNext} onChange={setVNext} type="date" />
            </Field>
          </>
        )}

        {type === "reminder" && (
          <>
            <Field label="Reminder">
              <SheetInput value={rTitle} onChange={setRTitle} placeholder="Flea treatment" />
            </Field>
            <Field label="Date">
              <SheetInput value={rDate} onChange={setRDate} type="date" />
            </Field>
            <Field label="Priority">
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORITIES.map((p) => (
                  <ChoiceChip
                    key={p}
                    label={p}
                    selected={rPriority === p}
                    onClick={() => setRPriority(p)}
                    grow
                  />
                ))}
              </div>
            </Field>
          </>
        )}

        {type === "medication" && (
          <>
            <Field label="Medication name">
              <SheetInput value={mName} onChange={setMName} placeholder="Antibiotic" />
            </Field>
            <Field label="Dose">
              <SheetInput value={mDose} onChange={setMDose} placeholder="1 tablet" />
            </Field>
            <Field label="Frequency">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {FREQS.map((f) => (
                  <ChoiceChip key={f} label={f} selected={mFreq === f} onClick={() => setMFreq(f)} />
                ))}
              </div>
            </Field>
            <Field label="Duration (days)">
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StepperButton
                  label="Decrease days"
                  icon={Icons.minus}
                  onClick={() => setMDays(Math.max(0, mDays - 1))}
                />
                <span
                  style={{
                    minWidth: 44,
                    textAlign: "center",
                    fontFamily: "var(--font-ui)",
                    fontWeight: 700,
                    fontSize: 18,
                    color: DARK,
                  }}
                >
                  {mDays === 0 ? "∞" : mDays}
                </span>
                <StepperButton label="Increase days" icon={Icons.plus} onClick={() => setMDays(mDays + 1)} />
                <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                  {[7, 14, 30, 0].map((d) => (
                    <ChoiceChip
                      key={d}
                      label={d === 0 ? "∞" : String(d)}
                      selected={mDays === d}
                      onClick={() => setMDays(d)}
                    />
                  ))}
                </div>
              </div>
            </Field>
            <Field label="Start date">
              <SheetInput value={mStart} onChange={setMStart} type="date" />
            </Field>
            <div
              style={{
                marginTop: 24,
                padding: 16,
                borderRadius: 16,
                border: `1px solid ${DARK}`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <span style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 15, color: DARK }}>
                {mFreq}
                {mDays === 0
                  ? " · Ongoing"
                  : medEnd
                    ? ` from ${fmtDate(mStart)} to ${fmtDate(medEnd)}`
                    : ` for ${mDays} days`}
              </span>
              <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 14, color: DARK, opacity: 0.7 }}>
                {totalDoses
                  ? `Total: ${totalDoses} dose${totalDoses !== 1 ? "s" : ""} of ${mDose || "dose"}`
                  : "Ongoing — no end date"}
              </span>
            </div>
            <Field label="Notes">
              <SheetTextarea value={mNotes} onChange={setMNotes} placeholder="Optional" />
            </Field>
          </>
        )}
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
            color: VET,
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {editReminder ? "Save changes" : "Save record"}
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

function SheetInput({
  value,
  onChange,
  placeholder,
  type,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "decimal";
}): React.ReactElement {
  return (
    <input
      className="wts-field"
      type={type}
      value={value}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...sheetFieldStyle,
        // Native date/time inputs on iOS keep an intrinsic width and ignore
        // `width: 100%`, overflowing the sheet. Reset appearance + min-width so
        // they respect the container.
        minWidth: 0,
        WebkitAppearance: "none",
        appearance: "none",
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
  placeholder?: string;
}): React.ReactElement {
  return (
    <textarea
      className="wts-field"
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...sheetFieldStyle, resize: "none" }}
    />
  );
}

function ChoiceChip({
  label,
  selected,
  onClick,
  grow,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  grow?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        flex: grow ? 1 : undefined,
        display: "flex",
        alignItems: "center",
        justifyContent: grow ? "space-between" : "flex-start",
        gap: 6,
        padding: "12px 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        cursor: "pointer",
        background: selected ? DARK : "transparent",
        color: selected ? VET : DARK,
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

function StepperButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: (typeof Icons)[keyof typeof Icons];
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 48,
        height: 48,
        flexShrink: 0,
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        background: "transparent",
        color: DARK,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon icon={icon} color="inherit" />
    </button>
  );
}

function FileButton({
  fileName,
  onPick,
  accept,
}: {
  fileName: string;
  onPick: (name: string) => void;
  accept?: string;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 16,
          borderRadius: 16,
          border: `1px dashed ${DARK}`,
          background: "transparent",
          color: DARK,
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          fontSize: 16,
          textAlign: "left",
        }}
      >
        <Icon icon={Icons.upload} color="inherit" />
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {fileName || "Choose a file"}
        </span>
        {fileName && <Icon icon={Icons.checkCircle} color="inherit" size="sm" />}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onPick(e.target.files?.[0]?.name || "")}
      />
    </>
  );
}
