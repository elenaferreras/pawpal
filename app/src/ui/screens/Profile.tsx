import { useEffect, useState } from "react";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
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
        action={
          <button className="btn btn-sm btn-secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
        }
      />

      <div style={{ display: "flex", justifyContent: "center", padding: "12px 0" }}>
        {p.avatar ? (
          <DogAvatar avatar={p.avatar} size={160} />
        ) : (
          <div className="profile-avatar">{p.emoji || "🐕"}</div>
        )}
      </div>
      <div className="profile-name">{p.name || "My Dog"}</div>
      <div className="profile-sub">{sub || "Tap Edit to set up your profile"}</div>

      <div className="section-label">Details</div>
      <div className="card card-flush">
        <InfoRow label="Breed" value={p.breed || "—"} />
        <InfoRow label="Age" value={age || p.birthday || "—"} />
        <InfoRow label="Weight" value={p.weight ? `${p.weight} kg` : "—"} />
        <InfoRow label="Food goal" value={`${p.foodGoal || 300}g / day`} />
        <InfoRow label="Vet" value={p.vet || "—"} />
        <InfoRow label="Vet phone" value={p.vetPhone || "—"} />
      </div>

      <NotificationSettings />

      <div className="section-label">Cloud sync</div>
      <div className="card">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Auto-sync on ☁️</div>
            <div style={{ fontSize: 12, color: "var(--text2)" }}>
              {getLastSync() ? `Last synced: ${getLastSync()}` : "Not synced yet"}
            </div>
          </div>
        </div>
        <button className="btn btn-secondary btn-full" onClick={() => void pull()}>
          Pull from cloud
        </button>
      </div>

      <div className="section-label">Data</div>
      <div className="card">
        <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={() => exportJSON(db)}>
            Export JSON
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={() => exportCSV(db)}>
            Export CSV
          </button>
        </div>
        <button className="btn btn-danger btn-full" onClick={clearAll}>
          Clear all data
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="toggle-row">
      <span className="toggle-label" style={{ color: "var(--text2)", fontWeight: 500 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 15 }}>{value}</span>
    </div>
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
        action={
          <button className="btn btn-sm btn-secondary" onClick={onDone}>
            Cancel
          </button>
        }
      />

      <div className="section-label">Avatar</div>
      <div style={{ padding: "0 18px" }}>
        <AvatarEditor value={avatar} onChange={setAvatar} previewSize={140} />
      </div>

      <div className="section-label">Details</div>
      <div className="form-group">
        <span className="form-label">Name</span>
        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <span className="form-label">Breed</span>
        <input className="form-input" value={breed} onChange={(e) => setBreed(e.target.value)} />
      </div>
      <div className="form-row">
        <div>
          <span className="form-label">Birthday</span>
          <input type="date" className="form-input" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
        </div>
        <div>
          <span className="form-label">Weight (kg)</span>
          <input type="number" className="form-input" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
      </div>

      <div className="section-label">Food</div>
      <div className="form-group">
        <span className="form-label">Daily goal: {foodGoal}g ({portion}g per meal)</span>
        <input
          type="range"
          min={50}
          max={1000}
          step={10}
          value={foodGoal}
          style={{ width: "100%" }}
          onChange={(e) => setFoodGoal(parseInt(e.target.value))}
        />
      </div>
      <div className="form-group">
        <span className="form-label">Meals per day</span>
        <div style={{ display: "flex", gap: 8 }}>
          {MEAL_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              className={"ob-part-pill" + (mealsPerDay === n ? " selected" : "")}
              style={{ flex: 1 }}
              onClick={() => setMealsPerDay(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className="section-label">Vet</div>
      <div className="form-group">
        <span className="form-label">Vet name</span>
        <input className="form-input" value={vet} onChange={(e) => setVet(e.target.value)} />
      </div>
      <div className="form-group">
        <span className="form-label">Vet phone</span>
        <input className="form-input" value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} />
      </div>

      <button className="btn btn-primary btn-full" style={{ margin: "8px 18px 24px", width: "calc(100% - 36px)" }} onClick={save}>
        Save profile
      </button>
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
      <div className="section-label">Notifications</div>
      <div className="card card-flush">
        {perm !== "granted" ? (
          <div className="toggle-row">
            <div>
              <div className="toggle-label">Reminders</div>
              <div className="toggle-sub">
                {perm === "denied" ? "Blocked — enable in Settings" : "Tap Allow to enable"}
              </div>
            </div>
            {perm !== "denied" && (
              <button className="btn btn-sm btn-primary" onClick={() => void enable()}>
                Allow
              </button>
            )}
          </div>
        ) : (
          <>
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
            <div className="toggle-row">
              <div>
                <div className="toggle-label">Vet reminders</div>
                <div className="toggle-sub">Notify about upcoming appointments</div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={cfg.vetReminder?.enabled || false}
                  onChange={(e) => persist({ ...cfg, vetReminder: { enabled: e.target.checked } })}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </>
        )}
      </div>
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
    <div className="toggle-row" style={{ flexWrap: "wrap", gap: 8 }}>
      <div style={{ flex: 1 }}>
        <div className="toggle-label">{label}</div>
        <div className="toggle-sub">{enabled ? `Daily at ${time}` : "Not set"}</div>
      </div>
      {enabled && (
        <input type="time" className="form-input" style={{ width: 120 }} value={time} onChange={(e) => setTime(e.target.value)} />
      )}
      <label className="toggle">
        <input type="checkbox" checked={enabled} onChange={(e) => toggle(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}
