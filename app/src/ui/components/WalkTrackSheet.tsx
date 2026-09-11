import { useEffect, useRef, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import { Group, SelectRow, NumberRow, DateRow, ToggleRow, NotesField } from "./SheetForm";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { autoWeather, currentPosition } from "../lib/weather";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons, type AppIconName } from "../lib/icons";
import { nowTime } from "../lib/date";
import { useWalkers, myWalkerName, walkerAvatar, type Walker } from "../lib/walkers";
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

// Sky states (map 1:1 to WMO codes) first; the two derived "feel" states last.
const WEATHERS: { value: string; icon: AppIconName; label: string }[] = [
  { value: "sunny", icon: "sun", label: "Sunny" },
  { value: "cloudy", icon: "cloud", label: "Cloudy" },
  { value: "rainy", icon: "cloudRain", label: "Rainy" },
  { value: "snowy", icon: "snowflake", label: "Snowy" },
  { value: "foggy", icon: "cloudFog", label: "Foggy" },
  { value: "stormy", icon: "cloudLightning", label: "Stormy" },
  { value: "windy", icon: "wind", label: "Windy" },
  { value: "hot", icon: "thermometer", label: "Hot" },
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
  const [terrain, setTerrain] = useState("");
  const [notes, setNotes] = useState("");
  const [sendToVet, setSendToVet] = useState(false);
  // Set once the user taps a weather chip, so auto-detect never overrides them.
  const weatherTouched = useRef(false);

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
      setNotes(editWalk.notes ?? "");
      setSendToVet(!!editWalk.sentToVet);
    } else {
      // New walk: carry forward the last walk's numbers/conditions so logging a
      // routine walk is one tap; results + notes start empty, walker = current
      // user (owner, co-owner or sitter).
      const last = db.walks
        .filter((w) => w.created)
        .sort((a, b) => (b.created || "").localeCompare(a.created || ""))[0];
      setDateISO(prefillDate || localISO(new Date()));
      setDuration(last?.duration ? String(last.duration) : "");
      setSteps(last?.steps ? String(last.steps) : "");
      setDistance(last?.distance ? String(last.distance) : "");
      setPooped(false);
      setSocialised(false);
      setAssignee(myWalkerName());
      setWeather(last?.weather ?? "");
      setTerrain(last?.terrain ?? "");
      setNotes("");
      setSendToVet(false);
    }
    weatherTouched.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  // For a new walk, replace the carried-forward guess with the live conditions
  // at the user's location. Prefill only — a manual pick or an edit wins.
  useEffect(() => {
    if (!open || editWalk) return;
    let cancelled = false;
    currentPosition()
      .then((pos) => autoWeather(pos.coords.latitude, pos.coords.longitude))
      .then((w) => {
        if (!cancelled && w && !weatherTouched.current) setWeather(w);
      })
      .catch(() => {
        /* denied or offline — keep the carried-forward default */
      });
    return () => {
      cancelled = true;
    };
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
          terrain: terrain,
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
      terrain: terrain,
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
      sheetClassName="form-sheet walk-sheet"
      title={editWalk ? "Edit walk" : "Track walk"}
      confirmLabel={editWalk ? "Save changes" : "Save walk"}
      onConfirm={save}
      body={
        <div className="wts-form">
          <Group title="Walk details">
            <DateRow label="Date" value={dateISO} max={localISO(new Date())} onChange={setDateISO} />
            <NumberRow label="Duration" value={duration} onChange={setDuration} suffix="min" inputMode="numeric" />
            <NumberRow label="Steps" value={steps} onChange={setSteps} suffix="steps" inputMode="numeric" />
            <NumberRow label="Distance" value={distance} onChange={setDistance} suffix="km" inputMode="decimal" />
            {/* Only meaningful once there's someone other than the user to pick —
                a co-owner or sitter. Still shown if an entry already has an
                assignee (e.g. editing after the co-owner/sitter was removed). */}
            {(walkers.length > 1 || assignee != null) && (
              <WalkerRow walkers={walkers} value={assignee} onChange={setAssignee} />
            )}
          </Group>

          <Group title="Conditions">
            <SelectRow
              label="Weather"
              placeholder="Add"
              value={weather}
              onChange={(v) => {
                weatherTouched.current = true;
                setWeather(v);
              }}
              options={WEATHERS.map((w) => ({ value: w.value, label: w.label, icon: w.icon }))}
            />
            <SelectRow
              label="Terrain"
              placeholder="Add"
              value={terrain}
              onChange={setTerrain}
              options={TERRAINS.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
            />
          </Group>

          <Group title="Results">
            <ToggleRow label="Socialised" value={socialised} onChange={setSocialised} />
            <ToggleRow label="Pooped" value={pooped} onChange={setPooped} />
          </Group>

          <section className="wts-group">
            <h3 className="wts-group-title">Notes</h3>
            <div className="wts-group-card">
              <NotesField value={notes} onChange={setNotes} />
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

/** "Walked by" row — the platform's native picker of the owner, co-owners and
    sitters, shown over the chip. */
function WalkerRow({
  walkers,
  value,
  onChange,
}: {
  walkers: Walker[];
  value: string | null;
  onChange: (v: string | null) => void;
}): React.ReactElement {
  return (
    <div className="wts-row">
      <span className="wts-row-label">Walked by</span>
      <span className={`wts-chip${value ? "" : " wts-chip--empty"}`} style={{ position: "relative" }}>
        {value && <WalkerDot name={value} size={20} />}
        <span className="wts-chip-text">{value ?? "Unassigned"}</span>
        <Icon icon={Icons.chevronUpDown} width={14} height={14} color="inherit" style={{ opacity: 0.5 }} />
        <select
          className="wts-native-select"
          aria-label="Walked by"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        >
          <option value="">Unassigned</option>
          {walkers.map((w) => (
            <option key={`${w.kind}:${w.name}`} value={w.name}>
              {w.name}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}
