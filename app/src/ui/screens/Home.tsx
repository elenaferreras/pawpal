import { useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { fmtDate, WEATHER_MAP } from "../lib/date";
import { Icons } from "../lib/icons";
import { DogAvatar, DogFace } from "../avatar/DogAvatar";
import { FoodRing } from "../components/FoodRing";
import { NotifPanel } from "../components/NotifPanel";
import { useLiveWalk } from "../components/LiveWalk";
import type { ScreenId } from "../types";

interface HomeProps {
  onNavigate: (id: ScreenId) => void;
  onLogWalk: () => void;
  onLogFood: () => void;
  onLogBathroom: () => void;
}

type ActivityAccent = "success" | "warning" | "secondary";

interface ActivityItem {
  kind: "walk" | "meal" | "bath";
  sortKey: string;
  icon: (typeof Icons)[keyof typeof Icons] | null;
  emoji?: string;
  accent: ActivityAccent;
  title: string;
  meta: string;
  photos?: readonly string[];
}

export function Home({ onNavigate, onLogWalk, onLogFood, onLogBathroom }: HomeProps): React.ReactElement {
  const { db } = useDb();
  const { start: startLiveWalk } = useLiveWalk();
  const [panelOpen, setPanelOpen] = useState(false);
  const p = db.profile;

  const todayStr = new Date().toISOString().split("T")[0];
  const todayWalks = db.walks.filter((w) => w.date === todayStr);
  const todayMeals = db.meals.filter((m) => m.date === todayStr);
  const todaySteps = todayWalks.reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0);
  const todayFood = todayMeals.reduce((a, m) => a + (m.amount || 0), 0);
  const goal = p.foodGoal || 300;
  const foodPct = Math.min(100, Math.round((todayFood / goal) * 100));
  const mealsPerDay = p.mealsPerDay || 4;
  const doneMeals = new Set(
    todayMeals.filter((m) => m.mealSlot != null).map((m) => m.mealSlot),
  ).size;
  const totalMins = todayWalks.reduce((a, w) => a + (parseInt(String(w.duration)) || 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const hasUrgent =
    todayWalks.length === 0 ||
    doneMeals < mealsPerDay ||
    db.vetRecords.reminders.some((r) => {
      const d = (new Date(r.date + "T12:00:00").getTime() - Date.now()) / 86400000;
      return d >= 0 && d <= 7;
    });

  // Recent activity, most recent first.
  const activity: ActivityItem[] = [];
  db.walks.forEach((w) => {
    const wIcon = WEATHER_MAP[w.weather] || "";
    activity.push({
      kind: "walk",
      sortKey: w.created || w.date,
      icon: Icons.pawPrint,
      accent: "success",
      title: `Walk — ${w.duration || "?"} min${w.steps ? ` · ${w.steps} steps` : ""}${wIcon ? ` · ${wIcon}` : ""}`,
      meta: `${fmtDate(w.date)} ${w.time} ${w.friends ? "· friends" : ""}`,
    });
  });
  db.meals.forEach((m) => {
    activity.push({
      kind: "meal",
      sortKey: m.created || m.date,
      icon: Icons.forkKnife,
      accent: "warning",
      title: `${m.type} — ${m.amount}g`,
      meta: `${fmtDate(m.date)} ${m.time}`,
    });
  });
  db.bathroom.forEach((b) => {
    activity.push({
      kind: "bath",
      sortKey: b.created || b.date,
      icon: null,
      emoji: b.type === "pipi" ? "💧" : "💩",
      accent: "secondary",
      title: `${b.type === "pipi" ? "Pipi" : b.type === "popo" ? "Popo" : "Pipi & Popo"}${b.consistency ? ` · ${b.consistency}` : ""}`,
      meta: `${fmtDate(b.date)} ${b.time}`,
      photos: b.photos,
    });
  });
  activity.sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime());
  const recent = activity.slice(0, 5);

  return (
    <div className="screen">
      <HStack justify="between" vAlign="start" style={{ marginBottom: 16 }}>
        <VStack gap={0.5}>
          <Heading level={2}>{greeting}</Heading>
          <Text type="supporting">
            {p.name ? `How’s ${p.name} doing today?` : "How’s your pup doing today?"}
            <br />
            {dateLabel}
          </Text>
        </VStack>
        <div style={{ position: "relative" }}>
          <IconButton
            label="Notifications"
            variant="ghost"
            icon={<Icon icon={Icons.bell} />}
            onClick={() => setPanelOpen(true)}
          />
          {hasUrgent && (
            <span
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--color-status-error, #FF3B30)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      </HStack>

      <Card padding={4} variant="yellow">
        <VStack gap={4}>
          <HStack gap={3} vAlign="center">
            {p.avatar ? (
              <DogFace avatar={p.avatar} size={48} />
            ) : (
              <span style={{ fontSize: 40 }}>{p.emoji || "🐕"}</span>
            )}
            <VStack gap={0.5}>
              <Heading level={3}>{p.name || "Set up profile"}</Heading>
              <Text type="supporting">
                {p.breed ? p.breed + (p.age ? `, ${p.age}` : "") : "Tap Profile to add your dog’s info"}
              </Text>
            </VStack>
          </HStack>
          <HStack justify="between">
            <VStack gap={0.5} hAlign="center">
              <Heading level={3}>{todayWalks.length}</Heading>
              <Text type="supporting">Walks today</Text>
            </VStack>
            <VStack gap={0.5} hAlign="center">
              <Heading level={3}>{foodPct}%</Heading>
              <Text type="supporting">Food</Text>
            </VStack>
            <VStack gap={0.5} hAlign="center">
              <Heading level={3}>{todaySteps > 999 ? (todaySteps / 1000).toFixed(1) + "k" : todaySteps}</Heading>
              <Text type="supporting">Steps</Text>
            </VStack>
          </HStack>
        </VStack>
      </Card>

      <Text type="label" color="secondary" as="div" style={{ margin: "20px 0 8px" }}>
        Today
      </Text>
      <Grid columns={3} gap={2}>
        <ClickableCard label="View steps" onClick={() => onNavigate("walks")}>
          <VStack gap={0.5} hAlign="center">
            <Heading level={4}>{todaySteps.toLocaleString()}</Heading>
            <Text type="supporting">steps</Text>
          </VStack>
        </ClickableCard>
        <ClickableCard label="View walks" onClick={() => onNavigate("walks")}>
          <VStack gap={0.5} hAlign="center">
            <Heading level={4}>{todayWalks.length}</Heading>
            <Text type="supporting">{totalMins > 0 ? `${totalMins} min` : "walks"}</Text>
          </VStack>
        </ClickableCard>
        <ClickableCard label="View meals" onClick={() => onNavigate("food")}>
          <VStack gap={1} hAlign="center">
            <FoodRing done={doneMeals} total={mealsPerDay} />
            <Text type="supporting">
              {doneMeals}/{mealsPerDay} meals
            </Text>
          </VStack>
        </ClickableCard>
      </Grid>

      <Text type="label" color="secondary" as="div" style={{ margin: "20px 0 8px" }}>
        Quick actions
      </Text>
      <Grid columns={2} gap={2}>
        <ClickableCard label="Log walk" variant="green" onClick={onLogWalk}>
          <VStack gap={1}>
            <Icon icon={Icons.pawPrint} color="success" />
            <Text weight="semibold">Log walk</Text>
            <Text type="supporting">
              {todayWalks.length ? `${todayWalks.length} walk${todayWalks.length > 1 ? "s" : ""} today` : "No walks today"}
            </Text>
          </VStack>
        </ClickableCard>
        <ClickableCard label="Log meal" variant="orange" onClick={onLogFood}>
          <VStack gap={1}>
            <Icon icon={Icons.forkKnife} color="warning" />
            <Text weight="semibold">Log meal</Text>
            <Text type="supporting">
              {todayMeals.length ? `${todayMeals.length} meal${todayMeals.length > 1 ? "s" : ""} today` : "No meals today"}
            </Text>
          </VStack>
        </ClickableCard>
        <ClickableCard label="Live walk" variant="blue" onClick={startLiveWalk}>
          <VStack gap={1}>
            <Icon icon={Icons.mapPin} color="accent" />
            <Text weight="semibold">Live walk</Text>
            <Text type="supporting">GPS + steps</Text>
          </VStack>
        </ClickableCard>
        <ClickableCard label="Bathroom" variant="purple" onClick={onLogBathroom}>
          <VStack gap={1}>
            <Icon icon={Icons.toilet} color="secondary" />
            <Text weight="semibold">Bathroom</Text>
            <Text type="supporting">Pipi / popo</Text>
          </VStack>
        </ClickableCard>
      </Grid>

      <Text type="label" color="secondary" as="div" style={{ margin: "20px 0 8px" }}>
        Recent activity
      </Text>
      <Card padding={0}>
        {recent.length === 0 ? (
          <VStack gap={2} hAlign="center" padding={6}>
            <Icon icon={Icons.pawPrint} size="lg" color="disabled" />
            <Text type="supporting" style={{ textAlign: "center" }}>
              No activity yet today.
              <br />
              Log a walk or meal to get started!
            </Text>
          </VStack>
        ) : (
          <VStack gap={0}>
            {recent.map((item, i) => (
              <HStack
                key={i}
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
                  {item.icon ? <Icon icon={item.icon} color={item.accent} /> : <span>{item.emoji}</span>}
                </span>
                <VStack gap={0.5}>
                  <Text weight="medium">{item.title}</Text>
                  <Text type="supporting">{item.meta}</Text>
                  {item.photos && item.photos.length > 0 && (
                    <HStack gap={1} wrap="wrap" style={{ marginTop: 4 }}>
                      {item.photos.map((src, pi) => (
                        <img
                          key={pi}
                          src={src}
                          style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }}
                          alt=""
                        />
                      ))}
                    </HStack>
                  )}
                </VStack>
              </HStack>
            ))}
          </VStack>
        )}
      </Card>

      {p.avatar && (
        <div style={{ display: "flex", justifyContent: "center", padding: "16px 0 4px" }}>
          <DogAvatar avatar={p.avatar} size={120} />
        </div>
      )}

      <NotifPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        db={db}
        onLogWalk={onLogWalk}
        onLogFood={onLogFood}
        onNavigate={onNavigate}
      />
    </div>
  );
}
