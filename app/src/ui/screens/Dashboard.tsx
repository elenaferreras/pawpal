import { useMemo, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useLiveWalk } from "../components/LiveWalk";
import { WalksBarChart, type WalksBar } from "../components/WalksBarChart";
import { NotifPanel } from "../components/NotifPanel";
import { DogFace } from "../avatar/DogAvatar";
import { Eyebrow, CardTitle, StatNumber, Caption, Callout } from "../components/Typography";
import { Icons } from "../lib/icons";
import type { ScreenId } from "../types";

interface DashboardProps {
  onNavigate: (id: ScreenId) => void;
  onLogWalk: () => void;
  onLogFood: () => void;
  onLogBathroom: () => void;
}

const HERO = "var(--color-pawpal-hero)"; // cream
const DARK = "var(--color-pawpal-page)"; // #352B25
const BAR_COLOR = "var(--color-data-yellow-3)"; // #FFFF83
const MUTED = "var(--color-pawpal-muted)"; // #8C8976

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Today dashboard screen (Figma node 58:978).
 *
 * Greeting header (avatar + bell), a cream hero card showing the last five days
 * of walks with the week's average steps, a "Ready for a walk?" starter, quick
 * "Pooped"/"Trained" loggers, a meals progress card, and a "Notes for the vet"
 * card (edited on the Vet tab).
 */
export function Dashboard({
  onNavigate,
  onLogWalk,
  onLogFood,
  onLogBathroom,
}: DashboardProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const { active: walkActive, start: startWalk } = useLiveWalk();
  const [panelOpen, setPanelOpen] = useState(false);
  const p = db.profile;
  const todayISO = localISO(new Date());

  // Last five days (oldest → today) of walk steps for the hero chart.
  const { bars, average } = useMemo(() => {
    const days: { iso: string; letter: string; steps: number }[] = [];
    for (let i = 4; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = localISO(d);
      const steps = db.walks
        .filter((w) => w.date === iso)
        .reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0);
      days.push({ iso, letter: WEEKDAY_LETTERS[d.getDay()], steps });
    }
    const max = Math.max(1, ...days.map((d) => d.steps));
    const chart: (WalksBar & { letter: string })[] = days.map((d) => ({
      label: `${d.letter}: ${d.steps} steps`,
      fraction: d.steps / max,
      color: BAR_COLOR,
      letter: d.letter,
    }));
    const withSteps = days.filter((d) => d.steps > 0);
    const avg = withSteps.length
      ? Math.round(withSteps.reduce((a, d) => a + d.steps, 0) / withSteps.length)
      : 0;
    return { bars: chart, average: avg };
  }, [db.walks]);

  const mealsPerDay = p.mealsPerDay || 4;
  const eatenSlots = useMemo(() => {
    const slots = db.meals
      .filter((m) => m.date === todayISO && m.mealSlot != null)
      .map((m) => m.mealSlot as number);
    return new Set(slots);
  }, [db.meals, todayISO]);

  const toggleMeal = (slot: number): void => {
    update((d) => {
      const has = d.meals.some((m) => m.date === todayISO && m.mealSlot === slot);
      if (has) {
        d.meals = d.meals.filter((m) => !(m.date === todayISO && m.mealSlot === slot));
      } else {
        d.meals.push({
          date: todayISO,
          time: "",
          type: "meal",
          amount: Math.round((p.foodGoal || 0) / mealsPerDay),
          notes: "",
          mealSlot: slot,
          created: new Date().toISOString(),
        });
      }
    });
  };

  const vetNotes = (db.vetRecords.notes ?? "").trim();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Greeting header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px 12px",
        }}
      >
        <button
          type="button"
          aria-label="Settings"
          onClick={() => onNavigate("settings")}
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: p.avatar?.bg ?? "var(--color-dash-pooped)",
            flexShrink: 0,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}
        >
          <DogFace avatar={p.avatar} size={48} />
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <Eyebrow color={MUTED}>Hello,</Eyebrow>
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontWeight: 900,
              fontSize: 26,
              lineHeight: 1,
              color: HERO,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name || "Dieguito"}
          </span>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          onClick={() => setPanelOpen(true)}
          style={{
            marginLeft: "auto",
            width: 44,
            height: 44,
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
          <Icon icon={Icons.bell} color="inherit" />
        </button>
      </div>

      {/* Hero card — last 5 days of walks + weekly average */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ background: HERO, borderRadius: 32, padding: 24 }}>
          {/* Weekday labels */}
          <div style={{ display: "flex", marginBottom: 12 }}>
            {bars.map((b, i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: "var(--font-ui)",
                  fontWeight: 600,
                  fontSize: 18,
                  color: MUTED,
                }}
              >
                {b.letter}
              </span>
            ))}
          </div>

          <WalksBarChart data={bars} height={131} gap={16} />

          <button
            type="button"
            onClick={() => onNavigate("walks")}
            aria-label="View walks"
            style={{
              marginTop: 20,
              display: "block",
              width: "100%",
              textAlign: "left",
              border: "none",
              background: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            <Eyebrow color={MUTED} size={13} tracking={0.6}>
              This week&rsquo;s average
            </Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <StatNumber color={DARK}>{average.toLocaleString("de-DE")}</StatNumber>
              <StatNumber color={MUTED} style={{ opacity: 0.6 }}>
                steps
              </StatNumber>
            </div>
          </button>
        </div>
      </div>

      {/* Quick actions row */}
      <div style={{ display: "flex", gap: 8, padding: "16px 16px 0", alignItems: "stretch" }}>
        {/* Ready for a walk? */}
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            background: "var(--color-dash-walk)",
            borderRadius: 32,
            padding: 20,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 16,
            color: DARK,
            minHeight: 150,
          }}
        >
          <CardTitle>Ready for a walk?</CardTitle>
          <button
            type="button"
            aria-label={walkActive ? "Walk in progress" : "Start a walk"}
            onClick={() => {
              if (walkActive) {
                onLogWalk();
              } else {
                startWalk();
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: walkActive ? "center" : "space-between",
              gap: 8,
              padding: walkActive ? "13px 12px" : "6px 6px 6px 18px",
              borderRadius: 100,
              border: "none",
              cursor: "pointer",
              background: HERO,
              color: DARK,
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
              fontSize: 16,
              width: "100%",
            }}
          >
            {walkActive ? (
              <span
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                In progress
              </span>
            ) : (
              <>
                <span>Start</span>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: DARK,
                    color: HERO,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon icon={Icons.play} color="inherit" />
                </span>
              </>
            )}
          </button>
        </div>

        {/* Pooped + Trained */}
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          <QuickCard label="Pooped" bg="var(--color-dash-pooped)" onClick={onLogBathroom} />
          <QuickCard
            label="Trained"
            bg="var(--color-dash-trained)"
            onClick={() => toast("Training coming soon \u{1F43E}")}
          />
        </div>
      </div>

      {/* Meals progress */}
      <div style={{ padding: "8px 16px 0" }}>
        <div
          style={{
            background: "var(--color-dash-surface)",
            borderRadius: 32,
            padding: "20px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <CardTitle color={HERO}>Meals</CardTitle>
          <div style={{ display: "flex", gap: 12 }}>
            {Array.from({ length: mealsPerDay }, (_, slot) => {
              const done = eatenSlots.has(slot);
              return (
                <div
                  key={slot}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}
                >
                  <button
                    type="button"
                    aria-pressed={done}
                    aria-label={`${ORDINALS[slot] ?? `Meal ${slot + 1}`} meal${done ? ", eaten" : ""}`}
                    onClick={() => toggleMeal(slot)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 0,
                      background: done ? "var(--color-track-poop)" : "transparent",
                      border: done ? "none" : `2px solid ${HERO}`,
                      color: "#fff",
                    }}
                  >
                    {done && <Icon icon={Icons.checkCircle} color="inherit" />}
                  </button>
                  <Caption color={HERO} style={{ opacity: 0.7 }}>
                    {ORDINALS[slot] ?? slot + 1}
                  </Caption>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notes for the vet */}
      <div style={{ padding: "16px 16px 0" }}>
        <button
          type="button"
          onClick={() => onNavigate("vet")}
          aria-label="Notes for the vet"
          style={{
            display: "block",
            width: "100%",
            textAlign: "left",
            border: "none",
            padding: 0,
            borderRadius: 32,
            overflow: "hidden",
            cursor: "pointer",
            background: HERO,
          }}
        >
          <div
            style={{
              background: "var(--color-dash-pooped)",
              padding: "16px 24px",
              fontFamily: "var(--font-brand)",
              fontWeight: 700,
              fontSize: 18,
              color: DARK,
            }}
          >
            Notes for the vet
          </div>
          <div
            style={{
              padding: "16px 24px 20px",
              whiteSpace: "pre-wrap",
              opacity: vetNotes ? 1 : 0.5,
            }}
          >
            <Callout color={DARK}>
              {vetNotes || "Tap to add notes for your next vet visit."}
            </Callout>
          </div>
        </button>
      </div>

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

function QuickCard({
  label,
  bg,
  onClick,
}: {
  label: string;
  bg: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 4,
        background: bg,
        border: "none",
        borderRadius: 32,
        padding: "0 8px 0 14px",
        minHeight: 71,
        cursor: "pointer",
        color: "var(--color-pawpal-page)",
      }}
    >
      <CardTitle
        size={16}
        style={{
          letterSpacing: -0.2,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </CardTitle>
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "var(--color-pawpal-page)",
          color: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon icon={Icons.plus} color="inherit" />
      </span>
    </button>
  );
}
