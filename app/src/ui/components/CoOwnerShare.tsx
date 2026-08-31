import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { VStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "./Button";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { getCurrentUser } from "../lib/auth";
import { getSharedRowKey } from "../lib/supabase";
import { Icons } from "../lib/icons";
import { PanelTitle, PanelText } from "../screens/settings/shared";
import {
  coownerLink,
  coownerStatus,
  createCoOwnerInvite,
  formatCode,
  listCoOwnerInvites,
  revokeCoOwnerInvite,
  type CoOwnerInviteRow,
} from "../lib/coowner";

/** Owner control to invite, list and remove co-owners (full shared access). */
export function CoOwnerShare(): React.ReactElement {
  const { db } = useDb();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [loggedIn, setLoggedIn] = useState(() => !!getCurrentUser());
  const [isCoOwner, setIsCoOwner] = useState(() => !!getSharedRowKey());

  const [invites, setInvites] = useState<CoOwnerInviteRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [detailInvite, setDetailInvite] = useState<CoOwnerInviteRow | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setShowQr(false);
    setMenuOpen(false);
  }, [detailInvite?.id]);

  useEffect(() => {
    const onAuth = (): void => {
      setLoggedIn(!!getCurrentUser());
      setIsCoOwner(!!getSharedRowKey());
    };
    window.addEventListener("pawpal:auth", onAuth);
    return () => window.removeEventListener("pawpal:auth", onAuth);
  }, []);

  useEffect(() => {
    if (loggedIn && !isCoOwner) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, isCoOwner]);

  const refresh = async (): Promise<void> => {
    try {
      setInvites(await listCoOwnerInvites());
    } catch {
      /* ignore */
    }
  };

  const create = async (): Promise<void> => {
    setBusy(true);
    try {
      const inv = await createCoOwnerInvite(db.profile.name || undefined);
      const rows = await listCoOwnerInvites();
      setInvites(rows);
      setShowQr(false);
      setDetailInvite(rows.find((r) => r.id === inv.inviteId) ?? null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string, claimed: boolean): Promise<void> => {
    if (!window.confirm(claimed ? "Remove this co-owner's access?" : "Cancel this invite?")) {
      return;
    }
    try {
      await revokeCoOwnerInvite(id);
      setDetailInvite(null);
      void refresh();
      toast(claimed ? "Co-owner removed" : "Invite cancelled");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not remove access.");
    }
  };

  const copy = async (text: string, label: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${label} copied`);
    } catch {
      toast("Couldn't copy");
    }
  };

  if (!loggedIn) {
    return (
      <VStack gap={1}>
        <PanelTitle>Add a co-owner</PanelTitle>
        <PanelText>
          Sign in to your account (above) to share full access to{" "}
          {db.profile.name || "your dog"} with another owner.
        </PanelText>
      </VStack>
    );
  }

  if (isCoOwner) {
    return (
      <VStack gap={1}>
        <PanelTitle>Shared with you</PanelTitle>
        <PanelText>
          You're a co-owner of {db.profile.name || "this dog"} — you already have
          full access. Only the primary owner can invite more co-owners.
        </PanelText>
      </VStack>
    );
  }

  const live = invites.filter((i) => coownerStatus(i) !== "revoked");
  const coOwners = live.filter((i) => coownerStatus(i) === "active");
  const pending = live.filter((i) => coownerStatus(i) === "pending");

  return (
    <VStack gap={3}>
      <VStack gap={0.5}>
        <PanelTitle>Add a co-owner</PanelTitle>
        <PanelText>
          Share a link so another person can help care for{" "}
          {db.profile.name || "your dog"}. Co-owners have the same full access you
          do — every walk, meal and note stays in sync between you.
        </PanelText>
      </VStack>

      {coOwners.length > 0 && (
        <VStack gap={0.5}>
          <PanelText style={{ opacity: 0.8 }}>Co-owners</PanelText>
          {coOwners.map((inv) => (
            <button
              key={inv.id}
              type="button"
              className="invite-row-btn"
              onClick={() => {
                setShowQr(false);
                setDetailInvite(inv);
              }}
            >
              <span className="invite-row-info">
                <PanelTitle>{inv.claimed_by || "Co-owner"}</PanelTitle>
                <PanelText>Full access</PanelText>
              </span>
              <span className="invite-row-caret" aria-hidden>
                <Icon icon={Icons.caretRight} color="inherit" />
              </span>
            </button>
          ))}
        </VStack>
      )}

      {pending.length > 0 && (
        <VStack gap={0.5}>
          <PanelText style={{ opacity: 0.8 }}>Pending invites</PanelText>
          {pending.map((inv) => (
            <button
              key={inv.id}
              type="button"
              className="invite-row-btn"
              onClick={() => {
                setShowQr(false);
                setDetailInvite(inv);
              }}
            >
              <span className="invite-row-info">
                <PanelTitle>{formatCode(inv.code)}</PanelTitle>
                <PanelText>Not accepted yet</PanelText>
              </span>
              <span className="invite-row-caret" aria-hidden>
                <Icon icon={Icons.caretRight} color="inherit" />
              </span>
            </button>
          ))}
        </VStack>
      )}

      <Button
        label={live.length > 0 ? "New invite" : "Invite a co-owner"}
        variant={live.length > 0 ? "secondary" : "primary"}
        onClick={() => void create()}
        isDisabled={busy}
        fullWidth
      />

      {/* Invite detail — bottom sheet with the code + actions */}
      {detailInvite && (
        <div className="walk-sheet-scrim" onClick={() => setDetailInvite(null)}>
          <div
            className="chooser-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Co-owner invite"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden
              style={{
                width: 36,
                height: 5,
                borderRadius: 100,
                background: "rgba(233,228,196,0.3)",
                alignSelf: "center",
                marginBottom: 20,
              }}
            />
            <VStack gap={2}>
              <VStack gap={0.5}>
                <PanelTitle>
                  {coownerStatus(detailInvite) === "active"
                    ? detailInvite.claimed_by || "Co-owner"
                    : "Co-owner invite"}
                </PanelTitle>
                <PanelText>
                  {coownerStatus(detailInvite) === "active"
                    ? "Full access · already joined"
                    : "Share this link or code. It works once and never expires."}
                </PanelText>
              </VStack>

              {coownerStatus(detailInvite) === "pending" && (
                <>
                  <div
                    style={{
                      alignSelf: "center",
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <div className="invite-code">{formatCode(detailInvite.code)}</div>
                    <button
                      type="button"
                      className="invite-kebab"
                      aria-label="Invite actions"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((v) => !v)}
                    >
                      <Icon icon={Icons.moreVertical} color="inherit" />
                    </button>

                    <AnimatePresence>
                      {menuOpen && (
                        <>
                          <div
                            className="ios-menu-scrim"
                            onClick={() => setMenuOpen(false)}
                          />
                          <motion.div
                            className="ios-menu"
                            role="menu"
                            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                            transition={{ type: "spring", stiffness: 500, damping: 32 }}
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="ios-menu-item"
                              onClick={() => {
                                setMenuOpen(false);
                                void copy(
                                  coownerLink(detailInvite.code, db.profile.name, db.profile.avatar),
                                  "Link",
                                );
                              }}
                            >
                              <span>Copy link</span>
                              <Icon icon={Icons.link} color="inherit" />
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="ios-menu-item"
                              onClick={() => {
                                setMenuOpen(false);
                                void copy(formatCode(detailInvite.code), "Code");
                              }}
                            >
                              <span>Copy code</span>
                              <Icon icon={Icons.copy} color="inherit" />
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="ios-menu-item"
                              onClick={() => {
                                setMenuOpen(false);
                                setShowQr((v) => !v);
                              }}
                            >
                              <span>{showQr ? "Hide QR code" : "Show QR code"}</span>
                              <Icon icon={Icons.qrCode} color="inherit" />
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {showQr && (
                    <div className="invite-qr" style={{ alignSelf: "center" }}>
                      <QRCodeSVG
                        value={coownerLink(detailInvite.code, db.profile.name, db.profile.avatar)}
                        size={168}
                        level="M"
                        marginSize={2}
                        fgColor="#352b25"
                        bgColor="#ffffff"
                      />
                    </div>
                  )}
                </>
              )}

              <Button
                label={
                  coownerStatus(detailInvite) === "active"
                    ? "Remove co-owner"
                    : "Cancel invite"
                }
                variant="destructive"
                onClick={() =>
                  void revoke(detailInvite.id, coownerStatus(detailInvite) === "active")
                }
                fullWidth
              />
            </VStack>
          </div>
        </div>
      )}
    </VStack>
  );
}
