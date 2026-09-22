// reminder-tick — scheduled reminder push sender.
//
// pg_cron invokes this once a minute (see supabase/reminder_prefs.sql). For each
// owner who enabled a reminder, it checks whether the current minute in the
// owner's own timezone is due and, if so, sends a Web Push — so reminders reach
// the phone even when the PawPal app is closed. Handles:
//   • meal   — per slot at its time, unless already fed today
//   • walk   — daily at a set time, unless a walk was logged today
//   • med    — 09:00, one push per active medication course
//   • vacc   — 09:00, one push per vaccine due within a day
//   • vet    — 09:00, one push per vet reminder due within a day
//
// Requires the same VAPID_* secrets as sitter-log, plus:
//   • CRON_SECRET — shared secret echoed by pg_cron in the x-cron-secret header
import { json, sb } from "../_shared/util.ts";
import { sendOwnerPush } from "../_shared/push.ts";

const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const HEALTH_HM = "09:00";

interface PrefRow {
  user_id: string;
  owner_row_key: string;
  meal_enabled: boolean;
  meal_times: string[];
  meals_per_day: number;
  walk_enabled: boolean;
  walk_time: string;
  med_enabled: boolean;
  vacc_enabled: boolean;
  vet_enabled: boolean;
  timezone: string;
}

interface MealEntry {
  date?: string;
  mealSlot?: number;
}
interface WalkEntry {
  date?: string;
}
interface Medication {
  name: string;
  dose?: string;
  start?: string;
  end?: string | null;
}
interface Vaccine {
  name: string;
  validUntil?: string;
  nextDue?: string;
}
interface VetReminder {
  title: string;
  date?: string;
}
interface Payload {
  meals?: MealEntry[];
  walks?: WalkEntry[];
  profile?: { name?: string };
  vetRecords?: {
    medications?: Medication[];
    vaccines?: Vaccine[];
    reminders?: VetReminder[];
  };
}

/** Current "HH:MM" and "YYYY-MM-DD" in the given IANA timezone. */
function nowInZone(tz: string): { hm: string; date: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return {
    hm: `${parts.hour}:${parts.minute}`,
    date: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

/** YYYY-MM-DD `days` after `iso`. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  // Only the scheduler (which knows the shared secret) may trigger this.
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  const res = await sb(
    "reminder_prefs?or=(meal_enabled.eq.true,walk_enabled.eq.true,med_enabled.eq.true,vacc_enabled.eq.true,vet_enabled.eq.true)&select=*",
  );
  if (!res.ok) return json({ error: "read_failed" }, 500);
  const prefs = (await res.json()) as PrefRow[];

  const utcDate = new Date().toISOString().split("T")[0];
  let sent = 0;

  await Promise.all(
    prefs.map(async (p) => {
      let clock: { hm: string; date: string };
      try {
        clock = nowInZone(p.timezone || "UTC");
      } catch {
        clock = nowInZone("UTC");
      }
      const isHealthTime = clock.hm === HEALTH_HM;

      // Which meal slots are due this minute.
      const mealTimes = Array.isArray(p.meal_times) ? p.meal_times : [];
      const mealCount = Math.min(p.meals_per_day || 4, mealTimes.length);
      const dueMealSlots: number[] = [];
      if (p.meal_enabled) {
        for (let slot = 0; slot < mealCount; slot++) {
          const t = mealTimes[slot];
          if (t && t.slice(0, 5) === clock.hm) dueMealSlots.push(slot);
        }
      }

      const walkDue =
        p.walk_enabled && (p.walk_time || "").slice(0, 5) === clock.hm;
      const healthDue =
        isHealthTime && (p.med_enabled || p.vacc_enabled || p.vet_enabled);

      // Nothing to do this minute — skip the payload fetch entirely.
      if (!dueMealSlots.length && !walkDue && !healthDue) return;

      const pRes = await sb(
        `pawpal_data?id=eq.${encodeURIComponent(p.owner_row_key)}&select=payload&limit=1`,
      );
      let payload: Payload = {};
      if (pRes.ok) {
        const rows = (await pRes.json()) as Array<{ payload: Payload }>;
        payload = rows[0]?.payload ?? {};
      }
      const dogName = payload.profile?.name?.trim() ?? "";

      // ── Meals ──────────────────────────────────────────────
      if (dueMealSlots.length) {
        // Meal logging stores `date` inconsistently (UTC in Food, local on
        // Dashboard), so accept either as "today".
        const meals = Array.isArray(payload.meals) ? payload.meals : [];
        const todaySet = new Set([clock.date, utcDate]);
        for (const slot of dueMealSlots) {
          const logged = meals.some(
            (m) => m.mealSlot === slot && m.date != null && todaySet.has(m.date),
          );
          if (logged) continue;
          await sendOwnerPush(`user_${p.user_id}`, {
            title: "Feeding time \u{1F356}",
            body: dogName
              ? `Time for ${dogName}'s meal ${slot + 1}.`
              : "Time to feed your pup!",
            // Same tag the in-app timer uses, so a foreground + push pair
            // collapse into one notification instead of showing twice.
            tag: `meal-reminder-${slot}`,
          });
          sent++;
        }
      }

      // ── Walk ───────────────────────────────────────────────
      if (walkDue) {
        const walks = Array.isArray(payload.walks) ? payload.walks : [];
        const walked = walks.some(
          (w) => w.date === clock.date || w.date === utcDate,
        );
        if (!walked) {
          await sendOwnerPush(`user_${p.user_id}`, {
            title: "Time for a walk! \u{1F43E}",
            body: dogName
              ? `${dogName} is waiting!`
              : "Your pup needs some exercise!",
            tag: "walk-reminder",
          });
          sent++;
        }
      }

      // ── Health (09:00) ─────────────────────────────────────
      if (healthDue) {
        const vet = payload.vetRecords ?? {};
        const tomorrow = addDays(clock.date, 1);

        if (p.med_enabled) {
          const meds = Array.isArray(vet.medications) ? vet.medications : [];
          for (const med of meds) {
            const start = med.start?.split("T")[0];
            const end = med.end?.split("T")[0];
            if (start && start > clock.date) continue; // not started
            if (end && end < clock.date) continue; // already ended
            await sendOwnerPush(`user_${p.user_id}`, {
              title: "Medication reminder",
              body: med.name + (med.dose ? ` — ${med.dose}` : ""),
              tag: `med-${med.name}`,
            });
            sent++;
          }
        }

        if (p.vacc_enabled) {
          const vaccines = Array.isArray(vet.vaccines) ? vet.vaccines : [];
          for (const v of vaccines) {
            const due = (v.validUntil ?? v.nextDue)?.split("T")[0];
            if (!due) continue;
            if (due !== clock.date && due !== tomorrow) continue;
            await sendOwnerPush(`user_${p.user_id}`, {
              title: "Vaccination due",
              body: v.name + (due ? ` — due ${due}` : ""),
              tag: `vacc-${v.name}`,
            });
            sent++;
          }
        }

        if (p.vet_enabled) {
          const reminders = Array.isArray(vet.reminders) ? vet.reminders : [];
          for (const r of reminders) {
            const due = r.date?.split("T")[0];
            if (!due) continue;
            if (due !== clock.date && due !== tomorrow) continue;
            await sendOwnerPush(`user_${p.user_id}`, {
              title: "Vet reminder",
              body: r.title + (r.date ? ` — ${due}` : ""),
              tag: `vet-${r.title}`,
            });
            sent++;
          }
        }
      }
    }),
  );

  return json({ ok: true, sent });
});
