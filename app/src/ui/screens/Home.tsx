import { useState } from "react";
import { useDb } from "../lib/store";
import { fmtDate, WEATHER_MAP } from "../lib/date";
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

interface ActivityItem {
  kind: "walk" | "meal" | "bath";
  sortKey: string;
  node: React.ReactNode;
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
      node: (
        <div className="log-item">
          <div className="log-dot" style={{ background: "var(--green-light)", color: "var(--green)" }}>
            <i className="ph ph-paw-print" style={{ fontSize: 16 }} />
          </div>
          <div className="log-info">
            <div className="log-title">
              Walk — {w.duration || "?"} min
              {w.steps ? ` · ${w.steps} steps` : ""}
              {wIcon ? ` · ${wIcon}` : ""}
            </div>
            <div className="log-meta">
              {fmtDate(w.date)} {w.time} {w.friends ? "· friends" : ""}
            </div>
          </div>
        </div>
      ),
    });
  });
  db.meals.forEach((m) => {
    activity.push({
      kind: "meal",
      sortKey: m.created || m.date,
      node: (
        <div className="log-item">
          <div className="log-dot" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
            <i className="ph ph-fork-knife" style={{ fontSize: 16 }} />
          </div>
          <div className="log-info">
            <div className="log-title">{m.type} — {m.amount}g</div>
            <div className="log-meta">{fmtDate(m.date)} {m.time}</div>
          </div>
        </div>
      ),
    });
  });
  db.bathroom.forEach((b) => {
    activity.push({
      kind: "bath",
      sortKey: b.created || b.date,
      node: (
        <div className="log-item">
          <div className="log-dot" style={{ background: "#F0F0F0" }}>
            {b.type === "pipi" ? "💧" : "💩"}
          </div>
          <div className="log-info">
            <div className="log-title">
              {b.type === "pipi" ? "Pipi" : b.type === "popo" ? "Popo" : "Pipi & Popo"}
              {b.consistency ? ` · ${b.consistency}` : ""}
            </div>
            <div className="log-meta">{fmtDate(b.date)} {b.time}</div>
            {b.photos.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {b.photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, border: "0.5px solid var(--border)" }}
                    alt=""
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    });
  });
  activity.sort((a, b) => new Date(b.sortKey).getTime() - new Date(a.sortKey).getTime());
  const recent = activity.slice(0, 5);

  return (
    <div className="screen">
      <div className="hdr">
        <div>
          <div className="hdr-title">{greeting}</div>
          <div className="hdr-sub">
            {p.name ? `How’s ${p.name} doing today?` : "How’s your pup doing today?"}
            <br />
            {dateLabel}
          </div>
        </div>
        <button className="hdr-btn" onClick={() => setPanelOpen(true)} aria-label="Notifications">
          <i className="ph ph-bell" />
          {hasUrgent && (
            <span
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#FF3B30",
              }}
            />
          )}
        </button>
      </div>

      <div className="dog-hero">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {p.avatar ? (
            <DogFace avatar={p.avatar} size={48} />
          ) : (
            <span className="dog-hero-emoji" style={{ position: "static", transform: "none", fontSize: 40 }}>
              {p.emoji || "🐕"}
            </span>
          )}
          <div>
            <h2>{p.name || "Set up profile"}</h2>
            <p>{p.breed ? p.breed + (p.age ? `, ${p.age}` : "") : "Tap Profile to add your dog’s info"}</p>
          </div>
        </div>
        <div className="dog-hero-stats">
          <div className="dog-hero-stat">
            <div className="val">{todayWalks.length}</div>
            <div className="lbl">Walks today</div>
          </div>
          <div className="dog-hero-stat">
            <div className="val">{foodPct}%</div>
            <div className="lbl">Food</div>
          </div>
          <div className="dog-hero-stat">
            <div className="val">{todaySteps > 999 ? (todaySteps / 1000).toFixed(1) + "k" : todaySteps}</div>
            <div className="lbl">Steps</div>
          </div>
        </div>
      </div>

      <div className="section-label">Today</div>
      <div className="stat-row">
        <div className="stat-chip">
          <div className="sv">{todaySteps.toLocaleString()}</div>
          <div className="sl">steps</div>
        </div>
        <div className="stat-chip">
          <div className="sv">{todayWalks.length}</div>
          <div className="sl">{totalMins > 0 ? `${totalMins} min` : "walks"}</div>
        </div>
        <div className="stat-chip" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <FoodRing done={doneMeals} total={mealsPerDay} />
          <div className="sl">{doneMeals}/{mealsPerDay} meals</div>
        </div>
      </div>

      <div className="section-label">Quick actions</div>
      <div className="quick-row">
        <button className="quick-card" onClick={onLogWalk}>
          <div className="qc-icon" style={{ background: "var(--green-light)", color: "var(--green)" }}>
            <i className="ph ph-paw-print" />
          </div>
          <div className="qc-label">Log walk</div>
          <div className="qc-sub">
            {todayWalks.length ? `${todayWalks.length} walk${todayWalks.length > 1 ? "s" : ""} today` : "No walks today"}
          </div>
        </button>
        <button className="quick-card" onClick={onLogFood}>
          <div className="qc-icon" style={{ background: "var(--amber-light)", color: "var(--amber)" }}>
            <i className="ph ph-fork-knife" />
          </div>
          <div className="qc-label">Log meal</div>
          <div className="qc-sub">
            {todayMeals.length ? `${todayMeals.length} meal${todayMeals.length > 1 ? "s" : ""} today` : "No meals today"}
          </div>
        </button>
        <button className="quick-card" onClick={startLiveWalk}>
          <div className="qc-icon" style={{ background: "var(--green-light)", color: "var(--green)" }}>
            <i className="ph ph-map-pin" />
          </div>
          <div className="qc-label">Live walk</div>
          <div className="qc-sub">GPS + steps</div>
        </button>
        <button className="quick-card" onClick={onLogBathroom}>
          <div className="qc-icon" style={{ background: "#F0F0F0", color: "var(--text2)" }}>
            <i className="ph ph-toilet" />
          </div>
          <div className="qc-label">Bathroom</div>
          <div className="qc-sub">Pipi / popo</div>
        </button>
      </div>

      <div className="section-label">Recent activity</div>
      <div className="card card-flush">
        {recent.length === 0 ? (
          <div className="empty" style={{ padding: "28px 24px" }}>
            <div className="empty-icon">
              <i className="ph ph-paw-print" />
            </div>
            <p>No activity yet today.<br />Log a walk or meal to get started!</p>
          </div>
        ) : (
          recent.map((item, i) => <div key={i}>{item.node}</div>)
        )}
      </div>

      {p.avatar && (
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 4px" }}>
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
