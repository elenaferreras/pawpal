import { useEffect, useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Button } from "@astryxdesign/core/Button";
import { Switch } from "@astryxdesign/core/Switch";
import { useToast } from "../../lib/toast";
import { TimeField } from "../../components/fields";
import {
  getNotifConfig,
  requestNotificationPermission,
  saveNotifConfig,
} from "../../lib/notifications";
import type { NotifConfig } from "../../types";
import { SettingsPage, Panel, PanelTitle, PanelText } from "./shared";

/** Notifications subpage: permission prompt + per-reminder toggles and times. */
export function NotificationsScreen({ onBack }: { onBack: () => void }): React.ReactElement {
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

  const enable = async (): Promise<void> => {
    const granted = await requestNotificationPermission();
    setPerm("Notification" in window ? Notification.permission : "unsupported");
    if (granted) toast("Notifications enabled!");
  };

  return (
    <SettingsPage title="Notifications" onBack={onBack}>
      <Panel>
        {perm === "unsupported" ? (
          <PanelText>Notifications aren&rsquo;t supported on this device.</PanelText>
        ) : perm !== "granted" ? (
          <HStack justify="between" vAlign="center">
            <VStack gap={0.5}>
              <PanelTitle>Reminders</PanelTitle>
              <PanelText>
                {perm === "denied" ? "Blocked — enable in Settings" : "Tap Allow to enable"}
              </PanelText>
            </VStack>
            {perm !== "denied" && (
              <Button label="Allow" size="sm" variant="primary" onClick={() => void enable()} />
            )}
          </HStack>
        ) : (
          <VStack gap={3}>
            <ReminderToggle
              label="Walk reminder"
              entry={cfg.walkReminder}
              defaultTime="09:00"
              onChange={(entry) => persist({ ...cfg, walkReminder: entry })}
            />
            <ReminderToggle
              label="Feeding reminder"
              entry={cfg.feedReminder}
              defaultTime="08:00"
              onChange={(entry) => persist({ ...cfg, feedReminder: entry })}
            />
            <HStack justify="between" vAlign="center">
              <VStack gap={0.5}>
                <PanelTitle>Vet reminders</PanelTitle>
                <PanelText>Notify about upcoming appointments</PanelText>
              </VStack>
              <Switch
                label="Vet reminders"
                isLabelHidden
                value={cfg.vetReminder?.enabled || false}
                onChange={(checked) => persist({ ...cfg, vetReminder: { enabled: checked } })}
              />
            </HStack>
          </VStack>
        )}
      </Panel>
    </SettingsPage>
  );
}

function ReminderToggle({
  label,
  entry,
  defaultTime,
  onChange,
}: {
  label: string;
  entry?: { enabled: boolean; hour: number; minute: number };
  defaultTime: string;
  onChange: (entry: { enabled: boolean; hour: number; minute: number }) => void;
}): React.ReactElement {
  const enabled = entry?.enabled || false;
  const time = entry
    ? `${String(entry.hour).padStart(2, "0")}:${String(entry.minute).padStart(2, "0")}`
    : defaultTime;

  const toggle = (checked: boolean): void => {
    const [h, m] = time.split(":").map(Number);
    onChange({ enabled: checked, hour: h, minute: m });
  };
  const setTime = (val: string): void => {
    const [h, m] = val.split(":").map(Number);
    onChange({ enabled: true, hour: h, minute: m });
  };

  return (
    <HStack justify="between" vAlign="center" wrap="wrap" gap={2}>
      <VStack gap={0.5} style={{ flex: 1 }}>
        <PanelTitle>{label}</PanelTitle>
        <PanelText>{enabled ? `Daily at ${time}` : "Not set"}</PanelText>
      </VStack>
      {enabled && (
        <div style={{ width: 130 }}>
          <TimeField label={`${label} time`} isLabelHidden value={time} onChange={setTime} />
        </div>
      )}
      <Switch label={label} isLabelHidden value={enabled} onChange={(checked) => toggle(checked)} />
    </HStack>
  );
}
