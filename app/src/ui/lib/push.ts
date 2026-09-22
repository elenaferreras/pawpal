// Web Push (owner side) — register this device with the browser's push service
// and store the subscription so the sitter-log Edge Function can notify the
// owner when a sitter logs activity, even while the app is closed.
import { getCurrentUserId, getValidAccessToken } from "./auth";
import { getRowKey, getSBConfig } from "./supabase";
import type { NotifConfig } from "../types";

// Public half of the server VAPID keypair (safe to expose). The private half
// lives only as a Supabase function secret (VAPID_PRIVATE_KEY).
const VAPID_PUBLIC_KEY =
  "BExYHFtL6kgZQnaZrwNmHmECLccTt0NIssXysdKRVNhNSBDhVzYylFPDqsbRW13-7srRIuvjG6-NQY7Z34WMZ18";

const LOCAL_ENDPOINT_KEY = "pawpal_push_endpoint";

/** Whether this browser can receive Web Push at all. */
export function pushSupported(): boolean {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyFromSub(sub: PushSubscription, name: "p256dh" | "auth"): string {
  const key = sub.getKey(name);
  if (!key) return "";
  let binary = "";
  const bytes = new Uint8Array(key);
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Ensure this device has a stored push subscription for the signed-in owner.
 * Safe to call repeatedly (e.g. on app start and when enabling notifications).
 * No-ops when unsupported, signed out, or permission isn't granted.
 */
export async function subscribeToPush(): Promise<boolean> {
  if (!pushSupported()) return false;
  if (Notification.permission !== "granted") return false;
  const userId = getCurrentUserId();
  const token = await getValidAccessToken();
  if (!userId || !token) return false;

  let sub: PushSubscription;
  try {
    const reg = await navigator.serviceWorker.ready;
    sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));
  } catch {
    return false;
  }

  const p256dh = keyFromSub(sub, "p256dh");
  const auth = keyFromSub(sub, "auth");
  if (!p256dh || !auth) return false;

  const cfg = getSBConfig();
  try {
    const res = await fetch(`${cfg.url}/rest/v1/push_subscriptions`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        user_id: userId,
        p256dh,
        auth,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!res.ok) return false;
    try {
      localStorage.setItem(LOCAL_ENDPOINT_KEY, sub.endpoint);
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove this device's push subscription (on sign-out or when the owner turns
 * notifications off). Best-effort: unsubscribes locally and deletes the row.
 */
export async function unsubscribeFromPush(): Promise<void> {
  let endpoint: string | null = null;
  try {
    endpoint = localStorage.getItem(LOCAL_ENDPOINT_KEY);
  } catch {
    /* ignore */
  }

  if (pushSupported()) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe();
      }
    } catch {
      /* ignore */
    }
  }

  if (endpoint) {
    const cfg = getSBConfig();
    const token = await getValidAccessToken();
    try {
      await fetch(
        `${cfg.url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        {
          method: "DELETE",
          headers: {
            apikey: cfg.key,
            Authorization: `Bearer ${token ?? cfg.key}`,
          },
        },
      );
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(LOCAL_ENDPOINT_KEY);
  } catch {
    /* ignore */
  }
}

/** "HH:MM" from an hour/minute pair, zero-padded. */
function hhmm(hour = 9, minute = 0): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Mirror this owner's reminder config to the server so the reminder-tick Edge
 * Function can deliver meal, walk, medication, vaccination and vet reminders
 * while the app is closed. Only meaningful for signed-in owners (anonymous
 * device rows have no push target). Best-effort: never throws.
 */
export async function syncReminderPrefs(
  cfg: NotifConfig,
  mealsPerDay: number,
): Promise<void> {
  const userId = getCurrentUserId();
  const token = await getValidAccessToken();
  if (!userId || !token) return;

  const timezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const meal = cfg.mealReminders;
  const walk = cfg.walkReminder;
  const sb = getSBConfig();
  try {
    await fetch(`${sb.url}/rest/v1/reminder_prefs`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: userId,
        owner_row_key: getRowKey(),
        meal_enabled: meal?.enabled ?? false,
        meal_times: (meal?.times ?? []).slice(0, mealsPerDay),
        meals_per_day: mealsPerDay,
        walk_enabled: walk?.enabled ?? false,
        walk_time: hhmm(walk?.hour, walk?.minute),
        med_enabled: cfg.medicationReminder?.enabled ?? false,
        vacc_enabled: cfg.vaccinationReminder?.enabled ?? false,
        vet_enabled: cfg.vetReminder?.enabled ?? false,
        timezone,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    /* ignore */
  }
}
