import { useEffect, useState, type ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Slider } from "@astryxdesign/core/Slider";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { DateField, TimeField } from "../components/fields";
import { calcAge } from "../lib/date";
import { exportCSV, exportJSON } from "../lib/export";
import { DogAvatar } from "../avatar/DogAvatar";
import { AvatarEditor } from "../avatar/AvatarEditor";
import {
  getNotifConfig,
  requestNotificationPermission,
  saveNotifConfig,
} from "../lib/notifications";
import { getLastSync, syncFromSupabase } from "../lib/supabase";
import { defaultDatabase } from "../lib/storage";
import type { Avatar, NotifConfig, Profile as ProfileT } from "../types";

const DEFAULT_AVATAR: Avatar = {
  head: "Normal",
  body: "Normal",
  colour: "orange",
  eyes: "Normal",
  nose: "Normal",
};

export function Profile(): React.ReactElement {
  const { db, replace } = useDb();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const p = db.profile;

  if (editing) {
    return <ProfileEdit onDone={() => setEditing(false)} />;
  }

  const age = calcAge(p.birthday);
  const sub = [p.breed, age, p.weight ? `${p.weight}kg` : ""].filter(Boolean).join(" · ");

  const pull = async (): Promise<void> => {
    toast("Pulling from cloud…");
    try {
      const payload = await syncFromSupabase();
      if (!payload) {
        toast("No cloud data found for this device");
        return;
      }
      replace({ ...db, ...payload });
      toast("Data pulled ✓");
    } catch (e) {
      toast("Pull failed: " + (e instanceof Error ? e.message.slice(0, 40) : "error"));
    }
  };

  const clearAll = (): void => {
    if (!window.confirm("Clear ALL data? This cannot be undone.")) return;
    replace(defaultDatabase());
    toast("All data cleared");
  };

  return (
    <div className="screen">
      <Header
        title="Profile"
        action={<Button label="Edit" size="sm" variant="secondary" onClick={() => setEditing(true)} />}
      />

      <VStack gap={2} hAlign="center" style={{ padding: "12px 0" }}>
        {p.avatar ? (
          <DogAvatar avatar={p.avatar} size={160} />
        ) : (
          <div style={{ fontSize: 80 }}>{p.emoji || "🐕"}</div>
        )}
        <Heading level={2}>{p.name || "My Dog"}</Heading>
        <Text type="supporting">{sub || "Tap Edit to set up your profile"}</Text>
      </VStack>

      <SectionLabel>Details</SectionLabel>
      <Card padding={0}>
        <InfoRow label="Breed" value={p.breed || "—"} isFirst />
        <InfoRow label="Age" value={age || p.birthday || "—"} />
        <InfoRow label="Weight" value={p.weight ? `${p.weight} kg` : "—"} />
        <InfoRow label="Food goal" value={`${p.foodGoal || 300}g / day`} />
        <InfoRow label="Vet" value={p.vet || "—"} />
        <InfoRow label="Vet phone" value={p.vetPhone || "—"} />
      </Card>

      <NotificationSettings />

      <SectionLabel>Cloud sync</SectionLabel>
      <Card padding={4}>
        <VStack gap={3}>
          <VStack gap={0.5}>
            <Text weight="semibold">Auto-sync on ☁️</Text>
            <Text type="supporting">
              {getLastSync() ? `Last synced: ${getLastSync()}` : "Not synced yet"}
            </Text>
          </VStack>
          <Button label="Pull from cloud" variant="secondary" onClick={() => void pull()} style={{ width: "100%" }} />
        </VStack>
      </Card>

      <SectionLabel>Data</SectionLabel>
      <Card padding={4}>
        <VStack gap={2}>
          <HStack gap={2}>
            <Button label="Export JSON" variant="secondary" onClick={() => exportJSON(db)} style={{ flex: 1 }} />
            <Button label="Export CSV" variant="secondary" onClick={() => exportCSV(db)} style={{ flex: 1 }} />
          </HStack>
          <Button label="Clear all data" variant="destructive" onClick={clearAll} style={{ width: "100%" }} />
        </VStack>
      </Card>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <Text type="label" color="secondary" as="div" style={{ margin: "20px 0 8px" }}>
      {children}
    </Text>
  );
}

function InfoRow({ label, value, isFirst }: { label: string; value: string; isFirst?: boolean }): React.ReactElement {
  return (
    <HStack
      justify="between"
      vAlign="center"
      padding={3}
      style={{ borderTop: isFirst ? undefined : "1px solid var(--color-border, #eee)" }}
    >
      <Text type="supporting">{label}</Text>
      <Text weight="semibold">{value}</Text>
    </HStack>
  );
}

const MEAL_OPTIONS = [1, 2, 3, 4, 5];

function ProfileEdit({ onDone }: { onDone: () => void }): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const p = db.profile;

  const [name, setName] = useState(p.name);
  const [breed, setBreed] = useState(p.breed);
  const [birthday, setBirthday] = useState(p.birthday || "");
  const [weight, setWeight] = useState(p.weight);
  const [foodGoal, setFoodGoal] = useState(p.foodGoal || 300);
  const [mealsPerDay, setMealsPerDay] = useState(p.mealsPerDay || 4);
  const [vet, setVet] = useState(p.vet);
  const [vetPhone, setVetPhone] = useState(p.vetPhone);
  const [avatar, setAvatar] = useState<Avatar>(p.avatar ? { ...p.avatar } : DEFAULT_AVATAR);

  const portion = Math.round(foodGoal / mealsPerDay);

  const save = (): void => {
    const next: ProfileT = {
      name,
      breed,
      birthday,
      weight,
      foodGoal,
      mealsPerDay,
      vet,
      vetPhone,
      avatar,
      emoji: "🐕",
      onboarded: p.onboarded,
    };
    update((d) => {
      d.profile = next;
    });
    toast("Profile saved! 🐾");
    onDone();
  };

  return (
    <div className="screen">
      <Header
        title="Edit profile"
        action={<Button label="Cancel" size="sm" variant="secondary" onClick={onDone} />}
      />

      <SectionLabel>Avatar</SectionLabel>
      <AvatarEditor value={avatar} onChange={setAvatar} previewSize={140} />

      <SectionLabel>Details</SectionLabel>
      <VStack gap={3}>
        <TextInput label="Name" value={name} onChange={setName} />
        <TextInput label="Breed" value={breed} onChange={setBreed} />
        <HStack gap={3}>
          <DateField label="Birthday" value={birthday} onChange={setBirthday} />
          <TextInput label="Weight (kg)" value={weight} onChange={setWeight} />
        </HStack>
      </VStack>

      <SectionLabel>Food</SectionLabel>
      <VStack gap={3}>
        <VStack gap={1}>
          <Text type="label">
            Daily goal: {foodGoal}g ({portion}g per meal)
          </Text>
          <Slider
            label="Daily food goal"
            value={foodGoal}
            min={50}
            max={1000}
            step={10}
            onChange={(v: number) => setFoodGoal(v)}
          />
        </VStack>
        <VStack gap={1}>
          <Text type="label">Meals per day</Text>
          <SegmentedControl
            value={String(mealsPerDay)}
            onChange={(v) => setMealsPerDay(Number(v))}
            label="Meals per day"
            layout="fill"
          >
            {MEAL_OPTIONS.map((mealCount) => (
              <SegmentedControlItem key={mealCount} value={String(mealCount)} label={String(mealCount)} />
            ))}
          </SegmentedControl>
        </VStack>
      </VStack>

      <SectionLabel>Vet</SectionLabel>
      <VStack gap={3}>
        <TextInput label="Vet name" value={vet} onChange={setVet} />
        <TextInput label="Vet phone" value={vetPhone} onChange={setVetPhone} />
      </VStack>

      <Button
        label="Save profile"
        variant="primary"
        onClick={save}
        style={{ width: "100%", marginTop: 16, marginBottom: 24 }}
      />
    </div>
  );
}

function NotificationSettings(): React.ReactElement {
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

  if (perm === "unsupported") return <></>;

  return (
    <>
      <SectionLabel>Notifications</SectionLabel>
      <Card padding={4}>
        {perm !== "granted" ? (
          <HStack justify="between" vAlign="center">
            <VStack gap={0.5}>
              <Text weight="medium">Reminders</Text>
              <Text type="supporting">
                {perm === "denied" ? "Blocked — enable in Settings" : "Tap Allow to enable"}
              </Text>
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
                <Text weight="medium">Vet reminders</Text>
                <Text type="supporting">Notify about upcoming appointments</Text>
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
      </Card>
    </>
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
        <Text weight="medium">{label}</Text>
        <Text type="supporting">{enabled ? `Daily at ${time}` : "Not set"}</Text>
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
