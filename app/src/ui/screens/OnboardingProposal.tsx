import { useEffect, useRef, useState } from "react";
import { VStack } from "@astryxdesign/core/Stack";
import { Text, Heading } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Slider } from "@astryxdesign/core/Slider";
import { Switch } from "@astryxdesign/core/Switch";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { StickerSheet } from "../components/StickerSheet";
import { DogFace } from "../avatar/DogAvatar";
import { TimeField } from "../components/fields";
import { requestNotificationPermission, saveNotifConfig } from "../lib/notifications";
import { signIn, signUp } from "../lib/auth";
import { syncFromSupabase } from "../lib/supabase";
import type { Avatar, Database, Profile } from "../types";

const DEFAULT_AVATAR: Avatar = {
  head: "Normal",
  body: "Normal",
  colour: "orange",
  eyes: "Normal",
  nose: "Normal",
};

const MEAL_OPTIONS = [1, 2, 3, 4];
const RECOMMENDED_MEALS = 2;

interface WheelItem {
  value: number;
  label: string;
}

const MONTHS: WheelItem[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ value: i + 1, label }));

const DAYS: WheelItem[] = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));

// Warm, single-focus steps in the spirit of "How We Feel" — one question per
// screen. Intro (0-1), review (10), notifications (11) and outro (12) sit
// outside the progress bar; only the answer steps (2-9) advance it.
const FIRST_INPUT_STEP = 2;
const LAST_INPUT_STEP = 9;
const INPUT_STEPS = LAST_INPUT_STEP - FIRST_INPUT_STEP + 1;
const REVIEW_STEP = 10;
const NOTIF_STEP = 11;
const FINISH_STEP = 12;

interface OnboardingProposalProps {
  onDone: () => void;
  /** "I'm dog sitting today" — hands off to the sitter claim flow. */
  onDogSit: () => void;
}

export function OnboardingProposal({ onDone, onDogSit }: OnboardingProposalProps): React.ReactElement {
  const { db, update, replace } = useDb();
  const toast = useToast();

  const [phase, setPhase] = useState<"auth" | "flow">("auth");
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");

  const avatar = DEFAULT_AVATAR;
  const [sticker, setSticker] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState(false);
  const [breed, setBreed] = useState("");
  const [birthday, setBirthday] = useState("");
  const [weight, setWeight] = useState("");
  const [foodGoal, setFoodGoal] = useState(300);
  const [mealsPerDay, setMealsPerDay] = useState(RECOMMENDED_MEALS);
  const [vet, setVet] = useState("");
  const [vetPhone, setVetPhone] = useState("");

  const [walkNotif, setWalkNotif] = useState(true);
  const [walkTime, setWalkTime] = useState("08:00");
  const [feedNotif, setFeedNotif] = useState(true);
  const [feedTime, setFeedTime] = useState("18:00");
  const [vetNotif, setVetNotif] = useState(true);

  const go = (target: number): void => {
    setDir(target > step ? "fwd" : "back");
    setStep(target);
  };
  const next = (): void => go(step + 1);
  const back = (): void => go(step - 1);

  const nextFromName = (): void => {
    if (!name.trim()) {
      setNameError(true);
      setTimeout(() => setNameError(false), 1500);
      return;
    }
    next();
  };

  const dogName = name.trim() || "your dog";

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

  // Advance to the celebration screen, then hand off after a beat.
  const celebrate = (): void => go(FINISH_STEP);

  // A returning user just signed in — pull their cloud profile. If they've
  // already onboarded, replace the local DB and hand straight off to the app,
  // skipping the questionnaire. Otherwise merge and continue building it.
  const handleLoggedIn = async (): Promise<void> => {
    try {
      const payload = await syncFromSupabase();
      if (payload) {
        replace({ ...db, ...payload } as Database);
        if (payload.profile?.onboarded) {
          toast("Welcome back! 🐾");
          onDone();
          return;
        }
      }
    } catch {
      // Cloud unreachable — fall through into the local flow.
    }
    setPhase("flow");
  };

  // Persist reminder preferences and trigger the native permission prompt.
  const enableReminders = async (): Promise<void> => {
    await requestNotificationPermission();
    const [walkHour, walkMinute] = walkTime.split(":").map(Number);
    const [feedHour, feedMinute] = feedTime.split(":").map(Number);
    saveNotifConfig({
      walkReminder: { enabled: walkNotif, hour: walkHour, minute: walkMinute },
      feedReminder: { enabled: feedNotif, hour: feedHour, minute: feedMinute },
      vetReminder: { enabled: vetNotif },
    });
    celebrate();
  };

  const progress =
    step < FIRST_INPUT_STEP
      ? 0
      : Math.min(1, (step - FIRST_INPUT_STEP + 1) / INPUT_STEPS);
  const showProgress = step >= FIRST_INPUT_STEP && step <= LAST_INPUT_STEP;

  if (phase === "auth") {
    return (
      <AuthGate
        onLoggedIn={handleLoggedIn}
        onSignedUp={() => setPhase("flow")}
        onDogSit={onDogSit}
      />
    );
  }

  return (
    <div className="ob-overlay open">
      {showProgress ? (
        <div className="obp-progress-wrap">
          <div className="obp-progress-track">
            <div className="obp-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="obp-progress-label">
            Step {step - FIRST_INPUT_STEP + 1} of {INPUT_STEPS}
          </span>
        </div>
      ) : (
        <div className="obp-progress-wrap" />
      )}

      <div key={step} className={`ob-slide obp-slide obp-${dir}`}>
        {step === 0 && (
          <div className="obp-hero">
            <h1 className="obp-hero-title">
              Ready for
              <br />
              <span className="obp-hero-title-accent">tail wags?</span>
            </h1>

            <div className="obp-hero-stage">
              <span className="obp-bubble obp-bubble--walk">walk</span>
              <span className="obp-bubble obp-bubble--treat">treat</span>
              <span className="obp-bubble obp-bubble--woof">woof!</span>
              <div className="obp-hero-pane">
                <DogFace avatar={avatar} size={150} className="obp-hero-dog" />
              </div>
            </div>

            <Button label="Let's go" variant="primary" onClick={next} className="obp-cta" />
            <Text type="supporting" className="obp-fineprint">
              Takes about a minute · Everything stays on your device
            </Text>
          </div>
        )}

        {step === 1 && (
          <VStack gap={3} className="obp-fill">
            <div className="obp-hero-emoji obp-hero-emoji--sm">✨</div>
            <h2 className="obp-title">Here&apos;s how PawPal helps</h2>
            <VStack gap={2} className="obp-benefits">
              <Benefit icon="🚶" title="Never miss a walk" body="Track routes, steps and potty breaks with a tap." />
              <Benefit icon="🍽️" title="Feed with confidence" body="Daily goals and meal reminders, made simple." />
              <Benefit icon="🩺" title="Stay on top of health" body="Vet visits and weight, all in one timeline." />
            </VStack>
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} nextLabel="Let's go" />
          </VStack>
        )}

        {step === 2 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">First, the fun part</span>
            <h2 className="obp-title">Find your pup</h2>
            <Text type="supporting" className="obp-sub-left">
              Peel a sticker off the sheet to make it yours — you can always swap it later.
            </Text>
            <div className="obp-avatar-stage">
              <StickerSheet value={sticker} onChange={setSticker} />
            </div>
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} />
          </VStack>
        )}

        {step === 3 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Nice to meet them</span>
            <h2 className="obp-title">What&apos;s their name?</h2>
            <Text type="supporting" className="obp-sub-left">
              We&apos;ll use it to make PawPal feel like home.
            </Text>
            <TextInput
              label="Name"
              value={name}
              placeholder="e.g. Zipi"
              onChange={setName}
              status={nameError ? { type: "error", message: "Every good dog needs a name 🐶" } : undefined}
            />
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={nextFromName} />
          </VStack>
        )}

        {step === 4 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Getting to know {dogName}</span>
            <h2 className="obp-title">What breed is {dogName}?</h2>
            <Text type="supporting" className="obp-sub-left">
              Helps us tailor care tips. Not sure yet? You can skip this.
            </Text>
            <TextInput label="Breed" value={breed} placeholder="e.g. Mixed breed" onChange={setBreed} />
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} />
          </VStack>
        )}

        {step === 5 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Mark the calendar</span>
            <h2 className="obp-title">When do we get to celebrate {dogName}?</h2>
            <Text type="supporting" className="obp-sub-left">
              Their birthday lets us track age and milestones.
            </Text>
            <WheelDate value={birthday} onChange={setBirthday} />
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} />
          </VStack>
        )}

        {step === 6 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Health basics</span>
            <h2 className="obp-title">How much does {dogName} weigh?</h2>
            <Text type="supporting" className="obp-sub-left">
              Weight helps us gauge portions and spot changes over time.
            </Text>
            <TextInput label="Weight (kg)" value={weight} placeholder="e.g. 12" onChange={setWeight} />
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} />
          </VStack>
        )}

        {step === 7 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Mealtime</span>
            <h2 className="obp-title">{dogName}&apos;s daily food goal</h2>
            <Text type="supporting" className="obp-sub-left">
              Set a gentle target — we&apos;ll help you keep the bowl balanced.
            </Text>
            <div className="obp-goal-readout">
              <span className="obp-goal-value">{foodGoal}</span>
              <span className="obp-goal-unit">grams / day</span>
            </div>
            <Slider
              label="Daily food goal"
              value={foodGoal}
              min={50}
              max={1000}
              step={10}
              onChange={(v: number) => setFoodGoal(v)}
            />
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} />
          </VStack>
        )}

        {step === 8 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Routine</span>
            <h2 className="obp-title">How many meals a day?</h2>
            <Text type="supporting" className="obp-sub-left">
              Splitting food across meals keeps {dogName} satisfied.
            </Text>
            <div className="obp-circle-grid" role="radiogroup" aria-label="Meals per day">
              {MEAL_OPTIONS.map((mealCount) => {
                const selected = mealsPerDay === mealCount;
                const recommended = mealCount === RECOMMENDED_MEALS;
                return (
                  <button
                    key={mealCount}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`obp-circle${selected ? " selected" : ""}`}
                    onClick={() => setMealsPerDay(mealCount)}
                  >
                    <span className="obp-circle-count">{mealCount}</span>
                    <span className="obp-circle-unit">per day</span>
                    {recommended && <span className="obp-circle-tag">Recommended</span>}
                  </button>
                );
              })}
            </div>
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={next} />
          </VStack>
        )}

        {step === 9 && (
          <VStack gap={3} className="obp-fill">
            <span className="obp-eyebrow">Health &amp; safety</span>
            <h2 className="obp-title">{dogName}&apos;s vet</h2>
            <Text type="supporting" className="obp-sub-left">
              Keep your vet a tap away for appointments and emergencies. You can add this later.
            </Text>
            <TextInput label="Vet name" value={vet} placeholder="e.g. Elm Street Vets" onChange={setVet} />
            <TextInput label="Vet phone" value={vetPhone} placeholder="e.g. 555 0100" onChange={setVetPhone} />
            <div className="ob-spacer" />
            <VStack gap={2}>
              <GooNav onBack={back} onNext={next} />
              <Button label="Skip for now" variant="ghost" onClick={next} className="obp-skip" />
            </VStack>
          </VStack>
        )}

        {step === REVIEW_STEP && (
          <VStack gap={3} className="obp-fill">
            <div className="obp-hero-emoji obp-hero-emoji--sm">🔒</div>
            <h2 className="obp-title">You&apos;re all set</h2>
            <Text type="supporting" className="obp-sub-left">
              Everything you&apos;ve entered stays private on your device. Ready to start caring for{" "}
              {dogName}?
            </Text>
            <div className="obp-review-card">
              <ReviewRow label="Name" value={name.trim() || "—"} />
              <ReviewRow label="Breed" value={breed || "—"} />
              <ReviewRow label="Birthday" value={prettyDate(birthday)} />
              <ReviewRow label="Food goal" value={`${foodGoal} g/day · ${mealsPerDay} meals`} />
              <ReviewRow label="Vet" value={vet || "Not added"} />
            </div>
            <div className="ob-spacer" />
            <GooNav onBack={back} onNext={() => go(NOTIF_STEP)} nextLabel="Continue" />
          </VStack>
        )}

        {step === NOTIF_STEP && (
          <VStack gap={3} className="obp-fill">
            <div className="obp-hero-emoji obp-hero-emoji--sm">🔔</div>
            <h2 className="obp-title">Never miss a moment with {dogName}</h2>
            <Text type="supporting" className="obp-sub-left">
              Gentle nudges so a walk, meal or vet visit never slips your mind. Pick what helps —
              you can change these anytime.
            </Text>
            <div className="obp-notif-grid">
              <NotifOption
                icon="🚶"
                label="Walks"
                enabled={walkNotif}
                onToggle={setWalkNotif}
                time={walkTime}
                onTime={setWalkTime}
              />
              <NotifOption
                icon="🍖"
                label="Feeding"
                enabled={feedNotif}
                onToggle={setFeedNotif}
                time={feedTime}
                onTime={setFeedTime}
              />
              <NotifOption
                icon="🩺"
                label="Vet"
                enabled={vetNotif}
                onToggle={setVetNotif}
                caption="Around 9 AM"
              />
            </div>
            <div className="ob-spacer" />
            <VStack gap={2}>
              <Button
                label="Turn on reminders"
                variant="primary"
                onClick={() => void enableReminders()}
                style={{ width: "100%" }}
              />
              <Button label="Set up later" variant="ghost" onClick={celebrate} className="obp-skip" />
            </VStack>
          </VStack>
        )}

        {step === FINISH_STEP && <Celebration dogName={dogName} onDone={finish} />}
      </div>
    </div>
  );
}

type AuthMode = "choose" | "signup" | "login";

// Optional account gate shown before the questionnaire. Email + password only.
// "Continue on this device" keeps everything local (device-scoped sync).
function AuthGate({
  onLoggedIn,
  onSignedUp,
  onDogSit,
}: {
  onLoggedIn: () => Promise<void>;
  onSignedUp: () => void;
  onDogSit: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [mode, setMode] = useState<AuthMode>("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 6 && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      setError(
        !emailOk ? "Enter a valid email address" : "Password must be at least 6 characters",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email.trim(), password);
        toast(
          needsConfirmation
            ? "Account created — check your email to confirm ✉️"
            : "Account created 🎉",
        );
        onSignedUp();
      } else {
        await signIn(email.trim(), password);
        await onLoggedIn();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  if (mode === "choose") {
    return (
      <div className="obw">
        {/* Hand-drawn dog doodles (Figma node 100:5297). */}
        <div className="obw-art" aria-hidden>
          <img className="obw-dog obw-dog--blue" src="onboarding/dog-blue.svg" alt="" />
          <img className="obw-dog obw-dog--purple" src="onboarding/dog-purple.svg" alt="" />
          <img className="obw-dog obw-dog--cream" src="onboarding/dog-cream.svg" alt="" />
          <img className="obw-dog obw-dog--orange" src="onboarding/dog-orange.svg" alt="" />
        </div>

        <div className="obw-ctas">
          <div className="obw-heading">
            <h1 className="obw-title">Welcome to PawPal</h1>
            <p className="obw-sub">The home for pet owners</p>
          </div>

          <div className="obw-buttons">
            <button
              type="button"
              className="obw-btn obw-btn--primary"
              onClick={() => {
                setError(null);
                setMode("signup");
              }}
            >
              Sign up
            </button>
            <button
              type="button"
              className="obw-btn obw-btn--outline"
              onClick={() => {
                setError(null);
                setMode("login");
              }}
            >
              Log in
            </button>
            <button type="button" className="obw-btn obw-btn--ghost" onClick={onDogSit}>
              I&rsquo;m dog sitting today
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isSignup = mode === "signup";

  return (
    <div className="ob-overlay open">
      <div className="obp-progress-wrap" />
      <div className="ob-slide obp-slide">
        <VStack gap={3} className="obp-fill obp-auth">
          <span className="obp-eyebrow">{isSignup ? "New here" : "Welcome back"}</span>
          <h2 className="obp-title">{isSignup ? "Create your account" : "Log in"}</h2>
          <Text type="supporting" className="obp-sub-left">
            {isSignup
              ? "We'll keep your pup's data safely backed up."
              : "Sign in to restore your pup's data."}
          </Text>
          <TextInput
            label="Email"
            type="email"
            value={email}
            placeholder="you@example.com"
            onChange={(v: string) => {
              setEmail(v);
              setError(null);
            }}
          />
          <TextInput
            label="Password"
            type="password"
            value={password}
            placeholder={isSignup ? "At least 6 characters" : "Your password"}
            onChange={(v: string) => {
              setPassword(v);
              setError(null);
            }}
            status={error ? { type: "error", message: error } : undefined}
          />
          <div className="ob-spacer" />
          <VStack gap={2}>
            <Button
              label={busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
              variant="primary"
              onClick={() => void submit()}
              isDisabled={busy}
              style={{ width: "100%" }}
            />
            <Button
              label={isSignup ? "I already have an account" : "Create an account instead"}
              variant="ghost"
              onClick={() => {
                setError(null);
                setMode(isSignup ? "login" : "signup");
              }}
              className="obp-skip"
            />
            <Button
              label="Back"
              variant="ghost"
              onClick={() => {
                setError(null);
                setMode("choose");
              }}
              className="obp-skip"
            />
          </VStack>
        </VStack>
      </div>
    </div>
  );
}

function GooNav({
  onBack,
  onNext,
  nextLabel = "Next",
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}): React.ReactElement {
  return (
    <div className="obp-goonav">
      <div className="obp-goonav-goo" aria-hidden>
        <span className="obp-goonav-blob obp-goonav-blob--back" />
        <span className="obp-goonav-blob obp-goonav-blob--next" />
      </div>
      <button
        type="button"
        className="obp-goonav-btn obp-goonav-btn--back"
        onClick={onBack}
      >
        Back
      </button>
      <button
        type="button"
        className="obp-goonav-btn obp-goonav-btn--next"
        onClick={onNext}
      >
        {nextLabel}
      </button>
      <svg className="obp-goo-svg" aria-hidden width="0" height="0">
        <defs>
          <filter id="obp-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

function Benefit({ icon, title, body }: { icon: string; title: string; body: string }): React.ReactElement {
  return (
    <div className="obp-benefit">
      <div className="obp-benefit-icon" aria-hidden>
        {icon}
      </div>
      <VStack gap={0}>
        <Text type="label" className="obp-benefit-title">
          {title}
        </Text>
        <Text type="supporting" className="obp-benefit-body">
          {body}
        </Text>
      </VStack>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="obp-review-row">
      <span className="obp-review-label">{label}</span>
      <span className="obp-review-value">{value}</span>
    </div>
  );
}

// One reminder channel in the notifications step: icon, label, an optional time
// picker, and an enable switch.
function NotifOption({
  icon,
  label,
  enabled,
  onToggle,
  time,
  onTime,
  caption,
}: {
  icon: string;
  label: string;
  enabled: boolean;
  onToggle: (value: boolean) => void;
  time?: string;
  onTime?: (value: string) => void;
  caption?: string;
}): React.ReactElement {
  return (
    <div className={`obp-notif-col${enabled ? "" : " off"}`}>
      <div className="obp-notif-icon" aria-hidden>
        {icon}
      </div>
      <span className="obp-notif-label">{label}</span>
      {time !== undefined && onTime ? (
        <div className="obp-notif-time">
          <TimeField label={`${label} reminder time`} isLabelHidden value={time} onChange={onTime} />
        </div>
      ) : (
        <span className="obp-notif-caption">{caption}</span>
      )}
      <Switch label={`${label} reminders`} isLabelHidden value={enabled} onChange={onToggle} />
    </div>
  );
}

function Celebration({ dogName, onDone }: { dogName: string; onDone: () => void }): React.ReactElement {
  const done = useRef(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onDone();
      }
    }, 1900);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <VStack gap={3} hAlign="center" className="obp-center obp-celebrate">
      <div className="obp-burst" aria-hidden>
        🎉
      </div>
      <Heading level={1}>Welcome aboard!</Heading>
      <Text type="supporting" className="obp-lede">
        {dogName} is going to love this. Taking you to the dashboard…
      </Text>
    </VStack>
  );
}

const WHEEL_ROW_H = 44;

function parseDate(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function composeDate(year: number, month: number, day: number): string {
  const clampedDay = Math.min(day, daysInMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

function prettyDate(value: string): string {
  const parsed = parseDate(value);
  if (!parsed) return "—";
  return new Date(parsed.y, parsed.m - 1, parsed.d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// A single scroll-snapping wheel column, in the spirit of iOS/pillowtalk pickers.
function WheelColumn({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: WheelItem[];
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const idx = Math.max(0, items.findIndex((it) => it.value === value));
    el.scrollTop = idx * WHEEL_ROW_H;
    // Position once on mount; selection is preserved across remounts via `value`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScroll = (): void => {
    const el = ref.current;
    if (!el) return;
    window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const raw = Math.round(el.scrollTop / WHEEL_ROW_H);
      const idx = Math.min(items.length - 1, Math.max(0, raw));
      const target = items[idx];
      el.scrollTo({ top: idx * WHEEL_ROW_H, behavior: "smooth" });
      if (target && target.value !== value) onChange(target.value);
    }, 130);
  };

  return (
    <div
      className="obp-wheel-col"
      ref={ref}
      onScroll={handleScroll}
      role="listbox"
      aria-label={ariaLabel}
    >
      {items.map((it) => (
        <div key={it.value} className={`obp-wheel-item${it.value === value ? " sel" : ""}`}>
          {it.label}
        </div>
      ))}
    </div>
  );
}

// Month / day / year wheel picker that reads and writes "YYYY-MM-DD".
function WheelDate({ value, onChange }: { value: string; onChange: (value: string) => void }): React.ReactElement {
  const now = new Date();
  const fallback = { y: now.getFullYear() - 2, m: now.getMonth() + 1, d: now.getDate() };
  const initial = parseDate(value) ?? fallback;

  const [month, setMonth] = useState(initial.m);
  const [day, setDay] = useState(initial.d);
  const [year, setYear] = useState(initial.y);

  const years: WheelItem[] = Array.from({ length: 26 }, (_, i) => {
    const y = now.getFullYear() - 25 + i;
    return { value: y, label: String(y) };
  });

  useEffect(() => {
    onChange(composeDate(year, month, day));
    // Re-compose whenever a column changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, day]);

  return (
    <div className="obp-wheel">
      <div className="obp-wheel-band" aria-hidden />
      <WheelColumn items={MONTHS} value={month} onChange={setMonth} ariaLabel="Month" />
      <WheelColumn items={DAYS} value={day} onChange={setDay} ariaLabel="Day" />
      <WheelColumn items={years} value={year} onChange={setYear} ariaLabel="Year" />
    </div>
  );
}

