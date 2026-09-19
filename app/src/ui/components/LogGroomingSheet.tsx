import { useEffect, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { MotionSheet } from "./MotionSheet";
import { Group, DateRow, NotesField } from "./SheetForm";
import { Icons } from "../lib/icons";
import { today } from "../lib/date";
import type { AppIconName } from "../lib/icons";
import type { GroomingLocation } from "../types";

/** The three services a single grooming visit can cover. */
export type GroomingService = "bath" | "nails" | "haircut";

/** Payload emitted when the user logs a grooming visit. */
export interface GroomingEntry {
  services: GroomingService[];
  location: GroomingLocation;
  date: string;
  notes: string;
}

const SERVICES: { key: GroomingService; label: string; icon: AppIconName }[] = [
  { key: "bath", label: "Baths", icon: "droplet" },
  { key: "nails", label: "Nails", icon: "pawPrint" },
  { key: "haircut", label: "Haircut", icon: "scissors" },
];

const LOCATIONS: { key: GroomingLocation; label: string; icon: AppIconName }[] = [
  { key: "home", label: "At home", icon: "house" },
  { key: "groomer", label: "At the groomers", icon: "store" },
];

/**
 * "Log grooming" bottom sheet. Records a bath, nail trim, and/or haircut in a
 * single visit — services are multi-select (pre-seeded from the active tab),
 * with a shared location, date, and note. `onSubmit` returns whether the entry
 * was accepted; the sheet stays open when it isn't (e.g. no service picked).
 */
export function LogGroomingSheet({
  open,
  onClose,
  defaultService,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  defaultService: GroomingService;
  onSubmit: (entry: GroomingEntry) => boolean;
}): React.ReactElement {
  const [services, setServices] = useState<Set<GroomingService>>(() => new Set([defaultService]));
  const [location, setLocation] = useState<GroomingLocation>("home");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const todayIso = today();

  // Reset the form each time it opens, seeded from the active tab.
  useEffect(() => {
    if (!open) return;
    setServices(new Set([defaultService]));
    setLocation("home");
    setDate(todayIso);
    setNotes("");
  }, [open, defaultService, todayIso]);

  const toggle = (key: GroomingService): void =>
    setServices((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const submit = (): void => {
    const picked = SERVICES.map((s) => s.key).filter((k) => services.has(k));
    const ok = onSubmit({ services: picked, location, date, notes: notes.trim() });
    if (ok) onClose();
  };

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel="Log grooming"
      scrimClassName="walk-sheet-scrim"
      scrimStyle={{ zIndex: 1300 }}
      sheetClassName="form-sheet groom-sheet"
      title="Log grooming"
      confirmLabel="Log grooming"
      onConfirm={submit}
      body={
        <div className="wts-form">
          <div className="groom-field">
            <span className="groom-field-label">Services</span>
            <div className="groom-chips">
              {SERVICES.map((s) => {
                const on = services.has(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`groom-chip${on ? " groom-chip--on" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggle(s.key)}
                  >
                    <Icon icon={on ? Icons.check : Icons[s.icon]} width={18} height={18} color="inherit" />
                    <span className="groom-chip-text">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="groom-field">
            <span className="groom-field-label">Where</span>
            <div className="groom-loc">
              {LOCATIONS.map((l) => {
                const on = location === l.key;
                return (
                  <button
                    key={l.key}
                    type="button"
                    className={`groom-loc-btn${on ? " groom-loc-btn--on" : ""}`}
                    aria-pressed={on}
                    onClick={() => setLocation(l.key)}
                  >
                    <Icon icon={Icons[l.icon]} width={18} height={18} color="inherit" />
                    <span className="groom-loc-text">{l.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <Group title="Date">
            <DateRow label="Date" value={date} max={todayIso} onChange={setDate} />
          </Group>

          <section className="wts-group">
            <h3 className="wts-group-title">Notes</h3>
            <div className="wts-group-card">
              <NotesField
                value={notes}
                onChange={setNotes}
                placeholder="Shampoo, groomer, how it went…"
              />
            </div>
          </section>
        </div>
      }
    />
  );
}
