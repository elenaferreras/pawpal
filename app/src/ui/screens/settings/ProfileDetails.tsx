import type { ReactNode } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../../lib/store";
import { DogFace } from "../../avatar/DogAvatar";
import { Icons } from "../../lib/icons";
import { Button } from "../../components/Button";
import type { ScreenId } from "../../types";
import { HERO, MUTED, SettingsPage, SectionLabel } from "./shared";

interface ProfileDetailsProps {
  onNavigate: (id: ScreenId) => void;
  onBack: () => void;
}

const GROUP = "var(--color-settings-group)"; // #221D1A deep list surface

/** DD/MM/YYYY for the stored `YYYY-MM-DD` birthday, or an em dash if unset. */
function formatBirthday(value?: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return "—";
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
}

/**
 * Profile Details subpage (Figma node 180:3354): centred avatar with an EDIT
 * pill, then grouped label/value rows for the pet's details, and a Manage group.
 */
export function ProfileDetails({ onNavigate, onBack }: ProfileDetailsProps): React.ReactElement {
  const { db } = useDb();
  const p = db.profile;
  const edit = (): void => onNavigate("settings-profile-edit");

  const details: { label: string; value: string }[] = [
    { label: "Name", value: p.name || "—" },
    { label: "Birthday", value: formatBirthday(p.birthday) },
    { label: "Weight", value: p.weight ? `${p.weight} kg` : "—" },
    { label: "Food goal", value: `${p.foodGoal || 300}g / day` },
    { label: "Vet", value: p.vet || "—" },
  ];

  return (
    <SettingsPage title="Profile details" onBack={onBack}>
      {/* Avatar with an overlapping EDIT pill */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "8px 24px 0",
        }}
      >
        <span
          style={{
            width: 112,
            height: 112,
            borderRadius: "50%",
            overflow: "hidden",
            background: p.avatar?.bg ?? "var(--color-dash-pooped)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: -18,
          }}
        >
          {p.avatar ? (
            <DogFace avatar={p.avatar} size={112} />
          ) : (
            <span style={{ fontSize: 60 }}>{p.emoji || "🐕"}</span>
          )}
        </span>
        <Button
          variant="primary"
          label="Edit"
          onClick={edit}
          style={{
            minWidth: 0,
            padding: "8px 24px",
            fontSize: 16,
            fontWeight: 510,
            textTransform: "uppercase",
            position: "relative",
          }}
        />
      </div>

      <SectionLabel style={{ color: HERO, fontSize: 16, fontWeight: 510, margin: "20px 4px 8px" }}>
        Details
      </SectionLabel>
      <Group>
        {details.map((d) => (
          <DetailRow key={d.label} label={d.label} value={d.value} onClick={edit} />
        ))}
      </Group>

      <SectionLabel style={{ color: HERO, fontSize: 16, fontWeight: 510, margin: "20px 4px 8px" }}>
        Manage
      </SectionLabel>
      <Group>
        <DetailRow label="Add a new pet" value="Coming soon" muted />
      </Group>
    </SettingsPage>
  );
}

/** Deep rounded surface that groups a set of {@link DetailRow}s. */
function Group({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div
      style={{
        background: GROUP,
        borderRadius: 16,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {children}
    </div>
  );
}

/** A label + value row with a trailing chevron. Tappable when `onClick` is set. */
function DetailRow({
  label,
  value,
  onClick,
  muted = false,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  muted?: boolean;
}): React.ReactElement {
  const clickable = onClick != null;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        textAlign: "left",
        padding: 16,
        background: "none",
        border: "none",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          fontFamily: "var(--font-ui)",
          fontSize: 16,
          color: HERO,
        }}
      >
        <span style={{ whiteSpace: "nowrap" }}>{label}</span>
        <span
          style={{
            opacity: muted ? 0.5 : 0.8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {value}
        </span>
      </span>
      <span style={{ color: MUTED, display: "flex", flexShrink: 0 }}>
        <Icon icon={Icons.caretRight} color="inherit" />
      </span>
    </button>
  );
}
