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
import { VStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "./Button";
import { TextArea } from "@astryxdesign/core/TextArea";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Modal } from "./Modal";
import { MotionSheet } from "./MotionSheet";
import { RouteMap } from "./RouteMap";
import { Icons } from "../lib/icons";
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

  // The live map's "you are here" pin uses the dog's own avatar so the walk
  // feels personal. Mirrors <DogAvatar>: a chosen sticker wins, otherwise the
  // full standing dog. The inner art is kept smaller than the circle (~the same
  // 112/136 ratio as the avatar editor) so the round mask never clips it.
  const markerHtml = useMemo(() => {
    const av = db.profile.avatar;
    const bg = av?.bg ?? "var(--color-data-yellow-3)";
    const sticker = stickerUrl(av?.sticker);
    const inner = sticker
      ? `<img src="${sticker}" alt="" width="40" height="40" style="display:block" />`
      : av
        ? buildDogSVG(av, 34)
        : buildDogFace(undefined, 30);
    return `<div class="lw-pin-inner" style="background:${bg}">${inner}</div>`;
  }, [db.profile.avatar]);

  return (
    <LiveWalkContext.Provider value={{ active: phase !== "idle", start, openSheet: () => setOpen(true), coords, elapsed }}>
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

      <Modal
        open={open && phase === "summary"}
        title="Walk complete! 🎉"
        onClose={() => setOpen(false)}
      >
        {phase === "summary" && (
          <VStack gap={3}>
            <Grid columns={4} gap={2}>
              <StatChip value={String(Math.round(elapsed / 60))} label="min" />
              <StatChip value={String(steps)} label="steps" />
              <StatChip value={distanceKm.toFixed(2)} label="km" />
              <StatChip value={paceStr} label="pace" />
            </Grid>

            {coords.length > 1 && <RouteMap coords={coords} height={200} mapStyle="dark" />}

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
