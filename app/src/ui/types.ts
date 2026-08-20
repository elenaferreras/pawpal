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
  /** True once this walk's note has been forwarded to the vet notes. */
  sentToVet?: boolean;
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
  /** True once this meal's note has been forwarded to the vet notes. */
  sentToVet?: boolean;
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
  /** When set, this entry was auto-created from a walk (the walk's `created` id) and is removed when that walk drops the toggle or is deleted. */
  source?: string;
  /** True once this entry's note has been forwarded to the vet notes. */
  sentToVet?: boolean;
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

export interface VetNote {
  /** The topic to raise at the next visit. */
  text: string;
  /** Whether it has already been discussed with the vet. */
  done: boolean;
  /** When set, this item was forwarded from a walk (the walk's `created` id) and stays in sync with it. */
  source?: string;
}

export interface VetRecords {
  checkups: Checkup[];
  vaccines: Vaccine[];
  reminders: Reminder[];
  medications: Medication[];
  /** Free-form notes to bring to the next vet visit (legacy; migrated to noteItems). */
  notes?: string;
  /** Checklist of topics to discuss with the vet. */
  noteItems?: VetNote[];
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
  | "bathroom"
  | "vet"
  | "notifications"
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
