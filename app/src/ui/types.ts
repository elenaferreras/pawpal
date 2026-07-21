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
  gpsRoute?: GpsCoord[];
  created: string;
}

export interface Meal {
  date: string;
  time: string;
  type: string;
  amount: number;
  notes: string;
  mealSlot?: number;
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
}

export interface Database {
  profile: Profile;
  walks: Walk[];
  meals: Meal[];
  bathroom: BathroomLog[];
  vetRecords: VetRecords;
}

export type ScreenId = "home" | "dashboard" | "walks" | "food" | "vet" | "profile";

export interface ReminderConfigEntry {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface NotifConfig {
  walkReminder?: ReminderConfigEntry;
  feedReminder?: ReminderConfigEntry;
  vetReminder?: { enabled: boolean };
}
