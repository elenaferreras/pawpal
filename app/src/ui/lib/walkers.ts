// Walkers — the set of people a walk can be attributed to.
//
// Replaces the old hard-coded "Person A" / "Person B" toggle. A walker is the
// signed-in user ("You"), any co-owner (full shared access), or any dog-sitter
// (ephemeral, log-only) known from their invite alias. A walk stores the
// walker's display name in `Walk.assignee`.
import { useEffect, useState } from "react";
import { getCurrentUser, getOwnerName } from "./auth";
import { listCoOwnerInvites, type CoOwnerInviteRow } from "./coowner";
import { listInvites } from "./sitter";

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
        if (!alias || inv.revoked_at) continue;
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
