import { useMemo, useState, useRef, useLayoutEffect, useEffect, Fragment } from "react";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "./ConfirmDialog";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { useLiveWalk } from "./LiveWalk";
import { RouteMap } from "./RouteMap";
import { MotionSheet } from "./MotionSheet";
import { RevealItem } from "./Reveal";
import { CardStagger } from "./CardStagger";
import { SwipeableRow } from "./SwipeableRow";
import { StatNumber } from "./Typography";
import { TopBar, TopBarAction, TopBarButton } from "./TopBar";
import { WalkEntry } from "./WalkEntry";
import { fmtDate } from "../lib/date";
import { useWalkers, myLoggerId, isMyWalk } from "../lib/walkers";
import { getSharedRowKey } from "../lib/supabase";
import type { Walk } from "../types";

interface WalksStatsProps {
  /** Optional back affordance; omitted when shown as a tab. */
  onBack?: () => void;
  /** Opens the add-walk flow from the header plus button. When a calendar day
   * is selected, its ISO date is passed so the walk pre-fills that date. */
  onAdd?: (dateISO?: string) => void;
  /** Opens the edit-walk flow for a given walk index (swipe → Edit). */
  onEdit?: (index: number) => void;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
// Rows per month page: a calendar month spans at most 6 Monday-aligned weeks.
const WEEKS = 6;
// How many month windows to keep loaded, newest last. Scroll left for older.
const PAGES = 6;

type WalkFilter = "today" | "month" | "all";

const WALK_FILTERS: { value: WalkFilter; label: string }[] = [
  { value: "today", label: "Day" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" },
];

/** Local YYYY-MM-DD (avoids UTC off-by-one from toISOString). */
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DayInfo {
  date: Date;
  steps: number;
  future: boolean;
}

/**
 * "Zipi's Walks" step heatmap (Figma node 31:259).
 *
 * Full-screen dark overlay opened from the Walks tab. Shows one calendar month
 * per page (starting on the 1st, Monday-aligned) as a grid: active days are
 * light-blue cells with an orange dot sized by step count; empty/future days are
 * muted cells with a small dot. Scroll left for previous months.
 */
export function WalksStats({ onBack, onAdd, onEdit }: WalksStatsProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const { active: walkActive, coords, openSheet, markerHtml, accuracy } = useLiveWalk();
  // Only the person who logged an entry may edit or delete it; everyone else's
  // walks (co-owners', sitters') are read-only here.
  const myId = myLoggerId();
  const [selected, setSelected] = useState<number | null>(null);
  const [filter, setFilter] = useState<WalkFilter>("today");
  const [mapWalk, setMapWalk] = useState<Walk | null>(null);
  const calRef = useRef<HTMLDivElement>(null);
  // Mirrors `visiblePage` for the scroll handler (avoids stale closures) and a
  // debounce timer so we only react once a fling has settled.
  const pageRef = useRef(PAGES - 1);
  const scrollEndTimer = useRef<number | null>(null);
  // Which month window is currently in view (defaults to the newest).
  const [visiblePage, setVisiblePage] = useState(PAGES - 1);
  // Measured height of the calendar for the month in view, so months with fewer
  // weeks don't leave dead space above the summary/list below.
  const [calH, setCalH] = useState<number | undefined>(undefined);

  // One-time migration: the old tracker stored two hard-coded assignees
  // ("Person A" / "Person B"). Now that walks are attributed to real people,
  // remap Person A → the signed-in user and Person B → the (first) co-owner.
  // Only the primary owner rewrites the shared data; a co-owner must not clobber
  // the owner's names, and we wait until co-owner/sitter names have loaded.
  const { walkers, loaded: walkersLoaded } = useWalkers();
  useEffect(() => {
    if (getSharedRowKey() || !walkersLoaded) return;
    try {
      if (localStorage.getItem("pawpal_assignee_migrated")) return;
    } catch {
      /* storage unavailable — skip once */
      return;
    }
    const me = walkers.find((w) => w.kind === "you")?.name ?? "You";
    const co = walkers.find((w) => w.kind === "coowner")?.name ?? "Co-owner";
    const needs = db.walks.some((w) => w.assignee === "Person A" || w.assignee === "Person B");
    if (needs) {
      update((d) => {
        for (const w of d.walks) {
          if (w.assignee === "Person A") w.assignee = me;
          else if (w.assignee === "Person B") w.assignee = co;
        }
      });
    }
    try {
      localStorage.setItem("pawpal_assignee_migrated", "1");
    } catch {
      /* ignore */
    }
  }, [walkersLoaded, walkers, db.walks, update]);

  // Open on the current window (rightmost); the user scrolls left for older.
  useLayoutEffect(() => {
    const el = calRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const onCalScroll = (): void => {
    const el = calRef.current;
    if (!el) return;
    // Defer page detection until the fling settles. Reacting on every scroll
    // event resizes the calendar (month → height) and re-renders the cells
    // mid-scroll, which cancels iOS momentum/snap and leaves a month parked
    // half-visible. Waiting for the scroll to stop lets snap resolve first.
    if (scrollEndTimer.current != null) clearTimeout(scrollEndTimer.current);
    scrollEndTimer.current = window.setTimeout(() => {
      const stride = (el.scrollWidth - el.clientWidth) / (PAGES - 1);
      const p = stride > 0 ? Math.round(el.scrollLeft / stride) : PAGES - 1;
      const clamped = Math.max(0, Math.min(PAGES - 1, p));
      // Landing on a different month clears the day selection and focuses the
      // "Month" segment on that month's walks.
      if (clamped !== pageRef.current) {
        pageRef.current = clamped;
        setVisiblePage(clamped);
        setSelected(null);
        setFilter("month");
      }
    }, 90);
  };

  useEffect(
    () => () => {
      if (scrollEndTimer.current != null) clearTimeout(scrollEndTimer.current);
    },
    [],
  );


  const delWalk = async (index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this walk?",
      message: "This walk will be permanently removed.",
      confirmLabel: "Delete Walk",
    });
    if (!ok) return;
    update((d) => {
      const walkCreated = d.walks[index]?.created;
      d.walks.splice(index, 1);
      if (walkCreated) {
        const bIdx = d.bathroom.findIndex((b) => b.source === walkCreated);
        if (bIdx >= 0) d.bathroom.splice(bIdx, 1);
      }
    });
    toast("Walk deleted");
  };

  const { pages, days } = useMemo(() => {
    const stepsByDay = new Map<string, number>();
    for (const w of db.walks) {
      const s = parseInt(String(w.steps)) || 0;
      stepsByDay.set(w.date, (stepsByDay.get(w.date) || 0) + s);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Each page is a calendar month starting on the 1st (Monday-aligned, with
    // leading/trailing blank cells). The current month is the rightmost page;
    // older months scroll left. Every page is padded to WEEKS×7 cells so the
    // flat `days` index stays a simple `page * WEEKS * 7 + cell`.
    const flat: (DayInfo | null)[] = [];
    const pageList: {
      month: Date;
      days: (DayInfo | null)[];
      rows: number;
      max: number;
      avg: number;
    }[] = [];
    for (let p = 0; p < PAGES; p++) {
      const monthsBack = PAGES - 1 - p;
      const first = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
      const year = first.getFullYear();
      const month = first.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const lead = (first.getDay() + 6) % 7; // blanks before the 1st (Mon = 0)
      const rows = Math.ceil((lead + daysInMonth) / 7); // weeks this month spans

      const cells: (DayInfo | null)[] = [];
      for (let i = 0; i < lead; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        cells.push({ date, steps: stepsByDay.get(localISO(date)) || 0, future: date > today });
      }
      // Pad the flat array to a fixed page stride so `days` indexing stays simple,
      // but `rows` drives how many weeks actually render.
      while (cells.length < WEEKS * 7) cells.push(null);

      // Normalise dot sizes to the month's own busiest day and carry its average.
      const activeDays = cells.filter((c): c is DayInfo => !!c && !c.future && c.steps > 0);
      const average = activeDays.length
        ? Math.round(activeDays.reduce((a, d) => a + d.steps, 0) / activeDays.length)
        : 0;
      pageList.push({
        month: first,
        days: cells,
        rows,
        max: Math.max(0, ...cells.map((c) => (c ? c.steps : 0))),
        avg: average,
      });
      flat.push(...cells);
    }

    return { pages: pageList, days: flat };
  }, [db.walks]);

  const name = db.profile.name.trim() || "Zipi";
  const selectedDay = selected !== null ? days[selected] : null;
  const avg = pages[visiblePage]?.avg ?? 0;
  // Name of the month currently in view (with year only when it isn't this one).
  const visibleMonth = pages[visiblePage]?.month;
  const monthLabel = visibleMonth
    ? visibleMonth.toLocaleDateString("en-US", {
        month: "long",
        ...(visibleMonth.getFullYear() === new Date().getFullYear()
          ? {}
          : { year: "numeric" }),
      })
    : "";

  // Size the calendar to the visible month's week count (cells are square, so a
  // row's height equals a column's width), remeasuring on resize/month change.
  const visibleRows = pages[visiblePage]?.rows ?? WEEKS;
  useLayoutEffect(() => {
    const el = calRef.current;
    if (!el) return;
    const measure = (): void => {
      const pad = 5;
      const gap = 4;
      const cell = (el.clientWidth - pad * 2 - gap * 6) / 7;
      setCalH(visibleRows * cell + (visibleRows - 1) * gap + pad * 2);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [visibleRows]);

  // Tapping a calendar day selects it and focuses the "Day" segment on that
  // date; tapping the same day again clears the selection (back to today).
  const selectDay = (i: number): void => {
    const next = selected === i ? null : i;
    setSelected(next);
    if (next !== null) setFilter("today");
  };

  const entries = useMemo(() => {
    const now = new Date();
    const todayStr = localISO(now);
    // Newest walk first, using the walk's own date + time (falling back to the
    // created timestamp) rather than only when the row was inserted.
    const stamp = (w: Walk): number =>
      new Date(`${w.date}T${w.time || "00:00"}`).getTime() || new Date(w.created || w.date).getTime();
    const sorted = db.walks
      .map((w, index) => ({ w, index }))
      .sort((a, b) => stamp(b.w) - stamp(a.w));
    if (filter === "today") {
      // "Day" shows the selected calendar day when one is tapped, else today.
      const dayStr = selected !== null && days[selected] ? localISO(days[selected]!.date) : todayStr;
      return sorted.filter(({ w }) => w.date === dayStr);
    }
    if (filter === "month")
      return sorted.filter(({ w }) => {
        const d = new Date(w.date + "T12:00:00");
        const m = pages[visiblePage]?.month ?? now;
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
    return sorted;
  }, [db.walks, filter, selected, days, pages, visiblePage]);

  // Group the (already newest-first) entries by calendar day so the list can
  // show a "Today" / "Yesterday" / date header above each day's walks.
  const groupedEntries = useMemo(() => {
    const groups: { date: string; items: { w: Walk; index: number }[] }[] = [];
    const byDate = new Map<string, { w: Walk; index: number }[]>();
    for (const e of entries) {
      let arr = byDate.get(e.w.date);
      if (!arr) {
        arr = [];
        byDate.set(e.w.date, arr);
        groups.push({ date: e.w.date, items: arr });
      }
      arr.push(e);
    }
    return groups;
  }, [entries]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-pawpal-page)",
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      <TopBar
        title={`${name}\u2019s Walks`}
        leading={
          onBack ? (
            <TopBarAction icon={Icons.caretLeft} label="Back" onClick={onBack} />
          ) : undefined
        }
        action={
          onAdd ? (
            <TopBarButton
              icon={Icons.plus}
              label="Add walk"
              onClick={() => onAdd(selectedDay ? localISO(selectedDay.date) : undefined)}
              color="var(--color-dash-walk)"
            />
          ) : undefined
        }
      />
      <div style={{ padding: "0 16px" }}>

      <CardStagger>
      {walkActive && (
        <button
          type="button"
          aria-label="Open walk in progress"
          onClick={openSheet}
          style={{
            background: "var(--color-dash-walk)",
            borderRadius: 40,
            padding: "20px 16px",
            marginBottom: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: "100%",
            border: "none",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-brand)",
              fontWeight: 400,
              fontSize: 24,
              lineHeight: 1,
              color: "var(--color-pawpal-page)",
            }}
          >
            Walk in progress
          </p>
          <div
            style={{
              height: 134,
              borderRadius: 24,
              overflow: "hidden",
              width: "100%",
              background: "var(--color-walkcell-empty)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {coords.length >= 1 ? (
              <RouteMap
                coords={coords}
                height={134}
                mapStyle="voyager"
                live
                follow
                markerHtml={markerHtml}
                accuracyM={accuracy ?? undefined}
                lineColor="#8592E0"
              />
            ) : (
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontWeight: 500,
                  fontSize: 15,
                  color: "var(--color-pawpal-hero)",
                  opacity: 0.85,
                }}
              >
                📍 Acquiring GPS…
              </span>
            )}
          </div>
        </button>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, padding: "0 5px" }}
        >
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: 24,
                color: "var(--color-track-notes)",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        <div
          className="week-scroller week-scroller--cal"
          ref={calRef}
          onScroll={onCalScroll}
          style={{
            gap: 16,
            height: calH,
            overflowY: "hidden",
            alignItems: "flex-start",
            transition: "height 0.2s ease",
          }}
        >
          {pages.map((page, p) => (
            <div
              key={p}
              className="week-panel"
              style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}
            >
              {page.days.slice(0, page.rows * 7).map((day, i) => {
                const gi = p * WEEKS * 7 + i;
                if (!day) return <div key={i} style={{ aspectRatio: "1 / 1" }} />;
                return (
                  <DayCell
                    key={i}
                    date={day.date}
                    steps={day.steps}
                    max={page.max}
                    future={day.future}
                    selected={selected === gi}
                    onSelect={() => selectDay(gi)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        {selectedDay ? (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 400,
                fontSize: 24,
                color: "var(--color-pawpal-hero)",
              }}
            >
              {selectedDay.date.toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
            <p style={{ margin: 0 }}>
              <StatNumber
                size={32}
                weight={700}
                color="var(--color-pawpal-hero)"
                style={{ fontSize: "clamp(24px, 7vw, 32px)" }}
              >
                {selectedDay.future
                  ? "Not yet"
                  : selectedDay.steps > 0
                    ? `${selectedDay.steps.toLocaleString("de-DE")} steps`
                    : "No walk"}
              </StatNumber>
            </p>
          </>
        ) : (
          <>
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-ui)",
                fontWeight: 400,
                fontSize: 24,
                color: "var(--color-pawpal-hero)",
              }}
            >
              {monthLabel}
            </p>
            <p style={{ margin: 0 }}>
              <StatNumber
                size={32}
                weight={700}
                color="var(--color-pawpal-hero)"
                style={{ fontSize: "clamp(24px, 7vw, 32px)" }}
              >
                {avg.toLocaleString("de-DE")} steps
              </StatNumber>
            </p>
          </>
        )}
      </div>

      {/* Filter + walk entries (Figma node 262:6584). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: 4,
          height: 48,
          marginTop: 24,
          borderRadius: 100,
          background: "#221D1A",
        }}
      >
        <div
          style={{
            display: "flex",
            flex: 1,
            minWidth: 0,
            height: "100%",
            alignItems: "center",
            borderRadius: 64,
            background: "var(--color-pawpal-page)",
          }}
        >
          {WALK_FILTERS.map((f, i) => {
            const active = filter === f.value;
            const prevActive = i > 0 && filter === WALK_FILTERS[i - 1].value;
            const showDivider = i > 0 && !active && !prevActive;
            return (
              <Fragment key={f.value}>
                {showDivider && (
                  <span
                    aria-hidden
                    style={{
                      width: 1,
                      height: 20,
                      flexShrink: 0,
                      background: "rgba(233, 228, 196, 0.25)",
                    }}
                  />
                )}
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: "100%",
                    padding: "0 12px",
                    borderRadius: 40,
                    border: "none",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-ui)",
                    fontWeight: active ? 700 : 500,
                    fontSize: 16,
                    background: active ? "var(--color-dash-walk)" : "transparent",
                    color: active ? "var(--color-pawpal-page)" : "var(--color-dash-walk)",
                  }}
                >
                  {f.label}
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {entries.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 24,
              textAlign: "center",
              borderRadius: 16,
              background: "var(--color-settings-group)",
              fontFamily: "var(--font-ui)",
              fontWeight: 400,
              fontSize: 16,
              color: "var(--color-pawpal-hero)",
              opacity: 0.6,
            }}
          >
            No walks{" "}
            {filter === "today"
              ? selectedDay
                ? "on this day"
                : "today"
              : filter === "month"
                ? "this month"
                : "yet"}
            .
          </p>
        ) : (
          groupedEntries.map((group) => (
            <div key={group.date}>
              <h3
                style={{
                  margin: "0 0 8px",
                  padding: "0 4px",
                  fontFamily: "var(--font-ui)",
                  fontWeight: 700,
                  fontSize: 16,
                  color: "var(--color-pawpal-hero)",
                }}
              >
                {fmtDate(group.date)}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                {group.items.map(({ w, index }, i) => {
                  const mine = isMyWalk(w, myId);
                  return (
                  <RevealItem key={index} index={i}>
                    <SwipeableRow
                      background="var(--color-settings-group)"
                      style={{ borderRadius: 32 }}
                      actions={
                        mine
                          ? [
                              ...(onEdit
                                ? [
                                    {
                                      label: "Edit",
                                      color: "#8592E0",
                                      icon: <Icon icon={Icons.pencilSimple} color="inherit" />,
                                      onAction: () => onEdit(index),
                                    },
                                  ]
                                : []),
                              {
                                label: "Delete",
                                color: "#ff3b30",
                                icon: <Icon icon={Icons.trash} color="inherit" />,
                                onAction: () => delWalk(index),
                              },
                            ]
                          : []
                      }
                    >
                      <WalkEntry walk={w} avatar={db.profile.avatar} onOpenMap={setMapWalk} />
                    </SwipeableRow>
                  </RevealItem>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      </CardStagger>

      <MotionSheet
        open={mapWalk !== null}
        onClose={() => setMapWalk(null)}
        onCancel={() => setMapWalk(null)}
        ariaLabel="Walk route"
        scrimClassName="walk-sheet-scrim"
        sheetClassName="walk-sheet"
        title={mapWalk ? `Walk · ${fmtDate(mapWalk.date)}` : undefined}
      >
        {mapWalk && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "8px 28px calc(28px + env(safe-area-inset-bottom, 12px))",
            }}
          >
            <RouteMap
              coords={mapWalk.gpsRoute ?? []}
              height={340}
              mapStyle="voyager"
              lineColor="#8592E0"
              markerHtml={markerHtml}
            />
            <RouteMapCaption walk={mapWalk} />
          </div>
        )}
      </MotionSheet>
      </div>
    </div>
  );
}

/** Summary line shown under the full route map. */
function RouteMapCaption({ walk }: { walk: Walk }): React.ReactElement {
  const steps = parseInt(String(walk.steps)) || 0;
  const dist = parseFloat(String(walk.distance)) || 0;
  const dur = parseInt(String(walk.duration)) || 0;
  const parts: string[] = [];
  if (dur) parts.push(`${dur} min`);
  if (dist) parts.push(`${dist.toFixed(2)} km`);
  if (steps) parts.push(`${steps.toLocaleString("de-DE")} steps`);
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 14,
        color: "var(--color-pawpal-muted)",
      }}
    >
      {parts.length ? parts.join(" · ") : "Route recorded"}
    </div>
  );
}

function DayCell({
  date,
  steps,
  max,
  future,
  selected,
  onSelect,
}: {
  date: Date;
  steps: number;
  max: number;
  future: boolean;
  selected: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const active = !future && steps > 0;
  const ratio = max > 0 ? steps / max : 0;
  const dotPct = active ? 22 + ratio * 42 : 26;
  const label = future
    ? "Upcoming day"
    : `${date.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}, ${steps > 0 ? `${steps} steps` : "no walk"}`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onSelect}
      style={{
        aspectRatio: "1 / 1",
        borderRadius: "26%",
        border: "none",
        padding: 0,
        cursor: "pointer",
        background: active ? "var(--color-walkcell)" : "var(--color-walkcell-empty)",
        opacity: future ? 0.6 : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Ring stays within the 4px grid gap so it can't overlap neighbour cells.
        outline: selected ? "2px solid var(--color-pawpal-hero)" : "none",
        outlineOffset: 1,
        transition: "outline-color 0.15s ease, transform 0.12s ease",
      }}
    >
      <span
        style={{
          width: `${dotPct}%`,
          height: `${dotPct}%`,
          borderRadius: "50%",
          background: active ? "var(--color-walkcell-dot)" : "var(--color-walkcell-empty-dot)",
        }}
      />
    </button>
  );
}
