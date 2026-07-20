import { useEffect, useState } from "react";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { Modal } from "./Modal";
import { TimeField } from "./fields";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { Meal } from "../types";

interface FoodFormModalProps {
  open: boolean;
  onClose: () => void;
}

const TYPES = ["Dry kibble", "Wet food", "Raw", "Treats", "Other"];

export function FoodFormModal({ open, onClose }: FoodFormModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [time, setTime] = useState("");
  const [type, setType] = useState(TYPES[0]);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTime(nowTime());
      setType(TYPES[0]);
      setAmount("");
      setNotes("");
    }
  }, [open]);

  const save = (): void => {
    if (!amount) {
      toast("Enter an amount");
      return;
    }
    const meal: Meal = {
      date: new Date().toISOString().split("T")[0],
      time,
      type,
      amount: parseInt(amount) || 0,
      notes,
      created: new Date().toISOString(),
    };
    update((d) => {
      d.meals.push(meal);
    });
    toast("Meal logged! 🍖");
    onClose();
  };

  return (
    <Modal open={open} title="Log a meal" onClose={onClose}>
      <VStack gap={3}>
        <HStack gap={3}>
          <TimeField label="Time" value={time} onChange={setTime} />
          <TextInput label="Amount (g)" value={amount} onChange={setAmount} />
        </HStack>
        <Selector label="Type" options={TYPES} value={type} onChange={setType} />
        <TextArea label="Notes" value={notes} onChange={setNotes} />
        <Button label="Save meal" variant="primary" onClick={save} style={{ width: "100%" }} />
      </VStack>
    </Modal>
  );
}
