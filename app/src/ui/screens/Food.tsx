import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { MealBowl } from "../components/MealBowl";
import { CardStagger } from "../components/CardStagger";
import { TopBar } from "../components/TopBar";
import { Icons } from "../lib/icons";
import type { Meal } from "../types";

const FOOD = "var(--color-food)"; // #E96A41 orange
const DARK = "var(--color-pawpal-page)"; // #352B25 page background
const CREAM = "var(--color-pawpal-hero)"; // #E9E4C4 foreground
const WIDGET_DARK = "var(--color-meal-widget-bg)"; // #1E1C1E dark surface

const NAMES: Record<number, string[]> = {
  1: ["Daily meal"],
  2: ["First meal", "Second meal"],
  3: ["First meal", "Second meal", "Third meal"],
  4: ["First meal", "Second meal", "Third meal", "Fourth meal"],
  5: ["First meal", "Second meal", "Third meal", "Fourth meal", "Fifth meal"],
};
const TIMES: Record<number, string[]> = {
  1: ["12:00"],
  2: ["08:00", "19:00"],
  3: ["08:00", "13:00", "19:00"],
  4: ["08:00", "12:00", "16:00", "20:00"],
  5: ["07:00", "10:00", "13:00", "17:00", "20:00"],
};

/**
 * Meals screen (Figma node 58:1372).
 *
 * Dark page with a large "{name}'s Meals" title, a dark "MEAL PLAN" card whose
 * bowl empties of kibble as meals are fed, and an orange meal schedule whose
 * rows can be checked off. At-a-glance only — no history.
 */
export function Food(): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const p = db.profile;
  const name = p.name.trim() || "Zipi";
  const n = p.mealsPerDay || 4;
  const fGoal = p.foodGoal || 300;
  const portion = Math.round(fGoal / n);
  // Local YYYY-MM-DD (matches the Dashboard meal circles, not UTC).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayMeals = db.meals.filter((m) => m.date === today);
  const doneSlots = new Set(todayMeals.filter((m) => m.mealSlot != null).map((m) => m.mealSlot));
  const names = NAMES[n] || NAMES[4];
  const times = TIMES[n] || TIMES[4];

  const quickLog = (slot: number): void => {
    const meal: Meal = {
      date: today,
      time: times[slot],
      type: "Dry kibble",
      amount: portion,
      notes: names[slot],
      mealSlot: slot,
      created: new Date().toISOString(),
    };
    update((d) => {
      d.meals.push(meal);
    });
    toast(`${names[slot]} — ${portion}g logged ✓`);
  };

  const undo = (slot: number): void => {
    update((d) => {
      d.meals = d.meals.filter((m) => !(m.date === today && m.mealSlot === slot));
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      <TopBar title={`${name}\u2019s Meals`} />
      <CardStagger style={{ padding: "0 16px" }}>
      {/* Meal plan — dark card whose bowl empties as meals are fed */}
      <div
        style={{
          marginTop: 12,
          background: WIDGET_DARK,
          borderRadius: 40,
          padding: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <MealBowl fed={doneSlots.size} total={n} width={132} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: CREAM,
              opacity: 0.8,
            }}
          >
            MEAL PLAN
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1,
                color: CREAM,
              }}
            >
              {fGoal}
            </span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 16, color: CREAM }}>
              gr of kibble
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontSize: 40,
                fontWeight: 700,
                lineHeight: 1,
                color: CREAM,
              }}
            >
              {n}
            </span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 16, color: CREAM }}>
              {n === 1 ? "serving" : "servings"}
            </span>
          </div>
        </div>
      </div>

      {/* Meal schedule — tap a row to log or undo today's meal */}
      <div
        style={{
          marginTop: 8,
          background: FOOD,
          borderRadius: 40,
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
          {names.map((mealName, i) => {
            const done = doneSlots.has(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={done}
                aria-label={done ? `Undo ${mealName}` : `Log ${mealName}`}
                onClick={() => (done ? undo(i) : quickLog(i))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 46,
                  cursor: "pointer",
                  textAlign: "left",
                  color: "#fff",
                  background: done ? "transparent" : "rgba(255,255,255,0.2)",
                  border: done ? "1px solid #fff" : "1px dashed #fff",
                }}
              >
                <Icon icon={done ? Icons.checkCircle : Icons.circle} color="inherit" />
                <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <span style={{ fontFamily: "var(--font-ui)", fontSize: 16, fontWeight: 400 }}>
                    {mealName}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 16,
                      fontWeight: 400,
                      opacity: 0.6,
                    }}
                  >
                    {times[i]}
                  </span>
                </span>
              </button>
            );
          })}
      </div>
      </CardStagger>
    </div>
  );
}
