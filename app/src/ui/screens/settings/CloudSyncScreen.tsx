import { VStack } from "@astryxdesign/core/Stack";
import { Button } from "../../components/Button";
import { useDb } from "../../lib/store";
import { useToast } from "../../lib/toast";
import { getLastSync, syncFromSupabase } from "../../lib/supabase";
import { SettingsPage, Panel, PanelTitle, PanelText } from "./shared";

/** Cloud sync subpage: shows last sync time and lets the owner pull from cloud. */
export function CloudSyncScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const { db, replace } = useDb();
  const toast = useToast();

  const pull = async (): Promise<void> => {
    toast("Pulling from cloud…");
    try {
      const payload = await syncFromSupabase();
      if (!payload) {
        toast("No cloud data found for this device");
        return;
      }
      replace({ ...db, ...payload });
      toast("Data pulled ✓");
    } catch (e) {
      toast("Pull failed: " + (e instanceof Error ? e.message.slice(0, 40) : "error"));
    }
  };

  return (
    <SettingsPage title="Cloud sync" onBack={onBack}>
      <Panel>
        <VStack gap={3}>
          <VStack gap={0.5}>
            <PanelTitle>Auto-sync on ☁️</PanelTitle>
            <PanelText>
              {getLastSync() ? `Last synced: ${getLastSync()}` : "Not synced yet"}
            </PanelText>
          </VStack>
          <Button
            label="Pull from cloud"
            variant="secondary"
            onClick={() => void pull()}
            style={{ width: "100%" }}
          />
        </VStack>
      </Panel>
    </SettingsPage>
  );
}
