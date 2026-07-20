import { useEffect, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

// Bottom-sheet modal matching the original overlay behaviour.
export function Modal({ open, title, onClose, children }: ModalProps): ReactNode {
  useEffect(() => {
    if (open) {
      document.body.classList.add("modal-open");
      return () => document.body.classList.remove("modal-open");
    }
    return undefined;
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-handle" onClick={onClose} />
        {title && <div className="modal-title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
