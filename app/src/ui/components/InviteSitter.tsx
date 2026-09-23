import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { VStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "./Button";
import { MotionSheet } from "./MotionSheet";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { getCurrentUser } from "../lib/auth";
import { Icons } from "../lib/icons";
import { PanelTitle, PanelText } from "../screens/settings/shared";
import {
  createInvite,
  deleteInvite,
  formatCode,
  inviteStatus,
  listInvites,
  reactivateInvite,
  revokeInvite,
  sitterLink,
  updateInvite,
  type DurationPreset,
  type InviteRow,
} from "../lib/sitter";

const DURATIONS: { value: DurationPreset; label: string }[] = [
  { value: "tonight", label: "Until tonight" },
  { value: "24h", label: "24 hours" },
  { value: "3d", label: "3 days" },
  { value: "custom", label: "Custom" },
];

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** ISO timestamp → value for a <input type="datetime-local"> (local time). */
function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** Owner control to create, display and revoke dog-sitter invites. */
export function InviteSitter(): React.ReactElement {
  const { db } = useDb();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [loggedIn, setLoggedIn] = useState(() => !!getCurrentUser());

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<InviteRow | null>(null);
  const [reactivating, setReactivating] = useState<InviteRow | null>(null);
  const [preset, setPreset] = useState<DurationPreset>("tonight");
  const [alias, setAlias] = useState("");
  const [notes, setNotes] = useState("");
  const [customAt, setCustomAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailInvite, setDetailInvite] = useState<InviteRow | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Collapse the QR (and any open action menu) when a different code opens.
  useEffect(() => {
    setShowQr(false);
    setMenuOpen(false);
  }, [detailInvite?.id]);

  // Stay in sync with sign in / sign out (auth.ts dispatches "pawpal:auth").
  useEffect(() => {
    const onAuth = (): void => setLoggedIn(!!getCurrentUser());
    window.addEventListener("pawpal:auth", onAuth);
    return () => window.removeEventListener("pawpal:auth", onAuth);
  }, []);

  useEffect(() => {
    if (loggedIn) void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const refresh = async (): Promise<void> => {
    try {
      setInvites(await listInvites());
    } catch {
      /* ignore */
    }
  };

  const create = async (): Promise<void> => {
    setBusy(true);
    try {
      if (reactivating) {
        // Refresh name/notes if changed, then revive with a new expiry.
        await updateInvite(reactivating.id, {
          alias: alias.trim(),
          notes: notes.trim() || null,
        });
        await reactivateInvite(reactivating.id, preset, {
          customExpiresAt:
            preset === "custom" ? new Date(customAt).toISOString() : undefined,
        });
        setChoosing(false);
        setReactivating(null);
        const rows = await listInvites();
        setInvites(rows);
        setShowQr(false);
        setDetailInvite(rows.find((r) => r.id === reactivating.id) ?? null);
        toast("Sitter reactivated");
        return;
      }
      if (editing) {
        await updateInvite(editing.id, {
          alias: alias.trim(),
          notes: notes.trim() || null,
          durationPreset: preset,
          customExpiresAt:
            preset === "custom" ? new Date(customAt).toISOString() : undefined,
        });
        setChoosing(false);
        setEditing(null);
        const rows = await listInvites();
        setInvites(rows);
        toast("Invite updated");
        return;
      }
      const inv = await createInvite(preset, {
        customExpiresAt: preset === "custom" ? new Date(customAt).toISOString() : undefined,
        dogName: db.profile.name || undefined,
        alias: alias.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setChoosing(false);
      const rows = await listInvites();
      setInvites(rows);
      // Reveal the freshly created code in its detail sheet.
      setShowQr(false);
      setDetailInvite(rows.find((r) => r.id === inv.inviteId) ?? null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save invite.");
    } finally {
      setBusy(false);
    }
  };

  // Open the chooser sheet pre-filled to edit an existing invite's name/expiry.
  const openEdit = (inv: InviteRow): void => {
    setEditing(inv);
    setReactivating(null);
    setAlias(inv.alias ?? "");
    setNotes(inv.notes ?? "");
    setPreset("custom");
    setCustomAt(toLocalDatetime(inv.expires_at));
    setDetailInvite(null);
    setChoosing(true);
  };

  // Open the chooser to revive a spent invite with a fresh duration.
  const openReactivate = (inv: InviteRow): void => {
    setReactivating(inv);
    setEditing(null);
    setAlias(inv.alias ?? "");
    setNotes(inv.notes ?? "");
    setPreset("tonight");
    setCustomAt("");
    setDetailInvite(null);
    setChoosing(true);
  };

  const revoke = async (id: string): Promise<void> => {
    if (!window.confirm("End this sitter's access?")) return;
    try {
      await revokeInvite(id);
      setDetailInvite(null);
      void refresh();
      toast("Access ended");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not revoke.");
    }
  };

  const remove = async (id: string): Promise<void> => {
    if (!window.confirm("Delete this sitter permanently?")) return;
    try {
      await deleteInvite(id);
      setDetailInvite(null);
      void refresh();
      toast("Sitter deleted");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete.");
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
        <PanelTitle>Invite a sitter</PanelTitle>
        <PanelText>
          Sign in to your account (above) to share {db.profile.name || "your dog"} with a sitter.
        </PanelText>
      </VStack>
    );
  }

  const active = invites.filter((i) => inviteStatus(i) === "pending" || inviteStatus(i) === "active");
  const inactive = invites.filter(
    (i) => inviteStatus(i) === "expired" || inviteStatus(i) === "revoked",
  );

  // Keep the last-opened invite around so the detail sheet keeps its content
  // while MotionSheet plays its slide-out exit animation.
  const lastDetail = useRef<InviteRow | null>(null);
  if (detailInvite) lastDetail.current = detailInvite;
  const shownDetail = detailInvite ?? lastDetail.current;

  return (
    <VStack gap={3}>
      <VStack gap={0.5}>
        <PanelTitle>Invite a sitter</PanelTitle>
          <PanelText>
            Share a code so a sitter can log walks, meals and poops for{" "}
            {db.profile.name || "your dog"} — without seeing or changing anything else.
          </PanelText>
        </VStack>

        {/* Active invites — tap a code to reveal its actions */}
        {active.length > 0 && (
          <VStack gap={0.5}>
            <PanelText style={{ opacity: 0.8 }}>Active codes</PanelText>
            {active.map((inv) => (
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
                  <PanelText>
                    {inv.alias ? `${inv.alias} · ` : ""}
                    {inviteStatus(inv) === "active"
                      ? `In use${inv.claimed_by ? ` · ${inv.claimed_by}` : ""}`
                      : "Not used yet"}{" "}
                    · ends {fmtWhen(inv.expires_at)}
                  </PanelText>
                </span>
                <span className="invite-row-caret" aria-hidden>
                  <Icon icon={Icons.caretRight} color="inherit" />
                </span>
              </button>
            ))}
          </VStack>
        )}

        {/* New invite — opens the duration chooser sheet */}
        <Button
          label={active.length > 0 ? "New invite" : "Invite a sitter"}
          variant={active.length > 0 ? "secondary" : "primary"}
          onClick={() => {
            setEditing(null);
            setReactivating(null);
            setPreset("tonight");
            setAlias("");
            setNotes("");
            setChoosing(true);
          }}
          fullWidth
        />

        {/* Past codes — expired or revoked; can be reactivated or deleted */}
        {inactive.length > 0 && (
          <VStack gap={0.5}>
            <PanelText style={{ opacity: 0.8 }}>Past sitters</PanelText>
            {inactive.map((inv) => (
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
                  <PanelTitle>{inv.alias || formatCode(inv.code)}</PanelTitle>
                  <PanelText>
                    {inviteStatus(inv) === "revoked" ? "Access ended" : "Expired"}
                    {" · "}
                    {fmtWhen(inv.expires_at)}
                  </PanelText>
                </span>
                <span className="invite-row-caret" aria-hidden>
                  <Icon icon={Icons.caretRight} color="inherit" />
                </span>
              </button>
            ))}
          </VStack>
        )}

      {/* Invite detail — bottom sheet with the code + actions */}
      <MotionSheet
        open={!!detailInvite}
        onClose={() => setDetailInvite(null)}
        ariaLabel="Invite code"
        scrimClassName="walk-sheet-scrim"
        sheetClassName="chooser-sheet"
      >
        {shownDetail && (
            <VStack gap={2}>
              <VStack gap={0.5}>
                <PanelTitle>{shownDetail.alias || "Sitter code"}</PanelTitle>
                <PanelText>
                  {inviteStatus(shownDetail) === "revoked"
                    ? `Access ended · ${fmtWhen(shownDetail.expires_at)}`
                    : inviteStatus(shownDetail) === "expired"
                      ? `Expired · ${fmtWhen(shownDetail.expires_at)}`
                      : `${
                          inviteStatus(shownDetail) === "active"
                            ? `In use${shownDetail.claimed_by ? ` · ${shownDetail.claimed_by}` : ""}`
                            : "Not used yet"
                        } · ends ${fmtWhen(shownDetail.expires_at)}`}
                </PanelText>
              </VStack>

              {shownDetail.notes?.trim() && (
                <div className="invite-notes">
                  <PanelText style={{ opacity: 0.8, marginBottom: 4 }}>
                    Notes for the sitter
                  </PanelText>
                  <PanelText style={{ whiteSpace: "pre-wrap" }}>
                    {shownDetail.notes}
                  </PanelText>
                </div>
              )}

              {inviteStatus(shownDetail) !== "expired" &&
                inviteStatus(shownDetail) !== "revoked" && (
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
                      <div className="invite-code">{formatCode(shownDetail.code)}</div>
                      <button
                        type="button"
                        className="invite-kebab"
                        aria-label="Code actions"
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
                                  void copy(formatCode(shownDetail.code), "Code");
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
                                  void copy(sitterLink(shownDetail.code), "Link");
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
                          value={sitterLink(shownDetail.code)}
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

              {inviteStatus(shownDetail) === "expired" ||
              inviteStatus(shownDetail) === "revoked" ? (
                <>
                  <Button
                    label="Reactivate sitter"
                    variant="primary"
                    onClick={() => openReactivate(shownDetail)}
                    fullWidth
                  />
                  <Button
                    label="Delete sitter"
                    variant="destructive"
                    onClick={() => void remove(shownDetail.id)}
                    fullWidth
                  />
                </>
              ) : (
                <>
                  <Button
                    label="Edit name & duration"
                    variant="secondary"
                    onClick={() => openEdit(shownDetail)}
                    fullWidth
                  />
                  <Button
                    label="Revoke access"
                    variant="destructive"
                    onClick={() => void revoke(shownDetail.id)}
                    fullWidth
                  />
                </>
              )}
            </VStack>
        )}
      </MotionSheet>

      {/* Duration chooser — bottom sheet (create or edit) */}
      <MotionSheet
        open={choosing}
        onClose={() => {
          setChoosing(false);
          setEditing(null);
          setReactivating(null);
        }}
        ariaLabel={
          reactivating
            ? "Reactivate sitter"
            : editing
              ? "Edit invite"
              : "Choose invite duration"
        }
        scrimClassName="walk-sheet-scrim"
        sheetClassName="chooser-sheet"
      >
            <VStack gap={2}>
              <VStack gap={0.5}>
                <PanelTitle>
                  {reactivating ? "Reactivate" : editing ? "Edit invite" : "How long?"}
                </PanelTitle>
                <PanelText>
                  {reactivating
                    ? "Pick how long this sitter's renewed access should last."
                    : editing
                      ? "Update the sitter's name or when their access ends."
                      : "Pick how long the sitter's access should last."}
                </PanelText>
              </VStack>

              <div className="oba-input-wrap">
                <input
                  type="text"
                  className="oba-input"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Sitter's name (optional)"
                  aria-label="Sitter's name"
                  maxLength={40}
                  autoComplete="off"
                />
              </div>

              <div className="oba-input-wrap oba-input-wrap--textarea">
                <textarea
                  className="oba-input oba-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes for the sitter (feeding quirks, house rules, emergencies…)"
                  aria-label="Notes for the sitter"
                  maxLength={600}
                  rows={3}
                />
              </div>

              <div className="invite-durations">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    className={"invite-chip" + (preset === d.value ? " selected" : "")}
                    onClick={() => setPreset(d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {preset === "custom" && (
                <input
                  type="datetime-local"
                  className="invite-datetime"
                  value={customAt}
                  onChange={(e) => setCustomAt(e.target.value)}
                  aria-label="Custom expiry"
                />
              )}

              <VStack gap={1.5}>
                <Button
                  label={
                    reactivating
                      ? busy
                        ? "Reactivating…"
                        : "Reactivate sitter"
                      : editing
                        ? busy
                          ? "Saving…"
                          : "Save changes"
                        : busy
                          ? "Creating…"
                          : "Create invite"
                  }
                  variant="primary"
                  onClick={() => void create()}
                  isDisabled={busy || (preset === "custom" && !customAt)}
                  fullWidth
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onClick={() => {
                    setChoosing(false);
                    setEditing(null);
                    setReactivating(null);
                  }}
                  fullWidth
                />
              </VStack>
            </VStack>
      </MotionSheet>
      </VStack>
  );
}
