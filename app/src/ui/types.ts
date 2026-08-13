// Core domain types for PawPal, mirroring the original localStorage schema.

export type ColourKey =
  | "orange"
  | "darkbrown"
  | "lightbrown"
  | "yellow"
  | "lightbrown2"
  | "darkgrey"
  | "black"
  | "white";

export interface Avatar {
  head: string;
  body: string;
  colour: string;
  eyes: string;
  nose: string;
  /** Background circle colour (hex) shown behind the dog. */
  bg?: string;
  /** When set, render this hand-drawn sticker instead of the composed dog. */
  sticker?: string;
}

export interface Profile {
  name: string;
  breed: string;
  birthday?: string;
  age?: string;
  weight: string;
  foodGoal: number;
  mealsPerDay: number;
  vet: string;
  vetPhone: string;
  emoji: string;
  avatar?: Avatar;
  onboarded?: boolean;
}

export interface GpsCoord {
  lat: number;
  lng: number;
  acc?: number;
}

export interface Walk {
  date: string;
  time: string;
  duration: number | string;
  steps: number | string;
  distance: number | string;
  pipi: boolean;
  popo: boolean;
  friends: boolean;
  weather: string;
  notes: string;
  assignee?: string;
  gpsRoute?: GpsCoord[];
  created: string;
  /** Set when the entry was logged by a dog-sitter (server-tagged). */
  by?: "sitter";
}

export interface Meal {
  date: string;
  time: string;
  type: string;
  amount: number;
  notes: string;
  mealSlot?: number;
  created: string;
  /** Set when the entry was logged by a dog-sitter (server-tagged). */
  by?: "sitter";
}

export type BathroomType = "pipi" | "popo" | "both";

export interface BathroomLog {
  date: string;
  time: string;
  type: BathroomType;
  consistency: string;
  notes: string;
  photos: string[];
  created: string;
  /** Set when the entry was logged by a dog-sitter (server-tagged). */
  by?: "sitter";
}

export interface Checkup {
  reason: string;
  date: string;
  clinic: string;
  notes: string;
  hasFile: boolean;
  fileName: string;
  created: string;
}

export interface Vaccine {
  name: string;
  date: string;
  nextDue: string;
  created: string;
}

export type Priority = "High" | "Medium" | "Low";

export interface Reminder {
  title: string;
  date: string;
  priority: Priority;
  created: string;
}

export interface Medication {
  name: string;
  dose: string;
  freq: string;
  days: number;
  start: string;
  end: string | null;
  totalDoses: number | null;
  notes: string;
  created: string;
}

export interface VetRecords {
  checkups: Checkup[];
  vaccines: Vaccine[];
  reminders: Reminder[];
  medications: Medication[];
  /** Free-form notes to bring to the next vet visit (shown on the dashboard). */
  notes?: string;
}

export interface Database {
  profile: Profile;
  walks: Walk[];
  meals: Meal[];
  bathroom: BathroomLog[];
  vetRecords: VetRecords;
}

export type ScreenId =
  | "home"
  | "dashboard"
  | "walks"
  | "food"
  | "vet"
  | "settings"
  | "settings-profile"
  | "settings-notifications"
  | "settings-account"
  | "settings-sitting"
  | "settings-sync"
  | "settings-data";

export interface ReminderConfigEntry {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface NotifConfig {
  walkReminder?: ReminderConfigEntry;
  feedReminder?: ReminderConfigEntry;
  /** Per-meal-slot reminders; `times[i]` is "HH:MM" for meal slot i. */
  mealReminders?: { enabled: boolean; times: string[] };
  vetReminder?: { enabled: boolean };
  /** Daily reminder while a medication course is active. */
  medicationReminder?: { enabled: boolean };
  /** Notify one day before a vaccine's next-due date. */
  vaccinationReminder?: { enabled: boolean };
}
