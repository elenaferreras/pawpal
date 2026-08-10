import { useDb } from "../../lib/store";
import { calcAge } from "../../lib/date";
import { DogFace } from "../../avatar/DogAvatar";
import { Icons } from "../../lib/icons";
import type { ScreenId } from "../../types";
import { DARK, HERO, MUTED, SURFACE, SettingsPage, SectionLabel, GroupCard, SettingsRow } from "./shared";

interface ProfileDetailsProps {
  onNavigate: (id: ScreenId) => void;
  onBack: () => void;
}

/** Profile Details subpage: pet summary, edit profile, and add-a-pet (coming soon). */
export function ProfileDetails({ onNavigate, onBack }: ProfileDetailsProps): React.ReactElement {
  const { db } = useDb();
  const p = db.profile;
  const age = calcAge(p.birthday);

  return (
    <SettingsPage title="Profile details" onBack={onBack}>
      {/* Pet summary */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          background: HERO,
          borderRadius: 28,
          padding: "24px 16px",
        }}
      >
        <span
          style={{
            width: 96,
            height: 96,
            borderRadius: "50%",
            overflow: "hidden",
            background: p.avatar?.bg ?? "var(--color-dash-pooped)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {p.avatar ? (
            <DogFace avatar={p.avatar} size={96} />
          ) : (
            <span style={{ fontSize: 52 }}>{p.emoji || "🐕"}</span>
          )}
        </span>
        <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 24, color: DARK }}>
          {p.name || "My Dog"}
        </span>
        <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 14, color: MUTED }}>
          {[p.breed, age].filter(Boolean).join(" · ") || "Tap Edit to set up your profile"}
        </span>
      </div>

      <SectionLabel>Details</SectionLabel>
      <GroupCard>
        <InfoRow label="Breed" value={p.breed || "—"} isFirst />
        <InfoRow label="Age" value={age || p.birthday || "—"} />
        <InfoRow label="Weight" value={p.weight ? `${p.weight} kg` : "—"} />
        <InfoRow label="Food goal" value={`${p.foodGoal || 300}g / day`} />
        <InfoRow label="Vet" value={p.vet || "—"} />
        <InfoRow label="Vet phone" value={p.vetPhone || "—"} />
      </GroupCard>

      <SectionLabel>Manage</SectionLabel>
      <GroupCard>
        <SettingsRow
          isFirst
          icon={Icons.pencilSimple}
          iconBg="var(--color-dash-pooped)"
          label="Edit profile"
          subtitle="Name, breed, food goal & vet"
          onClick={() => onNavigate("settings-profile-edit")}
        />
        <SettingsRow
          icon={Icons.plus}
          iconBg="var(--color-dash-trained)"
          label="Add a new pet"
          subtitle="Track more than one companion"
          badge="Coming soon"
          disabled
        />
      </GroupCard>
    </SettingsPage>
  );
}

function InfoRow({
  label,
  value,
  isFirst = false,
}: {
  label: string;
  value: string;
  isFirst?: boolean;
}): React.ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 16px",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.07)",
        background: SURFACE,
      }}
    >
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 500, fontSize: 15, color: MUTED }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 15, color: HERO }}>
        {value}
      </span>
    </div>
  );
}
