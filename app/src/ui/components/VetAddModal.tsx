import { useEffect, useMemo, useState } from "react";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Grid } from "@astryxdesign/core/Grid";
import { Text } from "@astryxdesign/core/Text";
import { Card } from "@astryxdesign/core/Card";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Modal } from "./Modal";
import { DateField } from "./fields";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { fmtDate } from "../lib/date";
import type { Checkup, Medication, Priority, Reminder, Vaccine } from "../types";

type RecordType = "checkup" | "vaccine" | "reminder" | "medication";

const FREQS = ["Once a day", "Twice a day", "3× a day", "Every 2 days", "Weekly", "Monthly"];
const DOSES_PER_DAY: Record<string, number> = {
  "Once a day": 1,
  "Twice a day": 2,
  "3× a day": 3,
  "Every 2 days": 0.5,
  Weekly: 1 / 7,
  Monthly: 1 / 30,
};

interface VetAddModalProps {
  open: boolean;
  onClose: () => void;
}

export function VetAddModal({ open, onClose }: VetAddModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [type, setType] = useState<RecordType>("checkup");

  // Checkup
  const [reason, setReason] = useState("");
  const [cDate, setCDate] = useState("");
  const [clinic, setClinic] = useState("");
  const [cNotes, setCNotes] = useState("");
  const [fileName, setFileName] = useState("");

  // Vaccine
  const [vName, setVName] = useState("");
  const [vDate, setVDate] = useState("");
  const [vNext, setVNext] = useState("");

  // Reminder
  const [rTitle, setRTitle] = useState("");
  const [rDate, setRDate] = useState("");
  const [rPriority, setRPriority] = useState<Priority>("Medium");

  // Medication
  const [mName, setMName] = useState("");
  const [mDose, setMDose] = useState("");
  const [mFreq, setMFreq] = useState(FREQS[0]);
  const [mDays, setMDays] = useState(7);
  const [mStart, setMStart] = useState("");
  const [mNotes, setMNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().split("T")[0];
    setType("checkup");
    setReason("");
    setCDate(today);
    setClinic("");
    setCNotes("");
    setFileName("");
    setVName("");
    setVDate(today);
    setVNext("");
    setRTitle("");
    setRDate(today);
    setRPriority("Medium");
    setMName("");
    setMDose("");
    setMFreq(FREQS[0]);
    setMDays(7);
    setMStart(today);
    setMNotes("");
  }, [open]);

  const medEnd = useMemo<string | null>(() => {
    if (mDays === 0 || !mStart) return null;
    const d = new Date(mStart + "T12:00:00");
    d.setDate(d.getDate() + mDays - 1);
    return d.toISOString().split("T")[0];
  }, [mDays, mStart]);

  const totalDoses = useMemo<number | null>(() => {
    if (mDays === 0) return null;
    return Math.ceil(mDays * (DOSES_PER_DAY[mFreq] || 1));
  }, [mDays, mFreq]);

  const save = (): void => {
    if (type === "checkup") {
      const rec: Checkup = {
        reason: reason || "Visit",
        date: cDate,
        clinic,
        notes: cNotes,
        hasFile: fileName !== "",
        fileName,
        created: new Date().toISOString(),
      };
      update((d) => {
        d.vetRecords.checkups.push(rec);
      });
    } else if (type === "vaccine") {
      if (!vName) {
        toast("Enter a vaccine name");
        return;
      }
      const rec: Vaccine = { name: vName, date: vDate, nextDue: vNext, created: new Date().toISOString() };
      update((d) => {
        d.vetRecords.vaccines.push(rec);
        if (vNext) {
          d.vetRecords.reminders.push({
            title: vName + " booster due",
            date: vNext,
            priority: "High",
            created: new Date().toISOString(),
          });
        }
      });
    } else if (type === "reminder") {
      if (!rTitle) {
        toast("Enter a reminder title");
        return;
      }
      const rec: Reminder = { title: rTitle, date: rDate, priority: rPriority, created: new Date().toISOString() };
      update((d) => {
        d.vetRecords.reminders.push(rec);
      });
    } else {
      if (!mName) {
        toast("Enter a medication name");
        return;
      }
      const rec: Medication = {
        name: mName,
        dose: mDose,
        freq: mFreq,
        days: mDays,
        start: mStart,
        end: medEnd,
        totalDoses,
        notes: mNotes,
        created: new Date().toISOString(),
      };
      update((d) => {
        d.vetRecords.medications.push(rec);
        if (medEnd) {
          d.vetRecords.reminders.push({
            title: mName + " course ends",
            date: medEnd,
            priority: "Medium",
            created: new Date().toISOString(),
          });
        }
      });
    }
    toast("Record saved! 📋");
    onClose();
  };

  return (
    <Modal open={open} title="Add health record" onClose={onClose}>
      <VStack gap={3}>
        <SegmentedControl value={type} onChange={(v) => setType(v as RecordType)} label="Record type" layout="fill" size="sm">
          <SegmentedControlItem value="checkup" label="Checkup" />
          <SegmentedControlItem value="vaccine" label="Vaccine" />
          <SegmentedControlItem value="reminder" label="Reminder" />
          <SegmentedControlItem value="medication" label="Medication" />
        </SegmentedControl>

        {type === "checkup" && (
          <>
            <TextInput label="Reason" value={reason} onChange={setReason} placeholder="Annual checkup" />
            <HStack gap={3}>
              <DateField label="Date" value={cDate} onChange={setCDate} />
              <TextInput label="Clinic" value={clinic} onChange={setClinic} />
            </HStack>
            <TextArea label="Notes" value={cNotes} onChange={setCNotes} />
            <FileInput
              label="Attach file (PDF)"
              value={null}
              onChange={(f) => setFileName((Array.isArray(f) ? f[0] : f)?.name || "")}
              accept=".pdf"
            />
          </>
        )}

        {type === "vaccine" && (
          <>
            <TextInput label="Vaccine name" value={vName} onChange={setVName} placeholder="Rabies" />
            <HStack gap={3}>
              <DateField label="Given" value={vDate} onChange={setVDate} />
              <DateField label="Next due" value={vNext} onChange={setVNext} />
            </HStack>
          </>
        )}

        {type === "reminder" && (
          <>
            <TextInput label="Reminder" value={rTitle} onChange={setRTitle} placeholder="Flea treatment" />
            <HStack gap={3}>
              <DateField label="Date" value={rDate} onChange={setRDate} />
              <Selector
                label="Priority"
                options={["High", "Medium", "Low"]}
                value={rPriority}
                onChange={(v) => setRPriority(v as Priority)}
              />
            </HStack>
          </>
        )}

        {type === "medication" && (
          <>
            <TextInput label="Medication name" value={mName} onChange={setMName} placeholder="Antibiotic" />
            <TextInput label="Dose" value={mDose} onChange={setMDose} placeholder="1 tablet" />
            <VStack gap={1}>
              <Text type="label">Frequency</Text>
              <Grid columns={3} gap={2}>
                {FREQS.map((f) => (
                  <ToggleButton
                    key={f}
                    label={f}
                    isPressed={mFreq === f}
                    onPressedChange={() => setMFreq(f)}
                  >
                    {f}
                  </ToggleButton>
                ))}
              </Grid>
            </VStack>
            <VStack gap={1}>
              <Text type="label">Duration (days)</Text>
              <HStack gap={2} vAlign="center">
                <IconButton
                  label="Decrease days"
                  variant="secondary"
                  icon={<Icon icon={Icons.minus} />}
                  onClick={() => setMDays(Math.max(0, mDays - 1))}
                />
                <Text weight="bold" style={{ minWidth: 40, textAlign: "center" }}>
                  {mDays === 0 ? "∞" : mDays}
                </Text>
                <IconButton
                  label="Increase days"
                  variant="secondary"
                  icon={<Icon icon={Icons.plus} />}
                  onClick={() => setMDays(mDays + 1)}
                />
                <HStack gap={1} style={{ marginLeft: "auto" }}>
                  {[7, 14, 30, 0].map((d) => (
                    <Button
                      key={d}
                      label={d === 0 ? "∞" : String(d)}
                      size="sm"
                      variant={mDays === d ? "primary" : "secondary"}
                      onClick={() => setMDays(d)}
                    />
                  ))}
                </HStack>
              </HStack>
            </VStack>
            <DateField label="Start date" value={mStart} onChange={setMStart} />
            <Card padding={3} variant="muted">
              <VStack gap={0.5}>
                <Text weight="semibold">
                  {mFreq}
                  {mDays === 0
                    ? " · Ongoing"
                    : medEnd
                      ? ` from ${fmtDate(mStart)} to ${fmtDate(medEnd)}`
                      : ` for ${mDays} days`}
                </Text>
                <Text type="supporting">
                  {totalDoses
                    ? `Total: ${totalDoses} dose${totalDoses !== 1 ? "s" : ""} of ${mDose || "dose"}`
                    : "Ongoing — no end date"}
                </Text>
              </VStack>
            </Card>
            <TextArea label="Notes" value={mNotes} onChange={setMNotes} />
          </>
        )}

        <Button label="Save record" variant="primary" onClick={save} style={{ width: "100%" }} />
      </VStack>
    </Modal>
  );
}
