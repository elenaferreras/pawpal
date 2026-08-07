import { useMemo, useState } from "react";
import { useDb } from "../lib/store";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";

interface WalksStatsProps {
  /** Optional back affordance; omitted when shown as a tab. */
  onBack?: () => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const WEEKS = 5;

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
export function WalksStats({ onBack }: WalksStatsProps): React.ReactElement {
  const { db } = useDb();
  const [selected, setSelected] = useState<number | null>(null);

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

      <h1
        style={{
          margin: "16px 0 24px",
          fontFamily: "var(--font-ui)",
          fontWeight: 300,
          fontSize: "clamp(44px, 16vw, 72px)",
          lineHeight: 1.0,
          color: "var(--color-pawpal-hero)",
        }}
      >
        {name}&rsquo;s Walks
      </h1>

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
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 700,
                fontSize: 32,
                color: "var(--color-pawpal-hero)",
              }}
            >
              {selectedDay.future
                ? "Not yet"
                : selectedDay.steps > 0
                  ? `${selectedDay.steps.toLocaleString("de-DE")} steps`
                  : "No walk"}
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
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 700,
                fontSize: 32,
                color: "var(--color-pawpal-hero)",
              }}
            >
              {avg.toLocaleString("de-DE")} steps
            </p>
          </>
        )}
      </div>
    </div>
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
