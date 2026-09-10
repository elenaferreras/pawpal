import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { PageTitle } from "./Typography";
import { Icons } from "../lib/icons";

type IconGlyph = (typeof Icons)[keyof typeof Icons];

interface TopBarProps {
  /** Centred inline title shown once collapsed; also the default large title. */
  title: string;
  /** Custom large-title content (e.g. the dashboard greeting). Defaults to the
   *  large title + optional {@link TopBarProps.action} in one row. */
  largeTitle?: ReactNode;
  /** Leading nav control in the compact bar — a back chevron or avatar. */
  leading?: ReactNode;
  /** Trailing nav control in the compact bar — a close ✕ or bell. */
  trailing?: ReactNode;
  /** Screen action rendered in the large-title row (e.g. a coloured + button). */
  action?: ReactNode;
}

/**
 * Shared iOS-style navigation bar. The large-title row (title + optional
 * coloured {@link TopBarProps.action}) is the resting header. A translucent
 * compact bar overlays the top as a zero-height sticky layer holding the nav
 * controls; on scroll it fades in a blur and the centred inline title.
 *
 * A sentinel at the bottom of the large title, watched by an IntersectionObserver
 * against the viewport, drives the collapse — so it works whether the page
 * scrolls the window (tab screens) or its own container (reveal overlays).
 */
export function TopBar({
  title,
  largeTitle,
  leading,
  trailing,
  action,
}: TopBarProps): React.ReactElement {
  const barRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const hasControls = Boolean(leading || trailing);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const barH = barRef.current?.offsetHeight ?? 44;
    const io = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      root: null,
      rootMargin: `-${barH}px 0px 0px 0px`,
      threshold: 0,
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <div className="topbar" data-collapsed={collapsed} data-controls={hasControls}>
      <div ref={barRef} className="topbar-bar">
        <div className="topbar-blur" aria-hidden="true">
          <div />
          <div />
          <div />
          <div />
        </div>
        <div className="topbar-lead">{leading}</div>
        <span className="topbar-inline">{title}</span>
        <div className="topbar-trail">{trailing}</div>
      </div>
      <div className="topbar-large">
        {largeTitle ?? (
          <div className="topbar-largerow">
            <PageTitle style={{ flex: 1, margin: 0 }}>{title}</PageTitle>
            {action}
          </div>
        )}
      </div>
      <div ref={sentinelRef} className="topbar-sentinel" aria-hidden="true" />
    </div>
  );
}

/**
 * Plain 44pt icon button for the {@link TopBar} nav slots — no background,
 * tinted via `color` (cream by default). Used for back / close / bell.
 */
export function TopBarAction({
  icon,
  label,
  onClick,
  color = "var(--color-pawpal-hero)",
  children,
}: {
  icon?: IconGlyph;
  label: string;
  onClick?: () => void;
  color?: string;
  children?: ReactNode;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="topbar-action"
      style={{ color }}
    >
      {children ?? (icon ? <Icon icon={icon} color="inherit" /> : null)}
    </button>
  );
}

/**
 * Filled, screen-tinted circular action button for the large-title row — a
 * coloured disc (`color`) with a darker glyph (`iconColor`, a darkened tint by
 * default). Used for the per-screen "+" add action.
 */
export function TopBarButton({
  icon,
  label,
  onClick,
  color,
  iconColor,
}: {
  icon: IconGlyph;
  label: string;
  onClick?: () => void;
  color: string;
  iconColor?: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="topbar-button"
      style={{ background: color, color: iconColor ?? "var(--color-pawpal-page)" }}
    >
      <Icon icon={icon} color="inherit" />
    </button>
  );
}
