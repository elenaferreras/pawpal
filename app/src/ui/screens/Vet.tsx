import type { ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { Badge } from "@astryxdesign/core/Badge";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { Header } from "../components/Header";
import { Icons } from "../lib/icons";
import { fmtDate } from "../lib/date";
import type { Priority } from "../types";

type IconComponent = (typeof Icons)[keyof typeof Icons];
type Accent = "success" | "warning" | "error" | "secondary";

interface VetProps {
  onAdd: () => void;
}

const PRIORITY_VARIANT: Record<Priority, "error" | "warning" | "success"> = {
  High: "error",
  Medium: "warning",
  Low: "success",
};

type Collection = "checkups" | "vaccines" | "reminders" | "medications";

export function Vet({ onAdd }: VetProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const { checkups, vaccines, reminders, medications } = db.vetRecords;

  const del = (collection: Collection, index: number): void => {
    if (!window.confirm("Delete this record?")) return;
    update((d) => {
      d.vetRecords[collection].splice(index, 1);
    });
    toast("Deleted");
  };

  const sortedReminders = reminders
    .map((r, index) => ({ r, index }))
    .sort((a, b) => new Date(a.r.date).getTime() - new Date(b.r.date).getTime());
  const sortedVaccines = vaccines
    .map((v, index) => ({ v, index }))
    .sort((a, b) => new Date(b.v.date).getTime() - new Date(a.v.date).getTime());
  const sortedCheckups = checkups
    .map((c, index) => ({ c, index }))
    .sort((a, b) => new Date(b.c.date).getTime() - new Date(a.c.date).getTime());

  return (
    <div className="screen">
      <Header
        title="Vet & Health"
        subtitle="Checkups, vaccines & meds"
        action={
          <IconButton label="Add record" variant="primary" icon={<Icon icon={Icons.plus} />} onClick={onAdd} />
        }
      />

      <SectionLabel>Reminders</SectionLabel>
      <Card padding={0}>
        {sortedReminders.length === 0 ? (
          <Empty icon={Icons.bell} text="No upcoming reminders." />
        ) : (
          <VStack gap={0}>
            {sortedReminders.map(({ r, index }, i) => (
              <RecordRow
                key={index}
                icon={Icons.bell}
                accent="secondary"
                isFirst={i === 0}
                title={r.title}
                meta={`${r.date ? fmtDate(r.date) : "No date set"}`}
                extra={<Badge variant={PRIORITY_VARIANT[r.priority]} label={`${r.priority} priority`} />}
                onDelete={() => del("reminders", index)}
              />
            ))}
          </VStack>
        )}
      </Card>

      <SectionLabel>Medications</SectionLabel>
      <Card padding={0}>
        {medications.length === 0 ? (
          <Empty icon={Icons.pill} text="No medications logged." />
        ) : (
          <VStack gap={0}>
            {medications.map((m, index) => {
              const daysLeft = m.end
                ? Math.ceil((new Date(m.end + "T12:00:00").getTime() - Date.now()) / 86400000)
                : null;
              const progress =
                m.days && m.start
                  ? Math.min(
                      100,
                      Math.round(
                        ((Date.now() - new Date(m.start + "T12:00:00").getTime()) / 86400000 / m.days) * 100,
                      ),
                    )
                  : 0;
              const urgent = daysLeft !== null && daysLeft <= 2;
              return (
                <VStack
                  key={index}
                  gap={2}
                  padding={3}
                  style={{ borderTop: index === 0 ? undefined : "1px solid var(--color-border, #eee)" }}
                >
                  <HStack gap={3} vAlign="start">
                    <IconDot icon={Icons.pill} accent="error" />
                    <VStack gap={0.5} style={{ flex: 1 }}>
                      <Text weight="medium">{m.name}</Text>
                      <Text type="supporting">
                        {m.dose} {m.freq ? `· ${m.freq}` : ""}
                      </Text>
                      {m.notes && <Text type="supporting">{m.notes}</Text>}
                    </VStack>
                    <IconButton
                      label="Delete medication"
                      size="sm"
                      variant="ghost"
                      icon={<Icon icon={Icons.x} />}
                      onClick={() => del("medications", index)}
                    />
                  </HStack>
                  {m.days > 0 ? (
                    <VStack gap={1}>
                      <HStack justify="between" vAlign="center">
                        <Text type="supporting">
                          {m.start ? fmtDate(m.start) : ""} → {m.end ? fmtDate(m.end) : ""}
                        </Text>
                        <Text type="supporting" color={urgent ? "accent" : "secondary"} weight="semibold">
                          {daysLeft !== null
                            ? daysLeft <= 0
                              ? "Completed"
                              : `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`
                            : "Ongoing"}
                        </Text>
                      </HStack>
                      <ProgressBar
                        label="Medication progress"
                        isLabelHidden
                        value={progress}
                        variant={urgent ? "error" : "warning"}
                      />
                    </VStack>
                  ) : (
                    <Text type="supporting">Ongoing — no end date</Text>
                  )}
                </VStack>
              );
            })}
          </VStack>
        )}
      </Card>

      <SectionLabel>Vaccinations</SectionLabel>
      <Card padding={0}>
        {sortedVaccines.length === 0 ? (
          <Empty icon={Icons.syringe} text="No vaccinations recorded." />
        ) : (
          <VStack gap={0}>
            {sortedVaccines.map(({ v, index }, i) => (
              <RecordRow
                key={index}
                icon={Icons.syringe}
                accent="secondary"
                isFirst={i === 0}
                title={v.name}
                meta={`${v.date ? `Given ${fmtDate(v.date)}` : ""}${v.nextDue ? ` · Next: ${fmtDate(v.nextDue)}` : ""}`}
                onDelete={() => del("vaccines", index)}
              />
            ))}
          </VStack>
        )}
      </Card>

      <SectionLabel>Checkups</SectionLabel>
      <Card padding={0}>
        {sortedCheckups.length === 0 ? (
          <Empty icon={Icons.clipboardText} text="No checkups recorded." />
        ) : (
          <VStack gap={0}>
            {sortedCheckups.map(({ c, index }, i) => (
              <RecordRow
                key={index}
                icon={Icons.clipboardText}
                accent="warning"
                isFirst={i === 0}
                title={c.reason}
                meta={`${c.date ? fmtDate(c.date) : ""}${c.clinic ? ` · ${c.clinic}` : ""}`}
                extra={
                  <>
                    {c.notes && <Text type="supporting">{c.notes}</Text>}
                    {c.hasFile && <Text type="supporting" color="accent">📎 {c.fileName}</Text>}
                  </>
                }
                onDelete={() => del("checkups", index)}
              />
            ))}
          </VStack>
        )}
      </Card>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }): React.ReactElement {
  return (
    <Text type="label" color="secondary" as="div" style={{ margin: "20px 0 8px" }}>
      {children}
    </Text>
  );
}

function IconDot({ icon, accent }: { icon: IconComponent; accent: Accent }): React.ReactElement {
  return (
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
      <Icon icon={icon} color={accent} />
    </span>
  );
}

function RecordRow({
  icon,
  accent,
  title,
  meta,
  extra,
  isFirst,
  onDelete,
}: {
  icon: IconComponent;
  accent: Accent;
  title: string;
  meta?: string;
  extra?: ReactNode;
  isFirst: boolean;
  onDelete: () => void;
}): React.ReactElement {
  return (
    <HStack
      gap={3}
      vAlign="start"
      padding={3}
      style={{ borderTop: isFirst ? undefined : "1px solid var(--color-border, #eee)" }}
    >
      <IconDot icon={icon} accent={accent} />
      <VStack gap={0.5} style={{ flex: 1 }}>
        <Text weight="medium">{title}</Text>
        {meta && <Text type="supporting">{meta}</Text>}
        {extra}
      </VStack>
      <IconButton label="Delete record" size="sm" variant="ghost" icon={<Icon icon={Icons.x} />} onClick={onDelete} />
    </HStack>
  );
}

function Empty({ icon, text }: { icon: IconComponent; text: string }): React.ReactElement {
  return (
    <VStack gap={2} hAlign="center" padding={6}>
      <Icon icon={icon} size="lg" color="disabled" />
      <Text type="supporting">{text}</Text>
    </VStack>
  );
}
