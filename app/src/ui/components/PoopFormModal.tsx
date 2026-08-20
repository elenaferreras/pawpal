import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
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
const BATH = "#A9E7A7"; // green bathroom accent (matches the sheet surface)

const CONSISTENCIES = ["Normal", "Soft", "Runny", "Hard", "Mucus", "Other"];

const TYPES: { value: BathroomType; label: string; icon?: AppIconName }[] = [
  { value: "pipi", label: "Pipi", icon: "droplet" },
  { value: "popo", label: "Popo", icon: "toilet" },
  { value: "both", label: "Both" },
];

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
        const stamp = new Date(entry.date + "T12:00:00").toLocaleDateString(undefined, {
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
      sheetClassName="bathroom-sheet"
      title={editIndex != null ? "Edit bathroom log" : "Bathroom log"}
      body={
        <>
        <Field label="Type">
          <div style={{ display: "flex", gap: 8 }}>
            {TYPES.map((t) => (
              <ChoiceChip
                key={t.value}
                label={t.label}
                icon={t.icon}
                selected={type === t.value}
                onClick={() => setType(t.value)}
                grow
              />
            ))}
          </div>
        </Field>

        <Field label="Time">
          <SheetInput value={time} onChange={setTime} type="time" />
        </Field>

        <Field label="Date">
          <SheetInput
            value={dateISO}
            onChange={setDateISO}
            type="date"
            max={localISO(new Date())}
          />
        </Field>

        {showPhoto && (
          <>
            <Field label="Consistency">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CONSISTENCIES.map((c) => (
                  <ChoiceChip
                    key={c}
                    label={c}
                    selected={consistency === c}
                    onClick={() => setConsistency(c)}
                  />
                ))}
              </div>
            </Field>

            <Field label="Photos">
              <PhotoPicker photos={photos} onChange={setPhotos} />
            </Field>
          </>
        )}

        <Field label="Notes">
          <SheetTextarea value={notes} onChange={setNotes} placeholder="Optional" />
          {notes.trim() !== "" && (
            <ChoiceChip
              label="Send note to vet"
              selected={sendToVet}
              onClick={() => setSendToVet((v) => !v)}
              grow
            />
          )}
        </Field>
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
            color: BATH,
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 16,
          }}
        >
          {editIndex != null ? "Save changes" : "Save"}
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
  max,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  max?: string;
}): React.ReactElement {
  return (
    <input
      className="wts-field"
      type={type}
      value={value}
      placeholder={placeholder}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...sheetFieldStyle,
        colorScheme: "light",
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
  icon,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  grow?: boolean;
  icon?: AppIconName;
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
        justifyContent: "center",
        gap: 6,
        padding: "12px 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        cursor: "pointer",
        background: selected ? DARK : "transparent",
        color: selected ? BATH : DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
        whiteSpace: "nowrap",
      }}
    >
      {icon && <Icon icon={Icons[icon]} color="inherit" size="sm" />}
      <span>{label}</span>
    </button>
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
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        <span style={{ flex: 1 }}>Add photos</span>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
              <img
                src={src}
                alt=""
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 12 }}
              />
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
                  color: BATH,
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
    </div>
  );
}
