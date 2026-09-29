import type { CareCadence, CareItem, CareKind } from "../types";
import type { AppIconName } from "./icons";

/** Per-kind icon + pastel accent (dark glyph on a light chip). */
export const CARE_KINDS: Record<CareKind, { label: string; icon: AppIconName; accent: string }> = {
  medication: { label: "Medication", icon: "pill", accent: "var(--color-track-meds)" },
  vaccine: { label: "Vaccine", icon: "syringe", accent: "var(--color-track-notes)" },
  treatment: { label: "Treatment", icon: "droplet", accent: "var(--color-bath)" },
  checkup: { label: "Checkup", icon: "clipboardText", accent: "var(--color-dash-trained)" },
  other: { label: "Reminder", icon: "bell", accent: "var(--color-track-vet)" },
};

export const CADENCE_UNIT_LABEL: Record<CareCadence["unit"], [string, string]> = {
  day: ["day", "days"],
  week: ["week", "weeks"],
  month: ["month", "months"],
  year: ["year", "years"],
};

/** Human-readable cadence, e.g. "Every 6 months" or "Daily". */
export function cadenceLabel(cadence: CareCadence | null): string {
  if (!cadence) return "One-off";
  const [one, many] = CADENCE_UNIT_LABEL[cadence.unit];
  if (cadence.every === 1) {
    return { day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" }[cadence.unit];
  }
  return `Every ${cadence.every} ${cadence.every === 1 ? one : many}`;
}

/** Advance an ISO date (YYYY-MM-DD) by a cadence, returning a new ISO date. */
export function addCadence(iso: string, cadence: CareCadence): string {
  const d = new Date(iso + "T12:00:00");
  if (cadence.unit === "day") d.setDate(d.getDate() + cadence.every);
  else if (cadence.unit === "week") d.setDate(d.getDate() + cadence.every * 7);
  else if (cadence.unit === "month") d.setMonth(d.getMonth() + cadence.every);
  else d.setFullYear(d.getFullYear() + cadence.every);
  return d.toISOString().split("T")[0];
}

/** Whole days from `date` until `todayIso` (positive = in the past). */
export function daysAgo(date: string, todayIso: string): number {
  const a = new Date(date + "T12:00:00").getTime();
  const b = new Date(todayIso + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

/** Coarse "3 months ago" / "Today" style relative label for a past date. */
export function relPast(date: string, todayIso: string): string {
  const days = daysAgo(date, todayIso);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 31) {
    const w = Math.round(days / 7);
    return `${w} ${w === 1 ? "week" : "weeks"} ago`;
  }
  if (days < 365) {
    const m = Math.round(days / 30);
    return `${m} ${m === 1 ? "month" : "months"} ago`;
  }
  const y = Math.round(days / 365);
  return `${y} ${y === 1 ? "year" : "years"} ago`;
}

/** Coarse "in 5 days" / "in 3 months" style label for a future date. */
export function relFuture(date: string, todayIso: string): string {
  const days = -daysAgo(date, todayIso);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 31) return `in ${days} days`;
  if (days < 365) {
    const m = Math.round(days / 30);
    return `in ${m} ${m === 1 ? "month" : "months"}`;
  }
  const y = Math.round(days / 365);
  return `in ${y} ${y === 1 ? "year" : "years"}`;
}

/** The most recent completion date, if any. */
export function lastDone(item: CareItem): string | undefined {
  if (!item.history.length) return undefined;
  return item.history.map((h) => h.date).sort()[item.history.length - 1];
}

/** Whether the item's next due date is in the past. */
export function isOverdue(item: CareItem, todayIso: string): boolean {
  return !!item.nextDue && daysAgo(item.nextDue, todayIso) > 0;
}
