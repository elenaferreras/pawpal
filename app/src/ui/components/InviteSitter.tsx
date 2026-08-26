import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { VStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Button } from "./Button";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { getCurrentUser } from "../lib/auth";
import { Icons } from "../lib/icons";
import { PanelTitle, PanelText } from "../screens/settings/shared";
import {
  createInvite,
  formatCode,
  inviteStatus,
  listInvites,
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
    setAlias(inv.alias ?? "");
    setNotes(inv.notes ?? "");
    setPreset("custom");
    setCustomAt(toLocalDatetime(inv.expires_at));
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
            setPreset("tonight");
            setAlias("");
            setNotes("");
            setChoosing(true);
          }}
          fullWidth
        />

      {/* Invite detail — bottom sheet with the code + actions */}
      {detailInvite && (
        <div className="walk-sheet-scrim" onClick={() => setDetailInvite(null)}>
          <div
            className="chooser-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Invite code"
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
                <PanelTitle>{detailInvite.alias || "Sitter code"}</PanelTitle>
                <PanelText>
                  {inviteStatus(detailInvite) === "active"
                    ? `In use${detailInvite.claimed_by ? ` · ${detailInvite.claimed_by}` : ""}`
                    : "Not used yet"}{" "}
                  · ends {fmtWhen(detailInvite.expires_at)}
                </PanelText>
              </VStack>

              {detailInvite.notes?.trim() && (
                <div className="invite-notes">
                  <PanelText style={{ opacity: 0.8, marginBottom: 4 }}>
                    Notes for the sitter
                  </PanelText>
                  <PanelText style={{ whiteSpace: "pre-wrap" }}>
                    {detailInvite.notes}
                  </PanelText>
                </div>
              )}

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
                            void copy(sitterLink(detailInvite.code), "Link");
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
                    value={sitterLink(detailInvite.code)}
                    size={168}
                    level="M"
                    marginSize={2}
                    fgColor="#352b25"
                    bgColor="#ffffff"
                  />
                </div>
              )}

              <Button
                label="Edit name & duration"
                variant="secondary"
                onClick={() => openEdit(detailInvite)}
                fullWidth
              />
              <Button
                label="Revoke access"
                variant="destructive"
                onClick={() => void revoke(detailInvite.id)}
                fullWidth
              />
            </VStack>
          </div>
        </div>
      )}

      {/* Duration chooser — bottom sheet (create or edit) */}
      {choosing && (
        <div
          className="walk-sheet-scrim"
          onClick={() => {
            setChoosing(false);
            setEditing(null);
          }}
        >
          <div
            className="chooser-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={editing ? "Edit invite" : "Choose invite duration"}
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
                <PanelTitle>{editing ? "Edit invite" : "How long?"}</PanelTitle>
                <PanelText>
                  {editing
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
                    editing
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
                  }}
                  fullWidth
                />
              </VStack>
            </VStack>
          </div>
        </div>
      )}
      </VStack>
  );
}
