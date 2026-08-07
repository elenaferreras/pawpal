import { useMemo } from "react";
import { useDb } from "../lib/store";
import { WalksIcon, MealsIcon } from "./TabIcons";

const DARK = "var(--color-pawpal-page)"; // #352B25
const STEP_GOAL = 10000; // daily step target for the outer ring

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const OUTER_R = 42;
const INNER_R = 30;
const SW = 10;
const OUTER_C = 2 * Math.PI * OUTER_R;
const INNER_C = 2 * Math.PI * INNER_R;

/**
 * Food-ring dashboard widget (Figma node 34:1418).
 *
 * Cream card with two concentric progress rings — blue for today's steps (vs a
 * daily goal) and red for grams eaten (vs the food goal) — plus matching pills.
 */
export function FoodRingWidget(): React.ReactElement {
  const { db } = useDb();
  const todayISO = localISO(new Date());

  const { steps, grams, goal } = useMemo(() => {
    const stepsToday = db.walks
      .filter((w) => w.date === todayISO)
      .reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0);
    const gramsToday = db.meals
      .filter((m) => m.date === todayISO)
      .reduce((a, m) => a + (Number(m.amount) || 0), 0);
    return { steps: stepsToday, grams: gramsToday, goal: db.profile.foodGoal || 0 };
  }, [db.walks, db.meals, db.profile.foodGoal, todayISO]);

  const stepsProgress = Math.min(1, steps / STEP_GOAL);
  const gramsProgress = goal > 0 ? Math.min(1, grams / goal) : 0;

  return (
    <div
      style={{
        background: "var(--color-pawpal-hero)",
        borderRadius: 32,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
      }}
    >
      <svg width={132} height={132} viewBox="0 0 100 100" aria-hidden>
        {/* Outer ring — steps (blue) */}
        <circle cx={50} cy={50} r={OUTER_R} fill="none" stroke="rgba(53,43,37,0.12)" strokeWidth={SW} />
        <circle
          cx={50}
          cy={50}
          r={OUTER_R}
          fill="none"
          stroke="#7FB0EE"
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={`${stepsProgress * OUTER_C} ${OUTER_C}`}
          transform="rotate(-90 50 50)"
        />
        {/* Inner ring — grams (red) */}
        <circle cx={50} cy={50} r={INNER_R} fill="none" stroke="rgba(53,43,37,0.12)" strokeWidth={SW} />
        <circle
          cx={50}
          cy={50}
          r={INNER_R}
          fill="none"
          stroke="#E96A41"
          strokeWidth={SW}
          strokeLinecap="round"
          strokeDasharray={`${gramsProgress * INNER_C} ${INNER_C}`}
          transform="rotate(-90 50 50)"
        />
      </svg>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <Pill bg="var(--color-pill-steps)" icon={<WalksIcon />} label={`${steps.toLocaleString("de-DE")} steps`} />
        <Pill bg="var(--color-track-poop)" icon={<MealsIcon />} label={`${grams.toLocaleString("de-DE")} grams`} />
      </div>
    </div>
  );
}

function Pill({
  bg,
  icon,
  label,
}: {
  bg: string;
  icon: React.ReactNode;
  label: string;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 100,
        background: bg,
        color: DARK,
      }}
    >
      <span style={{ width: 20, height: 20, display: "flex", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 15 }}>{label}</span>
    </div>
  );
}
