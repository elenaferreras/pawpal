import { type ReactNode } from "react";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { useScrollLock } from "../lib/scrollLock";

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

// Astryx Dialog wrapper preserving the previous { open, title, onClose } API.
export function Modal({ open, title, onClose, children }: ModalProps): ReactNode {
  useScrollLock(open);
  if (!open) return null;

  const handleOpenChange = (isOpen: boolean): void => {
    if (!isOpen) onClose();
  };

  return (
    <Dialog isOpen={open} onOpenChange={handleOpenChange} purpose="form" width="min(560px, 94vw)">
      <Layout
        header={title ? <DialogHeader title={title} onOpenChange={handleOpenChange} /> : undefined}
        content={
          <LayoutContent>
            <div className="btn-surface-light">{children}</div>
          </LayoutContent>
        }
      />
    </Dialog>
  );
}
