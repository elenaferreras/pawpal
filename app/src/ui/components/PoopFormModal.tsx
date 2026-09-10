import { useEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
import { Group, SelectRow, TimeRow, DateRow, ToggleRow, NotesField } from "./SheetForm";
import { Icons, type AppIconName } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { BathroomLog, BathroomType, Database } from "../types";

interface PoopFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Index into db.bathroom when editing an existing entry, or null to add. */
  editIndex?: number | null;
}

const DARK = "var(--color-pawpal-page)"; // #352B25

const CONSISTENCIES = ["Normal", "Soft", "Runny", "Hard", "Mucus", "Other"];

const TYPES: { value: BathroomType; label: string; icon?: AppIconName }[] = [
  { value: "pipi", label: "Pee", icon: "droplet" },
  { value: "popo", label: "Poop", icon: "toilet" },
  { value: "both", label: "Both" },
];

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Bathroom log" bottom sheet (new design).
 *
 * Green sheet that slides up from the bottom, matching the Track-walk and
 * Add-health-record sheets: dark outlined fields on the green surface, wrapping
 * chips that invert to a dark fill when selected, and a pinned dark save action.
 * Handles both adding a new entry and editing an existing one (via `editIndex`).
 */
export function PoopFormModal({ open, onClose, editIndex }: PoopFormModalProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const existing =
    editIndex != null && editIndex >= 0 && editIndex < db.bathroom.length
      ? db.bathroom[editIndex]
      : undefined;
  const [time, setTime] = useState("");
  const [dateISO, setDateISO] = useState("");
  const [type, setType] = useState<BathroomType>("pipi");
  const [consistency, setConsistency] = useState(CONSISTENCIES[0]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [sendToVet, setSendToVet] = useState(false);

  useEffect(() => {
    if (open) {
      setTime(existing?.time || nowTime());
      setDateISO(existing?.date || localISO(new Date()));
      setType(existing?.type || "pipi");
      setConsistency(existing?.consistency || CONSISTENCIES[0]);
      setNotes(existing?.notes || "");
      setPhotos(existing?.photos || []);
      setSendToVet(!!existing?.sentToVet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  const showPhoto = type === "popo" || type === "both";

  const save = (): void => {
    const trimmedNotes = notes.trim();
    const entry: BathroomLog = {
      date: dateISO || new Date().toISOString().split("T")[0],
      time,
      type,
      consistency: showPhoto ? consistency : "",
      notes,
      photos: showPhoto ? photos : [],
      created: existing?.created || new Date().toISOString(),
      sentToVet: sendToVet && trimmedNotes !== "",
      ...(existing?.source ? { source: existing.source } : {}),
    };
    // Keep a linked "Notes for the vet" checklist item in sync with this entry's
    // note: create it when the toggle is on, update its text when the note
    // changes, and remove it when the toggle is off or the note is cleared.
    const syncVetNote = (d: Database): void => {
      const items = (d.vetRecords.noteItems ??= []);
      const idx = items.findIndex((n) => n.source === entry.created);
      if (sendToVet && trimmedNotes) {
        const stamp = new Date(entry.date + "T12:00:00").toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });
        const text = `${stamp} (bathroom): ${trimmedNotes}`;
        if (idx >= 0) items[idx].text = text;
        else items.push({ text, done: false, source: entry.created });
      } else if (idx >= 0) {
        items.splice(idx, 1);
      }
    };
    update((d) => {
      if (editIndex != null && editIndex >= 0 && editIndex < d.bathroom.length) {
        d.bathroom[editIndex] = entry;
      } else {
        d.bathroom.push(entry);
      }
      syncVetNote(d);
    });
    toast(editIndex != null ? "Updated!" : "Logged!");
    onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={editIndex != null ? "Edit bathroom log" : "Bathroom log"}
      scrimClassName="walk-sheet-scrim"
      sheetClassName="form-sheet bathroom-sheet"
      title={editIndex != null ? "Edit bathroom log" : "Bathroom log"}
      confirmLabel={editIndex != null ? "Save changes" : "Save"}
      onConfirm={save}
      body={
        <div className="wts-form">
          <Group title="Bathroom">
            <SelectRow
              label="Type"
              hideEmpty
              value={type}
              onChange={(v) => setType(v as BathroomType)}
              placeholder="Type"
              options={TYPES.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
            />
            <TimeRow label="Time" value={time} onChange={setTime} />
            <DateRow label="Date" value={dateISO} max={localISO(new Date())} onChange={setDateISO} />
            {showPhoto && (
              <SelectRow
                label="Consistency"
                hideEmpty
                value={consistency}
                onChange={setConsistency}
                placeholder="Consistency"
                options={CONSISTENCIES.map((c) => ({ value: c, label: c }))}
              />
            )}
          </Group>

          {showPhoto && (
            <section className="wts-group">
              <h3 className="wts-group-title">Photos</h3>
              <div className="wts-group-card">
                <PhotoPicker photos={photos} onChange={setPhotos} />
              </div>
            </section>
          )}

          <section className="wts-group">
            <h3 className="wts-group-title">Notes</h3>
            <div className="wts-group-card">
              <NotesField value={notes} onChange={setNotes} placeholder="Optional" />
              {notes.trim() !== "" && (
                <ToggleRow label="Send note to vet" value={sendToVet} onChange={setSendToVet} />
              )}
            </div>
          </section>
        </div>
      }
    />
  );
}

function PhotoPicker({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null): void => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") onChange([...photos, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <>
      <button
        type="button"
        className="wts-row"
        style={{ cursor: "pointer" }}
        onClick={() => inputRef.current?.click()}
      >
        <span className="wts-row-label">Add photos</span>
        <span className="wts-chip wts-chip--empty">
          <Icon icon={Icons.upload} width={18} height={18} color="inherit" />
          <span className="wts-chip-text">{photos.length ? String(photos.length) : "Add"}</span>
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {photos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 12px" }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={src} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12 }} />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  background: DARK,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon icon={Icons.x} color="inherit" size="xsm" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
