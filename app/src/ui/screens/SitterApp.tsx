import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useToast } from "../lib/toast";
import { Icons } from "../lib/icons";
import { DogFace } from "../avatar/DogAvatar";
import { useLiveWalk, type TrackedWalk } from "../components/LiveWalk";
import { TopBar } from "../components/TopBar";
import { FitText } from "../components/FitText";
import { GooeyFab } from "../components/GooeyFab";
import { MotionSheet } from "../components/MotionSheet";
import { WalkTrackSheet } from "../components/WalkTrackSheet";
import { SwipeableRow } from "../components/SwipeableRow";
import {
  clearSitterSession,
  saveSitterSession,
  sitterLog,
  sitterUpdate,
  sitterDelete,
  validateSitterSession,
  type SitterEntry,
  type SitterState,
} from "../lib/sitter";
import type { Database, Walk } from "../types";

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
  const [feedScope, setFeedScope] = useState<"mine" | "all">("mine");
  const [fabOpen, setFabOpen] = useState(false);
  const [mealSheet, setMealSheet] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walkForm, setWalkForm] = useState<{ open: boolean; editCreated: string | null }>({
    open: false,
    editCreated: null,
  });

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

  const { registerExternalSave } = useLiveWalk();

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

  const mealsPerDay = snapshot.profile?.mealsPerDay || 4;

  const eatenSlots = useMemo(() => {
    const slots = (snapshot.meals ?? [])
      .filter((m) => m.date === todayISO && m.mealSlot != null)
      .map((m) => m.mealSlot as number);
    return new Set(slots);
  }, [snapshot, todayISO]);

  const foodPct = Math.round((today.mealSlots / mealsPerDay) * 100);

  // Today's combined activity (owner + sitter), newest first. Each row carries
  // who logged it so the "With you" filter can hide the owner's entries.
  const feed = useMemo(() => {
    const walks = (snapshot.walks ?? [])
      .filter((w) => w.date === todayISO)
      .map((w) => ({
        id: `walk-${w.created}`,
        kind: "walk" as const,
        time: w.time,
        created: w.created,
        mine: w.by === "sitter",
        icon: Icons.footprints,
        tone: WALK,
        label: Number(w.steps) > 0 ? `Walk \u00b7 ${Number(w.steps).toLocaleString()} steps` : "Walk",
      }));
    const meals = (snapshot.meals ?? [])
      .filter((m) => m.date === todayISO)
      .map((m) => ({
        id: `meal-${m.created}`,
        kind: "meal" as const,
        time: m.time,
        created: m.created,
        mine: m.by === "sitter",
        icon: Icons.forkKnife,
        tone: MEAL,
        label: m.mealSlot != null ? `${ORDINALS[m.mealSlot] ?? `${m.mealSlot + 1}th`} meal` : "Meal",
      }));
    const poops = (snapshot.bathroom ?? [])
      .filter((b) => b.date === todayISO)
      .map((b) => ({
        id: `poop-${b.created}`,
        kind: "poop" as const,
        time: b.time,
        created: b.created,
        mine: b.by === "sitter",
        icon: Icons.toilet,
        tone: POOP,
        label: b.type === "pipi" ? "Pee" : b.type === "popo" ? "Poop" : "Bathroom",
      }));
    return [...walks, ...meals, ...poops].sort((a, b) =>
      String(b.created ?? "").localeCompare(String(a.created ?? "")),
    );
  }, [snapshot, todayISO]);

  const shownFeed = feedScope === "all" ? feed : feed.filter((e) => e.mine);

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

  // Save a walk from the owner-style log form — new (append) or an edit of an
  // existing sitter walk (matched by its `created` id), via the broker.
  const submitWalk = async (fields: Partial<Walk>, editing: Walk | null): Promise<void> => {
    try {
      const next = editing
        ? await sitterUpdate(state.session.token, { type: "walk", data: fields }, editing.created)
        : await sitterLog(state.session.token, {
            type: "walk",
            data: { ...fields, time: fmtTime(new Date().toISOString()) },
          });
      setSnapshot(next);
      saveSitterSession({ ...state, snapshot: next });
      toast(editing ? "Walk updated \u{1F43E}" : `Walk logged \u2014 thanks for walking ${dog}! \u{1F43E}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't save the walk.";
      if (/expired|no_session/i.test(msg)) {
        toast("Your sitting session ended.");
        end();
        return;
      }
      toast(msg);
    }
  };

  const deleteWalk = async (created: string): Promise<void> => {
    try {
      const next = await sitterDelete(state.session.token, "walk", created);
      setSnapshot(next);
      saveSitterSession({ ...state, snapshot: next });
      toast("Walk deleted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Couldn't delete the walk.";
      toast(msg);
    }
  };

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

  // Sign the sitter out (used when the session expires mid-action).
  const end = (): void => {
    clearSitterSession();
    onEnd();
  };

  return (
    <div className="sit">
      {/* Owner-style header: the dog's avatar, "Sitting for …" and a bell. */}
      <TopBar
        title={`Sitting for ${dog}`}
        largeTitle={
          <div className="sit-header">
            <button
              type="button"
              className="sit-header-avatar"
              style={{ background: avatarBg }}
              aria-label={`${dog}'s profile`}
              onClick={() => setProfileOpen(true)}
            >
              <DogFace avatar={avatar} size={44} />
            </button>
            <FitText className="sit-header-title" max={34} min={20}>
              Sitting for {dog}
            </FitText>
            <button type="button" aria-label="Notifications" className="glass-btn">
              <Icon icon={Icons.bell} color="inherit" />
            </button>
          </div>
        }
      />

      <div className="sit-body">
        {/* Owner left a note for the sitter — surface it above the content. */}
        {state.session.notes?.trim() ? (
          <div className="sit-note-banner">
            <span className="sit-note-banner-icon">
              <Icon icon={Icons.chat} color="inherit" />
            </span>
            <span className="sit-note-banner-text">You have a message from the owner</span>
          </div>
        ) : null}

        {/* Zipi's day so far — steps + food at a glance */}
        <div className="sit-daycard">
          <span className="sit-daycard-eyebrow">{dog}&rsquo;s day so far</span>
          <div className="sit-daycard-tiles">
            <div className="sit-tile sit-tile--steps">
              <span className="sit-tile-icon">
                <Icon icon={Icons.pawPrint} color="inherit" />
              </span>
              <span className="sit-tile-value">
                {today.steps.toLocaleString()}
                <span className="sit-tile-unit">steps</span>
              </span>
            </div>
            <div className="sit-tile sit-tile--food">
              <span className="sit-tile-icon">
                <Icon icon={Icons.forkKnife} color="inherit" />
              </span>
              <span className="sit-tile-value">
                {foodPct}%<span className="sit-tile-unit">of food</span>
              </span>
            </div>
          </div>
        </div>

        {/* Filter: this sitter's logs vs the dog's whole day */}
        <div className="sit-seg" role="tablist" aria-label="Activity filter">
          <button
            type="button"
            role="tab"
            aria-selected={feedScope === "mine"}
            className={"sit-seg-btn" + (feedScope === "mine" ? " is-on" : "")}
            onClick={() => setFeedScope("mine")}
          >
            With you
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={feedScope === "all"}
            className={"sit-seg-btn" + (feedScope === "all" ? " is-on" : "")}
            onClick={() => setFeedScope("all")}
          >
            All entries
          </button>
        </div>

        {/* Today's activity feed */}
        <div className="sit-feed">
          <span className="sit-feed-title">Today</span>
          {shownFeed.length === 0 ? (
            <div className="sit-feed-empty">Nothing logged yet.</div>
          ) : (
            <div className="sit-feed-list">
              {shownFeed.map((e) => {
                const row = (
                  <div className="sit-feed-row">
                    <span className="sit-feed-icon" style={{ color: e.tone }}>
                      <Icon icon={e.icon} color="inherit" />
                    </span>
                    <span className="sit-feed-label">{e.label}</span>
                    {feedScope === "all" && e.mine ? (
                      <span className="sit-feed-you">You</span>
                    ) : null}
                    <span className="sit-feed-time">{e.time}</span>
                  </div>
                );
                // Only the sitter's own walks can be edited or deleted.
                if (e.kind === "walk" && e.mine) {
                  return (
                    <SwipeableRow
                      key={e.id}
                      background="var(--color-dash-surface)"
                      style={{ borderRadius: 20 }}
                      actions={[
                        {
                          label: "Edit",
                          color: "#8592E0",
                          icon: <Icon icon={Icons.pencilSimple} color="inherit" />,
                          onAction: () => setWalkForm({ open: true, editCreated: e.created }),
                        },
                        {
                          label: "Delete",
                          color: "#ff3b30",
                          icon: <Icon icon={Icons.trash} color="inherit" />,
                          onAction: () => void deleteWalk(e.created),
                        },
                      ]}
                    >
                      {row}
                    </SwipeableRow>
                  );
                }
                return <div key={e.id}>{row}</div>;
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick-add FAB — logs a walk or a meal via the owner-style menu */}
      <div className="sit-fab-wrap">
        <button
          type="button"
          className={"nav-fab nav-fab-grid" + (fabOpen ? " nav-fab-open" : "")}
          aria-label={fabOpen ? "Close menu" : "Log an activity"}
          aria-expanded={fabOpen}
          onClick={() => setFabOpen((v) => !v)}
        >
          <Icon icon={Icons.plus} color="inherit" />
        </button>
      </div>
      <GooeyFab
        open={fabOpen}
        onClose={() => setFabOpen(false)}
        onWalk={() => setWalkForm({ open: true, editCreated: null })}
        onMeal={() => setMealSheet(true)}
        compact
      />

      {/* Owner-style walk log form — new walk or editing a logged one. */}
      <WalkTrackSheet
        open={walkForm.open}
        onClose={() => setWalkForm({ open: false, editCreated: null })}
        walks={snapshot.walks ?? []}
        editCreated={walkForm.editCreated}
        onSubmit={(fields, editing) => void submitWalk(fields, editing)}
      />

      {/* Log a meal */}
      <MotionSheet
        open={mealSheet}
        onClose={() => setMealSheet(false)}
        ariaLabel="Log a meal"
        scrimClassName="walk-sheet-scrim"
        sheetClassName="chooser-sheet"
        title="Log a meal"
        titleColor={HERO}
        onCancel={() => setMealSheet(false)}
      >
        <div className="sit-sheet-options">
          {Array.from({ length: mealsPerDay }, (_, slot) => {
            const done = eatenSlots.has(slot);
            return (
              <button
                key={slot}
                type="button"
                className="sit-sheet-option"
                disabled={done || busy === "meal"}
                onClick={() => {
                  setMealSheet(false);
                  void logMealSlot(slot);
                }}
              >
                <span className="sit-sheet-option-icon" style={{ color: MEAL }}>
                  <Icon icon={done ? Icons.checkCircle : Icons.forkKnife} color="inherit" />
                </span>
                <span className="sit-sheet-option-text">
                  <span className="sit-sheet-option-title">
                    {ORDINALS[slot] ?? `${slot + 1}th`} meal
                  </span>
                  <span className="sit-sheet-option-sub">
                    {done ? "Already logged" : "Tap to mark as fed"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </MotionSheet>

      {/* Zipi's profile — feeding, vet & the owner's notes (from the avatar) */}
      <MotionSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        ariaLabel={`${dog}'s profile`}
        scrimClassName="walk-sheet-scrim"
        sheetClassName="chooser-sheet"
        title={dog}
        titleColor={HERO}
        onCancel={() => setProfileOpen(false)}
      >
        {/* The owner's message, surfaced in the green banner at the top. */}
        {state.session.notes?.trim() ? (
          <div className="sit-note-banner sit-note-banner--message">
            <span className="sit-note-banner-icon">
              <Icon icon={Icons.chat} color="inherit" />
            </span>
            <span className="sit-note-banner-text">{state.session.notes}</span>
          </div>
        ) : null}
        <div className="sit-info">
          <InfoRow label="Breed" value={snapshot.profile?.breed || "\u2014"} />
          <InfoRow
            label="Feeding"
            value={`${mealsPerDay} meals \u00b7 ${snapshot.profile?.foodGoal || "\u2014"} g/day`}
          />
          <InfoRow label="Vet" value={snapshot.profile?.vet || "Not provided"} />
          <InfoRow label="Vet phone" value={snapshot.profile?.vetPhone || "Not provided"} />
          {snapshot.vetRecords?.notes ? (
            <InfoRow label="Notes" value={snapshot.vetRecords.notes} />
          ) : null}
        </div>
      </MotionSheet>
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
