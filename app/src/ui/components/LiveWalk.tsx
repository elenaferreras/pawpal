import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { haversine } from "../lib/geo";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Modal } from "./Modal";
import { RouteCanvas } from "./RouteCanvas";
import type { GpsCoord } from "../types";

type Phase = "idle" | "active" | "summary";

interface LiveWalkContextValue {
  active: boolean;
  start: () => void;
}

const LiveWalkContext = createContext<LiveWalkContextValue | null>(null);

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

export function LiveWalkProvider({ children }: { children: ReactNode }): ReactNode {
  const { update } = useDb();
  const toast = useToast();

  const [phase, setPhase] = useState<Phase>("idle");
  const [open, setOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [steps, setSteps] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [gpsStatus, setGpsStatus] = useState("📍 Acquiring GPS…");
  const [coords, setCoords] = useState<GpsCoord[]>([]);

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
    setGpsStatus("📍 Acquiring GPS…");
    setWeather("");
    setPipi(false);
    setPopo(false);
    setFriends(false);
    setNotes("");

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
          if ((coord.acc ?? 999) < 50) {
            const prev = coordsRef.current[coordsRef.current.length - 1];
            if (prev) {
              distRef.current += haversine(prev.lat, prev.lng, coord.lat, coord.lng);
              setDistanceKm(distRef.current);
            }
            coordsRef.current = [...coordsRef.current, coord];
            setCoords(coordsRef.current);
            setGpsStatus("📍 GPS active · accuracy " + Math.round(coord.acc ?? 0) + "m");
          }
        },
        () => setGpsStatus("⚠️ GPS unavailable — distance won’t be tracked"),
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
      );
    } else {
      setGpsStatus("⚠️ GPS not supported on this device");
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

  const mm = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const ss = (elapsed % 60).toString().padStart(2, "0");
  const paceStr =
    distanceKm > 0.05 && elapsed > 0
      ? (() => {
          const p = elapsed / 60 / distanceKm;
          return Math.floor(p) + ":" + Math.round((p % 1) * 60).toString().padStart(2, "0");
        })()
      : "—";

  return (
    <LiveWalkContext.Provider value={{ active: phase !== "idle", start }}>
      {children}

      {phase !== "idle" && !open && (
        <div className="live-walk-bar" onClick={() => setOpen(true)}>
          <span className="lw-label">
            <span className="live-dot" />
            On a walk — {mm}:{ss}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Tap to open</span>
        </div>
      )}

      <Modal
        open={open}
        title={phase === "summary" ? "Walk complete! 🎉" : "Walk in progress"}
        onClose={() => setOpen(false)}
      >
        {phase === "active" && (
          <div style={{ padding: "0 18px" }}>
            <div className="stat-row">
              <div className="stat-chip">
                <div className="sv">{mm}:{ss}</div>
                <div className="sl">Time</div>
              </div>
              <div className="stat-chip">
                <div className="sv">{steps}</div>
                <div className="sl">Steps</div>
              </div>
              <div className="stat-chip">
                <div className="sv">{distanceKm.toFixed(2)}</div>
                <div className="sl">km</div>
              </div>
              <div className="stat-chip">
                <div className="sv">{paceStr}</div>
                <div className="sl">min/km</div>
              </div>
            </div>
            <RouteCanvas coords={coords} />
            <div
              style={{
                margin: "0 0 16px",
                padding: "8px 12px",
                borderRadius: 12,
                background: "var(--green-light)",
                color: "var(--green)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {gpsStatus}
            </div>
            <button className="btn btn-secondary btn-full" style={{ marginBottom: 10 }} onClick={finish}>
              Finish walk
            </button>
            <button className="btn btn-danger btn-full" onClick={cancel}>
              Cancel
            </button>
          </div>
        )}

        {phase === "summary" && (
          <div style={{ padding: "0 18px" }}>
            <div className="stat-row">
              <div className="stat-chip">
                <div className="sv">{Math.round(elapsed / 60)}</div>
                <div className="sl">min</div>
              </div>
              <div className="stat-chip">
                <div className="sv">{steps}</div>
                <div className="sl">steps</div>
              </div>
              <div className="stat-chip">
                <div className="sv">{distanceKm.toFixed(2)}</div>
                <div className="sl">km</div>
              </div>
              <div className="stat-chip">
                <div className="sv">{paceStr}</div>
                <div className="sl">pace</div>
              </div>
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
              <ToggleChip label="💧 Pipi" active={pipi} onClick={() => setPipi(!pipi)} />
              <ToggleChip label="💩 Popo" active={popo} onClick={() => setPopo(!popo)} />
              <ToggleChip label="🐶 Friends" active={friends} onClick={() => setFriends(!friends)} />
            </div>

            <div className="form-group">
              <span className="form-label">Notes</span>
              <textarea
                className="form-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How was the walk?"
              />
            </div>

            <button className="btn btn-primary btn-full" onClick={saveWalk}>
              Save walk
            </button>
          </div>
        )}
      </Modal>
    </LiveWalkContext.Provider>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      className={"ob-part-pill" + (active ? " selected" : "")}
      style={{ flex: 1 }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function useLiveWalk(): LiveWalkContextValue {
  const ctx = useContext(LiveWalkContext);
  if (!ctx) throw new Error("useLiveWalk must be used within a LiveWalkProvider");
  return ctx;
}
