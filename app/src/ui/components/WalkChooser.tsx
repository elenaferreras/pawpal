import { Button } from "@astryxdesign/core/Button";
import { VStack } from "@astryxdesign/core/Stack";
import { Icon } from "@astryxdesign/core/Icon";
import { Modal } from "./Modal";
import { useLiveWalk } from "./LiveWalk";
import { Icons } from "../lib/icons";

interface WalkChooserProps {
  open: boolean;
  onClose: () => void;
  onManual: () => void;
}

export function WalkChooser({ open, onClose, onManual }: WalkChooserProps): React.ReactElement {
  const { start } = useLiveWalk();
  return (
    <Modal open={open} title="Log a walk" onClose={onClose}>
      <VStack gap={2}>
        <Button
          label="Start live walk"
          variant="primary"
          icon={<Icon icon={Icons.mapPin} />}
          onClick={() => {
            onClose();
            start();
          }}
          style={{ width: "100%" }}
        />
        <Button
          label="Log manually"
          variant="secondary"
          icon={<Icon icon={Icons.pencilSimple} />}
          onClick={() => {
            onClose();
            onManual();
          }}
          style={{ width: "100%" }}
        />
      </VStack>
    </Modal>
  );
}
