import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Walk } from "../types";

const WEATHERS: { value: string; icon: string }[] = [
  { value: "sunny", icon: "☀️" },
  { value: "cloudy", icon: "☁️" },
  { value: "rainy", icon: "🌧️" },
  { value: "windy", icon: "💨" },
  { value: "snowy", icon: "❄️" },
  { value: "hot", icon: "🥵" },
  { value: "foggy", icon: "🌫️" },
  { value: "stormy", icon: "⛈️" },
];

interface WalkFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Index into db.walks when editing, or null when logging a new walk. */
  editIndex: number | null;
}

export function WalkFormModal({ open, onClose, editIndex }: WalkFormModalProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const existing = editIndex != null ? db.walks[editIndex] : undefined;

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState("");
  const [distance, setDistance] = useState("");
  const [pipi, setPipi] = useState(false);
  const [popo, setPopo] = useState(false);
  const [friends, setFriends] = useState(false);
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(existing?.date || new Date().toISOString().split("T")[0]);
    setTime(existing?.time || nowTime());
    setDuration(existing ? String(existing.duration || "") : "");
    setSteps(existing ? String(existing.steps || "") : "");
    setDistance(existing ? String(existing.distance || "") : "");
    setPipi(!!existing?.pipi);
    setPopo(!!existing?.popo);
    setFriends(!!existing?.friends);
    setWeather(existing?.weather || "");
    setNotes(existing?.notes || "");
    // Only reset when the modal opens or the edit target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  const save = (): void => {
    const walk: Walk = {
      date: date || new Date().toISOString().split("T")[0],
      time,
      duration,
      steps,
      distance,
      pipi,
      popo,
      friends,
      weather,
      notes,
      created: existing?.created || new Date().toISOString(),
    };
    update((d) => {
      if (editIndex != null) d.walks[editIndex] = walk;
      else d.walks.push(walk);
    });
    toast(editIndex != null ? "Walk updated! ✓" : "Walk saved! 🦮");
    onClose();
  };

  return (
    <Modal open={open} title={editIndex != null ? "Edit walk 🦮" : "Log a walk"} onClose={onClose}>
      <div className="form-row">
        <div>
          <span className="form-label">Date</span>
          <input type="date" className="form-input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <span className="form-label">Time</span>
          <input type="time" className="form-input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>
      <div className="form-row">
        <div>
          <span className="form-label">Duration (min)</span>
          <input type="number" className="form-input" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div>
          <span className="form-label">Steps</span>
          <input type="number" className="form-input" value={steps} onChange={(e) => setSteps(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <span className="form-label">Distance (km)</span>
        <input type="number" className="form-input" value={distance} onChange={(e) => setDistance(e.target.value)} />
      </div>

      <div className="form-group">
        <span className="form-label">Weather</span>
        <div className="pills" style={{ padding: 0 }}>
          {WEATHERS.map((w) => (
            <button
              key={w.value}
              type="button"
              className={"weather-btn" + (weather === w.value ? " selected" : "")}
              onClick={() => setWeather(weather === w.value ? "" : w.value)}
            >
              {w.icon}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "0 18px 16px" }}>
        <Chip label="💧 Pipi" active={pipi} onClick={() => setPipi(!pipi)} />
        <Chip label="💩 Popo" active={popo} onClick={() => setPopo(!popo)} />
        <Chip label="🐶 Friends" active={friends} onClick={() => setFriends(!friends)} />
      </div>

      <div className="form-group">
        <span className="form-label">Notes</span>
        <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-full" onClick={save}>
        {editIndex != null ? "Save changes" : "Save walk"}
      </button>
    </Modal>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button type="button" className={"ob-part-pill" + (active ? " selected" : "")} style={{ flex: 1 }} onClick={onClick}>
      {label}
    </button>
  );
}
