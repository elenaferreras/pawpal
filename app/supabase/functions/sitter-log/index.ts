// sitter-log — a sitter appends an activity (walk / meal / bathroom) to the
// owner's data. The session token authorizes a narrow, append-only write; the
// service role performs it so the sitter never touches the owner's row directly.
//
// POST body: { token: string, entry: { type: "walk"|"meal"|"bathroom", data: object } }
//   → { ok: true, snapshot }   (snapshot = the owner's updated payload)
import { json, preflight, sb } from "../_shared/util.ts";
import { sendOwnerPush } from "../_shared/push.ts";

interface SessionRow {
  owner_row_key: string;
  permissions: { log?: boolean } & Record<string, unknown>;
  expires_at: string;
}

const ARRAY_FOR: Record<string, "walks" | "meals" | "bathroom"> = {
  walk: "walks",
  meal: "meals",
  bathroom: "bathroom",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: {
    token?: string;
    ping?: boolean;
    entry?: { type?: string; data?: unknown };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const token = String(body.token ?? "");
  if (!token) return json({ error: "bad_request" }, 400);

  // Heartbeat: the sitter app polls this to confirm its session is still alive.
  // Revoking an invite deletes the session row, so a revoked sitter gets
  // "no_session" here and is signed out even if they never log anything.
  if (body.ping) {
    const sRes = await sb(
      `sitter_sessions?token=eq.${token}&select=expires_at&limit=1`,
    );
    if (!sRes.ok) return json({ error: "lookup_failed" }, 500);
    const [row] = (await sRes.json()) as Array<{ expires_at: string }>;
    if (!row) return json({ error: "no_session" }, 401);
    if (new Date(row.expires_at) <= new Date()) {
      return json({ error: "session_expired" }, 410);
    }
    return json({ ok: true });
  }

  const type = String(body.entry?.type ?? "");
  const data = (body.entry?.data ?? {}) as Record<string, unknown>;
  const arrayKey = ARRAY_FOR[type];
  if (!arrayKey) return json({ error: "bad_request" }, 400);

  // Validate the session.
  const sRes = await sb(
    `sitter_sessions?token=eq.${token}&select=owner_row_key,permissions,expires_at&limit=1`,
  );
  if (!sRes.ok) return json({ error: "lookup_failed" }, 500);
  const [session] = (await sRes.json()) as SessionRow[];
  if (!session) return json({ error: "no_session" }, 401);
  if (new Date(session.expires_at) <= new Date()) {
    return json({ error: "session_expired" }, 410);
  }
  if (!session.permissions?.log) return json({ error: "forbidden" }, 403);

  // Read the owner's current payload.
  const pRes = await sb(
    `pawpal_data?id=eq.${session.owner_row_key}&select=payload&limit=1`,
  );
  if (!pRes.ok) return json({ error: "read_failed" }, 500);
  const pRows = (await pRes.json()) as Array<{ payload: Record<string, unknown> }>;
  const payload = pRows[0]?.payload ?? {};

  // Append the sanitized entry, tagged as sitter-created.
  const list = Array.isArray(payload[arrayKey])
    ? (payload[arrayKey] as unknown[])
    : [];
  const entry = {
    ...data,
    created: new Date().toISOString(),
    by: "sitter",
  };
  payload[arrayKey] = [...list, entry];

  // Write it back.
  const wRes = await sb("pawpal_data", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      id: session.owner_row_key,
      payload,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!wRes.ok) return json({ error: "write_failed" }, 500);

  // Notify the owner (best-effort) that their sitter logged something — this
  // reaches their phone even when the PawPal app is closed.
  const profile = (payload.profile ?? {}) as { name?: string };
  const dog = profile.name?.trim();
  const who = dog ? `${dog}'s sitter` : "Your sitter";
  const what =
    type === "walk"
      ? "logged a walk \u{1F43E}"
      : type === "meal"
        ? "logged a meal \u{1F356}"
        : "logged a bathroom break \u{1F4A9}";
  await sendOwnerPush(session.owner_row_key, {
    title: "Sitter update \u{1F43E}",
    body: `${who} ${what}.`,
    tag: "sitter-activity",
  });

  return json({ ok: true, snapshot: payload });
});
