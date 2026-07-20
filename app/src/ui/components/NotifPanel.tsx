import type { Database, ScreenId } from "../types";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Icon } from "@astryxdesign/core/Icon";
import { Modal } from "./Modal";
import { Icons } from "../lib/icons";

type IconComponent = (typeof Icons)[keyof typeof Icons];
type Accent = "success" | "warning" | "secondary";

interface NotifItem {
  icon: IconComponent;
  accent: Accent;
  title: string;
  sub: string;
  onClick?: () => void;
}

interface NotifPanelProps {
  open: boolean;
  onClose: () => void;
  db: Database;
  onLogWalk: () => void;
  onLogFood: () => void;
  onNavigate: (id: ScreenId) => void;
}

export function NotifPanel({
  open,
  onClose,
  db,
  onLogWalk,
  onLogFood,
  onNavigate,
}: NotifPanelProps): React.ReactElement {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const items: NotifItem[] = [];

  const walksToday = db.walks.filter((w) => w.date === todayStr);
  if (walksToday.length === 0) {
    items.push({
      icon: Icons.pawPrint,
      accent: "success",
      title: "No walks yet today",
      sub: "Tap to log a walk",
      onClick: () => {
        onClose();
        onLogWalk();
      },
    });
  } else {
    items.push({
      icon: Icons.pawPrint,
      accent: "success",
      title: `${walksToday.length} walk${walksToday.length > 1 ? "s" : ""} today`,
      sub: "Great job!",
    });
  }

  const mealsToday = db.meals.filter((m) => m.date === todayStr);
  const fed = mealsToday.reduce((a, m) => a + (m.amount || 0), 0);
  const goal = db.profile.foodGoal || 300;
  const pct = Math.min(100, Math.round((fed / goal) * 100));
  if (pct < 100) {
    items.push({
      icon: Icons.forkKnife,
      accent: "warning",
      title: `${pct}% of daily food given`,
      sub: `${goal - fed}g remaining today`,
      onClick: () => {
        onClose();
        onLogFood();
      },
    });
  } else {
    items.push({
      icon: Icons.forkKnife,
      accent: "warning",
      title: "Daily food goal reached!",
      sub: `${fed}g given today`,
    });
  }

  const upcoming = db.vetRecords.reminders
    .filter((r) => {
      if (!r.date) return false;
      const diff = (new Date(r.date + "T12:00:00").getTime() - today.getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  upcoming.forEach((r) => {
    const diff = Math.round(
      (new Date(r.date + "T12:00:00").getTime() - today.getTime()) / 86400000,
    );
    const when = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `In ${diff} days`;
    items.push({
      icon: Icons.stethoscope,
      accent: "secondary",
      title: r.title,
      sub: `${when} · ${r.priority} priority`,
      onClick: () => {
        onClose();
        onNavigate("vet");
      },
    });
  });

  const meds = db.vetRecords.medications.filter((m) => {
    if (!m.end) return true;
    return new Date(m.end + "T12:00:00") >= today;
  });
  if (meds.length > 0) {
    items.push({
      icon: Icons.pill,
      accent: "secondary",
      title: `${meds.length} active medication${meds.length > 1 ? "s" : ""}`,
      sub: meds.map((m) => m.name).join(", "),
      onClick: () => {
        onClose();
        onNavigate("vet");
      },
    });
  }

  return (
    <Modal open={open} title="Today’s status" onClose={onClose}>
      {items.length === 0 ? (
        <VStack gap={2} hAlign="center" padding={6}>
          <Icon icon={Icons.checkCircle} size="lg" color="success" />
          <Text type="supporting">All good! Nothing to catch up on.</Text>
        </VStack>
      ) : (
        <VStack gap={0}>
          {items.map((item, i) => (
            <HStack
              key={i}
              gap={3}
              vAlign="center"
              padding={3}
              onClick={item.onClick}
              style={{
                cursor: item.onClick ? "pointer" : "default",
                borderTop: i === 0 ? undefined : "1px solid var(--color-border, #eee)",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: "var(--color-background-section, #f4f4f4)",
                  flexShrink: 0,
                }}
              >
                <Icon icon={item.icon} color={item.accent} />
              </span>
              <VStack gap={0.5} style={{ flex: 1 }}>
                <Text weight="semibold">{item.title}</Text>
                <Text type="supporting">{item.sub}</Text>
              </VStack>
              {item.onClick ? (
                <Icon icon={Icons.caretRight} color="disabled" />
              ) : (
                <Icon icon={Icons.check} color="success" />
              )}
            </HStack>
          ))}
        </VStack>
      )}
    </Modal>
  );
}
