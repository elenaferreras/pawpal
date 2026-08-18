import { AnimatePresence, motion, useReducedMotion } from "motion/react";

interface MotionSheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  scrimClassName?: string;
  scrimStyle?: React.CSSProperties;
  sheetClassName?: string;
  sheetStyle?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Animated bottom-sheet shell shared by PawPal's sheets.
 *
 * Handles the scrim fade, a spring slide-up, drag-to-dismiss, and proper exit
 * animation via AnimatePresence. Respects prefers-reduced-motion by falling
 * back to a plain opacity fade and disabling drag. Callers keep their own
 * `open`/`onClose` API and pass the sheet's surface class or style.
 */
export function MotionSheet({
  open,
  onClose,
  ariaLabel,
  scrimClassName,
  scrimStyle,
  sheetClassName,
  sheetStyle,
  children,
}: MotionSheetProps): React.ReactElement {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={scrimClassName}
          style={scrimStyle}
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={sheetClassName}
            style={sheetStyle}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            onClick={(e) => e.stopPropagation()}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 340 }}
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
