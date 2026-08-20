import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "../lib/scrollLock";

interface TrackMenuProps {
  open: boolean;
  onClose: () => void;
  onWalk: () => void;
  onMeal: () => void;
  onDiary: () => void;
  onPoop: () => void;
  onVet: () => void;
}

interface Bubble {
  key: string;
  label: string;
  /** Bubble colour, matched to each destination screen. */
  color: string;
  /** Position within the 321×254 cluster box (from Figma node 10:373). */
  x: number;
  y: number;
}

const BUBBLE = 116;

/** How long the exit animation runs before the overlay unmounts. */
const EXIT_MS = 360;

/**
 * "What do you want to track?" radial menu (Figma node 68:4612).
 *
 * Translucent, blurred overlay over the current page (the page stays visible,
 * dimmed) shown when the tab-bar FAB is tapped. Renders five glowing colour
 * bubbles (walks, meals, health, poop, diary) clustered above the bottom-right
 * FAB, with a soft yellow glow behind it. The tab-bar FAB itself rotates 45°
 * into an ✕ to close. Enter/exit use CSS keyframes (defined in global.css); on
 * close the overlay stays mounted through the exit so the FAB rotates back
 * from ✕ to + seamlessly.
 */
export function TrackMenu({ open, onClose, onWalk, onMeal, onDiary, onPoop, onVet }: TrackMenuProps): React.ReactElement | null {
  const [render, setRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (open) {
      setRender(true);
      setClosing(false);
      return;
    }
    // Closing: keep mounted through the exit animation, then unmount.
    setClosing(true);
    timer.current = setTimeout(() => setRender(false), EXIT_MS);
  }, [open]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  useScrollLock(open);

  if (!render) return null;

  const bubbles: (Bubble & { onSelect: () => void })[] = [
    { key: "walk", label: "walks", color: "#8592E0", x: 40, y: 0, onSelect: onWalk }, // blue
    { key: "meal", label: "meals", color: "#E96A41", x: 150, y: 14, onSelect: onMeal }, // red
    { key: "vet", label: "health", color: "#EDD4FD", x: 8, y: 88, onSelect: onVet }, // purple
    { key: "poop", label: "bathroom", color: "#3D8B6E", x: 82, y: 136, onSelect: onPoop }, // green
    { key: "diary", label: "diary", color: "#FFFF83", x: 162, y: 104, onSelect: onDiary }, // yellow
  ];

  const select = (fn: () => void): void => {
    onClose();
    fn();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="What do you want to track?"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        background: "rgba(0, 0, 0, 0.28)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: closing
          ? "pawpal-overlay-fade 240ms ease reverse forwards"
          : "pawpal-overlay-fade 220ms ease both",
      }}
    >
      {/* Soft yellow glow anchored on the bottom-right FAB. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: -70,
          bottom: "calc(-60px + var(--safe-bottom, 0px))",
          width: 260,
          height: 260,
          borderRadius: "50%",
          pointerEvents: "none",
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-pawpal-fab) 72%, transparent) 0%, transparent 62%)",
          animation: closing
            ? "pawpal-overlay-fade 240ms ease reverse forwards"
            : "pawpal-overlay-fade 260ms ease both",
        }}
      />

      {/* Bubble cluster — anchored above the bottom-right FAB. */}
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: "calc(72px + var(--safe-bottom, 0px))",
          width: 300,
          height: 248,
        }}
      >
        {bubbles.map((b, i) => (
          <button
            key={b.key}
            type="button"
            aria-label={b.label}
            onClick={(e) => {
              e.stopPropagation();
              select(b.onSelect);
            }}
            style={{
              position: "absolute",
              left: b.x,
              top: b.y,
              width: BUBBLE,
              height: BUBBLE,
              borderRadius: "50%",
              border: "none",
              cursor: "pointer",
              color: "#fff",
              fontWeight: 700,
              fontSize: 16,
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(circle at 50% 45%, rgba(0,0,0,0.62) 24%, ${b.color} 118%)`,
              boxShadow: `0 0 34px 4px color-mix(in srgb, ${b.color} 45%, transparent)`,
              animation: closing
                ? `pawpal-bubble-pop 220ms ease reverse forwards`
                : `pawpal-bubble-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both`,
              animationDelay: closing ? `${(bubbles.length - 1 - i) * 30}ms` : `${i * 45}ms`,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
