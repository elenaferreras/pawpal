import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
import { Group, SelectRow, TextRow, DateRow, NotesField } from "./SheetForm";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { fmtDate } from "../lib/date";
import type { Checkup, Medication, Priority, Reminder, Vaccine } from "../types";

type RecordType = "checkup" | "vaccine" | "reminder" | "medication";
export type { RecordType };

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
      : "New health entry";
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
      sheetClassName="form-sheet vet-sheet"
      title={sheetLabel}
      confirmLabel={isEdit ? "Save changes" : "Save record"}
      onConfirm={save}
      body={
        <div className="wts-form">
          {!isEdit && allowedTypes.length > 1 && (
            <Group title="Record">
              <SelectRow
                label="Type"
                hideEmpty
                value={type}
                onChange={(v) => setType(v as RecordType)}
                placeholder="Type"
                options={RECORD_TYPES.filter((t) => allowedTypes.includes(t.value)).map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />
            </Group>
          )}

          {type === "checkup" && (
            <>
              <Group title="Checkup">
                <TextRow label="Reason" value={reason} onChange={setReason} placeholder="Annual checkup" />
                <DateRow label="Date" value={cDate} onChange={setCDate} />
                <TextRow label="Clinic" value={clinic} onChange={setClinic} placeholder="Clinic name" />
                <FileRow label="File (PDF)" fileName={fileName} onPick={setFileName} accept=".pdf" />
              </Group>
              <NotesGroup value={cNotes} onChange={setCNotes} />
            </>
          )}

          {type === "vaccine" && (
            <Group title="Vaccine">
              <SelectRow
                label="Name"
                hideEmpty
                value={vNameChoice}
                onChange={setVNameChoice}
                placeholder="Name"
                options={vaccineNameOptions.map((opt) => ({ value: opt, label: opt }))}
              />
              {vNameChoice === OTHER && (
                <TextRow label="Custom name" value={vNameOther} onChange={setVNameOther} placeholder="Vaccine name" />
              )}
              <TextRow label="Manufacturer" value={vManufacturer} onChange={setVManufacturer} placeholder="e.g. Nobivac" />
              <DateRow label="Vaccination date" value={vDate} onChange={setVDate} />
              {showValidFrom && <DateRow label="Valid from" value={vValidFrom} onChange={setVValidFrom} />}
              <DateRow label="Valid until" value={vValidUntil} onChange={setVValidUntil} />
              <TextRow label="Vet / clinic" value={vClinic} onChange={setVClinic} placeholder="Clinic name" />
            </Group>
          )}

          {type === "reminder" && (
            <Group title="Reminder">
              <TextRow label="Title" value={rTitle} onChange={setRTitle} placeholder="Flea treatment" />
              <DateRow label="Date" value={rDate} onChange={setRDate} />
              <SelectRow
                label="Priority"
                hideEmpty
                value={rPriority}
                onChange={(v) => setRPriority(v as Priority)}
                placeholder="Priority"
                options={PRIORITIES.map((p) => ({ value: p, label: p }))}
              />
            </Group>
          )}

          {type === "medication" && (
            <>
              <Group title="Medication">
                <TextRow label="Name" value={mName} onChange={setMName} placeholder="Antibiotic" />
                <TextRow label="Dose" value={mDose} onChange={setMDose} placeholder="1 tablet" />
                <SelectRow
                  label="Frequency"
                  hideEmpty
                  value={mFreq}
                  onChange={setMFreq}
                  placeholder="Frequency"
                  options={FREQS.map((f) => ({ value: f, label: f }))}
                />
                <DaysRow days={mDays} onChange={setMDays} />
                <DateRow label="Start date" value={mStart} onChange={setMStart} />
              </Group>

              <section className="wts-group">
                <div className="wts-group-card">
                  <div className="wts-info">
                    <span className="wts-info-title">
                      {mFreq}
                      {mDays === 0
                        ? " · Ongoing"
                        : medEnd
                          ? ` from ${fmtDate(mStart)} to ${fmtDate(medEnd)}`
                          : ` for ${mDays} days`}
                    </span>
                    <span className="wts-info-sub">
                      {totalDoses
                        ? `Total: ${totalDoses} dose${totalDoses !== 1 ? "s" : ""} of ${mDose || "dose"}`
                        : "Ongoing — no end date"}
                    </span>
                  </div>
                </div>
              </section>

              <NotesGroup value={mNotes} onChange={setMNotes} />
            </>
          )}
        </div>
      }
    />
  );
}

function FileRow({
  label,
  fileName,
  onPick,
  accept,
}: {
  label: string;
  fileName: string;
  onPick: (name: string) => void;
  accept?: string;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="wts-row">
      <span className="wts-row-label">{label}</span>
      <button
        type="button"
        className={`wts-chip${fileName ? "" : " wts-chip--empty"}`}
        style={{ border: "none", cursor: "pointer", maxWidth: "55vw" }}
        onClick={() => inputRef.current?.click()}
      >
        <Icon icon={fileName ? Icons.checkCircle : Icons.upload} width={18} height={18} color="inherit" />
        <span className="wts-chip-text">{fileName || "Choose"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onPick(e.target.files?.[0]?.name || "")}
      />
    </div>
  );
}

/** Medication duration — a −/+ stepper with quick presets (∞ = ongoing). */
function DaysRow({ days, onChange }: { days: number; onChange: (n: number) => void }): React.ReactElement {
  return (
    <>
      <div className="wts-row">
        <span className="wts-row-label">Duration</span>
        <span className="wts-chip" style={{ gap: 12, paddingLeft: 8, paddingRight: 8 }}>
          <button type="button" aria-label="Decrease days" className="wts-step" onClick={() => onChange(Math.max(0, days - 1))}>
            <Icon icon={Icons.minus} width={16} height={16} color="inherit" />
          </button>
          <span style={{ minWidth: 52, textAlign: "center", fontWeight: 700 }}>
            {days === 0 ? "∞ days" : `${days} days`}
          </span>
          <button type="button" aria-label="Increase days" className="wts-step" onClick={() => onChange(days + 1)}>
            <Icon icon={Icons.plus} width={16} height={16} color="inherit" />
          </button>
        </span>
      </div>
      <div className="wts-presets">
        {[7, 14, 30, 0].map((d) => (
          <button
            key={d}
            type="button"
            className={`wts-preset${days === d ? " is-on" : ""}`}
            onClick={() => onChange(d)}
          >
            {d === 0 ? "∞" : `${d} days`}
          </button>
        ))}
      </div>
    </>
  );
}

function NotesGroup({ value, onChange }: { value: string; onChange: (v: string) => void }): React.ReactElement {
  return (
    <section className="wts-group">
      <h3 className="wts-group-title">Notes</h3>
      <div className="wts-group-card">
        <NotesField value={value} onChange={onChange} placeholder="Optional" />
      </div>
    </section>
  );
}
