import { Modal } from "./Modal";
import { useLiveWalk } from "./LiveWalk";

interface WalkChooserProps {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
}

export function WalkChooser({ open, onClose, onManual }: WalkChooserProps): React.ReactElement {
  const { start } = useLiveWalk();
  return (
    <Modal open={open} title="Log a walk" onClose={onClose}>
      <div style={{ padding: "0 18px" }}>
        <button
          className="btn btn-primary btn-full"
          style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => {
            onClose();
            start();
          }}
        >
          <i className="ph ph-map-pin" /> Start live walk
        </button>
        <button
          className="btn btn-secondary btn-full"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          onClick={() => {
            onClose();
            onManual();
          }}
        >
          <i className="ph ph-pencil-simple" /> Log manually
        </button>
      </div>
    </Modal>
  );
}
