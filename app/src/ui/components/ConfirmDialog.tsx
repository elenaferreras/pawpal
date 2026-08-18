import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export interface ConfirmOptions {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm button in the iOS destructive red style. */
  destructive?: boolean;
}

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Provides an imperative {@link useConfirm} hook that resolves to `true`/`false`.
 * Renders an iOS-style action-sheet confirmation, used for destructive actions
 * like deleting a walk, meal or record.
 */
export function ConfirmProvider({ children }: { children: ReactNode }): ReactNode {
  const reduce = useReducedMotion();
  const [state, setState] = useState<ConfirmState>({ open: false });
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setState({ open: true, ...opts });
    });
  }, []);

  const settle = useCallback((result: boolean): void => {
    resolver.current?.(result);
    resolver.current = null;
    setState((s) => ({ ...s, open: false }));
  }, []);

  const {
    open,
    title,
    message,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    destructive = true,
  } = state;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AnimatePresence>
        {open && (
          <motion.div
            className="confirm-scrim"
            onClick={() => settle(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="confirm-sheet"
              role="alertdialog"
              aria-modal="true"
              aria-label={title ?? confirmLabel}
              onClick={(e) => e.stopPropagation()}
              initial={reduce ? { opacity: 0 } : { y: "110%" }}
              animate={reduce ? { opacity: 1 } : { y: 0 }}
              exit={reduce ? { opacity: 0 } : { y: "110%" }}
              transition={{ type: "spring", damping: 34, stiffness: 360 }}
            >
              <div className="confirm-group">
                {(title || message) && (
                  <div className="confirm-info">
                    {title && <div className="confirm-title">{title}</div>}
                    {message && <div className="confirm-message">{message}</div>}
                  </div>
                )}
                <button
                  type="button"
                  className={"confirm-action" + (destructive ? " destructive" : "")}
                  onClick={() => settle(true)}
                >
                  {confirmLabel}
                </button>
              </div>
              <button type="button" className="confirm-cancel" onClick={() => settle(false)}>
                {cancelLabel}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
