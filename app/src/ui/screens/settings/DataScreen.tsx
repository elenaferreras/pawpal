import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Button } from "@astryxdesign/core/Button";
import { useDb } from "../../lib/store";
import { useToast } from "../../lib/toast";
import { exportCSV, exportJSON } from "../../lib/export";
import { defaultDatabase } from "../../lib/storage";
import { SettingsPage, Panel } from "./shared";

/** Data subpage: export the database as JSON/CSV or clear everything. */
export function DataScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const { db, replace } = useDb();
  const toast = useToast();

  const clearAll = (): void => {
    if (!window.confirm("Clear ALL data? This cannot be undone.")) return;
    replace(defaultDatabase());
    toast("All data cleared");
  };

  return (
    <SettingsPage title="Data" onBack={onBack}>
      <Panel>
        <VStack gap={2}>
          <HStack gap={2}>
            <Button label="Export JSON" variant="secondary" onClick={() => exportJSON(db)} style={{ flex: 1 }} />
            <Button label="Export CSV" variant="secondary" onClick={() => exportCSV(db)} style={{ flex: 1 }} />
          </HStack>
          <Button label="Clear all data" variant="destructive" onClick={clearAll} style={{ width: "100%" }} />
        </VStack>
      </Panel>
    </SettingsPage>
  );
}
