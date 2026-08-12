import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
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

/** Owner control to create, display and revoke dog-sitter invites. */
export function InviteSitter(): React.ReactElement {
  const { db } = useDb();
  const toast = useToast();
  const [loggedIn, setLoggedIn] = useState(() => !!getCurrentUser());

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [choosing, setChoosing] = useState(false);
  const [preset, setPreset] = useState<DurationPreset>("tonight");
  const [customAt, setCustomAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [detailInvite, setDetailInvite] = useState<InviteRow | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Collapse the QR whenever a different code's detail sheet opens.
  useEffect(() => {
    setShowQr(false);
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
      const inv = await createInvite(preset, {
        customExpiresAt: preset === "custom" ? new Date(customAt).toISOString() : undefined,
        dogName: db.profile.name || undefined,
      });
      setChoosing(false);
      const rows = await listInvites();
      setInvites(rows);
      // Reveal the freshly created code in its detail sheet.
      setShowQr(false);
      setDetailInvite(rows.find((r) => r.id === inv.inviteId) ?? null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
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
            setPreset("tonight");
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
                <PanelTitle>Sitter code</PanelTitle>
                <PanelText>
                  {inviteStatus(detailInvite) === "active"
                    ? `In use${detailInvite.claimed_by ? ` · ${detailInvite.claimed_by}` : ""}`
                    : "Not used yet"}{" "}
                  · ends {fmtWhen(detailInvite.expires_at)}
                </PanelText>
              </VStack>

              <div className="invite-code" style={{ alignSelf: "center" }}>
                {formatCode(detailInvite.code)}
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

              <HStack gap={2} style={{ width: "100%" }}>
                <Button
                  label="Copy code"
                  variant="secondary"
                  onClick={() => void copy(formatCode(detailInvite.code), "Code")}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Button
                  label="Copy link"
                  variant="secondary"
                  onClick={() => void copy(sitterLink(detailInvite.code), "Link")}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </HStack>
              <Button
                label={showQr ? "Hide QR code" : "Show QR code"}
                variant="secondary"
                onClick={() => setShowQr((v) => !v)}
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

      {/* Duration chooser — bottom sheet */}
      {choosing && (
        <div className="walk-sheet-scrim" onClick={() => setChoosing(false)}>
          <div
            className="chooser-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Choose invite duration"
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
                <PanelTitle>How long?</PanelTitle>
                <PanelText>Pick how long the sitter's access should last.</PanelText>
              </VStack>

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
                  label={busy ? "Creating…" : "Create invite"}
                  variant="primary"
                  onClick={() => void create()}
                  isDisabled={busy || (preset === "custom" && !customAt)}
                  fullWidth
                />
                <Button
                  label="Cancel"
                  variant="ghost"
                  onClick={() => setChoosing(false)}
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
