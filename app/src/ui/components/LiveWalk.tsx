import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { haversine } from "../lib/geo";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { MotionSheet } from "./MotionSheet";
import { RouteMap } from "./RouteMap";
import { Icons, type AppIconName } from "../lib/icons";
import { buildDogSVG, buildDogFace } from "../avatar/build";
import { stickerUrl } from "../avatar/stickers";
import type { GpsCoord } from "../types";

type Phase = "idle" | "active" | "summary";

interface LiveWalkContextValue {
  active: boolean;
  start: () => void;
  /** Re-open the live walk sheet (e.g. to finish the walk). */
  openSheet: () => void;
  /** Live GPS route captured so far (empty until fixes arrive). */
  coords: GpsCoord[];
  /** Elapsed seconds since the walk started. */
  elapsed: number;
  /** HTML for the dog-avatar map marker (shared with previews). */
  markerHtml: string;
  /** Latest GPS accuracy in metres (for the accuracy ring), or null. */
  accuracy: number | null;
}

const LiveWalkContext = createContext<LiveWalkContextValue | null>(null);

// Walk-sheet surface tokens (matches WalkTrackSheet).
const SHEET_DARK = "var(--color-pawpal-page)"; // #352B25
const SHEET_WALK = "var(--color-dash-walk)"; // #9CCFFF

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
// A walk lives in React state, which the OS discards when it suspends/kills a
// backgrounded tab (e.g. the phone is locked mid-walk). We mirror the session
// to localStorage so reopening the app restores it with data intact. Elapsed
// time is always recomputed from the wall-clock `startTime`, so a suspended
// walk resumes at the correct duration even though the JS timer was paused.
const LW_KEY = "pawpal-live-walk";
// Ignore a persisted walk older than this (stale/forgotten session).
const LW_MAX_AGE_MS = 12 * 60 * 60 * 1000;

interface PersistedWalk {
  startTime: number;
  coords: GpsCoord[];
  steps: number;
  distanceKm: number;
  phase: "active" | "summary";
  weather: string;
  pipi: boolean;
  popo: boolean;
  friends: boolean;
  notes: string;
}

function loadPersistedWalk(): PersistedWalk | null {
  try {
    const raw = localStorage.getItem(LW_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PersistedWalk;
    if (!p || typeof p.startTime !== "number") return null;
    if (p.phase !== "active" && p.phase !== "summary") return null;
    if (Date.now() - p.startTime > LW_MAX_AGE_MS) return null;
    return p;
  } catch {
    return null;
  }
}

function savePersistedWalk(p: PersistedWalk): void {
  try {
    localStorage.setItem(LW_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

function clearPersistedWalk(): void {
  try {
    localStorage.removeItem(LW_KEY);
  } catch {
    /* ignore */
  }
}
export function LiveWalkProvider({ children }: { children: ReactNode }): ReactNode {
  const { db, update } = useDb();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [gpsStatus, setGpsStatus] = useState("Acquiring GPS…");
  const [coords, setCoords] = useState<GpsCoord[]>([]);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Summary form state.
  const [weather, setWeather] = useState("");
  const [pipi, setPipi] = useState(false);
  const [popo, setPopo] = useState(false);
  const [friends, setFriends] = useState(false);
  const [notes, setNotes] = useState("");

  const startTime = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchId = useRef<number | null>(null);
  const motionHandler = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const lastAccel = useRef<number | null>(null);
  const lastStep = useRef(0);
  const coordsRef = useRef<GpsCoord[]>([]);
  const stepsRef = useRef(0);
  const distRef = useRef(0);

  const stopSensors = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (watchId.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    if (motionHandler.current) {
      window.removeEventListener("devicemotion", motionHandler.current);
    }
    timer.current = null;
    watchId.current = null;
    motionHandler.current = null;
  }, []);

  useEffect(() => stopSensors, [stopSensors]);

  // While the walk is minimised to the top bar, offset the page content so the
  // bar pushes the layout down instead of overlapping the header.
  useEffect(() => {
    const showBar = phase !== "idle" && !open;
    document.body.classList.toggle("has-live-bar", showBar);
    return () => document.body.classList.remove("has-live-bar");
  }, [phase, open]);

  // Attach the elapsed-timer, GPS watch and step counter. Shared by a fresh
  // `start()` and by resuming a persisted walk, so it never resets progress —
  // it appends onto whatever is already in the *Ref accumulators.
  const startSensors = useCallback(() => {
    timer.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);

    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coord: GpsCoord = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy,
          };
          setAccuracy(coord.acc ?? null);
          if ((coord.acc ?? 999) < 50) {
            const prev = coordsRef.current[coordsRef.current.length - 1];
            if (prev) {
              distRef.current += haversine(prev.lat, prev.lng, coord.lat, coord.lng);
              setDistanceKm(distRef.current);
            }
            coordsRef.current = [...coordsRef.current, coord];
            setCoords(coordsRef.current);
            setGpsStatus("GPS active · accuracy " + Math.round(coord.acc ?? 0) + "m");
          }
        },
        () => {
          setAccuracy(null);
          setGpsStatus("GPS unavailable — distance won’t be tracked");
        },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
      );
    } else {
      setGpsStatus("GPS not supported on this device");
    }

    const handleMotion = (e: DeviceMotionEvent): void => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const now = Date.now();
      if (lastAccel.current !== null) {
        const delta = Math.abs(mag - lastAccel.current);
        if (delta > 12 && now - lastStep.current > 300) {
          stepsRef.current += 1;
          lastStep.current = now;
          setSteps(stepsRef.current);
        }
      }
      lastAccel.current = mag;
    };
    motionHandler.current = handleMotion;
    window.addEventListener("devicemotion", handleMotion);
  }, []);

  const start = useCallback(() => {
    startTime.current = Date.now();
    coordsRef.current = [];
    stepsRef.current = 0;
    distRef.current = 0;
    lastAccel.current = null;
    lastStep.current = 0;
    setPhase("active");
    setOpen(true);
    setElapsed(0);
    setSteps(0);
    setDistanceKm(0);
    setCoords([]);
    setGpsStatus("Acquiring GPS…");
    setAccuracy(null);
    setWeather("");
    setPipi(false);
    setPopo(false);
    setFriends(false);
    setNotes("");
    startSensors();
  }, [startSensors]);

  const finish = useCallback(() => {
    stopSensors();
    setPhase("summary");
  }, [stopSensors]);

  const cancel = useCallback(() => {
    if (!window.confirm("Cancel this walk? All progress will be lost.")) return;
    stopSensors();
    setPhase("idle");
    setOpen(false);
  }, [stopSensors]);

  const saveWalk = useCallback(() => {
    const start = new Date(startTime.current);
    const walk = {
      date: start.toISOString().split("T")[0],
      time:
        start.getHours().toString().padStart(2, "0") +
        ":" +
        start.getMinutes().toString().padStart(2, "0"),
      duration: Math.round(elapsed / 60),
      steps: stepsRef.current,
      distance: parseFloat(distRef.current.toFixed(2)),
      pipi,
      popo,
      friends,
      weather,
      notes,
      gpsRoute: coordsRef.current.slice(0, 500),
      created: new Date().toISOString(),
    };
    update((d) => {
      d.walks.push(walk);
    });
    setPhase("idle");
    setOpen(false);
    toast("Walk saved!");
  }, [elapsed, pipi, popo, friends, weather, notes, update, toast]);

  // Restore a walk that was in progress when the app was last closed/suspended.
  // Runs once on mount. Active walks resume minimised (top bar) so they're not
  // intrusive; a walk left on the summary screen reopens that screen.
  useEffect(() => {
    const s = loadPersistedWalk();
    if (!s) return;
    startTime.current = s.startTime;
    coordsRef.current = s.coords ?? [];
    stepsRef.current = s.steps ?? 0;
    distRef.current = s.distanceKm ?? 0;
    setCoords(coordsRef.current);
    setSteps(stepsRef.current);
    setDistanceKm(distRef.current);
    setWeather(s.weather ?? "");
    setPipi(!!s.pipi);
    setPopo(!!s.popo);
    setFriends(!!s.friends);
    setNotes(s.notes ?? "");
    setElapsed(Math.floor((Date.now() - s.startTime) / 1000));
    if (s.phase === "active") {
      setPhase("active");
      setOpen(false);
      startSensors();
    } else {
      setPhase("summary");
      setOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the session on every meaningful change so it survives a suspend/
  // kill. Clearing on idle removes it after finishing/cancelling a walk.
  useEffect(() => {
    if (phase === "idle") {
      clearPersistedWalk();
      return;
    }
    savePersistedWalk({
      startTime: startTime.current,
      coords: coordsRef.current.slice(0, 500),
      steps: stepsRef.current,
      distanceKm: distRef.current,
      phase,
      weather,
      pipi,
      popo,
      friends,
      notes,
    });
  }, [phase, coords, steps, distanceKm, weather, pipi, popo, friends, notes]);

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  const paceStr =
    distanceKm > 0.05 && elapsed > 0
      ? (() => {
          const p = elapsed / 60 / distanceKm;
          return Math.floor(p) + ":" + Math.round((p % 1) * 60).toString().padStart(2, "0");
        })()
      : "—";

  // The live map's "you are here" pin uses the dog's own avatar so the walk
  // feels personal. Mirrors <DogAvatar>: a chosen sticker wins, otherwise the
  // full standing dog. The inner art is kept smaller than the circle (~the same
  // 112/136 ratio as the avatar editor) so the round mask never clips it.
  const markerHtml = useMemo(() => {
    const av = db.profile.avatar;
    const bg = av?.bg ?? "var(--color-data-yellow-3)";
    const sticker = stickerUrl(av?.sticker);
    const inner = sticker
      ? `<img src="${sticker}" alt="" style="display:block;width:34px;height:34px;object-fit:contain" />`
      : av
        ? buildDogSVG(av, 28)
        : buildDogFace(undefined, 26);
    return `<div class="lw-pin-inner" style="background:${bg}">${inner}</div>`;
  }, [db.profile.avatar]);

  return (
    <LiveWalkContext.Provider value={{ active: phase !== "idle", start, openSheet: () => setOpen(true), coords, elapsed, markerHtml, accuracy }}>
      {children}

      {phase !== "idle" && !open && (
        <div className="live-walk-bar" onClick={() => setOpen(true)}>
          <span className="lw-label">
            <span className="live-dot" />
            <span className="lw-bar-title">On a walk</span>
            <span className="lw-bar-time">{mm}:{ss}</span>
            {distanceKm > 0 && <span className="lw-bar-dist">{distanceKm.toFixed(2)} km</span>}
          </span>
          <span className="lw-bar-open">Tap to open</span>
        </div>
      )}

      <MotionSheet
        open={open && phase === "active"}
        onClose={() => setOpen(false)}
        ariaLabel="Walk in progress"
        scrimClassName="lws-scrim"
        sheetClassName="lws"
      >
        <div className="lws-grip" aria-hidden />
        <div className="lws-head">
          <span className="lws-title">
            <span className="live-dot" />
            Walk in progress
          </span>
          <button
            type="button"
            className="lws-min"
            aria-label="Minimise"
            onClick={() => setOpen(false)}
          >
            <Icon icon={Icons.chevronDown} color="inherit" />
          </button>
        </div>

        <div className="lws-stats">
          <SheetStat value={`${mm}:${ss}`} label="Time" />
          <SheetStat value={String(steps)} label="Steps" />
          <SheetStat value={distanceKm.toFixed(2)} label="km" />
          <SheetStat value={paceStr} label="min/km" />
        </div>

        <div className="lws-route">
          {coords.length >= 1 ? (
            <RouteMap
              coords={coords}
              live
              follow
              markerHtml={markerHtml}
              accuracyM={accuracy ?? undefined}
              mapStyle="voyager"
              height={220}
              lineColor="#8592E0"
            />
          ) : (
            <div className="lws-map-loading" style={{ height: 220 }}>
              <span className="lws-map-spinner" aria-hidden />
              <span>Finding your location…</span>
            </div>
          )}
        </div>

        <div className="lws-gps">
          <GpsSignal accuracy={accuracy} />
          <span className="lws-gps-text">{gpsStatus}</span>
        </div>

        <div className="lws-actions">
          <button type="button" className="lws-btn lws-btn--primary" onClick={finish}>
            Finish walk
          </button>
          <button type="button" className="lws-btn lws-btn--cancel" onClick={cancel}>
            Cancel walk
          </button>
        </div>
      </MotionSheet>

      <MotionSheet
        open={open && phase === "summary"}
        onClose={() => setOpen(false)}
        ariaLabel="Walk complete"
        scrimClassName="walk-sheet-scrim"
        sheetClassName="walk-sheet"
      >
        {phase === "summary" && (
          <>
            <div className="walk-sheet-body">
              <p
                style={{
                  margin: 0,
                  fontFamily: "var(--font-ui)",
                  fontWeight: 700,
                  fontSize: 32,
                  color: SHEET_DARK,
                }}
              >
                Walk complete! 🎉
              </p>

              <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                <SummaryStat value={String(Math.round(elapsed / 60))} label="min" />
                <SummaryStat value={String(steps)} label="steps" />
                <SummaryStat value={distanceKm.toFixed(2)} label="km" />
                <SummaryStat value={paceStr} label="pace" />
              </div>

              {coords.length > 1 && (
                <div style={{ marginTop: 24, borderRadius: 16, overflow: "hidden" }}>
                  <RouteMap coords={coords} height={200} mapStyle="voyager" lineColor="#352B25" />
                </div>
              )}

              <SummaryField label="Weather">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, 1fr)",
                    gap: 6,
                    padding: 6,
                    borderRadius: 16,
                    background: SHEET_DARK,
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
                          color: active ? SHEET_DARK : SHEET_WALK,
                          background: active ? SHEET_WALK : "transparent",
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
              </SummaryField>

              <SummaryField label="Extras">
                <div style={{ display: "flex", gap: 8 }}>
                  <SummaryChoice label="Pipi" selected={pipi} onClick={() => setPipi((v) => !v)} />
                  <SummaryChoice label="Popo" selected={popo} onClick={() => setPopo((v) => !v)} />
                  <SummaryChoice label="Friends" selected={friends} onClick={() => setFriends((v) => !v)} />
                </div>
              </SummaryField>

              <SummaryField label="Notes">
                <textarea
                  className="wts-field"
                  value={notes}
                  placeholder="How was the walk?"
                  rows={3}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: 16,
                    border: `1px solid ${SHEET_DARK}`,
                    background: "transparent",
                    color: SHEET_DARK,
                    fontFamily: "var(--font-ui)",
                    fontWeight: 500,
                    fontSize: 16,
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </SummaryField>
            </div>

            <div className="walk-sheet-footer">
              <button
                type="button"
                onClick={saveWalk}
                style={{
                  width: "100%",
                  padding: 16,
                  borderRadius: 16,
                  border: "none",
                  cursor: "pointer",
                  background: SHEET_DARK,
                  color: SHEET_WALK,
                  fontFamily: "var(--font-ui)",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                Save walk
              </button>
            </div>
          </>
        )}
      </MotionSheet>
    </LiveWalkContext.Provider>
  );
}

function SummaryField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 16, color: SHEET_DARK }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        padding: "12px 4px",
        borderRadius: 16,
        border: `1px solid ${SHEET_DARK}`,
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 18, color: SHEET_DARK }}>
        {value}
      </span>
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          fontSize: 12,
          color: SHEET_DARK,
          opacity: 0.7,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SummaryChoice({
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
        border: `1px solid ${SHEET_DARK}`,
        cursor: "pointer",
        background: selected ? SHEET_DARK : "transparent",
        color: selected ? SHEET_WALK : SHEET_DARK,
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

// Dark-surface stat used on the "Walk in progress" bottom sheet. Flexes to an
// equal share of the row so the four stats always fit without horizontal scroll.
// The value briefly "pops" when it changes to make the live feed feel alive.
function SheetStat({ value, label }: { value: string; label: string }): React.ReactElement {
  return (
    <div className="lws-stat">
      <span key={value} className="lws-stat-value">
        {value}
      </span>
      <span className="lws-stat-label">{label}</span>
    </div>
  );
}

// Signal-strength meter (four bars) derived from the raw GPS accuracy in metres.
// Fewer metres = tighter fix = more bars. `null` means we have no fix yet.
function GpsSignal({ accuracy }: { accuracy: number | null }): React.ReactElement {
  const level =
    accuracy === null
      ? 0
      : accuracy <= 10
        ? 4
        : accuracy <= 25
          ? 3
          : accuracy <= 50
            ? 2
            : 1;
  const searching = level === 0;
  return (
    <span
      className={"lws-signal" + (searching ? " is-searching" : "")}
      role="img"
      aria-label={searching ? "Searching for GPS" : `GPS signal ${level} of 4`}
    >
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className={"lws-signal-bar" + (bar <= level ? " is-on" : "")}
          style={{ animationDelay: `${bar * 0.12}s` }}
        />
      ))}
    </span>
  );
}

export function useLiveWalk(): LiveWalkContextValue {
  const ctx = useContext(LiveWalkContext);
  if (!ctx) throw new Error("useLiveWalk must be used within a LiveWalkProvider");
  return ctx;
}
