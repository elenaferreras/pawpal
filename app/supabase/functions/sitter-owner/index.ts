// sitter-owner — owner-only invite management (create / revoke).
// Requires the owner's Supabase access token in the Authorization header.
//
// POST body:
//   { action: "create", durationPreset: "tonight"|"24h"|"3d"|"custom",
//     customExpiresAt?: ISO, dogName?: string }
//     → { inviteId, code, expiresAt, permissions }
//   { action: "revoke", inviteId: string } → { ok: true }
import {
  durationToExpiry,
  generateCode,
  getUser,
  json,
  preflight,
  sb,
} from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const user = await getUser(req.headers.get("Authorization"));
  if (!user) return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const action = body.action;

  if (action === "create") {
    const expiresAt = durationToExpiry(
      String(body.durationPreset ?? ""),
      body.customExpiresAt ? String(body.customExpiresAt) : undefined,
    );
    if (!expiresAt) return json({ error: "invalid_duration" }, 400);

    const ownerRowKey = `user_${user.id}`;
    const permissions = { log: true };

    // Retry a couple of times on the (astronomically unlikely) code collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode(8);
      const res = await sb("sitter_invites", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({
          owner_user_id: user.id,
          owner_row_key: ownerRowKey,
          dog_name: body.dogName ? String(body.dogName) : null,
          code,
          permissions,
          expires_at: expiresAt,
        }),
      });
      if (res.ok) {
        const [row] = (await res.json()) as Array<{ id: string }>;
        return json({ inviteId: row.id, code, expiresAt, permissions });
      }
      if (res.status !== 409) {
        return json({ error: "create_failed" }, 500);
      }
    }
    return json({ error: "create_failed" }, 500);
  }

  if (action === "revoke") {
    const inviteId = body.inviteId ? String(body.inviteId) : "";
    if (!inviteId) return json({ error: "bad_request" }, 400);

    // Only the owner may revoke their own invite.
    const res = await sb(
      `sitter_invites?id=eq.${inviteId}&owner_user_id=eq.${user.id}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) return json({ error: "revoke_failed" }, 500);
    const rows = (await res.json()) as unknown[];
    if (rows.length === 0) return json({ error: "not_found" }, 404);

    // Kill any live sessions for this invite.
    await sb(`sitter_sessions?invite_id=eq.${inviteId}`, { method: "DELETE" });
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});
