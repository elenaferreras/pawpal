import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { WalksBarChart, type WalksBar } from "../components/WalksBarChart";
import { DogFace } from "../avatar/DogAvatar";
import { Eyebrow, CardTitle, StatNumber, Caption, Callout } from "../components/Typography";
import { TopBar } from "../components/TopBar";
import { FitText } from "../components/FitText";
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
  /** Opens the Vet tab with the "Notes for the vet" detail screen showing. */
  onOpenVetNotes?: () => void;
}

const HERO = "var(--color-pawpal-hero)"; // cream
const DARK = "var(--color-pawpal-page)"; // #352B25
const BAR_COLOR = "var(--color-data-yellow-3)"; // #FFFF83
// Future days render as a circle filled with the brown token at 40% opacity.
const FUTURE_COLOR = "color-mix(in srgb, var(--brown) 40%, transparent)";
const MUTED = "var(--color-pawpal-muted)"; // #8C8976

// Monday → Sunday letters for the hero week chart.
const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
// Blank space between adjacent week panels so Sunday↔Monday bars don't touch.
const WEEK_GAP = 24;
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

// Staggered load-in for the dashboard cards: each block fades and rises into
// place a beat after the previous one when the screen mounts (e.g. on reload).
const CARDS_CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const CARD_ITEM: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

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
  onOpenVetNotes,
}: DashboardProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const p = db.profile;
  const todayISO = localISO(new Date());
  const reduceMotion = useReducedMotion();

  // Every Monday → Sunday week from the earliest walk up to the current week.
  // Ordered oldest → newest so the current week is the last (rightmost) panel.
  const weeks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = (today.getDay() + 6) % 7; // 0 = Monday
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - dow);

    // How many weeks back the earliest walk sits (capped so we never render an
    // unbounded number of panels).
    let weeksBack = 0;
    if (db.walks.length) {
      let earliest = Infinity;
      for (const w of db.walks) {
        const t = new Date(`${w.date}T00:00:00`).getTime();
        if (!Number.isNaN(t) && t < earliest) earliest = t;
      }
      if (Number.isFinite(earliest)) {
        const diffDays = Math.floor((currentMonday.getTime() - earliest) / 86_400_000);
        weeksBack = Math.max(0, Math.min(52, Math.ceil(diffDays / 7)));
      }
    }

    const result: { bars: (WalksBar & { letter: string })[]; average: number; offset: number }[] = [];
    for (let wk = weeksBack; wk >= 0; wk--) {
      const monday = new Date(currentMonday);
      monday.setDate(currentMonday.getDate() - wk * 7);

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
      result.push({ bars: chart, average: avg, offset: -wk });
    }
    return result;
  }, [db.walks]);

  // Horizontal scroll carousel state — one snap panel per week.
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const [activeWeek, setActiveWeek] = useState(0);

  // Land on the current week (rightmost panel) whenever the week set changes.
  useLayoutEffect(() => {
    const el = weekScrollRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    setActiveWeek(weeks.length - 1);
  }, [weeks.length]);

  const onWeekScroll = (): void => {
    const el = weekScrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / (el.clientWidth + WEEK_GAP));
    setActiveWeek(Math.max(0, Math.min(weeks.length - 1, idx)));
  };

  const current = weeks[activeWeek] ?? weeks[weeks.length - 1];
  const average = current?.average ?? 0;
  const averageLabel =
    current?.offset === 0
      ? "This week's average"
      : current?.offset === -1
        ? "Last week's average"
        : `${Math.abs(current?.offset ?? 0)} weeks ago`;

  const mealsPerDay = p.mealsPerDay || 4;
  const eatenSlots = useMemo(() => {
    const slots = db.meals
      .filter((m) => m.date === todayISO && m.mealSlot != null)
      .map((m) => m.mealSlot as number);
    return new Set(slots);
  }, [db.meals, todayISO]);

  // Today's aggregated walk activity (summed across manual + any live entries).
  const todayActivity = useMemo(() => {
    const entries = db.walks.filter((w) => w.date === todayISO);
    return {
      hasData: entries.length > 0,
      steps: entries.reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0),
      walks: entries.reduce((a, w) => a + (w.walksCount ?? 1), 0),
      poops: entries.reduce((a, w) => a + (w.poops ?? 0), 0),
    };
  }, [db.walks, todayISO]);

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
      {/* Greeting header — avatar + name on the left, bell on the right. */}
      <TopBar
        title={p.name || "Dieguito"}
        largeTitle={
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 0 8px" }}>
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
                width: 44,
                height: 44,
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
              <DogFace avatar={p.avatar} size={44} />
            </button>
            <FitText
              max={34}
              min={20}
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 700,
                lineHeight: "41px",
                letterSpacing: -0.4,
                color: HERO,
                overflow: "hidden",
                whiteSpace: "nowrap",
              }}
            >
              {p.name || "Dieguito"}
            </FitText>
            <button
              type="button"
              aria-label="Notifications"
              className="glass-btn"
              onClick={(e) => {
                if (onOpenNotifications) {
                  const r = e.currentTarget.getBoundingClientRect();
                  onOpenNotifications({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                } else {
                  onNavigate("notifications");
                }
              }}
            >
              <Icon icon={Icons.bell} color="inherit" />
            </button>
          </div>
        }
      />

      {/* Hero card — weekly walks (swipe horizontally for previous weeks) */}
      <motion.div
        variants={CARDS_CONTAINER}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
      >
        <motion.div variants={CARD_ITEM} style={{ padding: "0 16px" }}>
          <div style={{ background: HERO, borderRadius: 32, padding: 24 }}>
          {/* Week carousel — each panel is one Monday → Sunday week. */}
          <div
            ref={weekScrollRef}
            className="week-scroller"
            onScroll={onWeekScroll}
            style={{ gap: WEEK_GAP }}
          >
            {weeks.map((week, wi) => (
              <div key={wi} className="week-panel">
                {/* Weekday labels */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {week.bars.map((b, i) => (
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

                <WalksBarChart data={week.bars} height={131} gap={8} />
              </div>
            ))}
          </div>

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
              {averageLabel}
            </Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <StatNumber color={DARK} weight={400} style={{ fontFamily: "var(--font-ui)", fontSize: "clamp(30px, 9.5vw, 44px)" }}>
                {average.toLocaleString("de-DE")}
              </StatNumber>
              <StatNumber color={MUTED} weight={400} style={{ fontFamily: "var(--font-ui)", opacity: 0.6, fontSize: "clamp(30px, 9.5vw, 44px)" }}>
                steps
              </StatNumber>
            </div>
          </button>
        </div>
        </motion.div>

      {/* Quick actions row */}
      <motion.div
        variants={CARD_ITEM}
        style={{ display: "flex", gap: 12, padding: "16px 16px 8px", alignItems: "stretch" }}
      >
        {/* Today's walk activity — tap to log/edit the day's activity */}
        <button
          type="button"
          onClick={onLogWalk}
          aria-label={
            todayActivity.hasData ? "Edit today's walk activity" : "Log today's walk activity"
          }
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
            border: "none",
            textAlign: "left",
            cursor: "pointer",
            fontFamily: "var(--font-ui)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <CardTitle weight={400} style={{ fontFamily: "var(--font-ui)" }}>
              {todayActivity.hasData ? "Today's walks" : "Today's activity"}
            </CardTitle>
            {todayActivity.hasData && (
              <span
                aria-hidden
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: HERO,
                  color: DARK,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon icon={Icons.pencilSimple} color="inherit" />
              </span>
            )}
          </div>

          {todayActivity.hasData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon icon={Icons.footprints} color="inherit" />
                <StatNumber color={DARK} weight={400} style={{ fontFamily: "var(--font-ui)", fontSize: 26, lineHeight: 1 }}>
                  {todayActivity.walks}
                </StatNumber>
                <Callout color={DARK} style={{ opacity: 0.7 }}>
                  {todayActivity.walks === 1 ? "walk" : "walks"}
                </Callout>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Icon icon={Icons.toilet} color="inherit" />
                <StatNumber color={DARK} weight={400} style={{ fontFamily: "var(--font-ui)", fontSize: 26, lineHeight: 1 }}>
                  {todayActivity.poops}
                </StatNumber>
                <Callout color={DARK} style={{ opacity: 0.7 }}>
                  {todayActivity.poops === 1 ? "poop" : "poops"}
                </Callout>
              </div>
              <Caption color={DARK} style={{ opacity: 0.55 }}>
                {todayActivity.steps.toLocaleString("de-DE")} steps
              </Caption>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Callout color={DARK} style={{ opacity: 0.7 }}>
                Nothing logged yet. Tap to track a walk.
              </Callout>
              <span className="dash-track-pill" aria-hidden>
                Track walk
              </span>
            </div>
          )}
        </button>

        {/* Pooped + Trained */}
        <div style={{ flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          <QuickCard label="Bathroom" bg="#A9E7A7" onClick={onLogBathroom} />
          <QuickCard
            label="Training"
            bg="var(--color-dash-trained)"
            onClick={() => toast("Training coming soon \u{1F43E}")}
          />
        </div>
      </motion.div>

      {/* Meals progress */}
      <motion.div variants={CARD_ITEM} style={{ padding: "8px 16px 0" }}>
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
          <CardTitle color={HERO} weight={400} style={{ fontFamily: "var(--font-ui)" }}>Meals</CardTitle>
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
      </motion.div>

      {/* Notes for the vet */}
      <motion.div variants={CARD_ITEM} style={{ padding: "16px 16px 0" }}>
        <button
          type="button"
          onClick={() => (onOpenVetNotes ? onOpenVetNotes() : onNavigate("vet"))}
          aria-label="Vet notes"
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
                fontFamily: "var(--font-ui)",
                fontWeight: 400,
                fontSize: 18,
                color: DARK,
              }}
            >
              Vet notes
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
              (() => {
                const latest = vetNoteList[vetNoteList.length - 1];
                const extra = vetNoteList.length - 1;
                return (
                  <>
                    <div
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
                        {latest.done ? (
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
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          textDecoration: latest.done ? "line-through" : "none",
                          opacity: latest.done ? 0.5 : 1,
                        }}
                      >
                        {latest.text}
                      </Callout>
                    </div>
                    {extra > 0 && (
                      <Callout color={DARK} style={{ opacity: 0.55, padding: "0 10px 0 42px" }}>
                        +{extra} more note{extra !== 1 ? "s" : ""}
                      </Callout>
                    )}
                  </>
                );
              })()
            )}
          </div>
        </button>
      </motion.div>
      </motion.div>
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
        weight={400}
        style={{
          fontFamily: "var(--font-ui)",
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
