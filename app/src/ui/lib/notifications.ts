import type { Database, NotifConfig } from "../types";

// Native Web Notifications + reminder scheduling, ported from the original app.

export function getNotifConfig(): NotifConfig {
  try {
    return JSON.parse(
      localStorage.getItem("pawpal_notif_config") || "{}",
    ) as NotifConfig;
  } catch {
    return {};
  }
}

export function saveNotifConfig(cfg: NotifConfig): void {
  localStorage.setItem("pawpal_notif_config", JSON.stringify(cfg));
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendNotification(title: string, body: string, tag?: string): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts: NotificationOptions = { body, tag: tag || "pawpal" };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    void navigator.serviceWorker.ready.then((reg) =>
      reg.showNotification(title, opts),
    );
  } else {
    new Notification(title, opts);
  }
}

interface FiredMap {
  [key: string]: boolean;
}

function getFired(): FiredMap {
  try {
    return JSON.parse(localStorage.getItem("pawpal_notif_fired") || "{}") as FiredMap;
  } catch {
    return {};
  }
}

function saveFired(map: FiredMap): void {
  localStorage.setItem("pawpal_notif_fired", JSON.stringify(map));
}

let reminderInterval: ReturnType<typeof setInterval> | null = null;

// Starts a once-per-minute reminder check. `getDb` returns the live database
// so the check always reflects the latest logs.
export function setupReminderChecks(getDb: () => Database): void {
  if (reminderInterval) clearInterval(reminderInterval);
  reminderInterval = setInterval(() => checkReminders(getDb()), 60000);
}

function checkReminders(db: Database): void {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const config = getNotifConfig();
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const todayStr = now.toISOString().split("T")[0];
  const fired = getFired();

  if (config.walkReminder?.enabled) {
    const wr = config.walkReminder;
    if (h === wr.hour && m === wr.minute) {
      const key = "walk_" + todayStr;
      if (!fired[key]) {
        const walks = db.walks.filter((w) => w.date === todayStr);
        if (walks.length === 0) {
          sendNotification(
            "Time for a walk! 🐾",
            db.profile.name ? db.profile.name + " is waiting!" : "Your pup needs some exercise!",
            "walk-reminder",
          );
        }
        fired[key] = true;
        saveFired(fired);
      }
    }
  }

  if (config.feedReminder?.enabled) {
    const fr = config.feedReminder;
    if (h === fr.hour && m === fr.minute) {
      const key = "feed_" + todayStr + "_" + h;
      if (!fired[key]) {
        const meals = db.meals.filter((meal) => meal.date === todayStr);
        const goal = db.profile.foodGoal || 300;
        const given = meals.reduce((a, meal) => a + (meal.amount || 0), 0);
        if (given < goal) {
          sendNotification(
            "Feeding time! 🍖",
            db.profile.name ? db.profile.name + " hasn’t had their full meal yet." : "Time to feed your pup!",
            "feed-reminder",
          );
        }
        fired[key] = true;
        saveFired(fired);
      }
    }
  }

  // Per-meal-slot reminders: fire at each configured time when that slot has
  // not been logged today.
  if (config.mealReminders?.enabled) {
    const mealsPerDay = db.profile.mealsPerDay || 4;
    const times = config.mealReminders.times;
    for (let slot = 0; slot < mealsPerDay; slot++) {
      const t = times[slot];
      if (!t) continue;
      const [th, tm] = t.split(":").map(Number);
      if (h !== th || m !== tm) continue;
      const key = "meal_" + todayStr + "_" + slot;
      if (fired[key]) continue;
      const logged = db.meals.some((meal) => meal.date === todayStr && meal.mealSlot === slot);
      if (!logged) {
        sendNotification(
          "Feeding time! 🍖",
          db.profile.name
            ? `Time for ${db.profile.name}’s meal ${slot + 1}.`
            : "Time to feed your pup!",
          "meal-reminder-" + slot,
        );
      }
      fired[key] = true;
      saveFired(fired);
    }
  }

  // Medication reminders: a daily nudge (09:00) while a medication course is
  // active (started, and not yet ended).
  if (config.medicationReminder?.enabled && h === 9 && m < 5) {
    const key = "med_" + todayStr;
    if (!fired[key]) {
      const active = db.vetRecords.medications.filter((med) => {
        if (med.start && new Date(med.start) > now) return false;
        if (med.end && new Date(med.end) < now) return false;
        return true;
      });
      active.forEach((med) => {
        sendNotification(
          "Medication reminder 💊",
          med.name + (med.dose ? " — " + med.dose : ""),
          "med-" + med.name,
        );
      });
      if (active.length > 0) {
        fired[key] = true;
        saveFired(fired);
      }
    }
  }

  // Vaccination reminders: notify one day before a vaccine's next-due date.
  if (config.vaccinationReminder?.enabled && h === 9 && m < 5) {
    const key = "vacc_" + todayStr;
    if (!fired[key]) {
      const dueSoon = db.vetRecords.vaccines.filter((v) => {
        if (!v.nextDue) return false;
        const diff = (new Date(v.nextDue).getTime() - now.getTime()) / 86400000;
        return diff >= 0 && diff <= 1;
      });
      dueSoon.forEach((v) => {
        sendNotification(
          "Vaccination due 💉",
          v.name + (v.nextDue ? " — due " + v.nextDue : ""),
          "vacc-" + v.name,
        );
      });
      if (dueSoon.length > 0) {
        fired[key] = true;
        saveFired(fired);
      }
    }
  }

  const vetKey = "vet_" + todayStr;
  if (config.vetReminder?.enabled && !fired[vetKey] && h === 9 && m < 5) {
    const upcoming = db.vetRecords.reminders.filter((r) => {
      if (!r.date) return false;
      const diff = (new Date(r.date).getTime() - now.getTime()) / 86400000;
      return diff >= 0 && diff <= 1;
    });
    upcoming.forEach((r) => {
      sendNotification("Vet reminder 🏥", r.title + (r.date ? " — " + r.date : ""), "vet-" + r.title);
    });
    if (upcoming.length > 0) {
      fired[vetKey] = true;
      saveFired(fired);
    }
  }
}
