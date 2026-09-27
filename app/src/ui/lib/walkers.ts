// Walkers — the set of people a walk can be attributed to.
//
// Replaces the old hard-coded "Person A" / "Person B" toggle. A walker is the
// signed-in user ("You"), any co-owner (full shared access), or any dog-sitter
// (ephemeral, log-only) known from their invite alias. A walk stores the
// walker's display name in `Walk.assignee`.
import { useEffect, useState } from "react";
import type { Walk } from "../types";
import { getCurrentUser, getCurrentUserId, getOwnerName } from "./auth";
import { listCoOwnerInvites, type CoOwnerInviteRow } from "./coowner";
import { listInvites, inviteStatus } from "./sitter";
import { getRowKey } from "./supabase";

export type WalkerKind = "you" | "coowner" | "sitter";

export interface Walker {
  /** Display name — also the value stored in `Walk.assignee`. */
  name: string;
  kind: WalkerKind;
}

/** Display name for the signed-in user: their chosen owner name, else the
 * email local-part, else "You". */
export function myWalkerName(): string {
  const owner = getOwnerName();
  if (owner) return owner;
  const email = getCurrentUser()?.email?.trim();
  if (!email) return "You";
  const local = email.split("@")[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : "You";
}

/** Owner-chosen name if set, else the joined account's email, else a fallback. */
function coownerName(inv: CoOwnerInviteRow): string {
  return (inv.label || inv.claimed_by || "Co-owner").trim();
}

// ── Logger identity (who logged an entry) ───────────────────────────────────
// A day's activity is grouped per person: the owner, each co-owner, and each
// sitter get their own entry. `Walk.loggedBy` stores that person's stable id —
// an auth uid for owners/co-owners, an invite id for sitters.

/** Bucket id for old sitter entries logged before per-sitter attribution. */
const SITTER_LEGACY_ID = "sitter";

/** The signed-in user's logger id (owner or co-owner). Null when signed out. */
export function myLoggerId(): string | null {
  return getCurrentUserId();
}

/** The primary owner's uid, derived from the (possibly shared) data row key. */
export function primaryOwnerId(): string {
  return getRowKey().replace(/^user_/, "");
}

/** Who logged a walk, as a stable id. Un-attributed non-sitter walks predate
 *  per-logger tracking and belong to the primary owner. */
export function walkLoggerId(w: Walk): string {
  if (w.loggedBy) return w.loggedBy;
  if (w.by === "sitter") return SITTER_LEGACY_ID;
  return primaryOwnerId();
}

/** Whether a walk was logged by the current user (logger id `myId`). */
export function isMyWalk(w: Walk, myId: string | null): boolean {
  return myId != null && walkLoggerId(w) === myId;
}

function dedupe(list: Walker[]): Walker[] {
  const seen = new Set<string>();
  const out: Walker[] = [];
  for (const w of list) {
    const key = w.name.toLowerCase();
    if (!w.name || seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}

/**
 * The people a walk can be assigned to. "You" is always first (available
 * offline); co-owners and sitters are fetched from their invites once loaded.
 */
export function useWalkers(): { walkers: Walker[]; loaded: boolean } {
  const [extra, setExtra] = useState<Walker[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [coRows, sitRows] = await Promise.all([
        listCoOwnerInvites().catch(() => [] as CoOwnerInviteRow[]),
        listInvites().catch(() => []),
      ]);
      if (cancelled) return;
      const list: Walker[] = [];
      for (const inv of coRows) {
        if (inv.revoked_at) continue;
        list.push({ name: coownerName(inv), kind: "coowner" });
      }
      for (const inv of sitRows) {
        const alias = inv.alias?.trim();
        // Only sitters with a live (claimed, unexpired) session — not old or
        // pending invites.
        if (!alias || inviteStatus(inv) !== "active") continue;
        list.push({ name: alias, kind: "sitter" });
      }
      setExtra(list);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const walkers = dedupe([{ name: myWalkerName(), kind: "you" }, ...extra]);
  return { walkers, loaded };
}

const PALETTE = ["#9CCFFF", "#FFFF83", "#A9E7A7", "#EDD4FD", "#FFC49B", "#FF9BB0"];

/** Deterministic avatar colour + initial for a walker's name. */
export function walkerAvatar(name: string): { bg: string; initials: string } {
  // Preserve the look of the two legacy assignees for any un-migrated data.
  if (name === "Person A") return { bg: "#9CCFFF", initials: "A" };
  if (name === "Person B") return { bg: "#FFFF83", initials: "B" };
  const initials = name.trim().charAt(0).toUpperCase() || "?";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return { bg: PALETTE[h % PALETTE.length], initials };
}
