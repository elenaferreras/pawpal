import type { Database } from "../types";

// Supabase cloud sync. The anon publishable key is safe to expose — row-level
// security scopes each device's data. Ported from the original hardcoded setup.
const SB_URL = "https://fsmzrbysyeggcezxsura.supabase.co";
const SB_KEY = "sb_publishable_l2TVcGUHf5UiqQDJaGZHeQ_AV9n9zFp";

export interface SBConfig {
  url: string;
  key: string;
}

export function getSBConfig(): SBConfig {
  return { url: SB_URL, key: SB_KEY };
}

export function getDeviceId(): string {
  let id = localStorage.getItem("pawpal_device_id");
  if (!id) {
    id = "device_" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("pawpal_device_id", id);
  }
  return id;
}

export function getLastSync(): string | null {
  return localStorage.getItem("pawpal_last_sync");
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;

// Debounced, silent, non-blocking push of the whole database to the cloud.
export function autoSyncToSupabase(db: Database): void {
  const cfg = getSBConfig();
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void (async () => {
      try {
        const deviceId = getDeviceId();
        const payload = JSON.parse(JSON.stringify(db)) as Database;
        // Strip photos to avoid hitting row-size limits.
        payload.bathroom = payload.bathroom.map((b) => ({ ...b, photos: [] }));
        const res = await fetch(`${cfg.url}/rest/v1/pawpal_data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: cfg.key,
            Authorization: "Bearer " + cfg.key,
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            id: deviceId,
            payload,
            updated_at: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          const t = new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          localStorage.setItem("pawpal_last_sync", t);
          window.dispatchEvent(new CustomEvent("pawpal:synced", { detail: t }));
        }
      } catch {
        // Silent fail — never interrupt the user.
      }
    })();
  }, 1500);
}

export async function syncFromSupabase(): Promise<Partial<Database> | null> {
  const cfg = getSBConfig();
  const res = await fetch(
    `${cfg.url}/rest/v1/pawpal_data?id=eq.${getDeviceId()}&limit=1`,
    { headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key } },
  );
  if (!res.ok) throw new Error("HTTP " + res.status);
  const rows = (await res.json()) as Array<{ payload: Partial<Database> }>;
  if (!rows || rows.length === 0) return null;
  return rows[0].payload;
}
