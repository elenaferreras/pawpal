import { CoOwnerShare } from "../../components/CoOwnerShare";
import { SettingsPage } from "./shared";

/** Co-owners subpage: invite, share and remove co-owners (full shared access). */
export function CoOwnersScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  return (
    <SettingsPage title="Co-owners" onBack={onBack}>
      <CoOwnerShare />
    </SettingsPage>
  );
}
