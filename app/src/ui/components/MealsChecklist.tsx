import { useMemo } from "react";
import { useDb } from "../lib/store";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import type { Meal } from "../types";

const DARK = "var(--color-pawpal-page)"; // #352B25
const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Evenly spread meal times across the day (08:00 → 20:00). */
function mealTime(index: number, total: number): string {
  if (total <= 1) return "12:00";
  const hour = Math.round(8 + (index * 12) / (total - 1));
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Meals checklist widget (Figma node 34:1418).
 *
 * Orange card listing the day's planned meals with times. Tapping a row toggles
 * that meal as eaten — writing to the same meal data the pacman widget reads, so
 * the two stay in sync.
 */
export function MealsChecklist(): React.ReactElement {
  const { db, update } = useDb();
  const todayISO = localISO(new Date());
  const mealsPerDay = db.profile.mealsPerDay || 4;
  const perMealAmount = Math.round((db.profile.foodGoal || 0) / mealsPerDay);

  const eaten = useMemo(() => {
    const slots = db.meals
      .filter((m) => m.date === todayISO && m.mealSlot != null)
      .map((m) => m.mealSlot as number);
    return new Set(slots);
  }, [db.meals, todayISO]);

  const toggle = (slot: number, time: string): void => {
    update((d) => {
      const has = d.meals.some((m) => m.date === todayISO && m.mealSlot === slot);
      if (has) {
        d.meals = d.meals.filter((m) => !(m.date === todayISO && m.mealSlot === slot));
      } else {
        const meal: Meal = {
          date: todayISO,
          time,
          type: "meal",
          amount: perMealAmount,
          notes: "",
          mealSlot: slot,
          created: new Date().toISOString(),
        };
        d.meals.push(meal);
      }
    });
  };

  const rows = Array.from({ length: mealsPerDay }, (_, i) => ({
    slot: i,
    label: `${ORDINALS[i] ?? `Meal ${i + 1}`} meal`,
    time: mealTime(i, mealsPerDay),
  }));

  return (
    <div
      style={{
        background: "var(--color-track-poop)",
        borderRadius: 32,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {rows.map((row) => {
        const done = eaten.has(row.slot);
        return (
          <button
            key={row.slot}
            type="button"
            aria-pressed={done}
            aria-label={`${row.label} at ${row.time}${done ? ", eaten" : ""}`}
            onClick={() => toggle(row.slot, row.time)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderRadius: 20,
              cursor: "pointer",
              textAlign: "left",
              background: done ? "rgba(0, 0, 0, 0.16)" : "transparent",
              border: done ? "1px solid transparent" : "1.5px dashed rgba(53, 43, 37, 0.4)",
              color: DARK,
            }}
          >
            {done ? (
              <Icon icon={Icons.checkCircle} color="inherit" />
            ) : (
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  border: `2px solid ${DARK}`,
                  flexShrink: 0,
                  opacity: 0.5,
                }}
              />
            )}
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontWeight: 600,
                  fontSize: 16,
                  textDecoration: done ? "line-through" : "none",
                  opacity: done ? 0.7 : 1,
                }}
              >
                {row.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontWeight: 500,
                  fontSize: 13,
                  opacity: 0.6,
                }}
              >
                {row.time}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
