import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../../lib/icons";

// Dashboard design tokens (mirrors screens/Dashboard.tsx).
export const DARK = "var(--color-pawpal-page)"; // #352B25 page background
export const HERO = "var(--color-pawpal-hero)"; // cream
export const SURFACE = "var(--color-dash-surface)"; // #3E332C dark card
export const MUTED = "var(--color-pawpal-muted)"; // #8C8976

type LucideIcon = ComponentType<{ color?: string; size?: number }>;

/**
 * Full-screen wrapper for a Settings page. Dark page background, dashboard-style
 * header with a back chevron and a large cream title. Leaves room for the fixed
 * bottom navigation.
 */
export function SettingsPage({
  title,
  onBack,
  action,
  children,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
  children: ReactNode;
}): React.ReactElement {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: DARK,
        paddingBottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
      }}
    >
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
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        {action && <div style={{ marginLeft: "auto", flexShrink: 0 }}>{action}</div>}
      </div>
      <div style={{ padding: "4px 16px 0" }}>{children}</div>
    </div>
  );
}

/** Uppercase muted section label, tuned for the dark page background. */
export function SectionLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <div
      style={{
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: 1,
        color: MUTED,
        textTransform: "uppercase",
        margin: "20px 4px 8px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Rounded dark surface that groups a set of {@link SettingsRow}s. */
export function GroupCard({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <div style={{ background: SURFACE, borderRadius: 24, overflow: "hidden" }}>{children}</div>
  );
}

/** Padded dark surface card, the dark-theme replacement for the Astryx <Card>. */
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <div style={{ background: SURFACE, borderRadius: 24, padding: 16, ...style }}>{children}</div>
  );
}

/** Cream primary text used inside a {@link Panel}. */
export function PanelTitle({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 16,
        color: HERO,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Muted supporting text used inside a {@link Panel}. */
export function PanelText({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: "var(--font-ui)",
        fontWeight: 500,
        fontSize: 13,
        color: MUTED,
        ...style,
      }}
    >
      {children}
    </span>
  );
}


/**
 * A single tappable settings row: coloured icon chip, label + optional subtitle,
 * and a trailing chevron. Supports a disabled state with a "Coming soon" badge.
 */
export function SettingsRow({
  icon,
  iconBg,
  label,
  subtitle,
  onClick,
  disabled = false,
  badge,
  isFirst = false,
}: {
  icon: LucideIcon;
  iconBg: string;
  label: string;
  subtitle?: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  isFirst?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        textAlign: "left",
        padding: "14px 16px",
        background: "none",
        border: "none",
        borderTop: isFirst ? "none" : "1px solid rgba(255,255,255,0.07)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: iconBg,
          color: DARK,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon icon={icon} color="inherit" />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 16,
            color: HERO,
          }}
        >
          {label}
        </span>
        {subtitle && (
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontWeight: 500,
              fontSize: 13,
              color: MUTED,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {subtitle}
          </span>
        )}
      </span>
      {badge ? (
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: DARK,
            background: HERO,
            borderRadius: 100,
            padding: "4px 10px",
            flexShrink: 0,
          }}
        >
          {badge}
        </span>
      ) : (
        <span style={{ color: MUTED, display: "flex", flexShrink: 0 }}>
          <Icon icon={Icons.caretRight} color="inherit" />
        </span>
      )}
    </button>
  );
}
