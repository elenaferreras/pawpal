import { useMemo, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useToast } from "../lib/toast";
import { Icons } from "../lib/icons";
import { DogFace } from "../avatar/DogAvatar";
import {
  clearSitterSession,
  saveSitterSession,
  sitterLog,
  type SitterEntry,
  type SitterState,
} from "../lib/sitter";
import type { Database } from "../types";

interface SitterAppProps {
  state: SitterState;
  onEnd: () => void;
}

const HERO = "var(--color-pawpal-hero)";
const DARK = "var(--color-pawpal-page)";
const WALK = "var(--color-dash-walk)"; // blue
const MEAL = "var(--color-dash-trained)"; // yellow
const POOP = "var(--color-dash-pooped)"; // purple

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

  const dog = snapshot.profile?.name || state.session.dogName || "this pup";
  const avatar = snapshot.profile?.avatar;
  const avatarBg = avatar?.bg ?? "var(--color-dash-pooped)";
  const todayISO = localISO(new Date());
  const endsAt = fmtTime(state.session.expiresAt);

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

  const logWalk = (): Promise<void> =>
    log("walk", {
      type: "walk",
      data: { date: todayISO, time: fmtTime(new Date().toISOString()), pipi: false, popo: false },
    });

  const logMeal = (): Promise<void> => {
    const eaten = new Set(
      (snapshot.meals ?? [])
        .filter((m) => m.date === todayISO && m.mealSlot != null)
        .map((m) => m.mealSlot as number),
    );
    let slot = 0;
    while (slot < mealsPerDay && eaten.has(slot)) slot++;
    if (slot >= mealsPerDay) {
      toast("All of today's meals are already logged \u{1F35A}");
      return Promise.resolve();
    }
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

        {/* Today so far */}
        <div className="sit-summary">
          <SummaryStat label="Walks" value={String(today.walks)} tone={WALK} />
          <SummaryStat label="Meals" value={`${today.mealSlots}/${mealsPerDay}`} tone={MEAL} />
          <SummaryStat label="Poops" value={String(today.poops)} tone={POOP} />
        </div>

        {/* Quick actions */}
        <div className="sit-actions">
          <SitButton
            label="Log a walk"
            icon={Icons.pawPrint}
            bg={WALK}
            busy={busy === "walk"}
            onClick={() => void logWalk()}
          />
          <SitButton
            label="Log a meal"
            icon={Icons.forkKnife}
            bg={MEAL}
            busy={busy === "meal"}
            onClick={() => void logMeal()}
          />
          <SitButton
            label="Mark a poop"
            icon={Icons.toilet}
            bg={POOP}
            busy={busy === "poop"}
            onClick={() => void logPoop()}
          />
        </div>

        {/* Emergency / owner info */}
        <div className="sit-info">
          <InfoRow label="Feeding" value={`${mealsPerDay} meals \u00b7 ${snapshot.profile?.foodGoal || "—"} g/day`} />
          <InfoRow label="Vet" value={snapshot.profile?.vet || "Not provided"} />
          <InfoRow label="Vet phone" value={snapshot.profile?.vetPhone || "Not provided"} />
          {snapshot.vetRecords?.notes ? (
            <InfoRow label="Notes" value={snapshot.vetRecords.notes} />
          ) : null}
        </div>
      </div>
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

function SitButton({
  label,
  icon,
  bg,
  busy,
  onClick,
}: {
  label: string;
  icon: (typeof Icons)[keyof typeof Icons];
  bg: string;
  busy: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button type="button" className="sit-action" style={{ background: bg }} onClick={onClick} disabled={busy}>
      <span className="sit-action-icon" style={{ color: DARK }}>
        <Icon icon={icon} color="inherit" />
      </span>
      <span>{busy ? "Saving\u2026" : label}</span>
    </button>
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
