import { motion, useReducedMotion, type Variants } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

// Subtle vertical fade — used when switching between the main tabs.
const verticalVariants: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

// Directional horizontal slide — used for step-by-step wizards (onboarding),
// so forward navigation moves left and going back moves right.
const horizontalVariants: Variants = {
  initial: (d: number) => ({ opacity: 0, x: 28 * (d || 1) }),
  animate: { opacity: 1, x: 0 },
  exit: (d: number) => ({ opacity: 0, x: -28 * (d || 1) }),
};

interface ScreenTransitionProps {
  children: React.ReactNode;
  /**
   * When provided, the screen slides horizontally in this direction
   * (1 = forward/next, -1 = back) — suited to step-by-step flows. Omit for the
   * default subtle vertical fade used when switching tabs.
   */
  direction?: number;
  style?: React.CSSProperties;
}

/**
 * Animated wrapper for a full-screen view. Place inside an `<AnimatePresence>`
 * with a `key` that changes per screen so the outgoing view animates out and
 * the incoming one animates in. Falls back to a static container when the user
 * prefers reduced motion.
 */
export function ScreenTransition({
  children,
  direction,
  style,
}: ScreenTransitionProps): React.ReactElement {
  const reduce = useReducedMotion();
  if (reduce) return <div style={style}>{children}</div>;

  const horizontal = direction !== undefined;
  return (
    <motion.div
      style={style}
      custom={direction ?? 0}
      variants={horizontal ? horizontalVariants : verticalVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.26, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
