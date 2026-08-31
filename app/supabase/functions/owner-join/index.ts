// owner-join — an invitee redeems a co-owner code and gains persistent, full
// access to the primary owner's dog data. AUTH REQUIRED: a co-owner must have
// their own account, so we can key their access via a membership row + RLS.
//
// POST body: { code: string }
//   → { ownerRowKey, ownerUserId, dogName, snapshot }
import { getUser, json, preflight, sb } from "../_shared/util.ts";

interface InviteRow {
  id: string;
  owner_user_id: string;
  owner_row_key: string;
  dog_name: string | null;
  claimed_at: string | null;
  revoked_at: string | null;
}

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

  const code = String(body.code ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (code.length < 6) return json({ error: "invalid_code" }, 400);

  // Look up the invite by code.
  const lookup = await sb(
    `coowner_invites?code=eq.${code}&select=id,owner_user_id,owner_row_key,dog_name,claimed_at,revoked_at&limit=1`,
  );
  if (!lookup.ok) return json({ error: "lookup_failed" }, 500);
  const [invite] = (await lookup.json()) as InviteRow[];

  if (!invite) return json({ error: "invalid_code" }, 404);
  if (invite.revoked_at) return json({ error: "revoked" }, 410);
  if (invite.claimed_at) return json({ error: "already_claimed" }, 409);
  if (invite.owner_user_id === user.id) return json({ error: "self_join" }, 409);

  // Mark claimed (guard against a race: only if still unclaimed).
  const mark = await sb(
    `coowner_invites?id=eq.${invite.id}&claimed_at=is.null&revoked_at=is.null`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({
        claimed_at: new Date().toISOString(),
        claimed_by: user.email ?? "Co-owner",
        claimed_user_id: user.id,
      }),
    },
  );
  if (!mark.ok) return json({ error: "join_failed" }, 500);
  const marked = (await mark.json()) as unknown[];
  if (marked.length === 0) return json({ error: "already_claimed" }, 409);

  // Record the membership (idempotent on the composite key).
  const member = await sb("dog_members", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: JSON.stringify({
      row_key: invite.owner_row_key,
      user_id: user.id,
      role: "coowner",
    }),
  });
  if (!member.ok) return json({ error: "join_failed" }, 500);

  // Read the owner's current data snapshot (service role bypasses RLS).
  const snapRes = await sb(
    `pawpal_data?id=eq.${invite.owner_row_key}&select=payload&limit=1`,
  );
  const rows = snapRes.ok
    ? ((await snapRes.json()) as Array<{ payload: unknown }>)
    : [];
  const snapshot = rows[0]?.payload ?? null;

  return json({
    ownerRowKey: invite.owner_row_key,
    ownerUserId: invite.owner_user_id,
    dogName: invite.dog_name,
    snapshot,
  });
});
