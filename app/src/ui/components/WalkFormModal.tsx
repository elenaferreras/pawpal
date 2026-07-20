import { useEffect, useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Modal } from "./Modal";
import { DateField, TimeField } from "./fields";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Walk } from "../types";

const WEATHERS: { value: string; icon: string }[] = [
  { value: "sunny", icon: "☀️" },
  { value: "cloudy", icon: "☁️" },
  { value: "rainy", icon: "🌧️" },
  { value: "windy", icon: "💨" },
  { value: "snowy", icon: "❄️" },
  { value: "hot", icon: "🥵" },
  { value: "foggy", icon: "🌫️" },
  { value: "stormy", icon: "⛈️" },
];

interface WalkFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Index into db.walks when editing, or null when logging a new walk. */
  editIndex: number | null;
}

export function WalkFormModal({ open, onClose, editIndex }: WalkFormModalProps): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const existing = editIndex != null ? db.walks[editIndex] : undefined;

  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [steps, setSteps] = useState("");
  const [distance, setDistance] = useState("");
  const [pipi, setPipi] = useState(false);
  const [popo, setPopo] = useState(false);
  const [friends, setFriends] = useState(false);
  const [weather, setWeather] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setDate(existing?.date || new Date().toISOString().split("T")[0]);
    setTime(existing?.time || nowTime());
    setDuration(existing ? String(existing.duration || "") : "");
    setSteps(existing ? String(existing.steps || "") : "");
    setDistance(existing ? String(existing.distance || "") : "");
    setPipi(!!existing?.pipi);
    setPopo(!!existing?.popo);
    setFriends(!!existing?.friends);
    setWeather(existing?.weather || "");
    setNotes(existing?.notes || "");
    // Only reset when the modal opens or the edit target changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editIndex]);

  const save = (): void => {
    const walk: Walk = {
      date: date || new Date().toISOString().split("T")[0],
      time,
      duration,
      steps,
      distance,
      pipi,
      popo,
      friends,
      weather,
      notes,
      created: existing?.created || new Date().toISOString(),
    };
    update((d) => {
      if (editIndex != null) d.walks[editIndex] = walk;
      else d.walks.push(walk);
    });
    toast(editIndex != null ? "Walk updated! ✓" : "Walk saved! 🦮");
    onClose();
  };

  return (
    <Modal open={open} title={editIndex != null ? "Edit walk 🦮" : "Log a walk"} onClose={onClose}>
      <VStack gap={3}>
        <HStack gap={3}>
          <DateField label="Date" value={date} onChange={setDate} />
          <TimeField label="Time" value={time} onChange={setTime} />
        </HStack>
        <HStack gap={3}>
          <TextInput label="Duration (min)" value={duration} onChange={setDuration} />
          <TextInput label="Steps" value={steps} onChange={setSteps} />
        </HStack>
        <TextInput label="Distance (km)" value={distance} onChange={setDistance} />

        <VStack gap={1}>
          <Text type="label">Weather</Text>
          <HStack gap={1} wrap="wrap">
            {WEATHERS.map((w) => (
              <ToggleButton
                key={w.value}
                label={w.value}
                isIconOnly
                icon={<span>{w.icon}</span>}
                isPressed={weather === w.value}
                onPressedChange={() => setWeather(weather === w.value ? "" : w.value)}
              />
            ))}
          </HStack>
        </VStack>

        <HStack gap={2}>
          <ToggleButton label="💧 Pipi" isPressed={pipi} onPressedChange={() => setPipi(!pipi)}>
            💧 Pipi
          </ToggleButton>
          <ToggleButton label="💩 Popo" isPressed={popo} onPressedChange={() => setPopo(!popo)}>
            💩 Popo
          </ToggleButton>
          <ToggleButton label="🐶 Friends" isPressed={friends} onPressedChange={() => setFriends(!friends)}>
            🐶 Friends
          </ToggleButton>
        </HStack>

        <TextArea label="Notes" value={notes} onChange={setNotes} />

        <Button
          label={editIndex != null ? "Save changes" : "Save walk"}
          variant="primary"
          onClick={save}
          style={{ width: "100%" }}
        />
      </VStack>
    </Modal>
  );
}
