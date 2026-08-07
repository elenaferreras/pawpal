// sitter-claim — a sitter redeems a code and receives an ephemeral session
// plus a read snapshot of the owner's dog data. No auth required (guests), but
// a signed-in user's email is recorded as the claimant label when provided.
//
// POST body: { code: string, claimant?: string }
//   → { token, expiresAt, permissions, dogName, ownerRowKey, snapshot }
import { getUser, json, preflight, randomToken, sb } from "../_shared/util.ts";

interface InviteRow {
  id: string;
  owner_row_key: string;
  dog_name: string | null;
  permissions: Record<string, unknown>;
  expires_at: string;
  claimed_at: string | null;
  revoked_at: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

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
    `sitter_invites?code=eq.${code}&select=id,owner_row_key,dog_name,permissions,expires_at,claimed_at,revoked_at&limit=1`,
  );
  if (!lookup.ok) return json({ error: "lookup_failed" }, 500);
  const [invite] = (await lookup.json()) as InviteRow[];

  if (!invite) return json({ error: "invalid_code" }, 404);
  if (invite.revoked_at) return json({ error: "revoked" }, 410);
  if (invite.claimed_at) return json({ error: "already_claimed" }, 409);
  if (new Date(invite.expires_at) <= new Date()) {
    return json({ error: "expired" }, 410);
  }

  // Record who claimed it (optional label from a signed-in sitter).
  const user = await getUser(req.headers.get("Authorization"));
  const claimedBy = user?.email
    ? user.email
    : body.claimant
    ? String(body.claimant)
    : "Guest device";

  // Mark claimed (guard against a race: only if still unclaimed).
  const mark = await sb(
    `sitter_invites?id=eq.${invite.id}&claimed_at=is.null&revoked_at=is.null`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: JSON.stringify({
        claimed_at: new Date().toISOString(),
        claimed_by: claimedBy,
      }),
    },
  );
  if (!mark.ok) return json({ error: "claim_failed" }, 500);
  const marked = (await mark.json()) as unknown[];
  if (marked.length === 0) return json({ error: "already_claimed" }, 409);

  // Create the ephemeral session (capped by the invite's own expiry).
  const token = randomToken();
  const sess = await sb("sitter_sessions", {
    method: "POST",
    body: JSON.stringify({
      token,
      invite_id: invite.id,
      owner_row_key: invite.owner_row_key,
      permissions: invite.permissions,
      expires_at: invite.expires_at,
    }),
  });
  if (!sess.ok) return json({ error: "session_failed" }, 500);

  // Read the owner's current data snapshot (service role bypasses RLS).
  const snapRes = await sb(
    `pawpal_data?id=eq.${invite.owner_row_key}&select=payload&limit=1`,
  );
  const rows = snapRes.ok
    ? ((await snapRes.json()) as Array<{ payload: unknown }>)
    : [];
  const snapshot = rows[0]?.payload ?? null;

  return json({
    token,
    expiresAt: invite.expires_at,
    permissions: invite.permissions,
    dogName: invite.dog_name,
    ownerRowKey: invite.owner_row_key,
    snapshot,
  });
});
