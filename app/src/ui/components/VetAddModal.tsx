import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { fmtDate } from "../lib/date";
import type { Checkup, Medication, Priority, Reminder, Vaccine } from "../types";

type RecordType = "checkup" | "vaccine" | "reminder" | "medication";

const FREQS = ["Once a day", "Twice a day", "3× a day", "Every 2 days", "Weekly", "Monthly"];
const DOSES_PER_DAY: Record<string, number> = {
  "Once a day": 1,
  "Twice a day": 2,
  "3× a day": 3,
  "Every 2 days": 0.5,
  Weekly: 1 / 7,
  Monthly: 1 / 30,
};

interface VetAddModalProps {
  open: boolean;
  onClose: () => void;
}

export function VetAddModal({ open, onClose }: VetAddModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [type, setType] = useState<RecordType>("checkup");

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
  }, [open]);

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
    <Modal open={open} title="Add health record" onClose={onClose}>
      <div className="form-group">
        <span className="form-label">Type</span>
        <div className="pills" style={{ padding: 0 }}>
          {(["checkup", "vaccine", "reminder", "medication"] as RecordType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={"pill" + (type === t ? " active" : "")}
              onClick={() => setType(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {type === "checkup" && (
        <>
          <Field label="Reason" value={reason} onChange={setReason} placeholder="Annual checkup" />
          <div className="form-row">
            <div>
              <span className="form-label">Date</span>
              <input type="date" className="form-input" value={cDate} onChange={(e) => setCDate(e.target.value)} />
            </div>
            <div>
              <span className="form-label">Clinic</span>
              <input className="form-input" value={clinic} onChange={(e) => setClinic(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">Notes</span>
            <textarea className="form-input" value={cNotes} onChange={(e) => setCNotes(e.target.value)} />
          </div>
          <div className="form-group">
            <span className="form-label">Attach file (PDF)</span>
            <input type="file" onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
          </div>
        </>
      )}

      {type === "vaccine" && (
        <>
          <Field label="Vaccine name" value={vName} onChange={setVName} placeholder="Rabies" />
          <div className="form-row">
            <div>
              <span className="form-label">Given</span>
              <input type="date" className="form-input" value={vDate} onChange={(e) => setVDate(e.target.value)} />
            </div>
            <div>
              <span className="form-label">Next due</span>
              <input type="date" className="form-input" value={vNext} onChange={(e) => setVNext(e.target.value)} />
            </div>
          </div>
        </>
      )}

      {type === "reminder" && (
        <>
          <Field label="Reminder" value={rTitle} onChange={setRTitle} placeholder="Flea treatment" />
          <div className="form-row">
            <div>
              <span className="form-label">Date</span>
              <input type="date" className="form-input" value={rDate} onChange={(e) => setRDate(e.target.value)} />
            </div>
            <div>
              <span className="form-label">Priority</span>
              <select className="form-input" value={rPriority} onChange={(e) => setRPriority(e.target.value as Priority)}>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
        </>
      )}

      {type === "medication" && (
        <>
          <Field label="Medication name" value={mName} onChange={setMName} placeholder="Antibiotic" />
          <Field label="Dose" value={mDose} onChange={setMDose} placeholder="1 tablet" />
          <div className="form-group">
            <span className="form-label">Frequency</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {FREQS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={"med-freq-opt" + (mFreq === f ? " selected" : "")}
                  onClick={() => setMFreq(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">Duration (days)</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button type="button" className="med-days-preset" onClick={() => setMDays(Math.max(0, mDays - 1))}>−</button>
              <span style={{ fontSize: 20, fontWeight: 800, minWidth: 40, textAlign: "center" }}>
                {mDays === 0 ? "∞" : mDays}
              </span>
              <button type="button" className="med-days-preset" onClick={() => setMDays(mDays + 1)}>+</button>
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                {[7, 14, 30, 0].map((d) => (
                  <button key={d} type="button" className="med-days-preset" onClick={() => setMDays(d)}>
                    {d === 0 ? "∞" : d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">Start date</span>
            <input type="date" className="form-input" value={mStart} onChange={(e) => setMStart(e.target.value)} />
          </div>
          <div className="card-sm card" style={{ margin: "0 18px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {mFreq}
              {mDays === 0
                ? " · Ongoing"
                : medEnd
                  ? ` from ${fmtDate(mStart)} to ${fmtDate(medEnd)}`
                  : ` for ${mDays} days`}
            </div>
            <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 2 }}>
              {totalDoses ? `Total: ${totalDoses} dose${totalDoses !== 1 ? "s" : ""} of ${mDose || "dose"}` : "Ongoing — no end date"}
            </div>
          </div>
          <div className="form-group">
            <span className="form-label">Notes</span>
            <textarea className="form-input" value={mNotes} onChange={(e) => setMNotes(e.target.value)} />
          </div>
        </>
      )}

      <button className="btn btn-primary btn-full" onClick={save}>
        Save record
      </button>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.ReactElement {
  return (
    <div className="form-group">
      <span className="form-label">{label}</span>
      <input className="form-input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
