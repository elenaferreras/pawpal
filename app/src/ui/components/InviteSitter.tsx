import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Button } from "./Button";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { getCurrentUser } from "../lib/auth";
import { Panel, PanelTitle, PanelText } from "../screens/settings/shared";
import {
  createInvite,
  formatCode,
  inviteStatus,
  listInvites,
  revokeInvite,
  sitterLink,
  type CreatedInvite,
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
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [showQr, setShowQr] = useState(false);

  // Collapse the QR whenever a fresh invite is created (avoids a stale code).
  useEffect(() => {
    setShowQr(false);
  }, [created?.code]);

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
      setCreated(inv);
      setChoosing(false);
      void refresh();
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
      if (created?.inviteId === id) setCreated(null);
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
      <Panel>
        <VStack gap={1}>
          <PanelTitle>Invite a sitter</PanelTitle>
          <PanelText>
            Sign in to your account (above) to share {db.profile.name || "your dog"} with a sitter.
          </PanelText>
        </VStack>
      </Panel>
    );
  }

  const active = invites.filter((i) => inviteStatus(i) === "pending" || inviteStatus(i) === "active");

  return (
    <Panel>
      <VStack gap={3}>
        <VStack gap={0.5}>
          <PanelTitle>Invite a sitter</PanelTitle>
          <PanelText>
            Share a code so a sitter can log walks, meals and poops for{" "}
            {db.profile.name || "your dog"} — without seeing or changing anything else.
          </PanelText>
        </VStack>

        {/* Freshly created invite */}
        {created && (
          <div className="invite-code-card">
            <PanelText style={{ opacity: 0.8 }}>
              Share this code (expires {fmtWhen(created.expiresAt)})
            </PanelText>
            <div className="invite-code">{formatCode(created.code)}</div>
            {showQr && (
              <div className="invite-qr">
                <QRCodeSVG
                  value={sitterLink(created.code)}
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
                onClick={() => void copy(formatCode(created.code), "Code")}
                style={{ flex: 1 }}
              />
              <Button
                label="Copy link"
                variant="secondary"
                onClick={() => void copy(sitterLink(created.code), "Link")}
                style={{ flex: 1 }}
              />
            </HStack>
            <Button
              label={showQr ? "Hide QR code" : "Show QR code"}
              variant="secondary"
              onClick={() => setShowQr((v) => !v)}
              style={{ width: "100%" }}
            />
          </div>
        )}

        {/* Duration chooser */}
        {choosing ? (
          <VStack gap={2}>
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
            <HStack gap={2}>
              <Button
                label={busy ? "Creating…" : "Create invite"}
                variant="primary"
                onClick={() => void create()}
                isDisabled={busy || (preset === "custom" && !customAt)}
                style={{ flex: 1 }}
              />
              <Button label="Cancel" variant="ghost" onClick={() => setChoosing(false)} />
            </HStack>
          </VStack>
        ) : (
          <Button
            label={created ? "New invite" : "Invite a sitter"}
            variant={created ? "secondary" : "primary"}
            onClick={() => {
              setChoosing(true);
              setPreset("tonight");
            }}
            style={{ width: "100%" }}
          />
        )}

        {/* Active invites */}
        {active.length > 0 && (
          <VStack gap={1.5}>
            <PanelText style={{ opacity: 0.8 }}>
              Active
            </PanelText>
            {active.map((inv) => (
              <HStack key={inv.id} justify="between" vAlign="center" className="invite-row">
                <VStack gap={0}>
                  <PanelTitle>{formatCode(inv.code)}</PanelTitle>
                  <PanelText>
                    {inviteStatus(inv) === "active"
                      ? `In use${inv.claimed_by ? ` · ${inv.claimed_by}` : ""}`
                      : "Not used yet"}{" "}
                    · ends {fmtWhen(inv.expires_at)}
                  </PanelText>
                </VStack>
                <Button label="Revoke" size="sm" variant="ghost" onClick={() => void revoke(inv.id)} />
              </HStack>
            ))}
          </VStack>
        )}
      </VStack>
    </Panel>
  );
}
