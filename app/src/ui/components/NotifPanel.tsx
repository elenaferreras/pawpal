import type { Database, ScreenId } from "../types";
import { Modal } from "./Modal";

interface NotifItem {
  icon: string;
  colour: string;
  bg: string;
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
      icon: "ph-paw-print",
      colour: "var(--green)",
      bg: "var(--green-light)",
      title: "No walks yet today",
      sub: "Tap to log a walk",
      onClick: () => {
        onClose();
        onLogWalk();
      },
    });
  } else {
    items.push({
      icon: "ph-paw-print",
      colour: "var(--green)",
      bg: "var(--green-light)",
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
      icon: "ph-fork-knife",
      colour: "var(--amber)",
      bg: "var(--amber-light)",
      title: `${pct}% of daily food given`,
      sub: `${goal - fed}g remaining today`,
      onClick: () => {
        onClose();
        onLogFood();
      },
    });
  } else {
    items.push({
      icon: "ph-fork-knife",
      colour: "var(--amber)",
      bg: "var(--amber-light)",
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
      icon: "ph-first-aid",
      colour: "var(--brown)",
      bg: "var(--brown-light)",
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
      icon: "ph-pill",
      colour: "var(--brown)",
      bg: "var(--brown-light)",
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
      <div style={{ padding: "0 22px 8px" }}>
        {items.length === 0 ? (
          <div className="empty" style={{ padding: "32px 0" }}>
            <div className="empty-icon">
              <i className="ph ph-check-circle" />
            </div>
            <p>All good! Nothing to catch up on.</p>
          </div>
        ) : (
          items.map((item, i) => (
            <div
              key={i}
              onClick={item.onClick}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 0",
                borderBottom: "0.5px solid var(--border)",
                cursor: item.onClick ? "pointer" : "default",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  background: item.bg,
                  color: item.colour,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <i className={"ph " + item.icon} style={{ fontSize: 18 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 1 }}>
                  {item.sub}
                </div>
              </div>
              {item.onClick ? (
                <i className="ph ph-caret-right" style={{ color: "var(--text3)", fontSize: 16 }} />
              ) : (
                <i className="ph ph-check" style={{ color: "var(--green)", fontSize: 18 }} />
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
