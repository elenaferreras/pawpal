import type { Database } from "../types";
import { getCurrentUserId, getValidAccessToken } from "./auth";

// Supabase cloud sync. The anon publishable key is safe to expose — row-level
// security scopes each device's data. Ported from the original hardcoded setup.
const SB_URL = "https://fsmzrbysyeggcezxsura.supabase.co";
const SB_KEY = "sb_publishable_l2TVcGUHf5UiqQDJaGZHeQ_AV9n9zFp";

// The `updated_at` of the last cloud version this device has reconciled — lets
// the live poll tell our own pushes apart from a sitter's remote changes.
const CLOUD_SEEN_KEY = "pawpal_cloud_seen";

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

// The row key scopes cloud data: to the signed-in account when logged in, and
// to the anonymous device otherwise. Optional accounts, one row per identity.
export function getRowKey(): string {
  const uid = getCurrentUserId();
  return uid ? `user_${uid}` : getDeviceId();
}

// Authenticated requests carry the user's access token so row-level security
// can enforce ownership; anonymous requests fall back to the publishable key.
async function authHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  return {
    apikey: SB_KEY,
    Authorization: "Bearer " + (token ?? SB_KEY),
  };
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
        const rowKey = getRowKey();
        const userId = getCurrentUserId();
        const payload = JSON.parse(JSON.stringify(db)) as Database;
        // Strip photos to avoid hitting row-size limits.
        payload.bathroom = payload.bathroom.map((b) => ({ ...b, photos: [] }));
        const updatedAt = new Date().toISOString();
        const res = await fetch(`${cfg.url}/rest/v1/pawpal_data`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            id: rowKey,
            // Owner column drives row-level security: the account id when
            // signed in, null for anonymous device rows.
            user_id: userId,
            payload,
            updated_at: updatedAt,
          }),
        });
        if (res.ok) {
          // Remember the version we just wrote so the live poll can tell our
          // own pushes apart from a sitter's remote changes.
          try {
            localStorage.setItem(CLOUD_SEEN_KEY, updatedAt);
          } catch {
            /* ignore */
          }
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
    `${cfg.url}/rest/v1/pawpal_data?id=eq.${getRowKey()}&limit=1`,
    { headers: await authHeaders() },
  );
  if (!res.ok) throw new Error("HTTP " + res.status);
  const rows = (await res.json()) as Array<{ payload: Partial<Database> }>;
  if (!rows || rows.length === 0) return null;
  return rows[0].payload;
}

// ── Live reconcile (pull sitter-logged activity into the owner's app) ────────

/** The cloud row's payload plus its version stamp. */
async function fetchCloudMeta(): Promise<{ payload: Partial<Database>; updatedAt: string } | null> {
  const cfg = getSBConfig();
  const res = await fetch(
    `${cfg.url}/rest/v1/pawpal_data?id=eq.${getRowKey()}&select=payload,updated_at&limit=1`,
    { headers: await authHeaders() },
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ payload: Partial<Database>; updated_at: string }>;
  if (!rows || rows.length === 0) return null;
  return { payload: rows[0].payload, updatedAt: rows[0].updated_at };
}

function entryKey(e: { created?: string }): string {
  return e.created || JSON.stringify(e);
}

/** Cloud entries whose key isn't already present locally (append-only merge). */
function newEntries<T extends { created?: string }>(local: T[] | undefined, cloud: T[] | undefined): T[] {
  const have = new Set((local ?? []).map(entryKey));
  return (cloud ?? []).filter((e) => !have.has(entryKey(e)));
}

/**
 * Pull the latest cloud version and merge any activities that aren't local yet
 * (e.g. logged by a sitter). Additive only — never overwrites the owner's own
 * profile edits or removes local entries. Returns true if anything was merged.
 */
export async function reconcileFromCloud(
  getDb: () => Database,
  update: (mutate: (draft: Database) => void) => void,
): Promise<boolean> {
  let meta: Awaited<ReturnType<typeof fetchCloudMeta>>;
  try {
    meta = await fetchCloudMeta();
  } catch {
    return false;
  }
  if (!meta || !meta.updatedAt) return false;

  let seen: string | null = null;
  try {
    seen = localStorage.getItem(CLOUD_SEEN_KEY);
  } catch {
    /* ignore */
  }
  if (meta.updatedAt === seen) return false; // our own last write — nothing new

  // Mark this version processed up-front so we don't reconcile it twice.
  try {
    localStorage.setItem(CLOUD_SEEN_KEY, meta.updatedAt);
  } catch {
    /* ignore */
  }

  const local = getDb();
  const cloud = meta.payload;
  const addWalks = newEntries(local.walks, cloud.walks);
  const addMeals = newEntries(local.meals, cloud.meals);
  const addBath = newEntries(local.bathroom, cloud.bathroom);
  if (addWalks.length + addMeals.length + addBath.length === 0) return false;

  update((d) => {
    if (addWalks.length) d.walks = [...d.walks, ...addWalks];
    if (addMeals.length) d.meals = [...d.meals, ...addMeals];
    if (addBath.length) d.bathroom = [...d.bathroom, ...addBath];
  });
  return true;
}
