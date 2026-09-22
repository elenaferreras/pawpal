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
  /** Pet's microchip / transponder number, shown on the Health identity card. */
  microchip?: string;
}

export interface GpsCoord {
  lat: number;
  lng: number;
  acc?: number;
}

export interface Walk {
  date: string;
  time: string;
  steps: number | string;
  friends: boolean;
  /** Selected sky/feel conditions (multiselect). Legacy string entries are migrated to a 1-element array. */
  weather: string[];
  /** Selected terrains (multiselect). */
  terrain?: string[];
  notes: string;
  assignee?: string;
  gpsRoute?: GpsCoord[];
  created: string;
  /** Number of walks aggregated into this day's entry. */
  walksCount?: number;
  /** Free-text location (auto-filled from geolocation when available). */
  location?: string;
  /** Number of poops during the day. */
  poops?: number;
  /** True once this walk's note has been forwarded to the vet notes. */
  sentToVet?: boolean;
  /** Set when the entry was logged by a dog-sitter (server-tagged). */
  by?: "sitter";
  // --- Legacy / live-GPS-session fields (kept for old data + LiveWalk routes) ---
  duration?: number | string;
  distance?: number | string;
  pipi?: boolean;
  popo?: boolean;
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

/** Where a grooming service happened. */
export type GroomingLocation = "home" | "groomer";

/** A grooming bath (washing the dog) — distinct from the pipi/popo `bathroom` log. */
export interface BathLog {
  /** Day the bath happened (YYYY-MM-DD). */
  date: string;
  /** Optional free-text note (e.g. shampoo used, groomer). */
  notes?: string;
  /** Where it happened (at home vs. the groomer). */
  location?: GroomingLocation;
  created: string;
}

export type GroomingType = "haircut" | "nails";

/** A dated grooming event (haircut or nail trim). */
export interface GroomingLog {
  type: GroomingType;
  /** Day it happened (YYYY-MM-DD). */
  date: string;
  notes?: string;
  /** Where it happened (at home vs. the groomer). */
  location?: GroomingLocation;
  created: string;
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
  /** Base64 data URL of the attached file (kept small — see the ~2MB cap). */
  fileData?: string;
  /** MIME type of the attached file. */
  fileMime?: string;
  created: string;
}

export interface Vaccine {
  name: string;
  /** Manufacturer / brand of the vaccine. */
  manufacturer?: string;
  /** Date the vaccine was administered. */
  date: string;
  /** Date the protection starts (from the pet passport). */
  validFrom?: string;
  /** Date the protection expires — drives the auto booster reminder. */
  validUntil?: string;
  /** Vet or clinic that administered it. */
  clinic?: string;
  notes?: string;
  /** Legacy expiry field; migrated to validUntil. */
  nextDue?: string;
  created: string;
}

export interface WeightEntry {
  /** Day the weight was recorded (YYYY-MM-DD). */
  date: string;
  /** Weight in kilograms. */
  kg: number;
  note?: string;
  created: string;
}

export interface HealthDocument {
  /** Display name (e.g. "Pet insurance"). */
  name: string;
  /** Grouping used to surface insurance on the identity card. */
  kind: "insurance" | "other";
  /** MIME type of the stored file. */
  mime: string;
  fileName: string;
  /** Base64 data URL of the file (kept small — see the ~2MB cap on upload). */
  data: string;
  /** File size in bytes. */
  size: number;
  notes?: string;
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
  /** Uploaded documents (insurance PDF, etc.), stored inline as base64. */
  documents?: HealthDocument[];
}

export interface Database {
  profile: Profile;
  walks: Walk[];
  meals: Meal[];
  bathroom: BathroomLog[];
  /** Grooming baths — powers the soft "due for a bath" reminder. */
  baths: BathLog[];
  vetRecords: VetRecords;
  /** Dated weight measurements powering the weight-evolution graph. */
  weightLog?: WeightEntry[];
  /** Haircut & nail-trim grooming events. */
  grooming?: GroomingLog[];
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
  | "settings-coowners"
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
