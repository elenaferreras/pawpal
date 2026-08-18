import { motion, useReducedMotion } from "motion/react";

interface CircleRevealProps {
  /** Viewport-space origin of the reveal (e.g. the tapped avatar centre). */
  origin: { x: number; y: number } | null;
  children: React.ReactNode;
}

/**
 * Circular clip-path reveal overlay.
 *
 * Renders its children in a fixed, full-screen layer and animates a circular
 * `clip-path` mask growing from `origin` on enter and collapsing back to it on
 * exit — so the screen appears to spill out of (and back into) the element that
 * was tapped, with whatever is rendered behind it staying visible through the
 * mask. Falls back to a static overlay when the user prefers reduced motion.
 *
 * Place inside an `<AnimatePresence>` so the exit animation can play.
 */
export function CircleReveal({ origin, children }: CircleRevealProps): React.ReactElement {
  const reduce = useReducedMotion();
  const x = origin?.x ?? 44;
  const y = origin?.y ?? 80;
  // Radius large enough to reach every corner from the origin point.
  const radius =
    typeof window !== "undefined"
      ? Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y)) + 40
      : 2000;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 500,
    overflowY: "auto",
    willChange: "clip-path",
  };

  if (reduce) return <div style={overlayStyle}>{children}</div>;

  return (
    <motion.div
      style={overlayStyle}
      initial={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
      animate={{ clipPath: `circle(${radius}px at ${x}px ${y}px)` }}
      exit={{ clipPath: `circle(0px at ${x}px ${y}px)` }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
