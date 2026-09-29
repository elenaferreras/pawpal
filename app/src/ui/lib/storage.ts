import type { CareItem, Database } from "../types";
import { autoSyncToSupabase } from "./supabase";

const STORAGE_KEY = "pawpal";

/** Generate a stable id for a care item. */
function careId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `care_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function defaultDatabase(): Database {
  return {
    profile: {
      name: "",
      breed: "",
      age: "",
      weight: "",
      foodGoal: 300,
      mealsPerDay: 4,
      vet: "",
      vetPhone: "",
      emoji: "🐕",
    },
    walks: [],
    meals: [],
    bathroom: [],
    baths: [],
    vetRecords: { checkups: [], vaccines: [], reminders: [], medications: [], notes: "", documents: [] },
    weightLog: [],
    grooming: [],
  };
}

/**
 * Bring older walk records up to the aggregated day-activity shape. Idempotent
 * (only touches entries still in the legacy shape): a single `weather`/`terrain`
 * string becomes a 1-element array, the `popo` boolean becomes a `poops` count,
 * and each pre-existing walk counts as one walk. Returns the same object.
 */
export function migrateDatabase(db: Database): Database {
  for (const w of db.walks) {
    const legacyWeather = w.weather as unknown;
    if (typeof legacyWeather === "string") w.weather = legacyWeather ? [legacyWeather] : [];
    else if (!Array.isArray(w.weather)) w.weather = [];
    const legacyTerrain = w.terrain as unknown;
    if (typeof legacyTerrain === "string") w.terrain = legacyTerrain ? [legacyTerrain] : [];
    if (w.poops == null) w.poops = w.popo ? 1 : 0;
    if (w.walksCount == null) w.walksCount = 1;
  }
  // Seed the unified care-items list from the legacy medications + reminders
  // once (gated on undefined so it never re-runs or clobbers edited data). The
  // legacy arrays are left intact for backward-compatible push scheduling.
  if (db.careItems === undefined) {
    const items: CareItem[] = [];
    const nowMs = Date.now();
    for (const m of db.vetRecords?.medications ?? []) {
      const ended = m.end ? new Date(m.end + "T12:00:00").getTime() < nowMs : false;
      items.push({
        id: careId(),
        kind: "medication" as const,
        name: m.name,
        dose: [m.dose, m.freq].filter(Boolean).join(" · ") || undefined,
        notes: m.notes || undefined,
        cadence: null,
        nextDue: m.end || m.start || undefined,
        history: [],
        archived: ended,
        created: m.created,
      });
    }
    for (const r of db.vetRecords?.reminders ?? []) {
      items.push({
        id: careId(),
        kind: "other" as const,
        name: r.title,
        cadence: null,
        nextDue: r.date || undefined,
        history: [],
        archived: false,
        created: r.created,
      });
    }
    db.careItems = items;
  }
  return db;
}

export function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Database>;
      return migrateDatabase({ ...defaultDatabase(), ...parsed });
    }
  } catch {
    // Corrupt storage — fall through to a fresh database.
  }
  return defaultDatabase();
}

export function persistDatabase(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or unavailable — keep the in-memory copy.
  }
  autoSyncToSupabase(db);
}
