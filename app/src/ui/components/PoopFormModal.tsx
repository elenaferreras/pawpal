import { useEffect, useState } from "react";
import { VStack, HStack } from "@astryxdesign/core/Stack";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { Icon } from "@astryxdesign/core/Icon";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Selector } from "@astryxdesign/core/Selector";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Modal } from "./Modal";
import { TimeField } from "./fields";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { nowTime } from "../lib/date";
import type { BathroomLog, BathroomType } from "../types";

interface PoopFormModalProps {
  open: boolean;
  onClose: () => void;
}

const CONSISTENCIES = ["Normal", "Soft", "Runny", "Hard", "Mucus", "Other"];

export function PoopFormModal({ open, onClose }: PoopFormModalProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [time, setTime] = useState("");
  const [type, setType] = useState<BathroomType>("pipi");
  const [consistency, setConsistency] = useState(CONSISTENCIES[0]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setTime(nowTime());
      setType("pipi");
      setConsistency(CONSISTENCIES[0]);
      setNotes("");
      setPhotos([]);
    }
  }, [open]);

  const showPhoto = type === "popo" || type === "both";

  const handleFiles = (files: File | File[] | null): void => {
    if (!files) return;
    const list = Array.isArray(files) ? files : [files];
    list.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === "string") setPhotos((prev) => [...prev, result]);
      };
      reader.readAsDataURL(file);
    });
  };

  const save = (): void => {
    const entry: BathroomLog = {
      date: new Date().toISOString().split("T")[0],
      time,
      type,
      consistency: showPhoto ? consistency : "",
      notes,
      photos: showPhoto ? photos : [],
      created: new Date().toISOString(),
    };
    update((d) => {
      d.bathroom.push(entry);
    });
    toast("Logged! 👍");
    onClose();
  };

  return (
    <Modal open={open} title="Bathroom log" onClose={onClose}>
      <VStack gap={3}>
        <SegmentedControl value={type} onChange={(v) => setType(v as BathroomType)} label="Type" layout="fill">
          <SegmentedControlItem value="pipi" label="💧 Pipi" />
          <SegmentedControlItem value="popo" label="💩 Popo" />
          <SegmentedControlItem value="both" label="Both" />
        </SegmentedControl>

        <TimeField label="Time" value={time} onChange={setTime} />

        {showPhoto && (
          <>
            <Selector label="Consistency" options={CONSISTENCIES} value={consistency} onChange={setConsistency} />
            <FileInput label="Photos" value={null} onChange={handleFiles} accept="image/*" isMultiple />
            {photos.length > 0 && (
              <HStack gap={2} wrap="wrap">
                {photos.map((src, i) => (
                  <div key={i} style={{ position: "relative", width: 72, height: 72 }}>
                    <img
                      src={src}
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10 }}
                      alt=""
                    />
                    <div style={{ position: "absolute", top: -8, right: -8 }}>
                      <IconButton
                        label="Remove photo"
                        size="sm"
                        variant="secondary"
                        icon={<Icon icon={Icons.x} size="xsm" />}
                        onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      />
                    </div>
                  </div>
                ))}
              </HStack>
            )}
          </>
        )}

        <TextArea label="Notes" value={notes} onChange={setNotes} />

        <Button label="Save" variant="primary" onClick={save} style={{ width: "100%" }} />
      </VStack>
    </Modal>
  );
}
