// owner-share — primary-owner-only co-owner invite management (create / revoke).
// Requires the owner's Supabase access token in the Authorization header.
//
// A co-owner invite is single-use and never expires; revoking it also removes
// the co-owner's membership (revoking a claimed invite = removing that person).
//
// POST body:
//   { action: "create", dogName?: string, label?: string } → { inviteId, code }
//   { action: "rename", inviteId: string, label?: string } → { ok: true }
//   { action: "revoke", inviteId: string } → { ok: true }
import { generateCode, getUser, json, preflight, sb } from "../_shared/util.ts";

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
  const ownerRowKey = `user_${user.id}`;

  if (action === "create") {
    // Retry a couple of times on the (astronomically unlikely) code collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode(8);
      const res = await sb("coowner_invites", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify({
          owner_user_id: user.id,
          owner_row_key: ownerRowKey,
          dog_name: body.dogName ? String(body.dogName) : null,
          label: labelValue(body.label),
          code,
        }),
      });
      if (res.ok) {
        const [row] = (await res.json()) as Array<{ id: string }>;
        return json({ inviteId: row.id, code });
      }
      if (res.status !== 409) return json({ error: "create_failed" }, 500);
    }
    return json({ error: "create_failed" }, 500);
  }

  if (action === "rename") {
    const inviteId = body.inviteId ? String(body.inviteId) : "";
    if (!inviteId) return json({ error: "bad_request" }, 400);

    const res = await sb(
      `coowner_invites?id=eq.${inviteId}&owner_user_id=eq.${user.id}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({ label: labelValue(body.label) }),
      },
    );
    if (!res.ok) return json({ error: "rename_failed" }, 500);
    const rows = (await res.json()) as Array<unknown>;
    if (rows.length === 0) return json({ error: "not_found" }, 404);
    return json({ ok: true });
  }

  if (action === "revoke") {
    const inviteId = body.inviteId ? String(body.inviteId) : "";
    if (!inviteId) return json({ error: "bad_request" }, 400);

    // Only the owner may revoke their own invite. Read it back so we can also
    // tear down the membership of whoever claimed it.
    const res = await sb(
      `coowner_invites?id=eq.${inviteId}&owner_user_id=eq.${user.id}`,
      {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify({ revoked_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) return json({ error: "revoke_failed" }, 500);
    const rows = (await res.json()) as Array<{
      owner_row_key: string;
      claimed_user_id: string | null;
    }>;
    if (rows.length === 0) return json({ error: "not_found" }, 404);

    const claimedUserId = rows[0].claimed_user_id;
    if (claimedUserId) {
      await sb(
        `dog_members?row_key=eq.${rows[0].owner_row_key}&user_id=eq.${claimedUserId}`,
        { method: "DELETE" },
      );
    }
    return json({ ok: true });
  }

  return json({ error: "unknown_action" }, 400);
});

// Trim an owner-supplied co-owner name, capped, coercing empty → null (clears it).
function labelValue(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().slice(0, 60);
  return trimmed ? trimmed : null;
}
