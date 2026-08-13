// Web Push sender for the PawPal Edge Functions (Deno).
//
// Requires these function secrets:
//   • VAPID_PUBLIC_KEY   — public VAPID key (also embedded in the client)
//   • VAPID_PRIVATE_KEY  — private VAPID key (server-only)
//   • VAPID_SUBJECT      — a mailto: or https: contact for the push service
import webpush from "npm:web-push@3.6.7";
import { sb } from "./util.ts";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@pawpal.app";

let configured = false;
function ensureConfigured(): boolean {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  if (!configured) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  }
  return true;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
}

/** `user_<uuid>` → `<uuid>`, or null if the row key isn't an account row. */
export function ownerUserId(ownerRowKey: string): string | null {
  const m = /^user_(.+)$/.exec(ownerRowKey);
  return m ? m[1] : null;
}

/**
 * Deliver a push notification to every device the owner has registered. Fully
 * best-effort: never throws, and prunes subscriptions the push service reports
 * as gone (404/410).
 */
export async function sendOwnerPush(
  ownerRowKey: string,
  payload: PushPayload,
): Promise<void> {
  try {
    if (!ensureConfigured()) return;
    const uid = ownerUserId(ownerRowKey);
    if (!uid) return;

    const res = await sb(
      `push_subscriptions?user_id=eq.${uid}&select=endpoint,p256dh,auth`,
    );
    if (!res.ok) return;
    const subs = (await res.json()) as SubRow[];
    if (!subs.length) return;

    const body = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) {
            await sb(
              `push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`,
              { method: "DELETE" },
            );
          }
        }
      }),
    );
  } catch {
    // Never let push failures affect the caller.
  }
}
