import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { Icons } from "../lib/icons";
import { PageTitle } from "../components/Typography";
import type { ScreenId } from "../types";

type IconComponent = (typeof Icons)[keyof typeof Icons];

const HERO = "var(--color-pawpal-hero)"; // cream
const DARK = "var(--color-pawpal-page)"; // #352B25
const SURFACE = "var(--color-dash-surface)"; // #3E332C dark card
const MUTED = "var(--color-pawpal-muted)"; // #8C8976

interface NotifItem {
  icon: IconComponent;
  iconBg: string;
  title: string;
  sub: string;
  onClick?: () => void;
}

interface NotificationsProps {
  onClose: () => void;
  onLogWalk: () => void;
  onLogFood: () => void;
  onNavigate: (id: ScreenId) => void;
}

/**
 * Today's status / notifications, presented as a full page in the new dark UI
 * style (opened from the dashboard bell via a circular reveal). Mirrors the
 * signals previously shown in the NotifPanel modal.
 */
export function Notifications({
  onClose,
  onLogWalk,
  onLogFood,
  onNavigate,
}: NotificationsProps): React.ReactElement {
  const { db } = useDb();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const items: NotifItem[] = [];

  const walksToday = db.walks.filter((w) => w.date === todayStr);
  if (walksToday.length === 0) {
    items.push({
      icon: Icons.pawPrint,
      iconBg: "var(--color-dash-walk)",
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
      iconBg: "var(--color-dash-walk)",
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
      iconBg: "var(--color-dash-trained)",
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
      iconBg: "var(--color-dash-trained)",
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
      iconBg: "var(--color-track-poop)",
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
      iconBg: "var(--color-track-notes)",
      title: `${meds.length} active medication${meds.length > 1 ? "s" : ""}`,
      sub: meds.map((m) => m.name).join(", "),
      onClick: () => {
        onClose();
        onNavigate("vet");
      },
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        paddingBottom: "calc(32px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px 8px",
        }}
      >
        <PageTitle style={{ margin: 0 }}>Today</PageTitle>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            width: 44,
            height: 44,
            marginRight: -8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: HERO,
            flexShrink: 0,
          }}
        >
          <Icon icon={Icons.x} color="inherit" />
        </button>
      </div>

      <div style={{ padding: "4px 16px 0" }}>
        {items.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              background: SURFACE,
              borderRadius: 24,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--color-dash-walk)",
                color: "#221D1A",
              }}
            >
              <Icon icon={Icons.checkCircle} color="inherit" />
            </span>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 600,
                fontSize: 16,
                color: HERO,
              }}
            >
              All good!
            </span>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: 14,
                color: MUTED,
              }}
            >
              Nothing to catch up on.
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {items.map((item, i) => {
              const Wrapper = item.onClick ? "button" : "div";
              return (
                <Wrapper
                  key={i}
                  type={item.onClick ? "button" : undefined}
                  onClick={item.onClick}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    textAlign: "left",
                    background: SURFACE,
                    borderRadius: 24,
                    border: "none",
                    padding: 16,
                    cursor: item.onClick ? "pointer" : "default",
                  }}
                >
                  <span
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: item.iconBg,
                      color: "#221D1A",
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={item.icon} color="inherit" />
                  </span>
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 3,
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontWeight: 700,
                        fontSize: 16,
                        lineHeight: 1.15,
                        color: HERO,
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontWeight: 500,
                        fontSize: 14,
                        color: MUTED,
                      }}
                    >
                      {item.sub}
                    </span>
                  </span>
                  {item.onClick ? (
                    <span style={{ color: MUTED, display: "flex", flexShrink: 0 }}>
                      <Icon icon={Icons.caretRight} color="inherit" />
                    </span>
                  ) : (
                    <span style={{ color: "var(--color-dash-walk)", display: "flex", flexShrink: 0 }}>
                      <Icon icon={Icons.check} color="inherit" />
                    </span>
                  )}
                </Wrapper>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
