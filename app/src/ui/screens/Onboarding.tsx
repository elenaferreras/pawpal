import { useState } from "react";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { AvatarEditor } from "../avatar/AvatarEditor";
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
          <>
            <div className="ob-emoji-big">🐾</div>
            <div className="ob-title">Welcome to PawPal</div>
            <div className="ob-sub">
              Track walks, meals, vet visits and more — everything your dog needs, in one place.
            </div>
            <div className="ob-spacer" />
            <button className="btn btn-primary btn-full" onClick={next}>
              Get started
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <div className="ob-title" style={{ marginTop: 12 }}>
              {name ? `Meet ${name}` : "Create your dog"}
            </div>
            <div className="ob-sub">Pick a look and give your pup a name.</div>
            <AvatarEditor value={avatar} onChange={setAvatar} previewSize={150} />
            <div className="form-group" style={{ margin: "8px 0 0" }}>
              <span className="form-label">Name</span>
              <input
                className="form-input"
                value={name}
                placeholder="e.g. Zipi"
                style={{ borderColor: nameError ? "#FF3B30" : undefined }}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="ob-btn-row">
              <button className="btn btn-secondary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={back}>
                Back
              </button>
              <button className="btn btn-primary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={nextFromName}>
                Next
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="ob-title" style={{ marginTop: 20 }}>About {name || "your dog"}</div>
            <div className="ob-sub">A few details help personalise things.</div>
            <div className="form-group">
              <span className="form-label">Breed</span>
              <input className="form-input" value={breed} onChange={(e) => setBreed(e.target.value)} />
            </div>
            <div className="form-row">
              <div>
                <span className="form-label">Birthday</span>
                <input type="date" className="form-input" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
              </div>
              <div>
                <span className="form-label">Weight (kg)</span>
                <input type="number" className="form-input" value={weight} onChange={(e) => setWeight(e.target.value)} />
              </div>
            </div>
            <div className="ob-spacer" />
            <div className="ob-btn-row">
              <button className="btn btn-secondary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={back}>
                Back
              </button>
              <button className="btn btn-primary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={next}>
                Next
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div className="ob-title" style={{ marginTop: 20 }}>Food & vet</div>
            <div className="ob-sub">Set a daily food goal and vet contact.</div>
            <div className="form-group">
              <span className="form-label">Daily food goal: {foodGoal}g</span>
              <input
                type="range"
                min={50}
                max={1000}
                step={10}
                value={foodGoal}
                style={{ width: "100%" }}
                onChange={(e) => setFoodGoal(parseInt(e.target.value))}
              />
            </div>
            <div className="form-group">
              <span className="form-label">Meals per day</span>
              <div style={{ display: "flex", gap: 8 }}>
                {MEAL_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={"ob-part-pill" + (mealsPerDay === n ? " selected" : "")}
                    style={{ flex: 1 }}
                    onClick={() => setMealsPerDay(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <span className="form-label">Vet name</span>
              <input className="form-input" value={vet} onChange={(e) => setVet(e.target.value)} />
            </div>
            <div className="form-group">
              <span className="form-label">Vet phone</span>
              <input className="form-input" value={vetPhone} onChange={(e) => setVetPhone(e.target.value)} />
            </div>
            <div className="ob-spacer" />
            <div className="ob-btn-row">
              <button className="btn btn-secondary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={back}>
                Back
              </button>
              <button className="btn btn-primary" style={{ flex: 1, margin: 0, width: "auto" }} onClick={finish}>
                Finish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
