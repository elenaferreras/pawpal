import type { Database } from "../types";
import { autoSyncToSupabase } from "./supabase";

const STORAGE_KEY = "pawpal";

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
