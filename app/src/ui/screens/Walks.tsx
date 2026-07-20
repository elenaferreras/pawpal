import { useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { Icons } from "../lib/icons";
import { fmtDate, WEATHER_MAP } from "../lib/date";
import type { Walk } from "../types";

type Filter = "all" | "today" | "week";

interface WalksProps {
  onAdd: () => void;
  onEdit: (index: number) => void;
}

export function Walks({ onAdd, onEdit }: WalksProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");

  const todayStr = new Date().toISOString().split("T")[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const indexed = db.walks.map((w, index) => ({ w, index }));
  let list = [...indexed].sort(
    (a, b) => new Date(b.w.created || b.w.date).getTime() - new Date(a.w.created || a.w.date).getTime(),
  );
  if (filter === "today") list = list.filter(({ w }) => w.date === todayStr);
  if (filter === "week") list = list.filter(({ w }) => new Date(w.date) >= weekAgo);

  const avgSteps = db.walks.length
    ? Math.round(db.walks.reduce((a, w) => a + (parseInt(String(w.steps)) || 0), 0) / db.walks.length)
    : 0;

  const del = (index: number): void => {
    if (!window.confirm("Delete this walk?")) return;
    update((d) => {
      d.walks.splice(index, 1);
    });
    toast("Walk deleted");
  };

  return (
    <div className="screen">
      <Header
        title="Walks"
        subtitle={`${list.length} walk${list.length !== 1 ? "s" : ""} logged`}
        action={
          <IconButton label="Add walk" variant="primary" icon={<Icon icon={Icons.plus} />} onClick={onAdd} />
        }
      />

      <Grid columns={3} gap={2}>
        <Card padding={3}>
          <VStack gap={0.5} hAlign="center">
            <Heading level={4}>{db.walks.length}</Heading>
            <Text type="supporting">total</Text>
          </VStack>
        </Card>
        <Card padding={3}>
          <VStack gap={0.5} hAlign="center">
            <Heading level={4}>{avgSteps > 999 ? (avgSteps / 1000).toFixed(1) + "k" : avgSteps}</Heading>
            <Text type="supporting">avg steps</Text>
          </VStack>
        </Card>
        <Card padding={3}>
          <VStack gap={0.5} hAlign="center">
            <Heading level={4}>{db.walks.filter((w) => w.friends).length}</Heading>
            <Text type="supporting">with friends</Text>
          </VStack>
        </Card>
      </Grid>

      <div style={{ margin: "12px 0" }}>
        <SegmentedControl value={filter} onChange={(v) => setFilter(v as Filter)} label="Filter walks" layout="fill">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="today" label="Today" />
          <SegmentedControlItem value="week" label="This week" />
        </SegmentedControl>
      </div>

      <Card padding={0}>
        {list.length === 0 ? (
          <VStack gap={2} hAlign="center" padding={6}>
            <Icon icon={Icons.pawPrint} size="lg" color="disabled" />
            <Text type="supporting" style={{ textAlign: "center" }}>
              No walks logged yet.
              <br />
              Tap + to record your first walk!
            </Text>
          </VStack>
        ) : (
          <VStack gap={0}>
            {list.map(({ w, index }, i) => (
              <WalkRow
                key={index}
                walk={w}
                isFirst={i === 0}
                onEdit={() => onEdit(index)}
                onDelete={() => del(index)}
              />
            ))}
          </VStack>
        )}
      </Card>
    </div>
  );
}

function WalkRow({
  walk,
  isFirst,
  onEdit,
  onDelete,
}: {
  walk: Walk;
  isFirst: boolean;
  onEdit: () => void;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <HStack
      gap={3}
      vAlign="start"
      padding={3}
      style={{ borderTop: isFirst ? undefined : "1px solid var(--color-border, #eee)" }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 36,
          height: 36,
          borderRadius: 10,
          background: "var(--color-background-section, #f4f4f4)",
          flexShrink: 0,
        }}
      >
        <Icon icon={Icons.pawPrint} color="success" />
      </span>
      <VStack gap={1} style={{ flex: 1 }}>
        <Text weight="medium">
          {fmtDate(walk.date)}
          {walk.time ? ` at ${walk.time}` : ""}
        </Text>
        <Text type="supporting">
          {walk.duration ? `${walk.duration} min` : ""}
          {walk.steps ? ` · ${walk.steps} steps` : ""}
          {walk.distance ? ` · ${walk.distance}km` : ""}
          {walk.weather ? ` · ${WEATHER_MAP[walk.weather] || ""}` : ""}
        </Text>
        {(walk.pipi || walk.popo || walk.friends) && (
          <HStack gap={1} wrap="wrap">
            {walk.pipi && <Badge variant="blue" label="💧 pipi" />}
            {walk.popo && <Badge variant="orange" label="💩 popo" />}
            {walk.friends && <Badge variant="yellow" label="🐶 friends" />}
          </HStack>
        )}
        {walk.notes && <Text type="supporting">{walk.notes}</Text>}
      </VStack>
      <VStack gap={1} hAlign="end" style={{ flexShrink: 0 }}>
        <Button label="Edit" size="sm" variant="secondary" onClick={onEdit} />
        <IconButton label="Delete walk" size="sm" variant="ghost" icon={<Icon icon={Icons.x} />} onClick={onDelete} />
      </VStack>
    </HStack>
  );
}
