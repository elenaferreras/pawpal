import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";

export interface SwipeAction {
  /** Short label shown under the icon. */
  label: string;
  /** Optional icon element. */
  icon?: ReactNode;
  /** Background colour of the action button. */
  color: string;
  /** Foreground colour (label + icon). Defaults to white. */
  textColor?: string;
  /** Invoked when the action is tapped. The row auto-closes first. */
  onAction: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  /** Actions revealed when sliding left, laid out left→right in this order. */
  actions: SwipeAction[];
  /**
   * Solid background painted behind the sliding content so the actions stay
   * hidden while the row is closed. Match the surrounding list surface.
   */
  background: string;
  /** Applied to the outer clipping container (e.g. borderTop between rows). */
  style?: CSSProperties;
  /** Width of each revealed action button. */
  actionWidth?: number;
}

/**
 * iOS-style swipe-to-reveal row. Drag the content left to expose one or more
 * action buttons (Edit / Delete). Snaps open past the halfway point or on a
 * fast flick; tapping the open content — or an action — closes it again.
 */
export function SwipeableRow({
  children,
  actions,
  background,
  style,
  actionWidth = 78,
}: SwipeableRowProps): React.ReactElement {
  const reduce = useReducedMotion();
  const revealWidth = actions.length * actionWidth;
  const x = useMotionValue(0);
  const [open, setOpen] = useState(false);
  const draggingRef = useRef(false);

  const snapTo = (target: number): void => {
    animate(x, target, { type: "spring", damping: 42, stiffness: 520 });
    setOpen(target !== 0);
  };

  const runAction = (action: SwipeAction): void => {
    snapTo(0);
    action.onAction();
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", background, ...style }}>
      {/* Action layer sitting behind the sliding content. */}
      <div
        aria-hidden={!open}
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          justifyContent: "flex-end",
        }}
      >
        {actions.map((action, i) => (
          <button
            key={i}
            type="button"
            tabIndex={open ? 0 : -1}
            aria-label={action.label}
            onClick={() => runAction(action)}
            style={{
              width: actionWidth,
              border: "none",
              cursor: "pointer",
              background: action.color,
              color: action.textColor ?? "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Draggable content sitting on top of the actions. */}
      <motion.div
        drag={reduce ? false : "x"}
        style={{ x, background, position: "relative", touchAction: "pan-y" }}
        dragConstraints={{ left: -revealWidth, right: 0 }}
        dragElastic={{ left: 0.12, right: 0 }}
        dragDirectionLock
        onDragStart={() => {
          draggingRef.current = true;
        }}
        onDragEnd={(_, info) => {
          window.setTimeout(() => {
            draggingRef.current = false;
          }, 0);
          const flickOpen = info.velocity.x < -400;
          const flickClose = info.velocity.x > 400;
          const pastHalf = info.offset.x < -revealWidth / 2;
          snapTo(!flickClose && (flickOpen || pastHalf) ? -revealWidth : 0);
        }}
        onClickCapture={(e) => {
          // A tap toggles the row open/closed so the actions are discoverable
          // without needing to know the swipe gesture exists. A drag suppresses
          // its trailing click, so this only fires on genuine taps.
          if (draggingRef.current) return;
          const interactive = (e.target as HTMLElement).closest(
            "button, a, input, textarea, select, label, [role='button']",
          );
          if (interactive) {
            // Let controls inside the row handle their own tap; if the row is
            // open, just close it first instead of firing the control.
            if (open) {
              e.stopPropagation();
              e.preventDefault();
              snapTo(0);
            }
            return;
          }
          e.stopPropagation();
          e.preventDefault();
          snapTo(open ? 0 : -revealWidth);
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
