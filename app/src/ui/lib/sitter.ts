// Dog-sitter (guest) sharing — client for the sitter Edge Functions.
//
// Owner side: create / list / revoke short-lived invite codes.
// Sitter side: claim a code for an ephemeral, log-only session over the
// owner's dog, and append activities through the server broker.
import type { BathroomLog, Database, Meal, Walk } from "../types";
import { getSBConfig } from "./supabase";
import { getCurrentUserId, getValidAccessToken } from "./auth";

const SITTER_SESSION_KEY = "pawpal_sitter";

function fnUrl(name: string): string {
  return `${getSBConfig().url}/functions/v1/${name}`;
}

export type DurationPreset = "tonight" | "24h" | "3d" | "custom";

export interface CreatedInvite {
  inviteId: string;
  code: string;
  expiresAt: string;
  permissions: { log: boolean };
}

export interface InviteRow {
  id: string;
  code: string;
  dog_name: string | null;
  permissions: { log?: boolean };
  created_at: string;
  expires_at: string;
  claimed_at: string | null;
  claimed_by: string | null;
  revoked_at: string | null;
}

export type InviteStatus = "pending" | "active" | "expired" | "revoked";

export function inviteStatus(inv: InviteRow): InviteStatus {
  if (inv.revoked_at) return "revoked";
  if (new Date(inv.expires_at) <= new Date()) return "expired";
  return inv.claimed_at ? "active" : "pending";
}

/** Group an 8-char code as XXXX-XXXX for display. */
export function formatCode(code: string): string {
  const c = code.toUpperCase();
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
}

/** Shareable link that deep-links the sitter straight to the claim screen. */
export function sitterLink(code: string): string {
  const base = window.location.origin + window.location.pathname;
  return `${base}?sit=${encodeURIComponent(code)}`;
}

// ── Owner ───────────────────────────────────────────────────────────────────

async function ownerHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  if (!token) throw new Error("You need to be signed in to invite a sitter.");
  return {
    apikey: getSBConfig().key,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function createInvite(
  durationPreset: DurationPreset,
  opts: { customExpiresAt?: string; dogName?: string } = {},
): Promise<CreatedInvite> {
  const res = await fetch(fnUrl("sitter-owner"), {
    method: "POST",
    headers: await ownerHeaders(),
    body: JSON.stringify({
      action: "create",
      durationPreset,
      customExpiresAt: opts.customExpiresAt,
      dogName: opts.dogName,
    }),
  });
  if (!res.ok) throw new Error((await errText(res)) || "Could not create invite.");
  return (await res.json()) as CreatedInvite;
}

export async function revokeInvite(inviteId: string): Promise<void> {
  const res = await fetch(fnUrl("sitter-owner"), {
    method: "POST",
    headers: await ownerHeaders(),
    body: JSON.stringify({ action: "revoke", inviteId }),
  });
  if (!res.ok) throw new Error((await errText(res)) || "Could not revoke invite.");
}

/** List the owner's invites directly (RLS restricts to their own rows). */
export async function listInvites(): Promise<InviteRow[]> {
  const uid = getCurrentUserId();
  const token = await getValidAccessToken();
  if (!uid || !token) return [];
  const cfg = getSBConfig();
  const res = await fetch(
    `${cfg.url}/rest/v1/sitter_invites?owner_user_id=eq.${uid}&order=created_at.desc`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  return (await res.json()) as InviteRow[];
}

// ── Sitter ──────────────────────────────────────────────────────────────────

export interface SitterSession {
  token: string;
  expiresAt: string;
  permissions: { log?: boolean };
  dogName: string | null;
  ownerRowKey: string;
}

export interface SitterState {
  session: SitterSession;
  snapshot: Database;
}

export type SitterEntry =
  | { type: "walk"; data: Partial<Walk> }
  | { type: "meal"; data: Partial<Meal> }
  | { type: "bathroom"; data: Partial<BathroomLog> };

export async function claimInvite(
  code: string,
  claimant?: string,
): Promise<SitterState> {
  const token = await getValidAccessToken();
  const headers: Record<string, string> = {
    apikey: getSBConfig().key,
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(fnUrl("sitter-claim"), {
    method: "POST",
    headers,
    body: JSON.stringify({ code: code.replace(/[^0-9a-zA-Z]/g, ""), claimant }),
  });
  if (!res.ok) throw new Error(claimError(await errCode(res)));
  const out = (await res.json()) as {
    token: string;
    expiresAt: string;
    permissions: { log?: boolean };
    dogName: string | null;
    ownerRowKey: string;
    snapshot: Database | null;
  };
  const state: SitterState = {
    session: {
      token: out.token,
      expiresAt: out.expiresAt,
      permissions: out.permissions,
      dogName: out.dogName,
      ownerRowKey: out.ownerRowKey,
    },
    snapshot: out.snapshot ?? ({} as Database),
  };
  return state;
}

/** Append an activity to the owner's data; returns the refreshed snapshot. */
export async function sitterLog(
  token: string,
  entry: SitterEntry,
): Promise<Database> {
  const res = await fetch(fnUrl("sitter-log"), {
    method: "POST",
    headers: { apikey: getSBConfig().key, "Content-Type": "application/json" },
    body: JSON.stringify({ token, entry }),
  });
  if (!res.ok) throw new Error((await errText(res)) || "Could not save. Try again.");
  const out = (await res.json()) as { snapshot: Database };
  return out.snapshot;
}

/**
 * Confirm a sitter session is still valid on the server. Returns `false` once
 * the owner has revoked the invite (session deleted) or it has expired, so the
 * sitter app can sign the guest out promptly. Network errors return `true` to
 * avoid kicking a sitter out over a transient blip.
 */
export async function validateSitterSession(token: string): Promise<boolean> {
  try {
    const res = await fetch(fnUrl("sitter-log"), {
      method: "POST",
      headers: { apikey: getSBConfig().key, "Content-Type": "application/json" },
      body: JSON.stringify({ token, ping: true }),
    });
    if (res.ok) return true;
    // Session gone (revoked) or expired → end the guest session.
    if (res.status === 401 || res.status === 410) return false;
    return true;
  } catch {
    return true;
  }
}

// ── Ephemeral session persistence (sessionStorage; cleared on tab close) ─────

export function saveSitterSession(state: SitterState): void {
  try {
    sessionStorage.setItem(SITTER_SESSION_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadSitterSession(): SitterState | null {
  try {
    const raw = sessionStorage.getItem(SITTER_SESSION_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as SitterState;
    if (new Date(state.session.expiresAt) <= new Date()) {
      clearSitterSession();
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

export function clearSitterSession(): void {
  try {
    sessionStorage.removeItem(SITTER_SESSION_KEY);
  } catch {
    /* ignore */
  }
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

function claimError(code: string): string {
  switch (code) {
    case "invalid_code":
      return "That code isn't valid. Double-check and try again.";
    case "expired":
      return "This invite has expired. Ask the owner for a new one.";
    case "revoked":
      return "This invite was turned off by the owner.";
    case "already_claimed":
      return "This invite has already been used.";
    default:
      return "Couldn't join with that code. Please try again.";
  }
}
