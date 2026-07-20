import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { fmtDate } from "../lib/date";
import type { Meal } from "../types";

interface FoodProps {
  onAdd: () => void;
}

const NAMES: Record<number, string[]> = {
  1: ["Daily meal"],
  2: ["Morning", "Evening"],
  3: ["Morning", "Afternoon", "Evening"],
  4: ["Morning", "Midday", "Afternoon", "Evening"],
  5: ["Morning", "Midday", "Afternoon", "Evening", "Night"],
};
const TIMES: Record<number, string[]> = {
  1: ["12:00"],
  2: ["08:00", "19:00"],
  3: ["08:00", "13:00", "19:00"],
  4: ["08:00", "12:00", "16:00", "19:00"],
  5: ["07:00", "10:00", "13:00", "17:00", "20:00"],
};

export function Food({ onAdd }: FoodProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const p = db.profile;
  const n = p.mealsPerDay || 4;
  const portion = Math.round((p.foodGoal || 300) / n);
  const today = new Date().toISOString().split("T")[0];
  const todayMeals = db.meals.filter((m) => m.date === today);
  const doneSlots = new Set(todayMeals.filter((m) => m.mealSlot != null).map((m) => m.mealSlot));
  const names = NAMES[n] || NAMES[4];
  const times = TIMES[n] || TIMES[4];

  const total = todayMeals.reduce((a, m) => a + (m.amount || 0), 0);
  const fGoal = p.foodGoal || 300;
  const pct = Math.min(100, Math.round((total / fGoal) * 100));

  const quickLog = (slot: number): void => {
    const meal: Meal = {
      date: today,
      time: times[slot],
      type: "Dry kibble",
      amount: portion,
      notes: names[slot] + " meal",
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

  const delMeal = (index: number): void => {
    if (!window.confirm("Delete this meal?")) return;
    update((d) => {
      d.meals.splice(index, 1);
    });
    toast("Meal deleted");
  };

  const history = db.meals
    .map((m, index) => ({ m, index }))
    .sort((a, b) => new Date(b.m.created || b.m.date).getTime() - new Date(a.m.created || a.m.date).getTime());

  return (
    <div className="screen">
      <Header
        title="Food"
        subtitle={`${doneSlots.size} of ${n} meals today`}
        action={
          <button className="hdr-btn" onClick={onAdd} aria-label="Log meal">
            <i className="ph ph-plus" />
          </button>
        }
      />

      <div className="section-label">Today’s meals</div>
      <div style={{ padding: "0 18px" }}>
        {names.map((name, i) => {
          const done = doneSlots.has(i);
          return (
            <div
              key={i}
              onClick={() => (done ? undo(i) : quickLog(i))}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--surface)",
                borderRadius: 18,
                padding: "14px 16px",
                marginBottom: 10,
                cursor: "pointer",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                border: `1.5px solid ${done ? "var(--green)" : "var(--border)"}`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  border: `2px solid ${done ? "var(--green)" : "var(--border-strong)"}`,
                  background: done ? "var(--green)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done && <i className="ph ph-check" style={{ color: "white", fontSize: 16, fontWeight: 700 }} />}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: done ? "var(--text2)" : "var(--text)",
                    textDecoration: done ? "line-through" : "none",
                  }}
                >
                  {name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 1 }}>
                  {times[i]} · {portion}g
                </div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: done ? "var(--green)" : "var(--text3)" }}>
                {done ? "Done" : `${portion}g`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="row-between">
          <div style={{ fontSize: 20, fontWeight: 800 }}>
            {total}g <span style={{ color: "var(--text3)", fontWeight: 400 }}>/ {fGoal}g</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: pct >= 100 ? "var(--green)" : "var(--text2)" }}>
            {pct}%
          </div>
        </div>
        <div className="food-meter">
          <div className="food-meter-fill" style={{ width: `${pct}%`, background: pct >= 100 ? "var(--green)" : "var(--amber)" }} />
        </div>
        <div style={{ fontSize: 12, color: "var(--text2)" }}>
          {total >= fGoal ? "✓ Daily goal reached!" : `${fGoal - total}g remaining today`}
        </div>
      </div>

      <div className="section-label">Meal history</div>
      <div className="card card-flush">
        {history.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">
              <i className="ph ph-fork-knife" />
            </div>
            <p>No meals logged yet</p>
          </div>
        ) : (
          history.map(({ m, index }) => (
            <div className="food-log-item" key={index}>
              <div className="food-log-icon">
                <i className="ph ph-fork-knife" style={{ fontSize: 15 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {m.type || "Meal"} {m.notes ? `· ${m.notes}` : ""}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {fmtDate(m.date)} {m.time}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{m.amount}g</span>
                <button className="icon-btn" onClick={() => delMeal(index)}>×</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
