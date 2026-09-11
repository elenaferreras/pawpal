import { useEffect, useRef, useState } from "react";
import { MotionSheet } from "./MotionSheet";
import {
  Group,
  NumberRow,
  DateRow,
  TextRow,
  ToggleRow,
  StepperRow,
  MultiSelectRow,
  NotesField,
} from "./SheetForm";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { autoWeather, currentPosition } from "../lib/weather";
import { reverseGeocode } from "../lib/geo";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons, type AppIconName } from "../lib/icons";
import { nowTime } from "../lib/date";
import { useWalkers, myWalkerName, walkerAvatar, type Walker } from "../lib/walkers";
import { useLiveWalk } from "./LiveWalk";
import type { Database, Walk } from "../types";

interface WalkTrackSheetProps {
  open: boolean;
  onClose: () => void;
  /** When set, the sheet edits this existing walk instead of the day's aggregate. */
  editIndex?: number | null;
  /** Pre-fills the date for a new day's activity (e.g. the selected calendar day). */
  prefillDate?: string | null;
  /** Open on the "Log a walk" chooser step, which morphs into the activity form. */
  startInChooser?: boolean;
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

/** True when a walk is a live-GPS session entry (kept separate from the day's aggregate). */
function isLiveEntry(w: Walk): boolean {
  return Array.isArray(w.gpsRoute) && w.gpsRoute.length > 1;
}

/** One-line summary of a day's aggregate for the chooser's edit preview. */
function activitySummary(w: Walk): string {
  const walks = w.walksCount ?? 1;
  const parts = [`${walks} walk${walks === 1 ? "" : "s"}`];
  const steps = parseInt(String(w.steps)) || 0;
  if (steps) parts.push(`${steps.toLocaleString("de-DE")} steps`);
  const poops = w.poops ?? 0;
  if (poops) parts.push(`${poops} poop${poops === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/**
 * "Activity of the day" bottom sheet.
 *
 * Aggregates the whole day's walking into a single entry per calendar day
 * (re-opening a day edits it). Fields: date, amount of walks, steps, walker,
 * location, weather + terrain (multiselect), socialised, and a poop count.
 */
export function WalkTrackSheet({ open, onClose, editIndex, prefillDate, startInChooser }: WalkTrackSheetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const { walkers } = useWalkers();
  const { start: startLiveWalk } = useLiveWalk();

  const editWalk =
    editIndex != null && editIndex >= 0 && editIndex < db.walks.length ? db.walks[editIndex] : null;

  // "choose" shows the two options (live GPS vs the day's activity) and morphs
  // into "form" — the same sheet growing into the activity editor.
  const [step, setStep] = useState<"choose" | "form">("form");
  const [dateISO, setDateISO] = useState(localISO(new Date()));
  const [walksCount, setWalksCount] = useState(1);
  const [steps, setSteps] = useState("");
  const [poops, setPoops] = useState(0);
  const [socialised, setSocialised] = useState(false);
  const [assignee, setAssignee] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [weather, setWeather] = useState<string[]>([]);
  const [terrain, setTerrain] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [sendToVet, setSendToVet] = useState(false);
  // Set once the user edits these, so auto-detect never overrides them.
  const weatherTouched = useRef(false);
  const locationTouched = useRef(false);

  /** The day's aggregate walk (the manual, non-GPS entry) for a given date. */
  const aggregateIndexFor = (iso: string): number =>
    db.walks.findIndex((w) => w.date === iso && !isLiveEntry(w));

  const loadFrom = (w: Walk): void => {
    setDateISO(w.date || localISO(new Date()));
    setWalksCount(w.walksCount ?? 1);
    setSteps(String(w.steps ?? ""));
    setPoops(w.poops ?? 0);
    setSocialised(!!w.friends);
    setAssignee(w.assignee ?? null);
    setLocation(w.location ?? "");
    setWeather(w.weather ?? []);
    setTerrain(w.terrain ?? []);
    setNotes(w.notes ?? "");
    setSendToVet(!!w.sentToVet);
  };

  useEffect(() => {
    if (!open) return;
    setStep(startInChooser && editWalk == null ? "choose" : "form");
    if (editWalk) {
      loadFrom(editWalk);
    } else {
      const startDate = prefillDate || localISO(new Date());
      const existing = db.walks[aggregateIndexFor(startDate)];
      if (existing) {
        // Re-opening a day that already has an aggregate → edit it.
        loadFrom(existing);
      } else {
        // Fresh day: carry forward the last aggregate's conditions/walker so a
        // routine day is a couple of taps; outcomes start empty.
        const last = db.walks
          .filter((w) => w.created && !isLiveEntry(w))
          .sort((a, b) => (b.created || "").localeCompare(a.created || ""))[0];
        setDateISO(startDate);
        setWalksCount(1);
        setSteps(last?.steps ? String(last.steps) : "");
        setPoops(0);
        setSocialised(false);
        setAssignee(myWalkerName());
        setLocation(last?.location ?? "");
        setWeather(last?.weather ?? []);
        setTerrain(last?.terrain ?? []);
        setNotes("");
        setSendToVet(false);
      }
    }
    weatherTouched.current = false;
    locationTouched.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  // For a new day, fill weather + location from the user's current position.
  // Prefill only — a manual edit or an existing entry wins.
  useEffect(() => {
    if (!open || editWalk) return;
    let cancelled = false;
    currentPosition()
      .then(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const [w, place] = await Promise.all([
          autoWeather(latitude, longitude),
          reverseGeocode(latitude, longitude),
        ]);
        if (cancelled) return;
        if (w && !weatherTouched.current) setWeather((prev) => (prev.length ? prev : [w]));
        if (place && !locationTouched.current) setLocation((prev) => prev || place);
      })
      .catch(() => {
        /* denied or offline — keep carried-forward defaults */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  const save = (): void => {
    const trimmedNotes = notes.trim();
    // Keep a linked "Notes for the vet" checklist item in sync with this day's
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

    const fields = {
      date: dateISO,
      walksCount,
      steps: steps.trim(),
      poops,
      friends: socialised,
      assignee: assignee ?? undefined,
      location: location.trim(),
      weather,
      terrain,
      notes: trimmedNotes,
      sentToVet: sendToVet && trimmedNotes !== "",
    };

    // Upsert: edit the targeted walk, else the day's existing aggregate, else add.
    const targetIndex = editIndex != null && editWalk ? editIndex : aggregateIndexFor(dateISO);
    if (targetIndex >= 0) {
      update((d) => {
        const existing = d.walks[targetIndex];
        if (!existing) return;
        d.walks[targetIndex] = { ...existing, ...fields };
        syncVetNote(d, existing.created);
      });
      toast("Activity updated! 🦮");
      onClose();
      return;
    }
    const walk: Walk = {
      ...fields,
      time: nowTime(),
      created: new Date().toISOString(),
    };
    update((d) => {
      d.walks.push(walk);
      syncVetNote(d, walk.created);
    });
    toast("Activity saved! 🦮");
    onClose();
  };

  const existingForDate = aggregateIndexFor(dateISO) >= 0 || (editWalk != null);
  const existingAgg = editWalk ?? db.walks[aggregateIndexFor(dateISO)] ?? null;

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel={step === "choose" ? "Log a walk" : "Activity of the day"}
      scrimClassName="walk-sheet-scrim"
      sheetClassName="form-sheet walk-sheet"
      layout
      title={step === "choose" ? "Log a walk" : "Activity of the day"}
      onCancel={onClose}
      confirmLabel={existingForDate ? "Save changes" : "Save activity"}
      onConfirm={step === "form" ? save : undefined}
      body={
        step === "choose" ? (
          <WalkChooserBody
            editTitle={dateISO === localISO(new Date()) ? "Edit today's activity" : "Edit activity"}
            editSummary={existingAgg ? activitySummary(existingAgg) : null}
            onStartWalk={() => {
              onClose();
              startLiveWalk();
            }}
            onLogActivity={() => setStep("form")}
          />
        ) : (
          <div className="wts-form">
          <Group title="Activity details">
            <DateRow label="Date" value={dateISO} max={localISO(new Date())} onChange={setDateISO} />
            <StepperRow label="Amount of walks" value={walksCount} onChange={setWalksCount} min={0} />
            <NumberRow label="Total steps" value={steps} onChange={setSteps} suffix="steps" inputMode="numeric" />
            {/* Only meaningful once there's someone other than the user to pick —
                a co-owner or sitter. Still shown if an entry already has an
                assignee (e.g. editing after the co-owner/sitter was removed). */}
            {(walkers.length > 1 || assignee != null) && (
              <WalkerRow walkers={walkers} value={assignee} onChange={setAssignee} />
            )}
          </Group>

          <Group title="Conditions">
            <TextRow
              label="Location"
              value={location}
              onChange={(v) => {
                locationTouched.current = true;
                setLocation(v);
              }}
              placeholder="Add"
            />
            <MultiSelectRow
              label="Weather"
              value={weather}
              onChange={(v) => {
                weatherTouched.current = true;
                setWeather(v);
              }}
              options={WEATHERS.map((w) => ({ value: w.value, label: w.label, icon: w.icon }))}
            />
            <MultiSelectRow
              label="Terrain"
              value={terrain}
              onChange={setTerrain}
              options={TERRAINS.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
            />
          </Group>

          <Group title="Walk outcomes">
            <ToggleRow label="Socialised" value={socialised} onChange={setSocialised} />
            <StepperRow label="Amount of poops" value={poops} onChange={setPoops} min={0} />
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
        )
      }
    />
  );
}

/** The "Log a walk" chooser step: two options on the same walk sheet surface.
    "Log activity" morphs the sheet into the activity form. When the day already
    has an aggregate, its second card previews that entry and opens it to edit. */
function WalkChooserBody({
  editTitle,
  editSummary,
  onStartWalk,
  onLogActivity,
}: {
  editTitle: string;
  editSummary: string | null;
  onStartWalk: () => void;
  onLogActivity: () => void;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0 6px" }}>
      <ChooserCard
        icon={Icons.mapPin}
        title="Start a walk"
        subtitle="Track live with GPS"
        onClick={onStartWalk}
      />
      <ChooserCard
        icon={Icons.pencilSimple}
        title={editSummary ? editTitle : "Log activity"}
        subtitle={editSummary ?? "The whole day's walks"}
        onClick={onLogActivity}
      />
    </div>
  );
}

function ChooserCard({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: (typeof Icons)[keyof typeof Icons];
  title: string;
  subtitle: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button type="button" className="walk-chooser-card" onClick={onClick}>
      <span className="walk-chooser-icon">
        <Icon icon={icon} color="inherit" />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1, textAlign: "left" }}>
        <span className="walk-chooser-title">{title}</span>
        <span className="walk-chooser-sub">{subtitle}</span>
      </span>
    </button>
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
