import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { Icons } from "../lib/icons";
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
          <IconButton label="Log meal" variant="primary" icon={<Icon icon={Icons.plus} />} onClick={onAdd} />
        }
      />

      <Text type="label" color="secondary" as="div" style={{ margin: "4px 0 8px" }}>
        Today’s meals
      </Text>
      <VStack gap={2}>
        {names.map((name, i) => {
          const done = doneSlots.has(i);
          return (
            <ClickableCard key={i} label={done ? `Undo ${name}` : `Log ${name}`} onClick={() => (done ? undo(i) : quickLog(i))}>
              <HStack gap={3} vAlign="center">
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    flexShrink: 0,
                    border: `2px solid ${done ? "var(--color-status-success, #2e7d32)" : "var(--color-border, #ccc)"}`,
                    background: done ? "var(--color-status-success, #2e7d32)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {done && <Icon icon={Icons.check} size="sm" color="inherit" />}
                </span>
                <VStack gap={0.5} style={{ flex: 1 }}>
                  <Text weight="semibold" style={{ textDecoration: done ? "line-through" : "none" }}>
                    {name}
                  </Text>
                  <Text type="supporting">
                    {times[i]} · {portion}g
                  </Text>
                </VStack>
                <Text type="supporting" color={done ? "accent" : "secondary"}>
                  {done ? "Done" : `${portion}g`}
                </Text>
              </HStack>
            </ClickableCard>
          );
        })}
      </VStack>

      <Card padding={4} style={{ marginTop: 16 }}>
        <VStack gap={2}>
          <HStack justify="between" vAlign="center">
            <Heading level={3}>
              {total}g <Text type="supporting">/ {fGoal}g</Text>
            </Heading>
            <Text weight="semibold" color={pct >= 100 ? "accent" : "secondary"}>
              {pct}%
            </Text>
          </HStack>
          <ProgressBar
            label="Daily food"
            isLabelHidden
            value={total}
            max={fGoal}
            variant={pct >= 100 ? "success" : "warning"}
          />
          <Text type="supporting">
            {total >= fGoal ? "✓ Daily goal reached!" : `${fGoal - total}g remaining today`}
          </Text>
        </VStack>
      </Card>

      <Text type="label" color="secondary" as="div" style={{ margin: "20px 0 8px" }}>
        Meal history
      </Text>
      <Card padding={0}>
        {history.length === 0 ? (
          <VStack gap={2} hAlign="center" padding={6}>
            <Icon icon={Icons.forkKnife} size="lg" color="disabled" />
            <Text type="supporting">No meals logged yet</Text>
          </VStack>
        ) : (
          <VStack gap={0}>
            {history.map(({ m, index }, i) => (
              <HStack
                key={index}
                gap={3}
                vAlign="center"
                padding={3}
                style={{ borderTop: i === 0 ? undefined : "1px solid var(--color-border, #eee)" }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: "var(--color-background-section, #f4f4f4)",
                    flexShrink: 0,
                  }}
                >
                  <Icon icon={Icons.forkKnife} color="warning" />
                </span>
                <VStack gap={0.5} style={{ flex: 1 }}>
                  <Text weight="medium">
                    {m.type || "Meal"} {m.notes ? `· ${m.notes}` : ""}
                  </Text>
                  <Text type="supporting">
                    {fmtDate(m.date)} {m.time}
                  </Text>
                </VStack>
                <HStack gap={2} vAlign="center" style={{ flexShrink: 0 }}>
                  <Text weight="semibold">{m.amount}g</Text>
                  <IconButton label="Delete meal" size="sm" variant="ghost" icon={<Icon icon={Icons.x} />} onClick={() => delMeal(index)} />
                </HStack>
              </HStack>
            ))}
          </VStack>
        )}
      </Card>
    </div>
  );
}
