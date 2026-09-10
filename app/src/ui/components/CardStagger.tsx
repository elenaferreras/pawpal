import { Children, isValidElement } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

// Staggered load-in shared by the main tab screens: each direct child fades and
// rises into place a beat after the previous one when the screen mounts.
const CONTAINER: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};
const ITEM: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

interface CardStaggerProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Wraps each top-level child in a staggered fade-and-rise so a screen's cards
 * animate in on mount. Falls back to a static container under reduced motion.
 */
export function CardStagger({ children, style, className }: CardStaggerProps): React.ReactElement {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      style={style}
      variants={CONTAINER}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
    >
      {Children.map(children, (child) =>
        isValidElement(child) ? <motion.div variants={ITEM}>{child}</motion.div> : child,
      )}
    </motion.div>
  );
}
