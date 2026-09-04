import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { fmtDate } from "../lib/date";
import type { Checkup, Medication, Priority, Reminder, Vaccine } from "../types";

type RecordType = "checkup" | "vaccine" | "reminder" | "medication";
export type { RecordType };

const DARK = "var(--color-pawpal-page)"; // #352B25
const VET = "var(--color-dash-walk)"; // blue sheet surface — used for button copy & selected chips

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

const RABIES = "Rabies";
const DHPP = "DHPP / DAPP (Combination Vaccine)";
const OTHER = "Other";

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
  /** When set, the sheet edits this existing vaccine instead of adding a new record. */
  editVaccineIndex?: number | null;
  /**
   * Restricts the record types this sheet can add. One type hides the picker
   * entirely (a dedicated sheet); multiple types show a picker limited to them.
   * Defaults to all record types.
   */
  addTypes?: RecordType[];
}

/**
 * "Add health record" bottom sheet (new design).
 *
 * Blue sheet that slides up from the bottom, matching the Track-walk and
 * Log-a-meal sheets: dark outlined fields on the blue surface, wrapping chips
 * that invert to a dark fill when selected, and a pinned dark save action.
 */

export function VetAddModal({
  open,
  onClose,
  editReminderIndex,
  editVaccineIndex,
  addTypes,
}: VetAddModalProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const allowedTypes = addTypes && addTypes.length ? addTypes : RECORD_TYPES.map((t) => t.value);
  const [type, setType] = useState<RecordType>(allowedTypes[0]);

  const editReminder =
    editReminderIndex != null &&
    editReminderIndex >= 0 &&
    editReminderIndex < db.vetRecords.reminders.length
      ? db.vetRecords.reminders[editReminderIndex]
      : null;

  const editVaccine =
    editVaccineIndex != null &&
    editVaccineIndex >= 0 &&
    editVaccineIndex < db.vetRecords.vaccines.length
      ? db.vetRecords.vaccines[editVaccineIndex]
      : null;

  const isEdit = Boolean(editReminder || editVaccine);
  const addLabel =
    allowedTypes.length === 1
      ? "Add " + (RECORD_TYPES.find((t) => t.value === allowedTypes[0])?.label.toLowerCase() ?? "record")
      : "Add health record";
  const sheetLabel = editReminder ? "Edit reminder" : editVaccine ? "Edit vaccine" : addLabel;

  // Checkup
  const [reason, setReason] = useState("");
  const [cDate, setCDate] = useState("");
  const [clinic, setClinic] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [fileName, setFileName] = useState("");

  // Vaccine
  const [vNameChoice, setVNameChoice] = useState<string>(RABIES);
  const [vNameOther, setVNameOther] = useState("");
  const vName = vNameChoice === OTHER ? vNameOther.trim() : vNameChoice;
  // Only the fixed combination vaccine hides "Valid from".
  const showValidFrom = vNameChoice !== DHPP;
  // Dropdown remembers any custom vaccine names previously saved.
  const vaccineNameOptions = useMemo(() => {
    const custom = Array.from(
      new Set(db.vetRecords.vaccines.map((v) => v.name).filter((n) => n && n !== RABIES && n !== DHPP)),
    );
    return [RABIES, DHPP, ...custom, OTHER];
  }, [db.vetRecords.vaccines]);
  const [vManufacturer, setVManufacturer] = useState("");
  const [vDate, setVDate] = useState("");
  const [vValidFrom, setVValidFrom] = useState("");
  const [vValidUntil, setVValidUntil] = useState("");
  const [vClinic, setVClinic] = useState("");

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
    setType(allowedTypes[0]);
    setReason("");
    setCDate(today);
    setClinic("");
    setCNotes("");
    setFileName("");
    setVNameChoice(RABIES);
    setVNameOther("");
    setVManufacturer("");
    setVDate(today);
    setVValidFrom("");
    setVValidUntil("");
    setVClinic("");
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
    // Editing an existing vaccine: lock the sheet to the vaccine form and prefill.
    if (editVaccine) {
      setType("vaccine");
      if (editVaccine.name === RABIES || editVaccine.name === DHPP) {
        setVNameChoice(editVaccine.name);
        setVNameOther("");
      } else {
        // Custom name: show the editable text field so it can be renamed.
        setVNameChoice(OTHER);
        setVNameOther(editVaccine.name);
      }
      setVManufacturer(editVaccine.manufacturer ?? "");
      setVDate(editVaccine.date || today);
      setVValidFrom(editVaccine.validFrom ?? "");
      setVValidUntil(editVaccine.validUntil ?? editVaccine.nextDue ?? "");
      setVClinic(editVaccine.clinic ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editReminderIndex, editVaccineIndex]);

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
      if (!vDate) {
        toast("Enter the vaccination date");
        return;
      }
      if (editVaccine && editVaccineIndex != null) {
        const oldBoosterTitle = editVaccine.name + " booster due";
        update((d) => {
          const existing = d.vetRecords.vaccines[editVaccineIndex];
          if (existing) {
            existing.name = vName;
            existing.manufacturer = vManufacturer || undefined;
            existing.date = vDate;
            existing.validFrom = showValidFrom ? vValidFrom || undefined : undefined;
            existing.validUntil = vValidUntil || undefined;
            existing.clinic = vClinic || undefined;
          }
          // Keep the auto booster reminder in sync with the new expiry date.
          const newBoosterTitle = vName + " booster due";
          const idx = d.vetRecords.reminders.findIndex((r) => r.title === oldBoosterTitle);
          if (vValidUntil) {
            if (idx >= 0) {
              d.vetRecords.reminders[idx].title = newBoosterTitle;
              d.vetRecords.reminders[idx].date = vValidUntil;
            } else {
              d.vetRecords.reminders.push({
                title: newBoosterTitle,
                date: vValidUntil,
                priority: "High",
                created: new Date().toISOString(),
              });
            }
          } else if (idx >= 0) {
            d.vetRecords.reminders.splice(idx, 1);
          }
        });
        toast("Vaccine updated");
        onClose();
        return;
      }
      const rec: Vaccine = {
        name: vName,
        manufacturer: vManufacturer || undefined,
        date: vDate,
        validFrom: showValidFrom ? vValidFrom || undefined : undefined,
        validUntil: vValidUntil || undefined,
        clinic: vClinic || undefined,
        created: new Date().toISOString(),
      };
      update((d) => {
        d.vetRecords.vaccines.push(rec);
        if (vValidUntil) {
          d.vetRecords.reminders.push({
            title: vName + " booster due",
            date: vValidUntil,
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
        toast("Reminder updated");
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
    toast("Record saved");
    onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={sheetLabel}
      scrimClassName="walk-sheet-scrim"
      sheetClassName="walk-sheet"
      title={sheetLabel}
      body={
        <>
        {!isEdit && allowedTypes.length > 1 && (
          <Field label="Record type">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {RECORD_TYPES.filter((t) => allowedTypes.includes(t.value)).map((t) => (
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
              <SheetSelect
                value={vNameChoice}
                onChange={setVNameChoice}
                options={vaccineNameOptions.map((opt) => ({ value: opt, label: opt }))}
              />
            </Field>
            {vNameChoice === OTHER && (
              <Field label="Vaccine name">
                <SheetInput value={vNameOther} onChange={setVNameOther} placeholder="Vaccine name" />
              </Field>
            )}
            <Field label="Manufacturer">
              <SheetInput value={vManufacturer} onChange={setVManufacturer} placeholder="e.g. Nobivac" />
            </Field>
            <Field label="Vaccination date">
              <SheetInput value={vDate} onChange={setVDate} type="date" />
            </Field>
            {showValidFrom && (
              <Field label="Valid from">
                <SheetInput value={vValidFrom} onChange={setVValidFrom} type="date" />
              </Field>
            )}
            <Field label="Valid until">
              <SheetInput value={vValidUntil} onChange={setVValidUntil} type="date" />
            </Field>
            <Field label="Vet / clinic">
              <SheetInput value={vClinic} onChange={setVClinic} placeholder="Clinic name" />
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
          {isEdit ? "Save changes" : "Save record"}
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

function SheetSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}): React.ReactElement {
  return (
    <div style={{ position: "relative" }}>
      <select
        className="wts-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...sheetFieldStyle,
          minWidth: 0,
          paddingRight: 44,
          WebkitAppearance: "none",
          appearance: "none",
          cursor: "pointer",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: 16,
          top: "50%",
          transform: "translateY(-50%)",
          pointerEvents: "none",
          display: "flex",
          color: DARK,
        }}
      >
        <Icon icon={Icons.chevronDown} color="inherit" size="sm" />
      </span>
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
