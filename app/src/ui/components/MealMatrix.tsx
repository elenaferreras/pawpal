import { useMemo } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import type { Meal } from "../types";

interface MealMatrixProps {
  meals: Meal[];
  mealsPerDay: number;
  /** Toggle a slot for a given day (add if missing, remove if present). */
  onToggle: (dateISO: string, slot: number) => void;
}

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_MS = 86400000;

/** UTC-based YYYY-MM-DD, matching how meal slots are stored elsewhere. */
function iso(d: Date): string {
  return d.toISOString().split("T")[0];
}

/** Monday-anchored week key for grouping consecutive days. */
function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return iso(d);
}

interface WeekBlock {
  key: string;
  label: string;
  days: string[];
  complete: number;
}

/**
 * Meal-history matrix: rows = days (newest first, grouped into week blocks),
 * columns = meal slots. Each cell toggles that day's slot; days with off-plan or
 * out-of-range meals show a small "+N" extra marker. Spans back to the earliest
 * logged meal (min two weeks).
 */
export function MealMatrix({ meals, mealsPerDay, onToggle }: MealMatrixProps): React.ReactElement {
  const todayISO = iso(new Date());

  // Map "date" -> set of eaten slots, and "date" -> count of extra (non-slot or
  // out-of-range) meals, for O(1) cell lookups.
  const { slotsByDay, extrasByDay, earliest } = useMemo(() => {
    const slotsByDay = new Map<string, Set<number>>();
    const extrasByDay = new Map<string, number>();
    let earliest = todayISO;
    for (const m of meals) {
      if (m.date < earliest) earliest = m.date;
      const inRange = m.mealSlot != null && m.mealSlot >= 0 && m.mealSlot < mealsPerDay;
      if (inRange) {
        const set = slotsByDay.get(m.date) ?? new Set<number>();
        set.add(m.mealSlot as number);
        slotsByDay.set(m.date, set);
      } else {
        extrasByDay.set(m.date, (extrasByDay.get(m.date) ?? 0) + 1);
      }
    }
    return { slotsByDay, extrasByDay, earliest };
  }, [meals, mealsPerDay, todayISO]);

  // Days from today back to the earliest meal (floor: two weeks), newest first,
  // grouped into Monday-anchored week blocks.
  const weeks = useMemo<WeekBlock[]>(() => {
    const floor = iso(new Date(Date.now() - 13 * DAY_MS));
    const start = earliest < floor ? earliest : floor;
    const startMs = new Date(start + "T12:00:00Z").getTime();
    const todayMs = new Date(todayISO + "T12:00:00Z").getTime();

    const blocks: WeekBlock[] = [];
    let current: WeekBlock | null = null;
    for (let ms = todayMs; ms >= startMs; ms -= DAY_MS) {
      const dISO = iso(new Date(ms));
      const wk = mondayOf(dISO);
      if (!current || current.key !== wk) {
        current = { key: wk, label: "", days: [], complete: 0 };
        blocks.push(current);
      }
      current.days.push(dISO);
      if ((slotsByDay.get(dISO)?.size ?? 0) >= mealsPerDay) current.complete += 1;
    }

    const thisWk = mondayOf(todayISO);
    const lastWk = mondayOf(iso(new Date(Date.now() - 7 * DAY_MS)));
    for (const b of blocks) {
      if (b.key === thisWk) b.label = "This week";
      else if (b.key === lastWk) b.label = "Last week";
      else {
        const first = b.days[b.days.length - 1];
        const last = b.days[0];
        const fmt = (s: string): string =>
          new Date(s + "T12:00:00Z").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          });
        b.label = `${fmt(first)} – ${fmt(last)}`;
      }
    }
    return blocks;
  }, [earliest, todayISO, slotsByDay, mealsPerDay]);

  const gridCols = `40px repeat(${mealsPerDay}, 1fr) 34px`;

  return (
    <div className="meal-matrix">
      {/* Column header — slot ordinals */}
      <div className="meal-matrix-head" style={{ gridTemplateColumns: gridCols }}>
        <span />
        {Array.from({ length: mealsPerDay }, (_, s) => (
          <span key={s} className="meal-matrix-col">
            {ORDINALS[s] ?? s + 1}
          </span>
        ))}
        <span />
      </div>

      {weeks.map((wk) => (
        <div key={wk.key} className="meal-matrix-week">
          <div className="meal-matrix-week-head">
            <span className="meal-matrix-week-label">{wk.label}</span>
            <span className="meal-matrix-week-count">
              {wk.complete}/{wk.days.length}
            </span>
          </div>

          {wk.days.map((dISO) => {
            const done = slotsByDay.get(dISO);
            const extras = extrasByDay.get(dISO) ?? 0;
            const isToday = dISO === todayISO;
            const dt = new Date(dISO + "T12:00:00Z");
            const wd = WEEKDAYS[dt.getUTCDay()];
            const dayNum = dt.getUTCDate();
            return (
              <div
                key={dISO}
                className={`meal-matrix-row${isToday ? " is-today" : ""}`}
                style={{ gridTemplateColumns: gridCols }}
              >
                <span className="meal-matrix-day">
                  <span className="meal-matrix-dow">{wd}</span>
                  <span className="meal-matrix-num">{dayNum}</span>
                </span>
                {Array.from({ length: mealsPerDay }, (_, s) => {
                  const eaten = done?.has(s) ?? false;
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={eaten}
                      aria-label={`${wd} ${dayNum}, ${ORDINALS[s] ?? s + 1} meal${eaten ? ", eaten" : ""}`}
                      className={`meal-matrix-cell${eaten ? " is-done" : ""}`}
                      onClick={() => onToggle(dISO, s)}
                    >
                      {eaten && <Icon icon={Icons.checkCircle} color="inherit" />}
                    </button>
                  );
                })}
                <span className="meal-matrix-extra">
                  {extras > 0 && (
                    <span className="meal-matrix-extra-chip" title={`${extras} more logged`}>
                      +{extras}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
