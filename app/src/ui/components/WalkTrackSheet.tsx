import { useEffect, useRef, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons, type AppIconName } from "../lib/icons";
import { nowTime } from "../lib/date";
import { useWalkers, walkerAvatar, type Walker } from "../lib/walkers";
import type { BathroomLog, Database, Walk } from "../types";

interface WalkTrackSheetProps {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet edits this existing walk instead of adding a new one. */
  editIndex?: number | null;
  /** Pre-fills the date for a new walk (e.g. the selected calendar day). */
  prefillDate?: string | null;
}

const DARK = "var(--color-pawpal-page)"; // #352B25
const WALK = "var(--color-dash-walk)"; // #9CCFFF walk accent token

const WEATHERS: { value: string; icon: AppIconName; label: string }[] = [
  { value: "sunny", icon: "sun", label: "Sunny" },
  { value: "cloudy", icon: "cloud", label: "Cloudy" },
  { value: "rainy", icon: "cloudRain", label: "Rainy" },
  { value: "windy", icon: "wind", label: "Windy" },
  { value: "snowy", icon: "snowflake", label: "Snowy" },
  { value: "hot", icon: "thermometer", label: "Hot" },
  { value: "foggy", icon: "cloudFog", label: "Foggy" },
  { value: "stormy", icon: "cloudLightning", label: "Stormy" },
];

const TERRAINS: { value: string; icon: AppIconName; label: string }[] = [
  { value: "city", icon: "building", label: "City" },
  { value: "park", icon: "trees", label: "Park" },
  { value: "forest", icon: "treePine", label: "Forest" },
  { value: "mountain", icon: "mountain", label: "Mountain" },
  { value: "beach", icon: "waves", label: "Beach" },
  { value: "trail", icon: "footprints", label: "Trail" },
];

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * "Track walk" bottom sheet (Figma node 31:925).
 *
 * Orange sheet that slides up when logging a walk in the new design. Dark fields
 * on the orange surface; selected toggles invert to a dark fill with a check.
 */
export function WalkTrackSheet({ open, onClose, editIndex, prefillDate }: WalkTrackSheetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const { walkers } = useWalkers();

  const editWalk =
    editIndex != null && editIndex >= 0 && editIndex < db.walks.length ? db.walks[editIndex] : null;

  const [dateISO, setDateISO] = useState(localISO(new Date()));
  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState("");
  const [distance, setDistance] = useState("");
  const [pooped, setPooped] = useState(false);
  const [socialised, setSocialised] = useState(false);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [weather, setWeather] = useState("");
  const [showTerrain, setShowTerrain] = useState(false);
  const [terrain, setTerrain] = useState("");
  const [notes, setNotes] = useState("");
  const [sendToVet, setSendToVet] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editWalk) {
      setDateISO(editWalk.date || localISO(new Date()));
      setDuration(String(editWalk.duration ?? ""));
      setSteps(String(editWalk.steps ?? ""));
      setDistance(String(editWalk.distance ?? ""));
      setPooped(!!editWalk.popo);
      setSocialised(!!editWalk.friends);
      setAssignee(editWalk.assignee ?? null);
      setWeather(editWalk.weather ?? "");
      setTerrain(editWalk.terrain ?? "");
      setShowTerrain(!!editWalk.terrain);
      setNotes(editWalk.notes ?? "");
      setSendToVet(!!editWalk.sentToVet);
    } else {
      setDateISO(prefillDate || localISO(new Date()));
      setDuration("");
      setSteps("");
      setDistance("");
      setPooped(false);
      setSocialised(false);
      setAssignee(null);
      setWeather("");
      setTerrain("");
      setShowTerrain(false);
      setNotes("");
      setSendToVet(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  const save = (): void => {
    const trimmedNotes = notes.trim();
    // Keep a linked bathroom entry in sync with the walk's "Pooped" toggle:
    // create a popo entry when it's turned on, remove it when turned off. An
    // existing linked entry is left untouched so edits made in the Bathroom tab
    // (time, consistency, photos…) survive re-saving the walk.
    const syncBathroom = (d: Database, walkCreated: string, time: string): void => {
      const idx = d.bathroom.findIndex((b) => b.source === walkCreated);
      if (pooped) {
        if (idx < 0) {
          const entry: BathroomLog = {
            date: dateISO,
            time,
            type: "popo",
            consistency: "",
            notes: "",
            photos: [],
            created: new Date().toISOString(),
            source: walkCreated,
          };
          d.bathroom.push(entry);
        }
      } else if (idx >= 0) {
        d.bathroom.splice(idx, 1);
      }
    };
    // Keep a linked "Notes for the vet" checklist item in sync with this walk's
    // note: create it when the toggle is on, update its text when the note
    // changes, and remove it when the toggle is turned off or the note cleared.
    const syncVetNote = (d: Database, walkCreated: string): void => {
      const items = (d.vetRecords.noteItems ??= []);
      const idx = items.findIndex((n) => n.source === walkCreated);
      if (sendToVet && trimmedNotes) {
        const stamp = new Date(dateISO + "T12:00:00").toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });
        const text = `${stamp} (walk): ${trimmedNotes}`;
        if (idx >= 0) items[idx].text = text;
        else items.push({ text, done: false, source: walkCreated });
      } else if (idx >= 0) {
        items.splice(idx, 1);
      }
    };
    if (editWalk && editIndex != null) {
      update((d) => {
        const existing = d.walks[editIndex];
        if (!existing) return;
        d.walks[editIndex] = {
          ...existing,
          date: dateISO,
          duration: duration.trim(),
          steps: steps.trim(),
          distance: distance.trim(),
          popo: pooped,
          friends: socialised,
          assignee: assignee ?? undefined,
          weather,
          terrain: showTerrain ? terrain : "",
          notes: notes.trim(),
          sentToVet: sendToVet && trimmedNotes !== "",
        };
        syncVetNote(d, existing.created);        syncBathroom(d, existing.created, existing.time);      });
      toast("Walk updated! 🦮");
      onClose();
      return;
    }
    const walk: Walk = {
      date: dateISO,
      time: nowTime(),
      duration: duration.trim(),
      steps: steps.trim(),
      distance: distance.trim(),
      pipi: false,
      popo: pooped,
      friends: socialised,
      weather,
      terrain: showTerrain ? terrain : "",
      notes: notes.trim(),
      assignee: assignee ?? undefined,
      sentToVet: sendToVet && trimmedNotes !== "",
      created: new Date().toISOString(),
    };
    update((d) => {
      d.walks.push(walk);
      syncVetNote(d, walk.created);
      syncBathroom(d, walk.created, walk.time);
    });
    toast("Walk saved! 🦮");
    onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel="Track walk"
      scrimClassName="walk-sheet-scrim"
      sheetClassName="walk-sheet"
      title={editWalk ? "Edit walk" : "Track walk"}
      confirmLabel={editWalk ? "Save changes" : "Save walk"}
      onConfirm={save}
      body={
        <>
        {/* Date picker — native date input */}
        <Field label="Date">
          <input
            className="wts-field"
            type="date"
            value={dateISO}
            max={localISO(new Date())}
            onChange={(e) => setDateISO(e.target.value)}
            style={{
              width: "100%",
              height: 28,
              boxSizing: "border-box",
              padding: "0 16px",
              borderRadius: 16,
              border: `1px solid ${DARK}`,
              background: "transparent",
              color: DARK,
              colorScheme: "light",
              fontFamily: "var(--font-ui)",
              fontWeight: 500,
              fontSize: 16,
              outline: "none",
            }}
          />
        </Field>

        {/* Weather picker — same segmented style as the date selector */}
        <Field label="Weather">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
              padding: 6,
              borderRadius: 16,
              background: DARK,
              overflow: "hidden",
            }}
          >
            {WEATHERS.map((w) => {
              const active = weather === w.value;
              return (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setWeather(active ? "" : w.value)}
                  aria-pressed={active}
                  aria-label={w.label}
                  title={w.label}
                  style={{
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 4,
                    padding: "8px 2px",
                    borderRadius: 12,
                    border: "none",
                    cursor: "pointer",
                    lineHeight: 1,
                    color: active ? DARK : WALK,
                    background: active ? WALK : "transparent",
                  }}
                >
                  <Icon icon={Icons[w.icon]} color="inherit" />
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontWeight: 500,
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                  >
                    {w.label}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        {/* Terrain picker — toggle reveals a segmented grid like the weather one */}
        <Field label="Terrain">
          <ChoiceButton
            label="Add terrain"
            selected={showTerrain}
            onClick={() =>
              setShowTerrain((v) => {
                if (v) setTerrain("");
                return !v;
              })
            }
          />
          {showTerrain && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 6,
                padding: 6,
                borderRadius: 16,
                background: DARK,
                overflow: "hidden",
              }}
            >
              {TERRAINS.map((t) => {
                const active = terrain === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTerrain(active ? "" : t.value)}
                    aria-pressed={active}
                    aria-label={t.label}
                    title={t.label}
                    style={{
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      padding: "8px 2px",
                      borderRadius: 12,
                      border: "none",
                      cursor: "pointer",
                      lineHeight: 1,
                      color: active ? DARK : WALK,
                      background: active ? WALK : "transparent",
                    }}
                  >
                    <Icon icon={Icons[t.icon]} color="inherit" />
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontWeight: 500,
                        fontSize: 10,
                        lineHeight: 1,
                      }}
                    >
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <Field label="Duration">
          <SheetInput value={duration} onChange={setDuration} placeholder="40" inputMode="numeric" suffix="min" />
        </Field>

        <Field label="Steps">
          <SheetInput value={steps} onChange={setSteps} placeholder="12000" inputMode="numeric" suffix="steps" />
        </Field>

        <Field label="Distance">
          <SheetInput value={distance} onChange={setDistance} placeholder="2.5" inputMode="decimal" suffix="km" />
        </Field>

        <Field label="Extras">
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceButton label="Pooped" selected={pooped} onClick={() => setPooped((v) => !v)} />
            <ChoiceButton label="Socialised" selected={socialised} onClick={() => setSocialised((v) => !v)} />
          </div>
        </Field>

        {/* Only meaningful once there's someone other than the user to pick —
            a co-owner or sitter. Still shown if an entry already has an
            assignee (e.g. editing after the co-owner/sitter was removed). */}
        {(walkers.length > 1 || assignee != null) && (
          <Field label="Walked by">
            <WalkerSelect walkers={walkers} value={assignee} onChange={setAssignee} />
          </Field>
        )}

        <Field label="Notes">
          <SheetTextarea value={notes} onChange={setNotes} placeholder="Anything worth remembering?" />
          {notes.trim() !== "" && (
            <ChoiceButton
              label="Send note to vet"
              selected={sendToVet}
              onClick={() => setSendToVet((v) => !v)}
            />
          )}
        </Field>

        </>
      }
    />
  );
}

const KIND_LABEL: Record<Walker["kind"], string> = {
  you: "You",
  coowner: "Co-owner",
  sitter: "Sitter",
};

/** Small circular avatar (coloured initial) for a walker. */
function WalkerDot({ name, size = 26 }: { name: string; size?: number }): React.ReactElement {
  const { bg, initials } = walkerAvatar(name);
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-ui)",
        fontWeight: 600,
        fontSize: size * 0.5,
        color: DARK,
      }}
    >
      {initials}
    </span>
  );
}

/**
 * Dropdown selecting who walked the dog — the signed-in user, a co-owner, or a
 * dog-sitter. Replaces the old hard-coded Person A/B toggle.
 */
function WalkerSelect({
  walkers,
  value,
  onChange,
}: {
  walkers: Walker[];
  value: string | null;
  onChange: (v: string | null) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const selected = value ? walkers.find((w) => w.name === value) : undefined;

  const pick = (name: string | null): void => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 16,
          borderRadius: 16,
          border: `1px solid ${DARK}`,
          background: "transparent",
          color: DARK,
          cursor: "pointer",
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          fontSize: 16,
          textAlign: "left",
        }}
      >
        {value ? (
          <>
            <WalkerDot name={value} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value}
            </span>
            {selected && (
              <span style={{ flexShrink: 0, opacity: 0.55, fontSize: 13 }}>{KIND_LABEL[selected.kind]}</span>
            )}
          </>
        ) : (
          <span style={{ flex: 1, opacity: 0.55 }}>Unassigned</span>
        )}
        <Icon
          icon={Icons.chevronDown}
          color="inherit"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
        />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 10,
            borderRadius: 16,
            background: DARK,
            padding: 6,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: 260,
            overflowY: "auto",
            boxShadow: "0 12px 32px rgba(0,0,0,0.28)",
          }}
        >
          <WalkerOption label="Unassigned" active={value == null} onClick={() => pick(null)} />
          {walkers.map((w) => (
            <WalkerOption
              key={`${w.kind}:${w.name}`}
              name={w.name}
              tag={KIND_LABEL[w.kind]}
              active={value === w.name}
              onClick={() => pick(w.name)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WalkerOption({
  name,
  label,
  tag,
  active,
  onClick,
}: {
  name?: string;
  label?: string;
  tag?: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        borderRadius: 12,
        border: "none",
        cursor: "pointer",
        background: active ? WALK : "transparent",
        color: active ? DARK : WALK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 15,
        textAlign: "left",
      }}
    >
      {name && <WalkerDot name={name} />}
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {name ?? label}
      </span>
      {tag && <span style={{ flexShrink: 0, opacity: 0.6, fontSize: 12 }}>{tag}</span>}
      {active && <Icon icon={Icons.check} color="inherit" />}
    </button>
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
  inputMode,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  inputMode?: "numeric" | "decimal";
  suffix?: string;
}): React.ReactElement {
  return (
    <div
      className="wts-field"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 28,
        boxSizing: "border-box",
        padding: "0 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        background: "transparent",
      }}
    >
      <input
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="wts-field"
        style={{
          flex: 1,
          minWidth: 0,
          padding: 0,
          border: "none",
          background: "transparent",
          color: DARK,
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          fontSize: 16,
          outline: "none",
        }}
      />
      {suffix && (
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            color: "rgba(53, 43, 37, 0.55)",
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            fontSize: 16,
          }}
        >
          {suffix}
        </span>
      )}
    </div>
  );
}

function SheetTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}): React.ReactElement {
  return (
    <textarea
      className="wts-field"
      value={value}
      placeholder={placeholder}
      rows={3}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        padding: "8px 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        background: "transparent",
        color: DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
        outline: "none",
        resize: "none",
      }}
    />
  );
}

function ChoiceButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "14px 16px",
        borderRadius: 16,
        border: `1px solid ${DARK}`,
        cursor: "pointer",
        background: selected ? DARK : "transparent",
        color: selected ? WALK : DARK,
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 16,
      }}
    >
      <span>{label}</span>
      {selected && <Icon icon={Icons.checkCircle} color="inherit" />}
    </button>
  );
}
