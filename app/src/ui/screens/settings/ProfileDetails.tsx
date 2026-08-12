import type { ReactNode } from "react";
import { useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { useDb } from "../../lib/store";
import { useToast } from "../../lib/toast";
import { DogFace } from "../../avatar/DogAvatar";
import { Icons } from "../../lib/icons";
import { Button } from "../../components/Button";
import { FieldEditSheet, type FieldEditType } from "../../components/FieldEditSheet";
import type { Profile, ScreenId } from "../../types";
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

/** A single editable profile field, driving both the list row and its sheet. */
interface EditableField {
  key: "name" | "birthday" | "weight" | "foodGoal" | "vet";
  label: string;
  /** Display value for the list row. */
  value: string;
  /** Raw value passed into the edit sheet's input. */
  editValue: string;
  type: FieldEditType;
  unit?: string;
  placeholder?: string;
}

/**
 * Profile Details subpage (Figma node 180:3354): centred avatar with an EDIT
 * pill, then grouped label/value rows for the pet's details, and a Manage group.
 * Tapping a detail row opens a bottom sheet to edit that single field.
 */
export function ProfileDetails({ onNavigate, onBack }: ProfileDetailsProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const p = db.profile;
  const edit = (): void => onNavigate("settings-profile-edit");
  const [editing, setEditing] = useState<EditableField["key"] | null>(null);

  const details: EditableField[] = [
    { key: "name", label: "Name", value: p.name || "—", editValue: p.name, type: "text" },
    {
      key: "birthday",
      label: "Birthday",
      value: formatBirthday(p.birthday),
      editValue: p.birthday || "",
      type: "date",
    },
    {
      key: "weight",
      label: "Weight",
      value: p.weight ? `${p.weight} kg` : "—",
      editValue: p.weight || "",
      type: "number",
      unit: "kg",
    },
    {
      key: "foodGoal",
      label: "Food goal",
      value: `${p.foodGoal || 300}g / day`,
      editValue: String(p.foodGoal || 300),
      type: "number",
      unit: "g / day",
    },
    { key: "vet", label: "Vet", value: p.vet || "—", editValue: p.vet, type: "text" },
  ];

  const activeField = details.find((d) => d.key === editing) ?? null;

  const saveField = (key: EditableField["key"], raw: string): void => {
    const value = raw.trim();
    update((d) => {
      const next: Profile = d.profile;
      if (key === "foodGoal") {
        next.foodGoal = parseInt(value, 10) || next.foodGoal;
      } else if (key === "weight") {
        next.weight = value;
      } else {
        next[key] = value;
      }
    });
    setEditing(null);
    toast("Profile saved! 🐾");
  };

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
          <DetailRow key={d.label} label={d.label} value={d.value} onClick={() => setEditing(d.key)} />
        ))}
      </Group>

      <SectionLabel style={{ color: HERO, fontSize: 16, fontWeight: 510, margin: "20px 4px 8px" }}>
        Manage
      </SectionLabel>
      <Group>
        <DetailRow label="Add a new pet" value="Coming soon" muted />
      </Group>

      <FieldEditSheet
        open={activeField != null}
        title={activeField?.label ?? ""}
        value={activeField?.editValue ?? ""}
        type={activeField?.type}
        unit={activeField?.unit}
        placeholder={activeField?.placeholder}
        onSave={(v) => activeField && saveField(activeField.key, v)}
        onClose={() => setEditing(null)}
      />
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
