import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { useScrollLock } from "../lib/scrollLock";

const HERO = "var(--color-pawpal-hero)"; // cream
const MUTED = "var(--color-pawpal-muted)"; // muted label text

interface HealthDetailScreenProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional line under the title (e.g. counts). */
  subtitle?: ReactNode;
  /** Optional action rendered at the top-right of the header. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Full-screen Health detail overlay. Slides up over the app like a pushed
 * detail screen, with a back header and a scrolling body. Shared chrome for
 * every Health-hub card (notes, vaccines, weight, documents, reminders…).
 */
export function HealthDetailScreen({
  open,
  onClose,
  title,
  subtitle,
  action,
  children,
}: HealthDetailScreenProps): React.ReactElement {
  const reduceMotion = useReducedMotion();
  useScrollLock(open);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="health-detail-scrim"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
          animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
          transition={{ type: "spring", damping: 34, stiffness: 320 }}
        >
          {/* Compact nav header: glass back button, inline title + subtitle,
              optional glass action on the right. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "calc(12px + env(safe-area-inset-top, 0px)) 12px 12px",
            }}
          >
            <button type="button" aria-label="Back" className="glass-btn" onClick={onClose}>
              <Icon icon={Icons.caretLeft} color="inherit" />
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: "block",
                  fontFamily: "var(--font-ui)",
                  fontWeight: 700,
                  fontSize: 20,
                  color: HERO,
                }}
              >
                {title}
              </span>
              {subtitle && (
                <span
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontWeight: 500,
                    fontSize: 13,
                    color: MUTED,
                  }}
                >
                  {subtitle}
                </span>
              )}
            </div>
            {action && <div style={{ flexShrink: 0 }}>{action}</div>}
          </div>

          <div style={{ padding: "8px 16px calc(32px + env(safe-area-inset-bottom, 20px))" }}>
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
