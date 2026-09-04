// Co-owner sharing — client for the co-owner Edge Functions.
//
// Unlike a sitter (ephemeral, log-only, brokered), a co-owner is a second
// account with a persistent membership granting full, two-way access to the
// SAME pawpal_data row as the primary owner. The owner issues a single-use,
// non-expiring, revocable invite; the invitee joins with their own account.
import type { Avatar, Database } from "../types";
import {
  forceRefreshAccessToken,
  getCurrentUserId,
  getValidAccessToken,
} from "./auth";
import { formatCode } from "./sitter";
import { clearSharedRow, getSBConfig, setSharedRow } from "./supabase";

export { formatCode };

export interface CoOwnerInviteRow {
  id: string;
  owner_user_id: string;
  owner_row_key: string;
  dog_name: string | null;
  label: string | null;
  code: string;
  created_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  claimed_user_id: string | null;
  revoked_at: string | null;
}

export type CoOwnerInviteStatus = "pending" | "active" | "revoked";

export function coownerStatus(inv: CoOwnerInviteRow): CoOwnerInviteStatus {
  if (inv.revoked_at) return "revoked";
  return inv.claimed_at ? "active" : "pending";
}

/** Shareable link that deep-links the invitee straight to the join screen. */
export function coownerLink(code: string, dogName?: string, avatar?: Avatar): string {
  const base = window.location.origin + window.location.pathname;
  const dog = dogName?.trim() ? `&dog=${encodeURIComponent(dogName.trim())}` : "";
  let av = "";
  if (avatar) {
    try {
      av = `&av=${encodeURIComponent(JSON.stringify(avatar))}`;
    } catch {
      av = "";
    }
  }
  return `${base}?join=${encodeURIComponent(code)}${dog}${av}`;
}

/** Parse an avatar carried by an invite link (already percent-decoded JSON). */
export function parseAvatarParam(raw: string | null | undefined): Avatar | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as Avatar;
  } catch {
    return undefined;
  }
}

// ── Owner ───────────────────────────────────────────────────────────────────

function fnUrl(name: string): string {
  return `${getSBConfig().url}/functions/v1/${name}`;
}

async function ownerHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("You need to be signed in to invite a co-owner.");
  return {
    apikey: getSBConfig().key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// POST to owner-share as the owner, retrying once on a stale-token 401.
async function ownerPost(body: unknown): Promise<Response> {
  let res = await fetch(fnUrl("owner-share"), {
    method: "POST",
    headers: await ownerHeaders(),
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    const token = await forceRefreshAccessToken();
    if (!token) {
      throw new Error("Your session expired. Please sign in again to continue.");
    }
    res = await fetch(fnUrl("owner-share"), {
      method: "POST",
      headers: {
        apikey: getSBConfig().key,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }
  return res;
}

export interface CreatedCoOwnerInvite {
  inviteId: string;
  code: string;
}

export async function createCoOwnerInvite(
  dogName?: string,
  label?: string,
): Promise<CreatedCoOwnerInvite> {
  const res = await ownerPost({ action: "create", dogName, label });
  if (!res.ok) throw new Error((await errText(res)) || "Could not create invite.");
  return (await res.json()) as CreatedCoOwnerInvite;
}

/** Set (or clear, with an empty string) the owner-chosen name for a co-owner. */
export async function renameCoOwner(inviteId: string, label: string): Promise<void> {
  const res = await ownerPost({ action: "rename", inviteId, label });
  if (!res.ok) throw new Error((await errText(res)) || "Could not update the name.");
}

export async function revokeCoOwnerInvite(inviteId: string): Promise<void> {
  const res = await ownerPost({ action: "revoke", inviteId });
  if (!res.ok) throw new Error((await errText(res)) || "Could not remove access.");
}

/** List the owner's co-owner invites directly (RLS restricts to their rows). */
export async function listCoOwnerInvites(): Promise<CoOwnerInviteRow[]> {
  const uid = getCurrentUserId();
  const token = await getValidAccessToken();
  if (!uid || !token) return [];
  const cfg = getSBConfig();
  const res = await fetch(
    `${cfg.url}/rest/v1/coowner_invites?owner_user_id=eq.${uid}&order=created_at.desc`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as CoOwnerInviteRow[];
}

// ── Invitee (join) ────────────────────────────────────────────────────────

export interface JoinResult {
  ownerRowKey: string;
  ownerUserId: string;
  dogName: string | null;
  snapshot: Database | null;
}

/**
 * Redeem a co-owner code. Requires the invitee to be signed in. On success the
 * local sync is repointed at the shared row and the owner's snapshot returned.
 */
export async function joinAsCoOwner(code: string): Promise<JoinResult> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("Please sign in to join as a co-owner.");
  const res = await fetch(fnUrl("owner-join"), {
    method: "POST",
    headers: {
      apikey: getSBConfig().key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: code.replace(/[^0-9a-zA-Z]/g, "") }),
  });
  if (!res.ok) throw new Error(joinError(await errCode(res)));
  const out = (await res.json()) as {
    ownerRowKey: string;
    ownerUserId: string;
    dogName: string | null;
    snapshot: Database | null;
  };
  setSharedRow(out.ownerRowKey);
  return out;
}

/**
 * Resolve whether the signed-in account co-owns someone else's row, and keep
 * the local shared-row mapping in step. Returns the shared row key, or null.
 * Called on sign-in so a co-owner adopts the shared data on any device.
 */
export async function resolveMembership(): Promise<string | null> {
  const uid = getCurrentUserId();
  const token = await getValidAccessToken();
  if (!uid || !token) {
    clearSharedRow();
    return null;
  }
  const cfg = getSBConfig();
  const res = await fetch(
    `${cfg.url}/rest/v1/dog_members?user_id=eq.${uid}&select=row_key&limit=1`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null; // network/lookup blip — leave any mapping as-is
  const rows = (await res.json()) as Array<{ row_key: string }>;
  const rowKey = rows[0]?.row_key ?? null;
  if (rowKey) setSharedRow(rowKey);
  else clearSharedRow();
  return rowKey;
}

// ── Errors ──────────────────────────────────────────────────────────────────

async function errText(res: Response): Promise<string | null> {
  try {
    const j = (await res.json()) as { error?: string; message?: string };
    return j.message ?? j.error ?? null;
  } catch {
    return null;
  }
}

async function errCode(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? "";
  } catch {
    return "";
  }
}

function joinError(code: string): string {
  switch (code) {
    case "invalid_code":
      return "That code isn't valid. Double-check and try again.";
    case "revoked":
      return "This invite was turned off by the owner.";
    case "already_claimed":
      return "This invite has already been used.";
    case "self_join":
      return "You can't co-own with your own account.";
    case "unauthorized":
      return "Please sign in to join as a co-owner.";
    default:
      return "Couldn't join with that code. Please try again.";
  }
}
