import { useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Slider } from "@astryxdesign/core/Slider";
import { useDb } from "../../lib/store";
import { useToast } from "../../lib/toast";
import { DateField } from "../../components/fields";
import { AvatarEditor } from "../../avatar/AvatarEditor";
import type { Avatar, Profile as ProfileT } from "../../types";
import { SettingsPage, SectionLabel, Panel, PanelTitle } from "./shared";

const DEFAULT_AVATAR: Avatar = {
  head: "Normal",
  body: "Normal",
  colour: "orange",
  eyes: "Normal",
  nose: "Normal",
};

const MEAL_OPTIONS = [1, 2, 3, 4, 5];

/** Edit-profile form. Saves back into the store, then returns to Profile Details. */
export function ProfileEdit({ onBack }: { onBack: () => void }): React.ReactElement {
  const { db, update } = useDb();
  const toast = useToast();
  const p = db.profile;

  const [name, setName] = useState(p.name);
  const [breed, setBreed] = useState(p.breed);
  const [birthday, setBirthday] = useState(p.birthday || "");
  const [weight, setWeight] = useState(p.weight);
  const [foodGoal, setFoodGoal] = useState(p.foodGoal || 300);
  const [mealsPerDay, setMealsPerDay] = useState(p.mealsPerDay || 4);
  const [vet, setVet] = useState(p.vet);
  const [vetPhone, setVetPhone] = useState(p.vetPhone);
  const [avatar, setAvatar] = useState<Avatar>(p.avatar ? { ...p.avatar } : DEFAULT_AVATAR);

  const portion = Math.round(foodGoal / mealsPerDay);

  const save = (): void => {
    const next: ProfileT = {
      name,
      breed,
      birthday,
      weight,
      foodGoal,
      mealsPerDay,
      vet,
      vetPhone,
      avatar,
      emoji: "🐕",
      onboarded: p.onboarded,
    };
    update((d) => {
      d.profile = next;
    });
    toast("Profile saved! 🐾");
    onBack();
  };

  return (
    <SettingsPage title="Edit profile" onBack={onBack}>
      <SectionLabel>Avatar</SectionLabel>
      <Panel>
        <AvatarEditor value={avatar} onChange={setAvatar} previewSize={140} />
      </Panel>

      <SectionLabel>Details</SectionLabel>
      <Panel>
        <VStack gap={3}>
          <TextInput label="Name" value={name} onChange={setName} />
          <TextInput label="Breed" value={breed} onChange={setBreed} />
          <HStack gap={3}>
            <DateField label="Birthday" value={birthday} onChange={setBirthday} />
            <TextInput label="Weight (kg)" value={weight} onChange={setWeight} />
          </HStack>
        </VStack>
      </Panel>

      <SectionLabel>Food</SectionLabel>
      <Panel>
        <VStack gap={3}>
          <VStack gap={1}>
            <PanelTitle>
              Daily goal: {foodGoal}g ({portion}g per meal)
            </PanelTitle>
            <Slider
              label="Daily food goal"
              value={foodGoal}
              min={50}
              max={1000}
              step={10}
              onChange={(v: number) => setFoodGoal(v)}
            />
          </VStack>
          <VStack gap={1}>
            <PanelTitle>Meals per day</PanelTitle>
            <SegmentedControl
              value={String(mealsPerDay)}
              onChange={(v) => setMealsPerDay(Number(v))}
              label="Meals per day"
              layout="fill"
            >
              {MEAL_OPTIONS.map((mealCount) => (
                <SegmentedControlItem key={mealCount} value={String(mealCount)} label={String(mealCount)} />
              ))}
            </SegmentedControl>
          </VStack>
        </VStack>
      </Panel>

      <SectionLabel>Vet</SectionLabel>
      <Panel>
        <VStack gap={3}>
          <TextInput label="Vet name" value={vet} onChange={setVet} />
          <TextInput label="Vet phone" value={vetPhone} onChange={setVetPhone} />
        </VStack>
      </Panel>

      <Button
        label="Save profile"
        variant="primary"
        onClick={save}
        style={{ width: "100%", marginTop: 16, marginBottom: 24 }}
      />
    </SettingsPage>
  );
}
