import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { BathroomLog, BathroomType } from "../types";

interface PoopFormModalProps {
  open: boolean;
  onClose: () => void;
}

const CONSISTENCIES = ["Normal", "Soft", "Runny", "Hard", "Mucus", "Other"];

export function PoopFormModal({ open, onClose }: PoopFormModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [time, setTime] = useState("");
  const [type, setType] = useState<BathroomType>("pipi");
  const [consistency, setConsistency] = useState(CONSISTENCIES[0]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTime(nowTime());
      setType("pipi");
      setConsistency(CONSISTENCIES[0]);
      setNotes("");
      setPhotos([]);
    }
  }, [open]);

  const showPhoto = type === "popo" || type === "both";

  const handleFiles = (files: FileList | null): void => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") setPhotos((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const save = (): void => {
    const entry: BathroomLog = {
      date: new Date().toISOString().split("T")[0],
      time,
      type,
      consistency: showPhoto ? consistency : "",
      notes,
      photos: showPhoto ? photos : [],
      created: new Date().toISOString(),
    };
    update((d) => {
      d.bathroom.push(entry);
    });
    toast("Logged! 👍");
    onClose();
  };

  return (
    <Modal open={open} title="Bathroom log" onClose={onClose}>
      <div className="form-group">
        <span className="form-label">Type</span>
        <div style={{ display: "flex", gap: 8 }}>
          {(["pipi", "popo", "both"] as BathroomType[]).map((t) => (
            <button
              key={t}
              type="button"
              className="ob-part-pill"
              style={{
                flex: 1,
                background: type === t ? "var(--green)" : undefined,
                color: type === t ? "white" : undefined,
                borderColor: type === t ? "var(--green)" : undefined,
              }}
              onClick={() => setType(t)}
            >
              {t === "pipi" ? "💧 Pipi" : t === "popo" ? "💩 Popo" : "Both"}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <span className="form-label">Time</span>
        <input type="time" className="form-input" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>

      {showPhoto && (
        <>
          <div className="form-group">
            <span className="form-label">Consistency</span>
            <select className="form-input" value={consistency} onChange={(e) => setConsistency(e.target.value)}>
              {CONSISTENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <span className="form-label">Photos</span>
            <input type="file" accept="image/*" multiple onChange={(e) => handleFiles(e.target.files)} />
            {photos.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                {photos.map((src, i) => (
                  <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                    <img src={src} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "0.5px solid var(--border)" }} alt="" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "var(--text)",
                        color: "white",
                        border: "none",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="form-group">
        <span className="form-label">Notes</span>
        <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-full" onClick={save}>
        Save
      </button>
    </Modal>
  );
}
