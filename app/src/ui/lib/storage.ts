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
    vetRecords: { checkups: [], vaccines: [], reminders: [], medications: [] },
  };
}

export function loadDatabase(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Database>;
      return { ...defaultDatabase(), ...parsed };
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
