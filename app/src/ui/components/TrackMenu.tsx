import { Icons } from "../lib/icons";

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
  colorVar: string;
  /** Position within the 321×254 cluster box (from Figma node 10:373). */
  x: number;
  y: number;
}

const BUBBLE = 116;

/**
 * "What do you want to track?" radial menu (Figma node 10:373).
 *
 * Full-screen black overlay shown when the dashboard FAB is tapped. Renders five
 * glowing colour bubbles (walk, meal, diary, poop, vet) clustered in the centre,
 * a cream title, and the FAB rotated 45° into an ✕ to close. Enter animations
 * use CSS keyframes (defined in global.css) so they play reliably on mount.
 */
export function TrackMenu({ open, onClose, onWalk, onMeal, onDiary, onPoop, onVet }: TrackMenuProps): React.ReactElement | null {
  const Plus = Icons.plus;

  if (!open) return null;

  const bubbles: (Bubble & { onSelect: () => void })[] = [
    { key: "walk", label: "walk", colorVar: "--color-track-walk", x: 32, y: 0, onSelect: onWalk },
    { key: "meal", label: "meal", colorVar: "--color-track-meal", x: 133, y: 12, onSelect: onMeal },
    { key: "diary", label: "diary", colorVar: "--color-track-diary", x: 205, y: 100, onSelect: onDiary },
    { key: "poop", label: "poop", colorVar: "--color-track-poop", x: 96, y: 138, onSelect: onPoop },
    { key: "vet", label: "vet", colorVar: "--color-track-vet", x: 0, y: 109, onSelect: onVet },
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
        background: "var(--color-pawpal-page)",
        animation: "pawpal-overlay-fade 220ms ease both",
      }}
    >
      <p
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: "calc(86px + env(safe-area-inset-top, 0px))",
          margin: 0,
          fontSize: 32,
          fontWeight: 900,
          lineHeight: "normal",
          color: "var(--color-pawpal-hero)",
        }}
      >
        What do you want to track?
      </p>

      {/* Bubble cluster */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: "translate(-50%, -50%)",
          width: 321,
          height: 254,
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
              fontWeight: 900,
              fontSize: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `radial-gradient(circle at 50% 45%, rgba(0,0,0,0.62) 24%, var(${b.colorVar}) 118%)`,
              boxShadow: `0 0 34px 4px color-mix(in srgb, var(${b.colorVar}) 45%, transparent)`,
              animation: `pawpal-bubble-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both`,
              animationDelay: `${i * 45}ms`,
            }}
          >
            {b.label}
          </button>
        ))}
      </div>

      {/* Close FAB — the plus rotated 45° into an ✕ */}
      <button
        type="button"
        aria-label="Close"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        style={{
          position: "absolute",
          left: "50%",
          bottom: "calc(96px + env(safe-area-inset-bottom, 20px))",
          transform: "translateX(-50%) rotate(45deg)",
          width: 64,
          height: 64,
          borderRadius: 100,
          border: "none",
          background: "var(--color-pawpal-fab)",
          color: "#000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          animation: "pawpal-fab-twist 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        <Plus size={32} />
      </button>
    </div>
  );
}
