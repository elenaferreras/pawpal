import { useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { HealthDetailScreen } from "./HealthDetailScreen";
import { SwipeableRow } from "./SwipeableRow";
import { RevealItem } from "./Reveal";
import { Eyebrow, Headline, Footnote } from "./Typography";
import { LogGroomingSheet } from "./LogGroomingSheet";
import type { GroomingEntry, GroomingService } from "./LogGroomingSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { useConfirm } from "../components/ConfirmDialog";
import { Icons } from "../lib/icons";
import { today } from "../lib/date";
import type { AppIconName } from "../lib/icons";
import type { GroomingLocation } from "../types";

const HERO = "var(--color-pawpal-hero)";
const MUTED = "var(--color-pawpal-muted)";
const SURFACE = "var(--color-dash-surface)";
const DARK = "var(--color-pawpal-page)";

const TABS: {
  key: GroomingService;
  label: string;
  prevLabel: string;
  icon: AppIconName;
  accent: string;
}[] = [
  { key: "bath", label: "Baths", prevLabel: "Previous bath", icon: "droplet", accent: "var(--color-bath)" },
  { key: "nails", label: "Nails", prevLabel: "Previous nail trim", icon: "pawPrint", accent: "var(--color-track-notes)" },
  { key: "haircut", label: "Haircuts", prevLabel: "Previous haircut", icon: "scissors", accent: "var(--color-bath)" },
];

const LOCATION: Record<GroomingLocation, { label: string; icon: AppIconName }> = {
  home: { label: "At home", icon: "house" },
  groomer: { label: "At the groomers", icon: "store" },
};

/** A tab's history entry, flattened across the split baths/grooming collections. */
interface Row {
  date: string;
  notes?: string;
  location?: GroomingLocation;
  created: string;
  /** Index into the underlying collection, for deletes. */
  index: number;
}

/** Whole days between a past date and today (0 = today, 1 = yesterday). */
function daysBetween(date: string, todayIso: string): number {
  const a = new Date(date + "T12:00:00").getTime();
  const b = new Date(todayIso + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function fullDate(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Unified grooming screen. Tabs across baths, nail trims, and haircuts; each
 * tab shows a "previous …" hero card and a location-tagged history list. The
 * header + button opens the shared "Log grooming" sheet, pre-selecting the
 * active tab's service.
 */
export function GroomingHub({
  open,
  onClose,
  initialTab = "bath",
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: GroomingService;
}): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState<GroomingService>(initialTab);
  const [logOpen, setLogOpen] = useState(false);
  const todayIso = today();

  const active = TABS.find((t) => t.key === tab)!;

  const rowsFor = (key: GroomingService): Row[] => {
    const list: Row[] =
      key === "bath"
        ? (db.baths ?? []).map((b, index) => ({
            date: b.date,
            notes: b.notes,
            location: b.location,
            created: b.created,
            index,
          }))
        : (db.grooming ?? [])
            .map((g, index) => ({ g, index }))
            .filter((x) => x.g.type === key)
            .map(({ g, index }) => ({
              date: g.date,
              notes: g.notes,
              location: g.location,
              created: g.created,
              index,
            }));
    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  };

  const rows = rowsFor(tab);
  const last = rows[0];
  const lastGap = last ? daysBetween(last.date, todayIso) : undefined;

  const logGrooming = (entry: GroomingEntry): boolean => {
    if (entry.services.length === 0) {
      toast("Pick at least one service");
      return false;
    }
    const created = new Date().toISOString();
    const notes = entry.notes.trim() || undefined;
    let skippedBath = false;
    update((d) => {
      for (const svc of entry.services) {
        if (svc === "bath") {
          d.baths ??= [];
          if (d.baths.some((b) => b.date === entry.date)) {
            skippedBath = true;
            continue;
          }
          d.baths.push({ date: entry.date, location: entry.location, ...(notes ? { notes } : {}), created });
        } else {
          d.grooming ??= [];
          d.grooming.push({
            type: svc,
            date: entry.date,
            location: entry.location,
            ...(notes ? { notes } : {}),
            created,
          });
        }
      }
    });
    toast(skippedBath ? "Logged — a bath already existed for that day" : "Logged");
    return true;
  };

  const removeRow = async (key: GroomingService, index: number): Promise<void> => {
    const ok = await confirm({
      title: "Delete this entry?",
      message: "This grooming entry will be removed.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    update((d) => {
      if (key === "bath") d.baths?.splice(index, 1);
      else d.grooming?.splice(index, 1);
    });
    toast("Deleted");
  };

  return (
    <HealthDetailScreen
      open={open}
      onClose={onClose}
      title="Grooming"
      subtitle="Baths, nail trims & haircuts"
      action={
        <button
          type="button"
          aria-label="Log grooming"
          className="glass-btn glass-btn--health"
          onClick={() => setLogOpen(true)}
        >
          <Icon icon={Icons.plus} color="inherit" />
        </button>
      }
    >
      {/* Segmented tab selector */}
      <div className="groom-tabs" role="tablist" aria-label="Grooming type">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`groom-tab${tab === t.key ? " groom-tab--on" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* "Previous …" hero card */}
      <div className="groom-prev">
        <div className="groom-prev-head">
          <Icon icon={Icons[active.icon]} width={18} height={18} color="inherit" />
          <span className="groom-prev-eyebrow">{active.prevLabel}</span>
        </div>
        {last ? (
          lastGap === undefined || lastGap <= 0 ? (
            <span className="groom-prev-value">Today</span>
          ) : lastGap === 1 ? (
            <span className="groom-prev-value">Yesterday</span>
          ) : (
            <span className="groom-prev-value">
              {lastGap}
              <span className="groom-prev-unit"> days ago</span>
            </span>
          )
        ) : (
          <span className="groom-prev-value groom-prev-value--empty">Not logged yet</span>
        )}
      </div>

      <Eyebrow style={{ display: "block", margin: "24px 4px 10px" }}>History</Eyebrow>

      {rows.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: 32 }}>
          <Icon icon={Icons[active.icon]} size="lg" color="disabled" />
          <Footnote color={MUTED}>Nothing logged yet.</Footnote>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {rows.map((r, i) => {
            const loc = r.location ? LOCATION[r.location] : undefined;
            return (
              <RevealItem key={r.created + r.index} index={i}>
                <SwipeableRow
                  background={SURFACE}
                  style={{ borderRadius: 20 }}
                  actions={[
                    {
                      label: "Delete",
                      color: "#ff3b30",
                      icon: <Icon icon={Icons.trash} color="inherit" />,
                      onAction: () => removeRow(tab, r.index),
                    },
                  ]}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14 }}>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: active.accent,
                        color: DARK,
                        flexShrink: 0,
                      }}
                    >
                      <Icon icon={Icons[loc?.icon ?? active.icon]} color="inherit" />
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                      <Headline color={HERO}>{loc?.label ?? "Logged"}</Headline>
                      <Footnote color={MUTED}>{fullDate(r.date)}</Footnote>
                      {r.notes && <Footnote color={MUTED}>{r.notes}</Footnote>}
                    </div>
                  </div>
                </SwipeableRow>
              </RevealItem>
            );
          })}
        </div>
      )}

      <LogGroomingSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        defaultService={tab}
        onSubmit={logGrooming}
      />
    </HealthDetailScreen>
  );
}
