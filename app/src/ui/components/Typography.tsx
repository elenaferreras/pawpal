import type { CSSProperties, ReactNode } from "react";

/**
 * Shared typography tokens. Centralises the repeated text styles across the
 * app so "things that should look the same" stay in sync from one place.
 */

/**
 * Canonical page-title style token. All top-level screen headers
 * ("{name}'s Walks", "{name}'s Meals", "{name}'s Health", "Settings")
 * render through this so they stay visually identical.
 *
 * SF (system) Bold 34 — HIG Large Title.
 */
export function PageTitle({
  children,
  color = "var(--color-pawpal-hero)",
  align = "left",
  style,
}: {
  children: ReactNode;
  /** Text colour — defaults to cream for dark backgrounds. */
  color?: string;
  align?: CSSProperties["textAlign"];
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <h1
      style={{
        margin: "16px 0 24px",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: 34,
        lineHeight: "41px",
        letterSpacing: -0.4,
        color,
        textAlign: align,
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

/** Small uppercase label — greetings, section eyebrows, stat captions. */
export function Eyebrow({
  children,
  color = "var(--color-pawpal-muted)",
  size = 14,
  tracking = 0,
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  tracking?: number;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <span
      style={{
        display: "flex",
        padding: "8px 16px 0 16px",
        alignItems: "center",
        alignSelf: "stretch",
        fontFamily: "var(--font-ui)",
        fontWeight: 700,
        fontSize: size,
        fontStyle: "normal",
        lineHeight: "normal",
        letterSpacing: tracking,
        color,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Brand card heading — the pastel action-card titles on the dashboard. */
export function CardTitle({
  children,
  color = "inherit",
  size = 24,
  weight = 900,
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  weight?: number;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: "var(--font-brand)",
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.1,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** Big brand display number — hero stats and walk counts. */
export function StatNumber({
  children,
  color = "inherit",
  size = 44,
  weight = 900,
  style,
}: {
  children: ReactNode;
  color?: string;
  size?: number;
  weight?: number;
  style?: CSSProperties;
}): React.ReactElement {
  return (
    <span
      style={{
        fontFamily: "var(--font-brand)",
        fontWeight: weight,
        fontSize: size,
        lineHeight: 1.1,
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

// ── SF (system) text scale, aligned to Apple HIG Dynamic Type ──────────────
// System-font tokens for functional UI. Brand display styles live above.

interface TextTokenProps {
  children: ReactNode;
  color?: string;
  weight?: number;
  style?: CSSProperties;
}

function makeText(defaultWeight: number, size: number, line: number) {
  return function TextToken({
    children,
    color = "inherit",
    weight = defaultWeight,
    style,
  }: TextTokenProps): React.ReactElement {
    return (
      <span
        style={{
          fontFamily: "var(--font-ui)",
          fontWeight: weight,
          fontSize: size,
          lineHeight: `${line}px`,
          color,
          ...style,
        }}
      >
        {children}
      </span>
    );
  };
}

/** 17 / Semibold — row titles and emphasized labels. */
export const Headline = makeText(600, 17, 22);
/** 17 / Regular — default body text and inputs. */
export const Body = makeText(400, 17, 22);
/** 16 / Regular — secondary body. */
export const Callout = makeText(400, 16, 21);
/** 15 / Regular — row subtitles. */
export const Subhead = makeText(400, 15, 20);
/** 13 / Regular — supporting text. */
export const Footnote = makeText(400, 13, 18);
/** 12 / Regular — captions. */
export const Caption = makeText(400, 12, 16);
