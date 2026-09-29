import type { Database } from "../types";
import { getCurrentUserId, getValidAccessToken } from "./auth";
import { sendNotification } from "./notifications";
import { getActiveSitterName } from "./sitter";

// Supabase cloud sync. The anon publishable key is safe to expose — row-level
// security scopes each device's data. Ported from the original hardcoded setup.
const SB_URL = "https://fsmzrbysyeggcezxsura.supabase.co";
const SB_KEY = "sb_publishable_l2TVcGUHf5UiqQDJaGZHeQ_AV9n9zFp";

// The `updated_at` of the last cloud version this device has reconciled — lets
// the live poll tell our own pushes apart from a sitter's remote changes.
const CLOUD_SEEN_KEY = "pawpal_cloud_seen";

// Serialized health block last synced (pushed or pulled) by this device. Health
// data (vet records, weight, grooming, baths) is shared last-writer-wins between
// co-owners: this marker lets a push tell whether WE changed health locally
// (so we overwrite the cloud) or not (so we preserve the cloud's health and
// never resurrect another co-owner's deletion on an unrelated push).
const HEALTH_SEEN_KEY = "pawpal_health_seen";

// The identity (row key) the local database currently belongs to. Used to stop
// one account's data leaking into another's cloud row when you switch accounts
// on the same device: pushes are blocked until the data is reconciled to match
// the signed-in identity (see reconcileIdentity in store.tsx).
const DATA_OWNER_KEY = "pawpal_data_owner";

/** The row key the on-device database is currently claimed by, if known. */
export function getDataOwner(): string | null {
  try {
    return localStorage.getItem(DATA_OWNER_KEY);
  } catch {
    return null;
  }
}

/** Record which identity the on-device database now represents. */
export function setDataOwner(key: string): void {
  try {
    localStorage.setItem(DATA_OWNER_KEY, key);
  } catch {
    /* ignore */
  }
}

// ── Co-owner shared row ──────────────────────────────────────────────────────
// A co-owner is a second account with a membership row granting full access to
// the PRIMARY owner's pawpal_data row. When set, the co-owner's whole sync is
// repointed at that shared row instead of their own `user_<uid>` row. The
// mapping is stamped with the member's uid so a stale value never leaks to a
// different account signed in on the same device (it only applies to its owner).
const SHARED_ROW_KEY = "pawpal_shared_row";

interface SharedRow {
  /** The uid of the co-owner this mapping belongs to. */
  memberUid: string;
  /** The shared pawpal_data row id, e.g. `user_<primaryOwnerUid>`. */
  rowKey: string;
}

function readSharedRow(): SharedRow | null {
  try {
    const raw = localStorage.getItem(SHARED_ROW_KEY);
    return raw ? (JSON.parse(raw) as SharedRow) : null;
  } catch {
    return null;
  }
}

/** The shared row id for the signed-in co-owner, or null when not a co-owner. */
export function getSharedRowKey(): string | null {
  const shared = readSharedRow();
  if (!shared) return null;
  // Only honour the mapping for the account it was recorded for.
  return shared.memberUid === getCurrentUserId() ? shared.rowKey : null;
}

/** Record that the signed-in account co-owns `rowKey` (the primary's row). */
export function setSharedRow(rowKey: string): void {
  const memberUid = getCurrentUserId();
  if (!memberUid) return;
  try {
    localStorage.setItem(SHARED_ROW_KEY, JSON.stringify({ memberUid, rowKey }));
  } catch {
    /* ignore */
  }
}

/** Forget any co-owner mapping (e.g. access revoked, or sign-out). */
export function clearSharedRow(): void {
  try {
    localStorage.removeItem(SHARED_ROW_KEY);
  } catch {
    /* ignore */
  }
}

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
// A co-owner is repointed at the primary owner's shared row instead.
export function getRowKey(): string {
  const uid = getCurrentUserId();
  if (!uid) return getDeviceId();
  return getSharedRowKey() ?? `user_${uid}`;
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
        // Guard against cross-account leakage: if the local data still belongs
        // to a different identity (an account switch that hasn't been
        // reconciled yet), don't push it into this identity's cloud row.
        const owner = getDataOwner();
        if (owner !== null && owner !== rowKey) return;
        // A shared (co-owned) row keeps the PRIMARY owner's user_id — the RLS
        // trigger forbids a co-owner from rewriting it. Derive it from the row
        // key (`user_<ownerUid>`); anonymous device rows carry a null user_id.
        const shared = getSharedRowKey();
        const userId = shared
          ? shared.replace(/^user_/, "")
          : getCurrentUserId();
        const payload = JSON.parse(JSON.stringify(db)) as Database;
        // Health (vet records, weight, grooming, baths) syncs last-writer-wins
        // between co-owners: only overwrite the cloud's copy when WE changed it
        // locally. `healthDirty` compares against the last health we synced, not
        // the cloud, so an unrelated push (e.g. a meal) never resurrects another
        // co-owner's health edit or deletion.
        const localHealth = healthStr(payload);
        const healthDirty = localHealth !== getHealthSeen();
        // Merge-before-overwrite: this push replaces the whole shared row, so
        // first pull the current cloud version and fold in any activity entries
        // (meals/walks/bathroom) another co-owner or a sitter added that we
        // don't have locally yet. Without this, a co-owner's logged meal could
        // be wiped by another co-owner's push — risking an overfed dog.
        let mergedRemote = false;
        try {
          const meta = await fetchCloudMeta();
          if (meta?.payload) {
            const c = meta.payload;
            // Deletions are authoritative: union both sides' tombstones, exclude
            // them from the additive merge, and strip them from the row we push
            // so a co-owner who still has a deleted entry locally can't push it
            // back (and our own deletions actually persist to the cloud).
            const tomb = tombSet(payload.deleted, c.deleted);
            const mWalks = newEntries(payload.walks, c.walks, tomb);
            const mMeals = newEntries(payload.meals, c.meals, tomb);
            const mBath = newEntries(payload.bathroom, c.bathroom, tomb);
            const mBaths = newEntries(payload.baths, c.baths, tomb);
            const mGroom = newEntries(payload.grooming, c.grooming, tomb);
            if (mWalks.length) payload.walks = [...payload.walks, ...mWalks];
            if (mMeals.length) payload.meals = [...payload.meals, ...mMeals];
            if (mBath.length) payload.bathroom = [...payload.bathroom, ...mBath];
            if (mBaths.length) payload.baths = [...payload.baths, ...mBaths];
            if (mGroom.length) payload.grooming = [...(payload.grooming ?? []), ...mGroom];
            payload.deleted = [...tomb];
            payload.walks = stripTombstoned(payload.walks, tomb);
            payload.meals = stripTombstoned(payload.meals, tomb);
            payload.bathroom = stripTombstoned(payload.bathroom, tomb);
            payload.baths = stripTombstoned(payload.baths, tomb);
            if (payload.grooming) payload.grooming = stripTombstoned(payload.grooming, tomb);
            mergedRemote =
              mWalks.length + mMeals.length + mBath.length + mBaths.length + mGroom.length > 0;
            // We didn't touch health locally — keep whatever the cloud holds so
            // we don't undo another co-owner's change. If it differs from ours,
            // leave CLOUD_SEEN unstamped so the next reconcile pulls it local.
            if (!healthDirty) {
              const ch = healthBlock(c);
              payload.vetRecords = ch.vetRecords;
              payload.weightLog = ch.weightLog;
              if (healthStr(c) !== localHealth) mergedRemote = true;
            }
          }
        } catch {
          // Offline or fetch failed — fall back to pushing local as-is.
        }
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
          // The local data is now confirmed to belong to this identity.
          setDataOwner(rowKey);
          // Our health is now the cloud's — remember it so a later unrelated
          // push preserves it instead of stomping another co-owner's change.
          if (healthDirty) setHealthSeen(localHealth);
          // Remember the version we just wrote so the live poll can tell our
          // own pushes apart from a sitter's remote changes. When we folded in
          // remote-only entries, leave the marker so the next reconcile pulls
          // those entries into this device's local copy too.
          if (!mergedRemote) {
            try {
              localStorage.setItem(CLOUD_SEEN_KEY, updatedAt);
            } catch {
              /* ignore */
            }
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

// Keep tombstones bounded — the newest keys matter most (older deletions have
// long since been stripped from every device's cloud row).
const MAX_TOMBSTONES = 500;

/** Union two tombstone lists into a bounded set of the most recent keys. */
function tombSet(a: string[] | undefined, b: string[] | undefined): Set<string> {
  const merged = [...(a ?? []), ...(b ?? [])];
  const set = new Set(merged);
  if (set.size <= MAX_TOMBSTONES) return set;
  return new Set([...set].slice(set.size - MAX_TOMBSTONES));
}

/**
 * Record deleted activity entry keys on the database draft so a later cloud
 * merge can't resurrect them. Call from inside an `update`/delete mutator.
 */
export function tombstoneEntries(db: Database, ...keys: string[]): void {
  const set = new Set(db.deleted ?? []);
  for (const k of keys) if (k) set.add(k);
  const next = [...set];
  db.deleted = next.length > MAX_TOMBSTONES ? next.slice(next.length - MAX_TOMBSTONES) : next;
}

/**
 * Remove tombstones for the given entry keys so a restored (undone) deletion
 * isn't stripped again by the next cloud merge. Call from inside an `update`
 * mutator when re-adding a previously deleted walk/meal/bathroom entry.
 */
export function untombstoneEntries(db: Database, ...keys: string[]): void {
  if (!db.deleted?.length) return;
  const drop = new Set(keys.filter(Boolean));
  db.deleted = db.deleted.filter((k) => !drop.has(k));
}

/** Drop any entry whose key has been tombstoned. */
function stripTombstoned<T extends { created?: string }>(list: T[] | undefined, tomb: Set<string>): T[] {
  return (list ?? []).filter((e) => !tomb.has(entryKey(e)));
}

/**
 * Cloud entries whose key isn't already present locally and isn't tombstoned
 * (append-only merge that respects deletions).
 */
function newEntries<T extends { created?: string }>(
  local: T[] | undefined,
  cloud: T[] | undefined,
  tomb?: Set<string>,
): T[] {
  const have = new Set((local ?? []).map(entryKey));
  return (cloud ?? []).filter((e) => {
    const k = entryKey(e);
    return !have.has(k) && !(tomb?.has(k) ?? false);
  });
}

/**
 * The shared health block: vet records and weight log. Synced last-writer-wins
 * between co-owners (unlike activity, which is additive) so edits and deletions
 * propagate. Grooming (`baths`/`grooming`) is intentionally NOT here — it uses
 * the additive+tombstone merge like walks/meals so a stale co-owner push can't
 * silently wipe another device's entries.
 */
function healthBlock(d: Partial<Database>): Pick<Database, "vetRecords" | "weightLog"> {
  return {
    vetRecords: d.vetRecords ?? { checkups: [], vaccines: [], reminders: [], medications: [], notes: "", documents: [] },
    weightLog: d.weightLog ?? [],
  };
}

/** Stable serialization of the health block for change detection. */
function healthStr(d: Partial<Database>): string {
  return JSON.stringify(healthBlock(d));
}

function getHealthSeen(): string | null {
  try {
    return localStorage.getItem(HEALTH_SEEN_KEY);
  } catch {
    return null;
  }
}

function setHealthSeen(value: string): void {
  try {
    localStorage.setItem(HEALTH_SEEN_KEY, value);
  } catch {
    /* ignore */
  }
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
  // Deletions are authoritative: fold the cloud's tombstones in, skip resurrecting
  // anything tombstoned, and remove locally anything a co-owner has since deleted.
  const tomb = tombSet(local.deleted, cloud.deleted);
  const addWalks = newEntries(local.walks, cloud.walks, tomb);
  const addMeals = newEntries(local.meals, cloud.meals, tomb);
  const addBath = newEntries(local.bathroom, cloud.bathroom, tomb);
  const addBaths = newEntries(local.baths, cloud.baths, tomb);
  const addGroom = newEntries(local.grooming, cloud.grooming, tomb);
  const nextWalks = stripTombstoned([...local.walks, ...addWalks], tomb);
  const nextMeals = stripTombstoned([...local.meals, ...addMeals], tomb);
  const nextBath = stripTombstoned([...local.bathroom, ...addBath], tomb);
  const nextBaths = stripTombstoned([...(local.baths ?? []), ...addBaths], tomb);
  const nextGroom = stripTombstoned([...(local.grooming ?? []), ...addGroom], tomb);
  const keysSig = (arr: { created?: string }[]): string => arr.map(entryKey).join(",");
  const activityChanged =
    keysSig(nextWalks) !== keysSig(local.walks) ||
    keysSig(nextMeals) !== keysSig(local.meals) ||
    keysSig(nextBath) !== keysSig(local.bathroom) ||
    keysSig(nextBaths) !== keysSig(local.baths ?? []) ||
    keysSig(nextGroom) !== keysSig(local.grooming ?? []);
  // Profile details (meals per day, weight, vet, etc.) are shared between
  // co-owners. This cloud version is newer than anything we've written or seen,
  // so adopt its profile (last-writer-wins) when it differs from ours.
  const cloudProfile = cloud.profile;
  const profileChanged =
    cloudProfile != null &&
    JSON.stringify(cloudProfile) !== JSON.stringify(local.profile);
  // Health (vet records, weight, grooming, baths) is shared last-writer-wins.
  // Compare the cloud against the health we last synced (not our local copy) so
  // our own unpushed edits aren't clobbered when the cloud only changed activity.
  const cloudHealth = healthBlock(cloud);
  const cloudHealthStr = JSON.stringify(cloudHealth);
  const healthChanged = cloudHealthStr !== getHealthSeen();
  if (!activityChanged && !profileChanged && !healthChanged) return false;

  update((d) => {
    d.deleted = [...tomb];
    d.walks = stripTombstoned([...d.walks, ...addWalks], tomb);
    d.meals = stripTombstoned([...d.meals, ...addMeals], tomb);
    d.bathroom = stripTombstoned([...d.bathroom, ...addBath], tomb);
    d.baths = stripTombstoned([...(d.baths ?? []), ...addBaths], tomb);
    if (addGroom.length || (d.grooming?.length ?? 0) > 0)
      d.grooming = stripTombstoned([...(d.grooming ?? []), ...addGroom], tomb);
    if (profileChanged && cloudProfile) d.profile = cloudProfile;
    if (healthChanged) {
      d.vetRecords = cloudHealth.vetRecords;
      d.weightLog = cloudHealth.weightLog;
    }
  });
  if (healthChanged) setHealthSeen(cloudHealthStr);

  // A co-owner's profile edit that changes the meal count must refresh this
  // device's server-side reminder mirror so meal reminders match.
  if (profileChanged && cloudProfile) {
    window.dispatchEvent(new CustomEvent("pawpal:profile-synced"));
  }

  // Notify the owner about activities a sitter just logged.
  notifySitterActivity(local, addWalks, addMeals, addBath);
  return true;
}

/**
 * Surface a local notification when merged cloud entries were logged by a
 * dog-sitter (server-tagged `by: "sitter"`). Only fires while the app is open;
 * a single collapsing tag avoids a burst of separate banners.
 */
function notifySitterActivity(
  db: Database,
  walks: Database["walks"],
  meals: Database["meals"],
  bathroom: Database["bathroom"],
): void {
  const nWalks = walks.filter((w) => w.by === "sitter").length;
  const nMeals = meals.filter((m) => m.by === "sitter").length;
  const nBath = bathroom.filter((b) => b.by === "sitter").length;
  const total = nWalks + nMeals + nBath;
  if (total === 0) return;

  const name = getActiveSitterName();
  const dog = db.profile?.name?.trim();
  const who = name || (dog ? `${dog}'s sitter` : "Your sitter");

  let what: string;
  if (total === 1) {
    if (nWalks) what = "logged a walk";
    else if (nMeals) what = "logged a meal";
    else what = "logged a bathroom break";
  } else {
    const parts: string[] = [];
    if (nWalks) parts.push(`${nWalks} walk${nWalks > 1 ? "s" : ""}`);
    if (nMeals) parts.push(`${nMeals} meal${nMeals > 1 ? "s" : ""}`);
    if (nBath) parts.push(`${nBath} bathroom break${nBath > 1 ? "s" : ""}`);
    what = `logged ${parts.join(", ")}`;
  }

  const title = name ? `Update from ${name}` : "Sitter update";
  sendNotification(title, `${who} ${what}.`, "sitter-activity");
}
