import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "./ConfirmDialog";
import { useScrollLock } from "../lib/scrollLock";
import { Icons } from "../lib/icons";
import { today } from "../lib/date";
import type { BathLog } from "../types";

const DARK = "var(--color-pawpal-page)"; // #352B25 page background
const HERO = "var(--color-pawpal-hero)"; // cream card
const MUTED = "var(--color-pawpal-muted)"; // muted label text
const BATH = "var(--color-bath)"; // teal water accent

/** Default cadence used before we've seen two baths (a gentle guess, not a rule). */
const DEFAULT_BATH_DAYS = 28;
/** Days on each side of the predicted date shown as a "bath window". */
const WINDOW = 2;

const DAY_MS = 86400000;
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

function parseISO(iso: string): Date {
  return new Date(iso + "T12:00:00");
}
function toISO(d: Date): string {
  return d.toISOString().split("T")[0];
}
function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function diffDays(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / DAY_MS);
}
function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
function fmtDue(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface Prediction {
  cadence: number;
  lastBath: string;
  nextDue: string;
  daysUntil: number;
  /** True once we've learned from ≥2 baths; false while using the default guess. */
  learned: boolean;
}

function predict(baths: BathLog[], todayIso: string): Prediction | null {
  if (baths.length === 0) return null;
  const dates = baths.map((b) => b.date).sort();
  const lastBath = dates[dates.length - 1];

  let cadence = DEFAULT_BATH_DAYS;
  let learned = false;
  if (dates.length >= 2) {
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const g = diffDays(dates[i], dates[i - 1]);
      if (g > 0) gaps.push(g);
    }
    if (gaps.length) {
      cadence = Math.max(3, median(gaps));
      learned = true;
    }
  }

  const nextDue = addDays(lastBath, cadence);
  return { cadence, lastBath, nextDue, daysUntil: diffDays(nextDue, todayIso), learned };
}

/** Soft, non-alarming nudge copy for the current prediction. */
function nudgeFor(prediction: Prediction | null, name: string): { title: string; sub: string } {
  if (!prediction) {
    return {
      title: "No baths logged yet",
      sub: `Log ${name}'s first bath and I'll start learning the rhythm.`,
    };
  }
  const { daysUntil, nextDue, learned } = prediction;
  const around = fmtDue(nextDue);
  let title: string;
  if (daysUntil > 1) title = `${name} is due for a bath around ${around}`;
  else if (daysUntil === 1) title = `${name} is due for a bath tomorrow`;
  else if (daysUntil === 0) title = `${name} is due for a bath today`;
  else if (daysUntil >= -3) title = `${name} is a little overdue for a bath`;
  else title = `${name} is overdue for a bath since ${around}`;

  const sub = learned
    ? daysUntil >= 0
      ? "Just a gentle nudge — no rush."
      : "Whenever it suits you both."
    : "Rough estimate — log another to learn the real rhythm.";
  return { title, sub };
}

/**
 * Bath-time reminder card (Health tab).
 *
 * Logs grooming baths, learns the rhythm between them, and shows a soft nudge
 * toward the next one. The timeline strip borrows Apple Health's period-tracker
 * layout — a scrollable week-style row of day pills — restyled in PawPal's
 * cream/teal palette: solid dots for logged baths, a hatched "window" around
 * the predicted date, and a dark badge marking today.
 */
export function BathReminder(): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const baths = db.baths ?? [];
  const name = db.profile.name.trim() || "Zipi";
  const todayIso = today();

  const [addDate, setAddDate] = useState(todayIso);
  const [addNotes, setAddNotes] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const loggedByDate = useMemo(() => new Set(baths.map((b) => b.date)), [baths]);
  const prediction = useMemo(() => predict(baths, todayIso), [baths, todayIso]);

  const logBath = (date: string, notes?: string): void => {
    if (loggedByDate.has(date)) {
      toast("A bath is already logged for that day");
      return;
    }
    update((d) => {
      (d.baths ??= []).push({
        date,
        ...(notes?.trim() ? { notes: notes.trim() } : {}),
        created: new Date().toISOString(),
      });
    });
    toast(date === todayIso ? "Bath logged 🛁" : "Bath added");
  };

  const removeBath = async (date: string): Promise<void> => {
    const ok = await confirm({
      title: "Remove this bath?",
      message: "This bath will be removed from the history.",
      confirmLabel: "Remove",
    });
    if (!ok) return;
    update((d) => {
      const i = (d.baths ?? []).findIndex((b) => b.date === date);
      if (i >= 0) d.baths.splice(i, 1);
    });
    toast("Removed");
  };

  // Compact 7-day window centred on today (today −3 … +3). The full timeline
  // lives on the detail screen.
  const strip = useMemo(() => {
    const days: string[] = [];
    for (let i = -3; i <= 3; i++) days.push(addDays(todayIso, i));
    return days;
  }, [todayIso]);

  return (
    <>
    <button
      type="button"
      onClick={() => setShowHistory(true)}
      aria-label="Open bath time"
      style={{
        marginTop: 20,
        width: "100%",
        textAlign: "left",
        border: "none",
        cursor: "pointer",
        borderRadius: 32,
        background: HERO,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* Header — title + chevron */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-brand)",
            fontWeight: 700,
            fontSize: 26,
            color: DARK,
          }}
        >
          Bath time
        </span>
        <span style={{ display: "flex", color: DARK, opacity: 0.8, flexShrink: 0 }}>
          <Icon icon={Icons.caretRight} color="inherit" />
        </span>
      </div>

      {/* Period-tracker style day strip (fixed 7-day window) */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
        {strip.map((iso) => {
          const isToday = iso === todayIso;
          const isLogged = loggedByDate.has(iso);
          const dist = prediction ? Math.abs(diffDays(iso, prediction.nextDue)) : Infinity;
          const isDue = prediction ? iso === prediction.nextDue : false;
          const inWindow = !isDue && dist <= WINDOW && iso > todayIso;

          let circle: React.CSSProperties | null = null;
          if (isLogged) {
            circle = { background: BATH };
          } else if (isDue) {
            circle = { background: BATH, border: "2px solid rgba(53,43,37,0.35)" };
          } else if (inWindow) {
            circle = {
              background:
                "repeating-linear-gradient(-45deg, var(--color-bath), var(--color-bath) 2px, transparent 2px, transparent 5px)",
              border: `1.5px solid ${BATH}`,
            };
          }

          return (
            <div
              key={iso}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                flex: 1,
                minWidth: 0,
              }}
            >
              {/* Weekday letter / today badge */}
              {isToday ? (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    background: DARK,
                    color: HERO,
                    fontFamily: "var(--font-ui)",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {WEEKDAY[parseISO(iso).getDay()]}
                </span>
              ) : (
                <span
                  style={{
                    height: 22,
                    lineHeight: "22px",
                    fontFamily: "var(--font-ui)",
                    fontWeight: 600,
                    fontSize: 12,
                    color: DARK,
                    opacity: 0.45,
                  }}
                >
                  {WEEKDAY[parseISO(iso).getDay()]}
                </span>
              )}

              {/* Day pill */}
              <div
                style={{
                  width: "100%",
                  maxWidth: 44,
                  height: 56,
                  borderRadius: 20,
                  background: isToday ? "rgba(53,43,37,0.10)" : "rgba(53,43,37,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {circle && (
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      boxSizing: "border-box",
                      ...circle,
                    }}
                  />
                )}
              </div>

              {/* Date number */}
              <span
                style={{
                  fontFamily: "var(--font-ui)",
                  fontWeight: isToday || isDue || isLogged ? 700 : 500,
                  fontSize: 11,
                  color: DARK,
                  opacity: isDue || isLogged || isToday ? 0.85 : 0.4,
                }}
              >
                {parseISO(iso).getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Legend swatch={{ background: BATH }} label="Bath logged" />
        <Legend
          swatch={{
            background:
              "repeating-linear-gradient(-45deg, var(--color-bath), var(--color-bath) 2px, transparent 2px, transparent 5px)",
            border: `1.5px solid ${BATH}`,
          }}
          label="Predicted window"
        />
      </div>
    </button>

    <MotionSheet
      open={showAdd}
      onClose={() => setShowAdd(false)}
      ariaLabel="Add a past bath"
      scrimClassName="walk-sheet-scrim"
      scrimStyle={{ zIndex: 1300 }}
      sheetClassName="bath-sheet"
      title="Add a bath"
      confirmLabel="Add bath"
      onConfirm={() => {
        logBath(addDate, addNotes);
        setShowAdd(false);
      }}
      body={
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 16, color: DARK }}>
              Date
            </span>
            <input
              type="date"
              value={addDate}
              max={todayIso}
              onChange={(e) => setAddDate(e.target.value)}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: `1px solid ${DARK}`,
                background: "transparent",
                color: DARK,
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: 16,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 16, color: DARK }}>
              Notes
            </span>
            <textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              placeholder="Shampoo, groomer, how it went… (optional)"
              rows={3}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 16,
                border: `1px solid ${DARK}`,
                background: "transparent",
                color: DARK,
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.4,
                outline: "none",
                resize: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </>
      }
    />

    <BathHistory
      open={showHistory}
      onClose={() => setShowHistory(false)}
      baths={baths}
      prediction={prediction}
      todayIso={todayIso}
      name={name}
      onRemove={removeBath}
      onAdd={() => {
        setAddDate(todayIso);
        setAddNotes("");
        setShowAdd(true);
      }}
    />
    </>
  );
}

/**
 * Full-screen bath history — reads every logged bath with its note, the gap
 * since the previous one, plus a small summary of the learned cadence. Slides
 * up over the app like a pushed detail screen.
 */
function BathHistory({
  open,
  onClose,
  baths,
  prediction,
  todayIso,
  name,
  onRemove,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  baths: BathLog[];
  prediction: Prediction | null;
  todayIso: string;
  name: string;
  onRemove: (date: string) => void | Promise<void>;
  onAdd: () => void;
}): React.ReactElement {
  const reduceMotion = useReducedMotion();
  useScrollLock(open);

  const sorted = [...baths].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="bath-history-scrim"
          role="dialog"
          aria-modal="true"
          aria-label={`${name}'s bath history`}
          initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 320 }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "calc(12px + env(safe-area-inset-top, 0px)) 8px 12px",
            }}
          >
            <button
              type="button"
              aria-label="Back"
              onClick={onClose}
              style={{
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
              <Icon icon={Icons.caretLeft} color="inherit" />
            </button>
            <span
              style={{
                flex: 1,
                fontFamily: "var(--font-brand)",
                fontWeight: 700,
                fontSize: 20,
                color: HERO,
              }}
            >
              Bath time
            </span>
          </div>

          <div
            style={{
              padding: "8px 16px calc(32px + env(safe-area-inset-bottom, 20px))",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* Soft nudge */}
            {(() => {
              const nudge = nudgeFor(prediction, name);
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "4px 4px 8px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-brand)",
                      fontWeight: 700,
                      fontSize: 22,
                      lineHeight: 1.2,
                      color: HERO,
                    }}
                  >
                    {nudge.title}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-ui)",
                      fontWeight: 500,
                      fontSize: 14,
                      color: MUTED,
                    }}
                  >
                    {nudge.sub}
                  </span>
                </div>
              );
            })()}

            {/* Log a bath — opens the date/notes sheet */}
            <button
              type="button"
              onClick={onAdd}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "16px",
                borderRadius: 100,
                border: "none",
                cursor: "pointer",
                background: BATH,
                color: DARK,
                fontFamily: "var(--font-ui)",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              <Icon icon={Icons.droplet} color="inherit" />
              Log a bath
            </button>

            {/* Summary */}
            {prediction && (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 4,
                }}
              >
                <SummaryStat value={String(baths.length)} label={`bath${baths.length !== 1 ? "es" : ""} logged`} />
                {prediction.learned && (
                  <SummaryStat
                    value={`~${prediction.cadence}`}
                    label={`day${prediction.cadence !== 1 ? "s" : ""} between baths`}
                  />
                )}
                <SummaryStat value={fmtDue(prediction.nextDue)} label="next due" />
              </div>
            )}

            {sorted.map((b, i) => {
              const prev = sorted[i + 1];
              const gap = prev ? diffDays(b.date, prev.date) : null;
              return (
                <div
                  key={b.date + b.created}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: 16,
                    borderRadius: 20,
                    background: "var(--color-dash-surface)",
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
                      background: BATH,
                      color: DARK,
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={Icons.droplet} color="inherit" />
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontWeight: 700,
                        fontSize: 16,
                        color: HERO,
                      }}
                    >
                      {parseISO(b.date).toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-ui)",
                        fontWeight: 500,
                        fontSize: 13,
                        color: MUTED,
                      }}
                    >
                      {b.date === todayIso
                        ? "Today"
                        : gap != null
                          ? `${gap} day${gap !== 1 ? "s" : ""} after the previous bath`
                          : "First logged bath"}
                    </span>
                    {b.notes && (
                      <span
                        style={{
                          fontFamily: "var(--font-ui)",
                          fontWeight: 500,
                          fontSize: 14,
                          color: HERO,
                          opacity: 0.85,
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          marginTop: 2,
                        }}
                      >
                        {b.notes}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove bath on ${b.date}`}
                    onClick={() => void onRemove(b.date)}
                    style={{
                      border: "none",
                      cursor: "pointer",
                      background: "transparent",
                      color: HERO,
                      opacity: 0.4,
                      padding: 4,
                      display: "flex",
                      flexShrink: 0,
                    }}
                  >
                    <Icon icon={Icons.trash} color="inherit" />
                  </button>
                </div>
              );
            })}

            {sorted.length === 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                  padding: 40,
                }}
              >
                <Icon icon={Icons.droplet} size="lg" color="disabled" />
                <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 14, color: MUTED }}>
                  No baths logged yet.
                </span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "14px 12px",
        borderRadius: 18,
        background: "var(--color-dash-surface)",
      }}
    >
      <span style={{ fontFamily: "var(--font-brand)", fontWeight: 700, fontSize: 20, color: HERO }}>
        {value}
      </span>
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 11, color: MUTED, lineHeight: 1.2 }}>
        {label}
      </span>
    </div>
  );
}

function Legend({
  swatch,
  label,
}: {
  swatch: React.CSSProperties;
  label: string;
}): React.ReactElement {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          boxSizing: "border-box",
          flexShrink: 0,
          ...swatch,
        }}
      />
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: 500,
          fontSize: 12,
          color: DARK,
          opacity: 0.6,
        }}
      >
        {label}
      </span>
    </span>
  );
}
