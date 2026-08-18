import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { SwipeableRow } from "../components/SwipeableRow";
import { MealsWidget } from "../components/MealsWidget";
import { PageTitle, CardTitle } from "../components/Typography";
import { RevealItem } from "../components/Reveal";
import { Icons } from "../lib/icons";
import { fmtDate } from "../lib/date";
import type { Meal } from "../types";

interface FoodProps {
  onAdd: () => void;
}

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

/** Dark pill showing a single line of the current meal plan. */
function PlanField({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        minHeight: 54,
        padding: "8px 20px",
        borderRadius: 46,
        background: DARK,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 400, fontSize: 20, color: CREAM }}>
        {children}
      </span>
    </div>
  );
}

/**
 * Meals screen (Figma node 58:1372).
 *
 * Dark page with a large "{name}'s Meals" title and an add button, an orange
 * "Current meal plan" card summarising the daily goal, and an orange meal
 * schedule whose rows can be checked off. The pacman MealsWidget peeks out of
 * the dark surface beneath the schedule to show today's progress.
 */
export function Food({ onAdd }: FoodProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const p = db.profile;
  const name = p.name.trim() || "Zipi";
  const n = p.mealsPerDay || 4;
  const fGoal = p.foodGoal || 300;
  const portion = Math.round(fGoal / n);
  const today = new Date().toISOString().split("T")[0];
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
      const idx = d.meals.findIndex((m) => m.date === today && m.mealSlot === slot);
      if (idx > -1) d.meals.splice(idx, 1);
    });
  };

  const delMeal = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this meal?",
      message: "This meal will be permanently removed.",
      confirmLabel: "Delete Meal",
    });
    if (!ok) return;
    update((d) => {
      d.meals.splice(index, 1);
    });
    toast("Meal deleted");
  };

  const history = db.meals
    .map((m, index) => ({ m, index }))
    .sort(
      (a, b) =>
        new Date(b.m.created || b.m.date).getTime() - new Date(a.m.created || a.m.date).getTime(),
    );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        padding:
          "calc(16px + env(safe-area-inset-top, 0px)) 16px calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Header — title + add button */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PageTitle style={{ flex: 1, margin: "4px 0" }}>{name}&rsquo;s Meals</PageTitle>
        <button
          type="button"
          aria-label="Log meal"
          onClick={onAdd}
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            flexShrink: 0,
            border: "none",
            cursor: "pointer",
            background: "var(--color-dash-surface)",
            color: CREAM,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon icon={Icons.plusCircle} color="inherit" />
        </button>
      </div>

      {/* Current meal plan */}
      <div
        style={{
          marginTop: 12,
          background: FOOD,
          borderRadius: 40,
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <CardTitle color={DARK} size={24} weight={400} style={{ padding: "0 8px" }}>
          Current meal plan
        </CardTitle>
        <PlanField>
          {fGoal}g of kibble in {n} servings
        </PlanField>
        <PlanField>{portion}g per meal</PlanField>
      </div>

      {/* Meal schedule — orange list over a dark surface with the pacman widget */}
      <div
        style={{
          marginTop: 8,
          background: WIDGET_DARK,
          borderRadius: 40,
          padding: 8,
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            background: FOOD,
            borderRadius: 34,
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

        {/* Today's progress — the pacman widget, blended into the dark surface */}
        <div style={{ padding: "8px 8px 4px" }}>
          <MealsWidget eaten={doneSlots.size} total={n} />
        </div>
      </div>

      {/* Meal history */}
      {history.length > 0 && (
        <>
          <CardTitle
            color={CREAM}
            size={20}
            weight={400}
            style={{ display: "block", margin: "24px 8px 12px" }}
          >
            Meal history
          </CardTitle>
          <div
            style={{
              background: "var(--color-dash-surface)",
              borderRadius: 24,
              overflow: "hidden",
            }}
          >
            {history.map(({ m, index }, i) => (
              <RevealItem
                key={index}
                index={i}
                style={{
                  borderTop: i === 0 ? undefined : "1px solid rgba(233,228,196,0.12)",
                }}
              >
                <SwipeableRow
                  background="var(--color-dash-surface)"
                  actions={[
                    {
                      label: "Delete",
                      color: "#ff3b30",
                      icon: <Icon icon={Icons.trash} color="inherit" />,
                      onAction: () => delMeal(index),
                    },
                  ]}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                    }}
                  >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: FOOD,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  <Icon icon={Icons.forkKnife} color="inherit" />
                </span>
                <span style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 15,
                      fontWeight: 500,
                      color: CREAM,
                    }}
                  >
                    {m.type || "Meal"} {m.notes ? `· ${m.notes}` : ""}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontSize: 13,
                      color: "var(--color-pawpal-muted)",
                    }}
                  >
                    {fmtDate(m.date)} {m.time}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: CREAM,
                    flexShrink: 0,
                  }}
                >
                  {m.amount}g
                </span>
                  </div>
                </SwipeableRow>
              </RevealItem>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
