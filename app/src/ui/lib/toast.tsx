import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ToastAction = { label: string; onClick: () => void };
type ToastFn = (message: string, action?: ToastAction) => void;

const ToastContext = createContext<ToastFn | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): ReactNode {
  const [message, setMessage] = useState<string>("");
  const [action, setAction] = useState<ToastAction | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback<ToastFn>((msg, act) => {
    setMessage(msg);
    setAction(act ?? null);
    setVisible(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), act ? 4500 : 2200);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={"notif" + (visible ? " show" : "")}>
        <span>{message}</span>
        {action && (
          <button
            type="button"
            className="notif-action"
            onClick={() => {
              action.onClick();
              setVisible(false);
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastFn {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
