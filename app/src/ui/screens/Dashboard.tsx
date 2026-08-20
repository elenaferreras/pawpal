import { useMemo } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useLiveWalk } from "../components/LiveWalk";
import { WalksBarChart, type WalksBar } from "../components/WalksBarChart";
import { DogFace } from "../avatar/DogAvatar";
import { Eyebrow, CardTitle, StatNumber, Caption, Callout } from "../components/Typography";
import { Icons } from "../lib/icons";
import type { ScreenId } from "../types";

interface DashboardProps {
  onNavigate: (id: ScreenId) => void;
  onLogWalk: () => void;
  onLogBathroom: () => void;
  /** Opens Settings with a circular reveal from the tapped avatar. */
  onOpenSettings?: (origin: { x: number; y: number }) => void;
  /** Opens the notifications page with a circular reveal from the tapped bell. */
  onOpenNotifications?: (origin: { x: number; y: number }) => void;
}

const HERO = "var(--color-pawpal-hero)"; // cream
const DARK = "var(--color-pawpal-page)"; // #352B25
const BAR_COLOR = "var(--color-data-yellow-3)"; // #FFFF83
// Future days render as a circle filled with the brown token at 40% opacity.
const FUTURE_COLOR = "color-mix(in srgb, var(--brown) 40%, transparent)";
const MUTED = "var(--color-pawpal-muted)"; // #8C8976

// Monday → Sunday letters for the hero week chart.
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
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
  onLogBathroom,
  onOpenSettings,
  onOpenNotifications,
}: DashboardProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const { active: walkActive, start: startWalk } = useLiveWalk();
  const p = db.profile;
  const todayISO = localISO(new Date());

  // Full current week (Monday → Sunday) of walk steps for the hero chart.
  const { bars, average } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() - dow);

    const days: { iso: string; letter: string; steps: number; future: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = localISO(d);
      const steps = db.walks
        .filter((w) => w.date === iso)
        .reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0);
      days.push({ iso, letter: WEEK_LETTERS[i], steps, future: d > today });
    }
    const max = Math.max(1, ...days.map((d) => d.steps));
    const chart: (WalksBar & { letter: string })[] = days.map((d) => ({
      label: d.future ? `${d.letter}: upcoming` : `${d.letter}: ${d.steps} steps`,
      // Future days render as a circle (fraction 0 → min height = width).
      fraction: d.future ? 0 : d.steps / max,
      color: d.future ? FUTURE_COLOR : BAR_COLOR,
      letter: d.letter,
    }));
    const withSteps = days.filter((d) => !d.future && d.steps > 0);
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

  const vetNoteItems = db.vetRecords.noteItems;
  // Checklist preview matching the Vet (health) tab. Falls back to splitting any
  // legacy free-text notes into rows so both screens look identical.
  const vetNoteList: { text: string; done: boolean }[] =
    vetNoteItems !== undefined
      ? vetNoteItems
      : (db.vetRecords.notes ?? "")
          .split("\n")
          .map((line) => line.replace(/^[-•✅☑️✔️\s]+/, "").trim())
          .filter(Boolean)
          .map((text) => ({ text, done: false }));
  const openVetCount = vetNoteList.filter((n) => !n.done).length;

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
          onClick={(e) => {
            if (onOpenSettings) {
              const r = e.currentTarget.getBoundingClientRect();
              onOpenSettings({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            } else {
              onNavigate("settings");
            }
          }}
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
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontWeight: 900,
              fontSize: 12,
              lineHeight: 1,
              color: MUTED,
            }}
          >
            Hello,
          </span>
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
          onClick={(e) => {
            if (onOpenNotifications) {
              const r = e.currentTarget.getBoundingClientRect();
              onOpenNotifications({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
            } else {
              onNavigate("notifications");
            }
          }}
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
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
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

          <WalksBarChart data={bars} height={131} gap={8} />

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
            <Eyebrow color={MUTED} size={13} tracking={0.6} style={{ paddingLeft: 0 }}>
              This week&rsquo;s average
            </Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <StatNumber color={DARK} style={{ fontSize: "clamp(30px, 9.5vw, 44px)" }}>
                {average.toLocaleString("de-DE")}
              </StatNumber>
              <StatNumber color={MUTED} style={{ opacity: 0.6, fontSize: "clamp(30px, 9.5vw, 44px)" }}>
                steps
              </StatNumber>
            </div>
          </button>
        </div>
      </div>

      {/* Quick actions row */}
      <div style={{ display: "flex", gap: 12, padding: "16px 16px 8px", alignItems: "stretch" }}>
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
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <QuickCard label="Bathroom" bg="#A9E7A7" onClick={onLogBathroom} />
          <QuickCard
            label="Training"
            bg="var(--color-dash-trained)"
            onClick={() => toast("Training coming soon \u{1F43E}")}
          />
        </div>
      </div>

      {/* Meals progress */}
      <div style={{ padding: "8px 16px 0" }}>
        <div
          role="button"
          tabIndex={0}
          aria-label="Meals"
          onClick={() => onNavigate("food")}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onNavigate("food");
            }
          }}
          style={{
            background: "var(--color-dash-surface)",
            borderRadius: 32,
            padding: "20px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            cursor: "pointer",
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
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMeal(slot);
                    }}
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              background: "var(--color-dash-pooped)",
              padding: "16px 24px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-brand)",
                fontWeight: 700,
                fontSize: 18,
                color: DARK,
              }}
            >
              Notes for the vet
            </span>
            {openVetCount > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontWeight: 700,
                  fontSize: 12,
                  color: DARK,
                  opacity: 0.7,
                }}
              >
                {openVetCount} open
              </span>
            )}
          </div>
          <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {vetNoteList.length === 0 ? (
              <Callout color={DARK} style={{ opacity: 0.5, padding: "4px 8px" }}>
                Tap to add notes for your next vet visit.
              </Callout>
            ) : (
              vetNoteList.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 10px",
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: DARK,
                      height: 21,
                      flexShrink: 0,
                    }}
                  >
                    {item.done ? (
                      <Icon icon={Icons.checkCircle} color="inherit" />
                    ) : (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          border: `2px solid ${DARK}`,
                          opacity: 0.5,
                        }}
                      />
                    )}
                  </span>
                  <Callout
                    color={DARK}
                    style={{
                      whiteSpace: "pre-wrap",
                      textDecoration: item.done ? "line-through" : "none",
                      opacity: item.done ? 0.5 : 1,
                    }}
                  >
                    {item.text}
                  </Callout>
                </div>
              ))
            )}
          </div>
        </button>
      </div>
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
