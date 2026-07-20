import { useState } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Slider } from "@astryxdesign/core/Slider";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { AvatarEditor } from "../avatar/AvatarEditor";
import { DateField } from "../components/fields";
import type { Avatar, Profile } from "../types";

const DEFAULT_AVATAR: Avatar = {
  head: "Normal",
  body: "Normal",
  colour: "orange",
  eyes: "Normal",
  nose: "Normal",
};

const OB_STEPS = 4;
const MEAL_OPTIONS = [1, 2, 3, 4, 5];

interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const { update } = useDb();
  const toast = useToast();
  const [step, setStep] = useState(0);

  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState("");
  const [weight, setWeight] = useState("");
  const [foodGoal, setFoodGoal] = useState(300);
  const [mealsPerDay, setMealsPerDay] = useState(4);
  const [vet, setVet] = useState("");
  const [vetPhone, setVetPhone] = useState("");

  const next = (): void => setStep((s) => Math.min(OB_STEPS - 1, s + 1));
  const back = (): void => setStep((s) => Math.max(0, s - 1));

  const nextFromName = (): void => {
    if (!name.trim()) {
      setNameError(true);
      setTimeout(() => setNameError(false), 1500);
      return;
    }
    next();
  };

  const finish = (): void => {
    const profile: Profile = {
      name: name.trim(),
      breed,
      birthday,
      weight,
      foodGoal,
      mealsPerDay,
      vet,
      vetPhone,
      avatar,
      emoji: "🐕",
      onboarded: true,
    };
    update((d) => {
      d.profile = profile;
    });
    toast(`Welcome to PawPal, ${profile.name}! 🐾`);
    onDone();
  };

  return (
    <div className="ob-overlay open">
      <div className="ob-progress">
        {Array.from({ length: OB_STEPS }).map((_, i) => (
          <div key={i} className={"ob-progress-dot" + (i <= step ? " done" : "")} />
        ))}
      </div>

      <div className="ob-slide">
        {step === 0 && (
          <VStack gap={3} hAlign="center">
            <div style={{ fontSize: 64 }}>🐾</div>
            <Heading level={1}>Welcome to PawPal</Heading>
            <Text type="supporting" style={{ textAlign: "center" }}>
              Track walks, meals, vet visits and more — everything your dog needs, in one place.
            </Text>
            <Button label="Get started" variant="primary" onClick={next} style={{ width: "100%", marginTop: 16 }} />
          </VStack>
        )}

        {step === 1 && (
          <VStack gap={3}>
            <Heading level={2}>{name ? `Meet ${name}` : "Create your dog"}</Heading>
            <Text type="supporting">Pick a look and give your pup a name.</Text>
            <AvatarEditor value={avatar} onChange={setAvatar} previewSize={150} />
            <TextInput
              label="Name"
              value={name}
              placeholder="e.g. Zipi"
              onChange={setName}
              status={nameError ? { type: "error", message: "Please enter a name" } : undefined}
            />
            <HStack gap={2}>
              <Button label="Back" variant="secondary" onClick={back} style={{ flex: 1 }} />
              <Button label="Next" variant="primary" onClick={nextFromName} style={{ flex: 1 }} />
            </HStack>
          </VStack>
        )}

        {step === 2 && (
          <VStack gap={3}>
            <Heading level={2}>About {name || "your dog"}</Heading>
            <Text type="supporting">A few details help personalise things.</Text>
            <TextInput label="Breed" value={breed} onChange={setBreed} />
            <HStack gap={3}>
              <DateField label="Birthday" value={birthday} onChange={setBirthday} />
              <TextInput label="Weight (kg)" value={weight} onChange={setWeight} />
            </HStack>
            <HStack gap={2}>
              <Button label="Back" variant="secondary" onClick={back} style={{ flex: 1 }} />
              <Button label="Next" variant="primary" onClick={next} style={{ flex: 1 }} />
            </HStack>
          </VStack>
        )}

        {step === 3 && (
          <VStack gap={3}>
            <Heading level={2}>Food & vet</Heading>
            <Text type="supporting">Set a daily food goal and vet contact.</Text>
            <VStack gap={1}>
              <Text type="label">Daily food goal: {foodGoal}g</Text>
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
              <Text type="label">Meals per day</Text>
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
            <TextInput label="Vet name" value={vet} onChange={setVet} />
            <TextInput label="Vet phone" value={vetPhone} onChange={setVetPhone} />
            <HStack gap={2}>
              <Button label="Back" variant="secondary" onClick={back} style={{ flex: 1 }} />
              <Button label="Finish" variant="primary" onClick={finish} style={{ flex: 1 }} />
            </HStack>
          </VStack>
        )}
      </div>
    </div>
  );
}
