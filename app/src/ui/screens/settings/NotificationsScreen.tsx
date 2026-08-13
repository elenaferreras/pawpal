import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../components/Button";
import { Toggle } from "../../components/Toggle";
import { useDb } from "../../lib/store";
import { useToast } from "../../lib/toast";
import {
  getNotifConfig,
  requestNotificationPermission,
  saveNotifConfig,
} from "../../lib/notifications";
import { subscribeToPush } from "../../lib/push";
import type { NotifConfig, ReminderConfigEntry } from "../../types";
import { HERO, MUTED, SURFACE, SettingsPage, SectionLabel } from "./shared";

const DEFAULT_MEAL_TIMES = ["09:00", "12:00", "16:00", "20:00", "22:00", "07:00"];
const MEAL_LABELS = ["First meal", "2nd meal", "3rd meal", "4th meal", "5th meal", "6th meal"];
const DIVIDER = "1px solid rgba(255,255,255,0.07)";

/** "HH:MM" ⇢ {hour, minute}. */
function parseTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

/** {hour, minute} ⇢ "HH:MM". */
function formatTime(hour = 9, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Notifications subpage (Figma node 233:3226). Grouped reminder toggles on the
 * dark settings surface: walk + per-meal reminders, then a Health group for vet
 * appointments, medication and vaccination reminders. Times are edited inline.
 */
export function NotificationsScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const { db } = useDb();
  const toast = useToast();
  const [cfg, setCfg] = useState<NotifConfig>(getNotifConfig);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(
    "Notification" in window ? Notification.permission : "unsupported",
  );

  useEffect(() => {
    setCfg(getNotifConfig());
  }, []);

  const persist = (next: NotifConfig): void => {
    setCfg(next);
    saveNotifConfig(next);
  };

  // Toggling any reminder on prompts for permission if not yet granted.
  const ensurePermission = async (): Promise<void> => {
    if (perm === "granted" || perm === "unsupported") return;
    await requestNotificationPermission();
    setPerm("Notification" in window ? Notification.permission : "unsupported");
    void subscribeToPush();
  };

  const enable = async (): Promise<void> => {
    const granted = await requestNotificationPermission();
    setPerm("Notification" in window ? Notification.permission : "unsupported");
    if (granted) {
      void subscribeToPush();
      toast("Notifications enabled!");
    }
  };

  const mealsPerDay = db.profile.mealsPerDay || 4;

  // Walk reminder.
  const walk = cfg.walkReminder;
  const walkOn = walk?.enabled ?? false;
  const walkTime = walk ? formatTime(walk.hour, walk.minute) : "09:00";
  const setWalk = (entry: ReminderConfigEntry): void => persist({ ...cfg, walkReminder: entry });

  // Meal reminders.
  const meals = cfg.mealReminders ?? {
    enabled: cfg.feedReminder?.enabled ?? false,
    times: DEFAULT_MEAL_TIMES,
  };
  const mealsOn = meals.enabled;
  const mealTime = (i: number): string => meals.times[i] ?? DEFAULT_MEAL_TIMES[i] ?? "12:00";
  const setMeals = (enabled: boolean, times: string[]): void =>
    persist({ ...cfg, mealReminders: { enabled, times } });

  const vetOn = cfg.vetReminder?.enabled ?? false;
  const medOn = cfg.medicationReminder?.enabled ?? false;
  const vaccOn = cfg.vaccinationReminder?.enabled ?? false;

  const toggle = async (fn: () => void): Promise<void> => {
    await ensurePermission();
    fn();
  };

  return (
    <SettingsPage title="Notifications" onBack={onBack}>
      {perm === "unsupported" ? (
        <Group>
          <div style={{ padding: 16 }}>
            <Sub>Notifications aren&rsquo;t supported on this device.</Sub>
          </div>
        </Group>
      ) : (
        <>
          {perm !== "granted" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                background: SURFACE,
                borderRadius: 20,
                padding: 16,
                marginBottom: 16,
              }}
            >
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <Title>Enable notifications</Title>
                <Sub>
                  {perm === "denied"
                    ? "Blocked — enable in device Settings"
                    : "Allow PawPal to send reminders"}
                </Sub>
              </span>
              {perm !== "denied" && (
                <Button
                  label="Allow"
                  size="sm"
                  variant="primary"
                  onClick={() => void enable()}
                  style={{ width: "auto", minWidth: 0, margin: 0 }}
                />
              )}
            </div>
          )}

          <Group>
            <ToggleRow
              title="Walk reminders"
              subtitle={walkOn ? `Daily at ${walkTime}` : "Not set"}
              value={walkOn}
              onChange={(checked) =>
                void toggle(() => {
                  const { hour, minute } = parseTime(walkTime);
                  setWalk({ enabled: checked, hour, minute });
                })
              }
              isFirst
            />
            {walkOn && (
              <TimeRow
                label="Reminder time"
                value={walkTime}
                onChange={(v) => {
                  const { hour, minute } = parseTime(v);
                  setWalk({ enabled: true, hour, minute });
                }}
              />
            )}

            <ToggleRow
              title="Meal reminders"
              subtitle={mealsOn ? "On" : "Not set"}
              value={mealsOn}
              onChange={(checked) => void toggle(() => setMeals(checked, meals.times))}
            />
            {mealsOn &&
              Array.from({ length: mealsPerDay }, (_, i) => (
                <TimeRow
                  key={i}
                  label={MEAL_LABELS[i] ?? `Meal ${i + 1}`}
                  value={mealTime(i)}
                  onChange={(v) => {
                    const times = Array.from(
                      { length: Math.max(mealsPerDay, meals.times.length) },
                      (_, j) => (j === i ? v : mealTime(j)),
                    );
                    setMeals(true, times);
                  }}
                />
              ))}
          </Group>

          <SectionLabel style={{ color: HERO, fontSize: 16, fontWeight: 510, margin: "20px 4px 8px" }}>
            Health
          </SectionLabel>
          <Group>
            <ToggleRow
              title="Vet appointments"
              subtitle={vetOn ? "One day before at 09:00" : "Not set"}
              value={vetOn}
              onChange={(checked) =>
                void toggle(() => persist({ ...cfg, vetReminder: { enabled: checked } }))
              }
              isFirst
            />
            <ToggleRow
              title="Medication reminders"
              subtitle={medOn ? "Daily at 09:00 while active" : "Not set"}
              value={medOn}
              onChange={(checked) =>
                void toggle(() => persist({ ...cfg, medicationReminder: { enabled: checked } }))
              }
            />
            <ToggleRow
              title="Vaccination reminders"
              subtitle={vaccOn ? "One day before at 09:00" : "Not set"}
              value={vaccOn}
              onChange={(checked) =>
                void toggle(() => persist({ ...cfg, vaccinationReminder: { enabled: checked } }))
              }
            />
          </Group>
        </>
      )}
    </SettingsPage>
  );
}

/** Rounded dark surface grouping a set of rows. */
function Group({ children }: { children: ReactNode }): React.ReactElement {
  return <div style={{ background: SURFACE, borderRadius: 24, overflow: "hidden" }}>{children}</div>;
}

function Title({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <span style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 17, color: HERO }}>
      {children}
    </span>
  );
}

function Sub({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <span style={{ fontFamily: "var(--font-ui)", fontWeight: 400, fontSize: 14, color: MUTED }}>
      {children}
    </span>
  );
}

/** A reminder toggle row: title + subtitle on the left, a Switch on the right. */
function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  isFirst = false,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (checked: boolean) => void;
  isFirst?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px",
        borderTop: isFirst ? "none" : DIVIDER,
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <Title>{title}</Title>
        <Sub>{subtitle}</Sub>
      </span>
      <Toggle label={title} value={value} onChange={onChange} />
    </div>
  );
}

/** A time row: label on the left, an inline native time input on the right. */
function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.ReactElement {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "16px",
        borderTop: DIVIDER,
        cursor: "pointer",
      }}
    >
      <span
        style={{ flex: 1, fontFamily: "var(--font-ui)", fontWeight: 400, fontSize: 16, color: HERO }}
      >
        {label}
      </span>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: "none",
          background: "none",
          fontFamily: "var(--font-ui)",
          fontWeight: 400,
          fontSize: 16,
          color: MUTED,
          textAlign: "right",
          cursor: "pointer",
          padding: 0,
          colorScheme: "dark",
        }}
      />
    </label>
  );
}
