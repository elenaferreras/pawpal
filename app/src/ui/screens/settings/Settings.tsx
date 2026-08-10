import { useEffect, useState } from "react";
import { useDb } from "../../lib/store";
import { calcAge } from "../../lib/date";
import { DogFace } from "../../avatar/DogAvatar";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../../lib/icons";
import { getCurrentUser, type AuthUser } from "../../lib/auth";
import { getLastSync } from "../../lib/supabase";
import type { ScreenId } from "../../types";
import { DARK, HERO, MUTED, GroupCard, SectionLabel, SettingsRow } from "./shared";

interface SettingsProps {
  onNavigate: (id: ScreenId) => void;
  onBack: () => void;
}

/**
 * Settings hub. A pinned pet header (taps into Profile Details) sits above a
 * grouped list of setting categories, each drilling into its own subpage.
 * Styled to match the new dashboard (dark page, cream accents, rounded cards).
 */
export function Settings({ onNavigate, onBack }: SettingsProps): React.ReactElement {
  const { db } = useDb();
  const p = db.profile;
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser);

  useEffect(() => {
    const onAuth = (): void => setUser(getCurrentUser());
    window.addEventListener("pawpal:auth", onAuth);
    return () => window.removeEventListener("pawpal:auth", onAuth);
  }, []);

  const age = calcAge(p.birthday);
  const petSub = [p.breed, age].filter(Boolean).join(" · ");
  const lastSync = getLastSync();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "calc(16px + env(safe-area-inset-top, 0px)) 16px 12px",
        }}
      >
        <button
          type="button"
          aria-label="Back"
          onClick={onBack}
          style={{
            width: 44,
            height: 44,
            marginLeft: -8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: HERO,
            flexShrink: 0,
          }}
        >
          <Icon icon={Icons.caretLeft} color="inherit" />
        </button>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 900,
            fontSize: 26,
            lineHeight: 1,
            color: HERO,
          }}
        >
          Settings
        </span>
      </div>

      <div style={{ padding: "4px 16px 0" }}>
        {/* Pinned pet header → Profile Details */}
        <button
          type="button"
          onClick={() => onNavigate("settings-profile")}
          aria-label="Profile details"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            width: "100%",
            textAlign: "left",
            background: HERO,
            borderRadius: 28,
            border: "none",
            padding: 16,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              overflow: "hidden",
              flexShrink: 0,
              background: p.avatar?.bg ?? "var(--color-dash-pooped)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {p.avatar ? (
              <DogFace avatar={p.avatar} size={64} />
            ) : (
              <span style={{ fontSize: 34 }}>{p.emoji || "🐕"}</span>
            )}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 900,
                fontSize: 22,
                lineHeight: 1.05,
                color: DARK,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.name || "My Dog"}
            </span>
            <span
              style={{
                fontFamily: "var(--font-ui)",
                fontWeight: 500,
                fontSize: 14,
                color: MUTED,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {petSub || "Set up your pet profile"}
            </span>
          </span>
          <span style={{ color: MUTED, display: "flex", flexShrink: 0 }}>
            <Icon icon={Icons.caretRight} color="inherit" />
          </span>
        </button>

        {/* General */}
        <SectionLabel>General</SectionLabel>
        <GroupCard>
          <SettingsRow
            isFirst
            icon={Icons.dog}
            iconBg="var(--color-dash-pooped)"
            label="Profile details"
            subtitle="Edit profile · add a pet"
            onClick={() => onNavigate("settings-profile")}
          />
          <SettingsRow
            icon={Icons.bell}
            iconBg="var(--color-dash-trained)"
            label="Notifications"
            subtitle="Walk, feeding & vet reminders"
            onClick={() => onNavigate("settings-notifications")}
          />
          <SettingsRow
            icon={Icons.user}
            iconBg="var(--color-dash-walk)"
            label="Account"
            subtitle={user ? user.email : "Sign in to back up your pup"}
            onClick={() => onNavigate("settings-account")}
          />
        </GroupCard>

        {/* Sharing & backup */}
        <SectionLabel>Sharing &amp; backup</SectionLabel>
        <GroupCard>
          <SettingsRow
            isFirst
            icon={Icons.pawPrint}
            iconBg="var(--color-track-diary)"
            label="Dog sitting"
            subtitle="Invite a sitter to help out"
            onClick={() => onNavigate("settings-sitting")}
          />
          <SettingsRow
            icon={Icons.refresh}
            iconBg="var(--color-track-notes)"
            label="Cloud sync"
            subtitle={lastSync ? `Last synced ${lastSync}` : "Auto-sync on"}
            onClick={() => onNavigate("settings-sync")}
          />
          <SettingsRow
            icon={Icons.download}
            iconBg="var(--color-track-poop)"
            label="Data"
            subtitle="Export or clear your data"
            onClick={() => onNavigate("settings-data")}
          />
        </GroupCard>
      </div>
    </div>
  );
}
