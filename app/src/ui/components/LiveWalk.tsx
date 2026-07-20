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
import { VStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Modal } from "./Modal";
import { RouteCanvas } from "./RouteCanvas";
import { Icons } from "../lib/icons";
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
          <VStack gap={3}>
            <Grid columns={4} gap={2}>
              <StatChip value={`${mm}:${ss}`} label="Time" />
              <StatChip value={String(steps)} label="Steps" />
              <StatChip value={distanceKm.toFixed(2)} label="km" />
              <StatChip value={paceStr} label="min/km" />
            </Grid>
            <RouteCanvas coords={coords} />
            <Card variant="muted" padding={2}>
              <Text type="supporting">{gpsStatus}</Text>
            </Card>
            <Button
              label="Minimise"
              variant="ghost"
              icon={<Icon icon={Icons.chevronDown} />}
              onClick={() => setOpen(false)}
              style={{ width: "100%" }}
            />
            <Button label="Finish walk" variant="secondary" onClick={finish} style={{ width: "100%" }} />
            <Button label="Cancel" variant="destructive" onClick={cancel} style={{ width: "100%" }} />
          </VStack>
        )}

        {phase === "summary" && (
          <VStack gap={3}>
            <Grid columns={4} gap={2}>
              <StatChip value={String(Math.round(elapsed / 60))} label="min" />
              <StatChip value={String(steps)} label="steps" />
              <StatChip value={distanceKm.toFixed(2)} label="km" />
              <StatChip value={paceStr} label="pace" />
            </Grid>

            <VStack gap={1}>
              <Text type="label">Weather</Text>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {WEATHERS.map((w) => (
                  <ToggleButton
                    key={w.value}
                    label={w.value}
                    isIconOnly
                    icon={<span>{w.icon}</span>}
                    isPressed={weather === w.value}
                    onPressedChange={() => setWeather(weather === w.value ? "" : w.value)}
                  />
                ))}
              </div>
            </VStack>

            <div style={{ display: "flex", gap: 8 }}>
              <ToggleButton label="💧 Pipi" isPressed={pipi} onPressedChange={() => setPipi(!pipi)}>
                💧 Pipi
              </ToggleButton>
              <ToggleButton label="💩 Popo" isPressed={popo} onPressedChange={() => setPopo(!popo)}>
                💩 Popo
              </ToggleButton>
              <ToggleButton label="🐶 Friends" isPressed={friends} onPressedChange={() => setFriends(!friends)}>
                🐶 Friends
              </ToggleButton>
            </div>

            <TextArea label="Notes" value={notes} onChange={setNotes} placeholder="How was the walk?" />

            <Button label="Save walk" variant="primary" onClick={saveWalk} style={{ width: "100%" }} />
          </VStack>
        )}
      </Modal>
    </LiveWalkContext.Provider>
  );
}

function StatChip({ value, label }: { value: string; label: string }): React.ReactElement {
  return (
    <Card padding={2}>
      <VStack gap={0.5} hAlign="center">
        <Text weight="bold">{value}</Text>
        <Text type="supporting">{label}</Text>
      </VStack>
    </Card>
  );
}

export function useLiveWalk(): LiveWalkContextValue {
  const ctx = useContext(LiveWalkContext);
  if (!ctx) throw new Error("useLiveWalk must be used within a LiveWalkProvider");
  return ctx;
}
