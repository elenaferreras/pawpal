import { useMemo, useState, Fragment } from "react";
import { useDb } from "../lib/store";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { useLiveWalk } from "./LiveWalk";
import { RouteMap } from "./RouteMap";
import { PageTitle, StatNumber } from "./Typography";
import { DogFace } from "../avatar/DogAvatar";
import { fmtDate } from "../lib/date";
import type { Walk } from "../types";

interface WalksStatsProps {
  /** Optional back affordance; omitted when shown as a tab. */
  onBack?: () => void;
  /** Opens the add-walk flow from the header plus button. */
  onAdd?: () => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKS = 5;

type WalkFilter = "today" | "month" | "all";

const WALK_FILTERS: { value: WalkFilter; label: string }[] = [
  { value: "today", label: "Day" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
];

/** Colours for the two walk assignees, keyed off the tracker's Person A/B. */
const ASSIGNEE_STYLE: Record<string, { bg: string; initials: string }> = {
  "Person A": { bg: "#9CCFFF", initials: "A" },
  "Person B": { bg: "#FFFF83", initials: "B" },
};

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DayInfo {
  date: Date;
  steps: number;
  future: boolean;
}

/**
 * "Zipi's Walks" step heatmap (Figma node 31:259).
 *
 * Full-screen dark overlay opened from the Walks tab. Shows the last five weeks
 * (Mon-aligned) as a grid: active days are light-blue cells with an orange dot
 * sized by step count; empty/future days are muted cells with a small dot.
 */
export function WalksStats({ onBack, onAdd }: WalksStatsProps): React.ReactElement {
  const { db } = useDb();
  const { active: walkActive, coords, openSheet } = useLiveWalk();
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<WalkFilter>("today");

  const { days, maxSteps, avg } = useMemo(() => {
    const stepsByDay = new Map<string, number>();
    for (const w of db.walks) {
      const s = parseInt(String(w.steps)) || 0;
      stepsByDay.set(w.date, (stepsByDay.get(w.date) || 0) + s);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(today);
    start.setDate(today.getDate() - dow - (WEEKS - 1) * 7);

    const list: DayInfo[] = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      list.push({ date: d, steps: stepsByDay.get(localISO(d)) || 0, future: d > today });
    }

    const max = Math.max(0, ...list.map((d) => d.steps));
    const active = list.filter((d) => !d.future && d.steps > 0);
    const average = active.length
      ? Math.round(active.reduce((a, d) => a + d.steps, 0) / active.length)
      : 0;

    return { days: list, maxSteps: max, avg: average };
  }, [db.walks]);

  const name = db.profile.name.trim() || "Zipi";
  const selectedDay = selected !== null ? days[selected] : null;

  const entries = useMemo(() => {
    const now = new Date();
    const todayStr = localISO(now);
    // Newest walk first, using the walk's own date + time (falling back to the
    // created timestamp) rather than only when the row was inserted.
    const stamp = (w: Walk): number =>
      new Date(`${w.date}T${w.time || "00:00"}`).getTime() || new Date(w.created || w.date).getTime();
    const sorted = db.walks
      .map((w, index) => ({ w, index }))
      .sort((a, b) => stamp(b.w) - stamp(a.w));
    if (filter === "today") return sorted.filter(({ w }) => w.date === todayStr);
    if (filter === "month")
      return sorted.filter(({ w }) => {
        const d = new Date(w.date + "T12:00:00");
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
    return sorted;
  }, [db.walks, filter]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-pawpal-page)",
        padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {onBack && (
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          style={{
            width: 48,
            height: 48,
            border: "none",
            background: "none",
            color: "var(--color-pawpal-hero)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            marginLeft: -8,
          }}
        >
          <Icon icon={Icons.caretLeft} size="lg" color="inherit" />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <PageTitle style={{ flex: 1 }}>{name}&rsquo;s Walks</PageTitle>
        {onAdd && (
          <button
            type="button"
            aria-label="Add walk"
            onClick={onAdd}
            style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 12,
              border: "none",
              borderRadius: 100,
              background: "none",
              color: "var(--color-pawpal-hero)",
              cursor: "pointer",
            }}
          >
            <Icon icon={Icons.plusCircle} width={32} height={32} color="inherit" />
          </button>
        )}
      </div>

      {walkActive && (
        <button
          type="button"
          aria-label="Open walk in progress"
          onClick={openSheet}
          style={{
            background: "var(--color-dash-walk)",
            borderRadius: 40,
            padding: "20px 16px",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-brand)",
              fontWeight: 400,
              fontSize: 32,
              lineHeight: 1,
              color: "var(--color-pawpal-page)",
            }}
          >
            Walk in progress
          </p>
          <div
            style={{
              height: 134,
              borderRadius: 24,
              overflow: "hidden",
              width: "100%",
              background: "var(--color-walkcell-empty)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {coords.length > 1 ? (
              <RouteMap coords={coords} height={134} mapStyle="voyager" />
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontWeight: 500,
                  fontSize: 15,
                  color: "var(--color-pawpal-hero)",
                  opacity: 0.85,
                }}
              >
                📍 Acquiring GPS…
              </span>
            )}
          </div>
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: 24,
                color: "var(--color-track-notes)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {days.map((day, i) => (
            <DayCell
              key={i}
              date={day.date}
              steps={day.steps}
              max={maxSteps}
              future={day.future}
              selected={selected === i}
              onSelect={() => setSelected((cur) => (cur === i ? null : i))}
            />
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {selectedDay ? (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 400,
                fontSize: 24,
                color: "var(--color-pawpal-hero)",
              }}
            >
              {selectedDay.date.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p style={{ margin: 0 }}>
              <StatNumber size={32} weight={700} color="var(--color-pawpal-hero)">
                {selectedDay.future
                  ? "Not yet"
                  : selectedDay.steps > 0
                    ? `${selectedDay.steps.toLocaleString("de-DE")} steps`
                    : "No walk"}
              </StatNumber>
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 400,
                fontSize: 24,
                color: "var(--color-pawpal-hero)",
              }}
            >
              Average of
            </p>
            <p style={{ margin: 0 }}>
              <StatNumber size={32} weight={700} color="var(--color-pawpal-hero)">
                {avg.toLocaleString("de-DE")} steps
              </StatNumber>
            </p>
          </>
        )}
      </div>

      {/* Filter + walk entries (Figma node 262:6584). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: 4,
          height: 48,
          marginTop: 24,
          borderRadius: 100,
          background: "#221D1A",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            minWidth: 0,
            height: "100%",
            alignItems: "center",
            borderRadius: 64,
            background: "var(--color-pawpal-page)",
          }}
        >
          {WALK_FILTERS.map((f, i) => {
            const active = filter === f.value;
            const prevActive = i > 0 && filter === WALK_FILTERS[i - 1].value;
            const showDivider = i > 0 && !active && !prevActive;
            return (
              <Fragment key={f.value}>
                {showDivider && (
                  <span
                    aria-hidden
                    style={{
                      width: 1,
                      height: 20,
                      flexShrink: 0,
                      background: "rgba(233, 228, 196, 0.25)",
                    }}
                  />
                )}
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    padding: "0 12px",
                    borderRadius: 40,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-ui)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 16,
                    background: active ? "var(--color-dash-walk)" : "transparent",
                    color: active ? "var(--color-pawpal-page)" : "var(--color-dash-walk)",
                  }}
                >
                  {f.label}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          borderRadius: 16,
          overflow: "hidden",
          background: "var(--color-settings-group)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {entries.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 24,
              textAlign: "center",
              fontFamily: "var(--font-ui)",
              fontWeight: 400,
              fontSize: 16,
              color: "var(--color-pawpal-hero)",
              opacity: 0.6,
            }}
          >
            No walks {filter === "today" ? "today" : filter === "month" ? "this month" : "yet"}.
          </p>
        ) : (
          entries.map(({ w, index }) => (
            <WalkEntry key={index} walk={w} avatar={db.profile.avatar} />
          ))
        )}
      </div>
    </div>
  );
}

function WalkEntry({
  walk,
  avatar,
}: {
  walk: Walk;
  avatar: Parameters<typeof DogFace>[0]["avatar"];
}): React.ReactElement {
  const hasRoute = Array.isArray(walk.gpsRoute) && walk.gpsRoute.length > 1;
  const stepsNum = parseInt(String(walk.steps)) || 0;
  const assignee = walk.assignee ? ASSIGNEE_STYLE[walk.assignee] : undefined;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 16 }}>
      {/* Thumbnail: route map when available, else a green paw tile. */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          overflow: "hidden",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#A9E7A7",
          color: "var(--color-pawpal-page)",
        }}
      >
        {hasRoute && walk.gpsRoute ? (
          <RouteThumb coords={walk.gpsRoute} size={40} />
        ) : (
          <Icon icon={Icons.pawPrint} width={24} height={24} color="inherit" />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 600,
            fontSize: 16,
            color: "var(--color-pawpal-hero)",
          }}
        >
          {stepsNum > 0 ? `${stepsNum.toLocaleString("de-DE")} steps` : "Walk logged"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 400,
            fontSize: 16,
            color: "var(--color-pawpal-hero)",
            opacity: 0.8,
          }}
        >
          {fmtDate(walk.date)}
          {walk.time ? ` at ${walk.time}` : ""}
        </span>
      </div>

      {/* Walkers: the pet plus (optionally) the assignee. */}
      <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            overflow: "hidden",
            background: "#EDD4FD",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            position: "relative",
          }}
        >
          <DogFace avatar={avatar} size={32} />
        </div>
        {assignee && (
          <div
            style={{
              width: 32,
              height: 32,
              marginLeft: -4,
              borderRadius: "50%",
              background: assignee.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-ui)",
              fontWeight: 600,
              fontSize: 14,
              color: "var(--color-pawpal-page)",
              zIndex: 1,
            }}
          >
            {assignee.initials}
          </div>
        )}
      </div>
    </div>
  );
}

/** Compact GPS route thumbnail: the drawn line, normalised into a square. */
function RouteThumb({ coords, size }: { coords: Walk["gpsRoute"]; size: number }): React.ReactElement | null {
  const pts = coords ?? [];
  if (pts.length < 2) return null;
  const pad = 6;
  const span = size - pad * 2;
  const lats = pts.map((c) => c.lat);
  const lngs = pts.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.0001;
  const dLng = maxLng - minLng || 0.0001;
  const scale = Math.min(span / dLng, span / dLat);
  // Centre the route within the square.
  const offX = pad + (span - dLng * scale) / 2;
  const offY = pad + (span - dLat * scale) / 2;
  const toX = (lng: number): number => offX + (lng - minLng) * scale;
  const toY = (lat: number): number => offY + (maxLat - lat) * scale;
  const d = pts.map((c, i) => `${i === 0 ? "M" : "L"}${toX(c.lng).toFixed(1)} ${toY(c.lat).toFixed(1)}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="var(--color-pawpal-page)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DayCell({
  date,
  steps,
  max,
  future,
  selected,
  onSelect,
}: {
  date: Date;
  steps: number;
  max: number;
  future: boolean;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const active = !future && steps > 0;
  const ratio = max > 0 ? steps / max : 0;
  const dotPct = active ? 22 + ratio * 42 : 26;
  const label = future
    ? "Upcoming day"
    : `${date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}, ${steps > 0 ? `${steps} steps` : "no walk"}`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        aspectRatio: "1 / 1",
        borderRadius: "26%",
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: active ? "var(--color-walkcell)" : "var(--color-walkcell-empty)",
        opacity: future ? 0.6 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: selected ? "3px solid var(--color-pawpal-hero)" : "none",
        outlineOffset: 2,
        transition: "outline-color 0.15s ease, transform 0.12s ease",
      }}
    >
      <span
        style={{
          width: `${dotPct}%`,
          height: `${dotPct}%`,
          borderRadius: "50%",
          background: active ? "var(--color-walkcell-dot)" : "var(--color-walkcell-empty-dot)",
        }}
      />
    </button>
  );
}
