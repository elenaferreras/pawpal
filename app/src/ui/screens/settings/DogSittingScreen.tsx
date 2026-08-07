import { InviteSitter } from "../../components/InviteSitter";
import { SettingsPage } from "./shared";

/** Dog sitting subpage: create, share and revoke sitter invites. */
export function DogSittingScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  return (
    <SettingsPage title="Dog sitting" onBack={onBack}>
      <InviteSitter />
    </SettingsPage>
  );
}
