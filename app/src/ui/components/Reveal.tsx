import { motion, useReducedMotion } from "motion/react";

interface RevealItemProps {
  /** Position in the list; drives a small staggered delay (capped). */
  index?: number;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * List row that fades + rises into view the first time it scrolls on screen.
 *
 * Each item reveals independently as the user scrolls (a lazy-reveal feel),
 * with a slight per-index stagger for rows already visible on mount. Respects
 * prefers-reduced-motion by rendering the row statically.
 */
export function RevealItem({
  index = 0,
  className,
  style,
  children,
}: RevealItemProps): React.ReactElement {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        type: "spring",
        damping: 26,
        stiffness: 320,
        delay: Math.min(index, 6) * 0.03,
      }}
    >
      {children}
    </motion.div>
  );
}
