import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";

interface MotionSheetProps {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  scrimClassName?: string;
  scrimStyle?: React.CSSProperties;
  sheetClassName?: string;
  sheetStyle?: React.CSSProperties;
  /** Hide the drag handle (grabber). Defaults to showing it. */
  hideHandle?: boolean;
  /** Compact header title that stays fixed above the scrolling body. */
  title?: React.ReactNode;
  /** Text colour for the header title. Defaults to the PawPal page brown. */
  titleColor?: string;
  /** Scrollable content rendered inside the unified sheet body. */
  body?: React.ReactNode;
  /** Pinned actions rendered in the fading footer over the body. */
  footer?: React.ReactNode;
  /** Custom content rendered directly in the sheet (bypasses body/footer). */
  children?: React.ReactNode;
}

/**
 * Animated bottom-sheet shell shared by PawPal's sheets.
 *
 * Handles the scrim fade, a spring slide-up, drag-to-dismiss, and proper exit
 * animation via AnimatePresence. Respects prefers-reduced-motion by falling
 * back to a plain opacity fade and disabling drag. Callers keep their own
 * `open`/`onClose` API and pass the sheet's surface class or style.
 *
 * Drag-to-dismiss is limited to the top grabber handle so scrolling inside the
 * sheet body never moves the sheet (matches the native iOS sheet grabber).
 */
export function MotionSheet({
  open,
  onClose,
  ariaLabel,
  scrimClassName,
  scrimStyle,
  sheetClassName,
  sheetStyle,
  hideHandle,
  title,
  titleColor,
  body,
  footer,
  children,
}: MotionSheetProps): React.ReactElement {
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();
  const showHandle = !reduceMotion && !hideHandle;
  const draggable = !reduceMotion;

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
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
          >
            {(showHandle || title != null) && (
              <div
                className="sheet-header"
                onPointerDown={draggable ? (e) => dragControls.start(e) : undefined}
                style={draggable ? { touchAction: "none" } : undefined}
              >
                {showHandle && <span className="sheet-grabber" aria-hidden="true" />}
                {title != null && (
                  <h2 className="sheet-title" style={titleColor ? { color: titleColor } : undefined}>
                    {title}
                  </h2>
                )}
              </div>
            )}
            {(body != null || footer != null) && (
              <div className="sheet-scroll">
                {body != null && <div className="sheet-body">{body}</div>}
                {footer != null && <div className="sheet-footer">{footer}</div>}
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
