import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useToast } from "../lib/toast";
import { Icons } from "../lib/icons";
import { DogFace } from "../avatar/DogAvatar";
import { useLiveWalk, type TrackedWalk } from "../components/LiveWalk";
import {
  clearSitterSession,
  saveSitterSession,
  sitterLog,
  validateSitterSession,
  type SitterEntry,
  type SitterState,
} from "../lib/sitter";
import type { Database } from "../types";

interface SitterAppProps {
  state: SitterState;
  onEnd: () => void;
}

const HERO = "var(--color-pawpal-hero)";
const WALK = "var(--color-dash-walk)"; // blue
const MEAL = "var(--color-dash-trained)"; // yellow
const POOP = "var(--color-dash-pooped)"; // purple

const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Sitter mode — an ephemeral, log-only view of someone else's dog.
 *
 * Renders the owner's snapshot (read) and lets the sitter log walks, meals and
 * poops through the server broker (sitter-log). Nothing is written to this
 * device's own PawPal data.
 */
export function SitterApp({ state, onEnd }: SitterAppProps): React.ReactElement {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<Database>(state.snapshot);
  const [busy, setBusy] = useState<string | null>(null);

  // Heartbeat: poll the server so a revoked (or expired) session signs the
  // sitter out promptly, even if they never log another activity. Runs on
  // mount, whenever the tab becomes visible, and every 20s while visible.
  useEffect(() => {
    let stopped = false;
    const check = async (): Promise<void> => {
      if (document.visibilityState !== "visible") return;
      const ok = await validateSitterSession(state.session.token);
      if (!ok && !stopped) {
        clearSitterSession();
        toast("Your sitting access was ended by the owner.");
        onEnd();
      }
    };
    void check();
    const id = window.setInterval(() => void check(), 20000);
    const onVisible = (): void => void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state.session.token, onEnd, toast]);

  const dog = snapshot.profile?.name || state.session.dogName || "this pup";
  const avatar = snapshot.profile?.avatar;
  const avatarBg = avatar?.bg ?? "var(--color-dash-pooped)";
  const todayISO = localISO(new Date());
  const endsAt = fmtTime(state.session.expiresAt);

  const { active: walkActive, start: startWalk, openSheet, registerExternalSave } = useLiveWalk();

  const today = useMemo(() => {
    const walks = (snapshot.walks ?? []).filter((w) => w.date === todayISO);
    const steps = walks.reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0);
    const mealSlots = new Set(
      (snapshot.meals ?? [])
        .filter((m) => m.date === todayISO && m.mealSlot != null)
        .map((m) => m.mealSlot),
    ).size;
    const poops = (snapshot.bathroom ?? []).filter((b) => b.date === todayISO).length;
    return { walks: walks.length, steps, mealSlots, poops };
  }, [snapshot, todayISO]);

  // What this sitter has logged today (server-tagged `by: "sitter"`) — the
  // "your shift" view of the time spent with the dog.
  const mine = useMemo(() => {
    const walks = (snapshot.walks ?? []).filter((w) => w.date === todayISO && w.by === "sitter").length;
    const meals = (snapshot.meals ?? []).filter((m) => m.date === todayISO && m.by === "sitter").length;
    const poops = (snapshot.bathroom ?? []).filter((b) => b.date === todayISO && b.by === "sitter").length;
    return { walks, meals, poops, total: walks + meals + poops };
  }, [snapshot, todayISO]);

  const mealsPerDay = snapshot.profile?.mealsPerDay || 4;

  const eatenSlots = useMemo(() => {
    const slots = (snapshot.meals ?? [])
      .filter((m) => m.date === todayISO && m.mealSlot != null)
      .map((m) => m.mealSlot as number);
    return new Set(slots);
  }, [snapshot, todayISO]);

  const log = async (kind: string, entry: SitterEntry): Promise<void> => {
    if (busy) return;
    setBusy(kind);
    try {
      const next = await sitterLog(state.session.token, entry);
      setSnapshot(next);
      // Keep the cached session snapshot fresh for reloads.
      saveSitterSession({ ...state, snapshot: next });
      toast(`Logged \u2014 thanks for looking after ${dog}! \u{1F43E}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save.";
      if (/expired|no_session/i.test(msg)) {
        toast("Your sitting session ended.");
        end();
        return;
      }
      toast(msg);
    } finally {
      setBusy(null);
    }
  };

  // Quick manual walk (no tracking) — a single tap logs "went on a walk".
  const logWalk = (): Promise<void> =>
    log("walk", {
      type: "walk",
      data: { date: todayISO, time: fmtTime(new Date().toISOString()), pipi: false, popo: false },
    });

  // Log a specific meal slot (empty slots only — owner logs stay read-only).
  const logMealSlot = (slot: number): Promise<void> => {
    if (eatenSlots.has(slot)) return Promise.resolve();
    return log("meal", {
      type: "meal",
      data: {
        date: todayISO,
        time: fmtTime(new Date().toISOString()),
        type: "meal",
        amount: Math.round((snapshot.profile?.foodGoal || 0) / mealsPerDay),
        mealSlot: slot,
      },
    });
  };

  const logPoop = (): Promise<void> =>
    log("poop", {
      type: "bathroom",
      data: { date: todayISO, time: fmtTime(new Date().toISOString()), type: "popo" },
    });

  // Persist a GPS/pedometer-tracked walk to the owner via the server broker.
  const saveTrackedWalk = useCallback(
    async (walk: TrackedWalk): Promise<void> => {
      try {
        const next = await sitterLog(state.session.token, { type: "walk", data: walk });
        setSnapshot(next);
        saveSitterSession({ ...state, snapshot: next });
        toast(`Walk logged \u2014 thanks for walking ${dog}! \u{1F43E}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Couldn't save the walk.";
        toast(msg);
      }
    },
    [state, dog, toast],
  );

  // Route the live tracker's "Save walk" through the sitter broker (and show
  // the sat-for dog on the map) for as long as this session is on screen.
  useEffect(() => {
    registerExternalSave(saveTrackedWalk, avatar ?? null);
    return () => registerExternalSave(null, null);
  }, [registerExternalSave, saveTrackedWalk, avatar]);

  const end = (): void => {
    clearSitterSession();
    onEnd();
  };

  return (
    <div className="sit">
      {/* Top bar */}
      <div className="sit-banner">
        <div className="sit-banner-text">
          <span className="sit-banner-title">Sitting for {dog}</span>
          <span className="sit-banner-sub">{`Ends ${endsAt} · read + log only`}</span>
        </div>
        <button type="button" className="sit-banner-end" onClick={end}>
          End
        </button>
      </div>

      <div className="sit-body">
        {/* Hero — the pup you're caring for */}
        <div className="sit-hero">
          <div className="sit-avatar" style={{ background: avatarBg }}>
            <DogFace avatar={avatar} size={96} />
          </div>
          <h1 className="sit-hello">
            You&rsquo;re looking after
            <br />
            <span className="sit-dog">{dog}</span> today.
          </h1>
        </div>

        {/* Your shift — the time you've spent with the dog */}
        <div className="sit-shift">
          <div className="sit-shift-head">
            <span className="sit-shift-title">Your shift</span>
            <span className="sit-shift-end">until {endsAt}</span>
          </div>
          <p className="sit-shift-sub">
            {mine.total > 0
              ? `You've logged ${mine.total} thing${mine.total === 1 ? "" : "s"} for ${dog} today.`
              : `Nothing logged yet \u2014 start by taking ${dog} for a walk.`}
          </p>
          <div className="sit-shift-stats">
            <ShiftStat label="Walks" value={mine.walks} tone={WALK} />
            <ShiftStat label="Meals" value={mine.meals} tone={MEAL} />
            <ShiftStat label="Poops" value={mine.poops} tone={POOP} />
          </div>
        </div>

        {/* Today so far — the dog's full day (owner + sitter) */}
        <div className="sit-summary">
          <SummaryStat label="Walks" value={String(today.walks)} tone={WALK} />
          <SummaryStat label="Meals" value={`${today.mealSlots}/${mealsPerDay}`} tone={MEAL} />
          <SummaryStat label="Poops" value={String(today.poops)} tone={POOP} />
        </div>

        {/* Walk — start a tracked walk or log one quickly */}
        <div className="sit-walk-card">
          <div className="sit-walk-head">
            <span className="sit-walk-title">
              {walkActive ? "Walk in progress" : "Ready for a walk?"}
            </span>
            <span className="sit-walk-sub">GPS &amp; step tracking</span>
          </div>
          <button
            type="button"
            className="sit-walk-start"
            aria-label={walkActive ? "Open the walk in progress" : `Start a tracked walk with ${dog}`}
            onClick={() => (walkActive ? openSheet() : startWalk())}
          >
            {walkActive ? (
              <span>In progress</span>
            ) : (
              <>
                <span>Start</span>
                <span className="sit-walk-play">
                  <Icon icon={Icons.play} color="inherit" />
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            className="sit-walk-log"
            disabled={busy === "walk"}
            onClick={() => void logWalk()}
          >
            {busy === "walk" ? "Saving\u2026" : "Log a walk without tracking"}
          </button>
        </div>

        {/* Meals — mirrors the owner's dashboard widget; owner logs are read-only */}
        <div className="sit-meals-card">
          <div className="sit-meals-head">
            <span className="sit-meals-title">Meals</span>
            <span className="sit-meals-count">
              {today.mealSlots}/{mealsPerDay}
            </span>
          </div>
          <div className="sit-meals-row">
            {Array.from({ length: mealsPerDay }, (_, slot) => {
              const done = eatenSlots.has(slot);
              return (
                <div key={slot} className="sit-meal-slot">
                  <button
                    type="button"
                    className={"sit-meal-dot" + (done ? " is-done" : "")}
                    aria-pressed={done}
                    disabled={done || busy === "meal"}
                    aria-label={
                      done
                        ? `${ORDINALS[slot] ?? `Meal ${slot + 1}`} meal already logged`
                        : `Log the ${ORDINALS[slot] ?? `${slot + 1}th`} meal`
                    }
                    onClick={() => void logMealSlot(slot)}
                  >
                    {done && <Icon icon={Icons.checkCircle} color="inherit" />}
                  </button>
                  <span className="sit-meal-label">{ORDINALS[slot] ?? slot + 1}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bathroom — quick poop logger */}
        <button
          type="button"
          className="sit-bath-card"
          disabled={busy === "poop"}
          onClick={() => void logPoop()}
        >
          <span className="sit-bath-title">{busy === "poop" ? "Saving\u2026" : "Mark a poop"}</span>
          <span className="sit-bath-icon">
            <Icon icon={Icons.toilet} color="inherit" />
          </span>
        </button>

        {/* Emergency / owner info */}
        <div className="sit-info">
          <InfoRow label="Feeding" value={`${mealsPerDay} meals \u00b7 ${snapshot.profile?.foodGoal || "—"} g/day`} />
          <InfoRow label="Vet" value={snapshot.profile?.vet || "Not provided"} />
          <InfoRow label="Vet phone" value={snapshot.profile?.vetPhone || "Not provided"} />
          {state.session.notes?.trim() ? (
            <InfoRow label="From the owner" value={state.session.notes} />
          ) : null}
          {snapshot.vetRecords?.notes ? (
            <InfoRow label="Notes" value={snapshot.vetRecords.notes} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ShiftStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}): React.ReactElement {
  return (
    <div className="sit-shift-stat">
      <span className="sit-shift-stat-value" style={{ color: tone }}>
        {value}
      </span>
      <span className="sit-shift-stat-label">{label}</span>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}): React.ReactElement {
  return (
    <div className="sit-stat">
      <span className="sit-stat-value" style={{ color: tone }}>
        {value}
      </span>
      <span className="sit-stat-label">{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="sit-info-row">
      <span className="sit-info-label">{label}</span>
      <span className="sit-info-value" style={{ color: HERO }}>
        {value}
      </span>
    </div>
  );
}
