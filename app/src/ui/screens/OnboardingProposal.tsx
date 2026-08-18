import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Button } from "../components/Button";
import { Slider } from "@astryxdesign/core/Slider";
import { Toggle } from "../components/Toggle";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { useDb } from "../lib/store";
import { useToast } from "../lib/toast";
import { AVATAR_STICKERS } from "../avatar/stickers";
import { AVATAR_BG_COLORS, DEFAULT_AVATAR_BG } from "../avatar/presets";
import { TimeField } from "../components/fields";
import { ScreenTransition } from "../components/ScreenTransition";
import { requestNotificationPermission, saveNotifConfig } from "../lib/notifications";
import { requestPasswordReset, signIn, signUp } from "../lib/auth";
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
// screen. Each step is its own full-screen dark shell. Step numbering keeps its
// historical offset so the flow constants below stay stable.
const FIRST_INPUT_STEP = 2;
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
  // The flow now opens on "Find your pup" — the old hero/intro steps are gone.
  const [step, setStep] = useState(FIRST_INPUT_STEP);
  // Slide direction for the step transition: 1 = forward, -1 = back.
  const [direction, setDirection] = useState(1);

  const avatar = DEFAULT_AVATAR;
  const [sticker, setSticker] = useState<string>(AVATAR_STICKERS[0].id);
  const [bg, setBg] = useState<string>(DEFAULT_AVATAR_BG);
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
    setDirection(target >= step ? 1 : -1);
    setStep(target);
  };
  const next = (): void => go(step + 1);
  const back = (): void => go(step - 1);

  // Phase changes (auth <-> flow) drive the slide direction too.
  const goToFlow = (): void => {
    setDirection(1);
    setPhase("flow");
  };
  const backToAuth = (): void => {
    setDirection(-1);
    setPhase("auth");
  };

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
      avatar: { ...avatar, sticker, bg },
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
    goToFlow();
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

  let stepKey: string;
  let stepNode: React.ReactElement;

  if (phase === "auth") {
    stepKey = "auth";
    stepNode = (
      <AuthGate onLoggedIn={handleLoggedIn} onSignedUp={goToFlow} onDogSit={onDogSit} />
    );
  } else if (step === FIRST_INPUT_STEP) {
    // First flow step — the redesigned "Find your pup" avatar picker. It runs in
    // its own full-screen dark shell (matching the auth screens) rather than the
    // light questionnaire overlay used by the remaining steps.
    stepKey = "pup";
    stepNode = (
      <FindYourPup
        sticker={sticker}
        onSticker={setSticker}
        bg={bg}
        onBg={setBg}
        onBack={backToAuth}
        onNext={next}
      />
    );
  } else if (step === 3) {
    // Name step — same full-screen dark shell, with an autofocused text input.
    stepKey = "name";
    stepNode = (
      <NameStep
        value={name}
        error={nameError}
        onChange={(v) => {
          setName(v);
          setNameError(false);
        }}
        onBack={() => go(FIRST_INPUT_STEP)}
        onNext={nextFromName}
      />
    );
  } else if (step === 4) {
    // Breed step — same full-screen dark shell with an autofocused input.
    stepKey = "breed";
    stepNode = (
      <BreedStep value={breed} dogName={dogName} onChange={setBreed} onBack={back} onNext={next} />
    );
  } else if (step === 5) {
    stepKey = "birthday";
    stepNode = (
      <BirthdayStep
        dogName={dogName}
        value={birthday}
        onChange={setBirthday}
        onBack={back}
        onNext={next}
      />
    );
  } else if (step === 6) {
    stepKey = "weight";
    stepNode = (
      <WeightStep
        dogName={dogName}
        value={weight}
        onChange={setWeight}
        onBack={back}
        onNext={next}
      />
    );
  } else if (step === 7) {
    stepKey = "food-goal";
    stepNode = (
      <FoodGoalStep
        dogName={dogName}
        value={foodGoal}
        onChange={setFoodGoal}
        onBack={back}
        onNext={next}
      />
    );
  } else if (step === 8) {
    stepKey = "meals";
    stepNode = (
      <MealsStep
        dogName={dogName}
        value={mealsPerDay}
        onChange={setMealsPerDay}
        onBack={back}
        onNext={next}
      />
    );
  } else if (step === 9) {
    stepKey = "vet";
    stepNode = (
      <VetStep
        dogName={dogName}
        vet={vet}
        vetPhone={vetPhone}
        onVet={setVet}
        onVetPhone={setVetPhone}
        onBack={back}
        onNext={next}
      />
    );
  } else if (step === REVIEW_STEP) {
    stepKey = "review";
    stepNode = (
      <ReviewStep
        dogName={dogName}
        name={name}
        breed={breed}
        birthday={birthday}
        foodGoal={foodGoal}
        mealsPerDay={mealsPerDay}
        vet={vet}
        onBack={back}
        onNext={() => go(NOTIF_STEP)}
      />
    );
  } else if (step === NOTIF_STEP) {
    stepKey = "notif";
    stepNode = (
      <NotifStep
        dogName={dogName}
        walkNotif={walkNotif}
        onWalkNotif={setWalkNotif}
        walkTime={walkTime}
        onWalkTime={setWalkTime}
        feedNotif={feedNotif}
        onFeedNotif={setFeedNotif}
        feedTime={feedTime}
        onFeedTime={setFeedTime}
        vetNotif={vetNotif}
        onVetNotif={setVetNotif}
        onBack={back}
        onEnable={() => void enableReminders()}
        onSkip={celebrate}
      />
    );
  } else {
    stepKey = "celebration";
    stepNode = <Celebration dogName={dogName} onDone={finish} />;
  }

  return (
    <div style={{ background: "var(--color-pawpal-page)", minHeight: "100vh" }}>
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <ScreenTransition key={stepKey} direction={direction} style={{ minHeight: "100vh" }}>
          {stepNode}
        </ScreenTransition>
      </AnimatePresence>
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 6 && !busy;

  // Send a reset link. Requires a valid email in the field first.
  const forgot = async (): Promise<void> => {
    if (!emailOk) {
      setError("Enter your email above to reset your password");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      toast("Password reset link sent — check your email ✉️");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send the reset link. Try again.");
    } finally {
      setBusy(false);
    }
  };

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
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setError(null);
                setMode("signup");
              }}
            >
              Sign up
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setError(null);
                setMode("login");
              }}
            >
              Log in
            </Button>
            <Button variant="ghost" fullWidth onClick={onDogSit}>
              I&rsquo;m dog sitting today
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isSignup = mode === "signup";
  // An error belongs to the email field when the email itself is invalid;
  // otherwise it relates to the password / auth attempt.
  const emailError = error != null && !emailOk;
  const passwordError = error != null && emailOk;

  return (
    <div className="oba">
      <button
        type="button"
        aria-label="Back"
        className="oba-back"
        onClick={() => {
          setError(null);
          setMode("choose");
        }}
      >
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="oba-title">{isSignup ? "Let's get started!" : "Welcome back!"}</h1>

      <div className="oba-fields">
        <div className="oba-field">
          <label className="oba-field-label" htmlFor="oba-email">
            Email
          </label>
          <div className={`oba-input-wrap${emailError ? " error" : ""}`}>
            <input
              id="oba-email"
              className="oba-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              placeholder="you@example.com"
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
            />
          </div>
          {emailError && <p className="oba-fielderror">{error}</p>}
        </div>

        <div className="oba-field">
          <label className="oba-field-label" htmlFor="oba-password">
            Password
          </label>
          <div className={`oba-input-wrap${passwordError ? " error" : ""}`}>
            <input
              id="oba-password"
              className="oba-input"
              type={showPassword ? "text" : "password"}
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              placeholder={isSignup ? "At least 6 characters" : "Your password"}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
              }}
            />
            <button
              type="button"
              className="oba-eye"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
            >
              <Icon icon={showPassword ? Icons.eyeOff : Icons.eye} color="inherit" />
            </button>
          </div>
          {passwordError && <p className="oba-fielderror">{error}</p>}
        </div>
      </div>

      <button
        type="button"
        className="oba-submit"
        onClick={() => void submit()}
        disabled={busy}
      >
        {busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}
      </button>

      {isSignup ? (
        <button
          type="button"
          className="oba-link"
          onClick={() => {
            setError(null);
            setMode("login");
          }}
        >
          I already have an account
        </button>
      ) : (
        <button type="button" className="oba-link" onClick={() => void forgot()} disabled={busy}>
          Forgot password
        </button>
      )}

      <div className="oba-spacer" />
    </div>
  );
}

// Redesigned first onboarding step (new dark UI, Figma node 156:881). A live
// preview, a background-colour picker, and a grid of hand-drawn dog stickers.
// The picked pup + colour become the profile avatar.
function FindYourPup({
  sticker,
  onSticker,
  bg,
  onBg,
  onBack,
  onNext,
}: {
  sticker: string;
  onSticker: (id: string) => void;
  bg: string;
  onBg: (hex: string) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const selectedUrl = AVATAR_STICKERS.find((s) => s.id === sticker)?.url;
  return (
    <div className="fyp">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">Find your pup</h1>
      <p className="fyp-sub">
        Pick the pup that looks most like yours — you can always change it later.
      </p>

      {/* Live preview of the chosen pup on the chosen background. */}
      <div className="fyp-preview" style={{ background: bg }}>
        {selectedUrl && <img src={selectedUrl} alt="" className="fyp-preview-img" />}
      </div>

      {/* Background colour picker. */}
      <div className="fyp-colors" role="radiogroup" aria-label="Background colour">
        {AVATAR_BG_COLORS.map((c) => {
          const selected = bg.toUpperCase() === c.hex.toUpperCase();
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${c.key} background`}
              className={`fyp-color${selected ? " selected" : ""}`}
              style={{ background: c.hex }}
              onClick={() => onBg(c.hex)}
            />
          );
        })}
      </div>

      {/* Sticker grid — each tile takes the chosen background colour. */}
      <div className="fyp-grid" role="radiogroup" aria-label="Choose your pup">
        {AVATAR_STICKERS.map((s) => {
          const selected = sticker === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={s.label}
              className={`fyp-tile${selected ? " selected" : ""}`}
              style={{ background: bg }}
              onClick={() => onSticker(s.id)}
            >
              <img src={s.url} alt="" className="fyp-tile-img" />
            </button>
          );
        })}
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Name step (new dark UI). Full-screen dark shell with an autofocused text
// input and the shared pill button.
function NameStep({
  value,
  error,
  onChange,
  onBack,
  onNext,
}: {
  value: string;
  error: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">What&apos;s their name?</h1>
      <p className="fyp-sub">We&apos;ll use it to make PawPal feel like home.</p>

      <div className="oba-field">
        <label className="oba-field-label" htmlFor="obn-name">
          Name
        </label>
        <div className={`oba-input-wrap${error ? " error" : ""}`}>
          <input
            id="obn-name"
            ref={inputRef}
            className="oba-input"
            type="text"
            autoComplete="off"
            value={value}
            placeholder="e.g. Zipi"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onNext();
            }}
          />
        </div>
        {error && <p className="oba-fielderror">Every good dog needs a name 🐶</p>}
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Breed step (new dark UI). Full-screen dark shell with an autofocused text
// input and the shared pill button.
function BreedStep({
  value,
  dogName,
  onChange,
  onBack,
  onNext,
}: {
  value: string;
  dogName: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">What breed is {dogName}?</h1>
      <p className="fyp-sub">Helps us tailor care tips. Not sure yet? You can skip this.</p>

      <div className="oba-field">
        <label className="oba-field-label" htmlFor="obn-breed">
          Breed
        </label>
        <div className="oba-input-wrap">
          <input
            id="obn-breed"
            ref={inputRef}
            className="oba-input"
            type="text"
            autoComplete="off"
            value={value}
            placeholder="e.g. Mixed breed"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onNext();
            }}
          />
        </div>
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Birthday step (new dark UI). Dark shell wrapping the month/day/year wheel.
function BirthdayStep({
  dogName,
  value,
  onChange,
  onBack,
  onNext,
}: {
  dogName: string;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">When do we get to celebrate {dogName}?</h1>
      <p className="fyp-sub">Their birthday lets us track age and milestones.</p>

      <WheelDate value={value} onChange={onChange} />

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Weight step (new dark UI). Autofocused numeric input.
function WeightStep({
  dogName,
  value,
  onChange,
  onBack,
  onNext,
}: {
  dogName: string;
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">How much does {dogName} weigh?</h1>
      <p className="fyp-sub">Weight helps us gauge portions and spot changes over time.</p>

      <div className="oba-field">
        <label className="oba-field-label" htmlFor="obn-weight">
          Weight (kg)
        </label>
        <div className="oba-input-wrap">
          <input
            id="obn-weight"
            ref={inputRef}
            className="oba-input"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            placeholder="e.g. 12"
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onNext();
            }}
          />
        </div>
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Food goal step (new dark UI). Big readout above the shared slider.
function FoodGoalStep({
  dogName,
  value,
  onChange,
  onBack,
  onNext,
}: {
  dogName: string;
  value: number;
  onChange: (value: number) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">{dogName}’s daily food goal</h1>
      <p className="fyp-sub">Set a gentle target — we’ll help you keep the bowl balanced.</p>

      <div className="obp-goal-readout">
        <span className="obp-goal-value">{value}</span>
        <span className="obp-goal-unit">grams / day</span>
      </div>
      <Slider
        label="Daily food goal"
        value={value}
        min={50}
        max={1000}
        step={10}
        onChange={(v: number) => onChange(v)}
      />

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Meals-per-day step (new dark UI). Circular radio grid.
function MealsStep({
  dogName,
  value,
  onChange,
  onBack,
  onNext,
}: {
  dogName: string;
  value: number;
  onChange: (value: number) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">How many meals a day?</h1>
      <p className="fyp-sub">Splitting food across meals keeps {dogName} satisfied.</p>

      <div className="obp-circle-grid" role="radiogroup" aria-label="Meals per day">
        {MEAL_OPTIONS.map((mealCount) => {
          const selected = value === mealCount;
          const recommended = mealCount === RECOMMENDED_MEALS;
          return (
            <button
              key={mealCount}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`obp-circle${selected ? " selected" : ""}`}
              onClick={() => onChange(mealCount)}
            >
              <span className="obp-circle-count">{mealCount}</span>
              <span className="obp-circle-unit">per day</span>
              {recommended && <span className="obp-circle-tag">Recommended</span>}
            </button>
          );
        })}
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Vet step (new dark UI). Two optional inputs plus a skip link.
function VetStep({
  dogName,
  vet,
  vetPhone,
  onVet,
  onVetPhone,
  onBack,
  onNext,
}: {
  dogName: string;
  vet: string;
  vetPhone: string;
  onVet: (value: string) => void;
  onVetPhone: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">{dogName}’s vet</h1>
      <p className="fyp-sub">
        Keep your vet a tap away for appointments and emergencies. You can add this later.
      </p>

      <div className="oba-fields">
        <div className="oba-field">
          <label className="oba-field-label" htmlFor="obn-vet">
            Vet name
          </label>
          <div className="oba-input-wrap">
            <input
              id="obn-vet"
              ref={inputRef}
              className="oba-input"
              type="text"
              autoComplete="off"
              value={vet}
              placeholder="e.g. Elm Street Vets"
              onChange={(e) => onVet(e.target.value)}
            />
          </div>
        </div>
        <div className="oba-field">
          <label className="oba-field-label" htmlFor="obn-vetphone">
            Vet phone
          </label>
          <div className="oba-input-wrap">
            <input
              id="obn-vetphone"
              className="oba-input"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={vetPhone}
              placeholder="e.g. 555 0100"
              onChange={(e) => onVetPhone(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onNext();
              }}
            />
          </div>
        </div>
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
      <button type="button" className="oba-link" onClick={onNext}>
        Skip for now
      </button>
    </div>
  );
}

// Review step (new dark UI). Summary card before the notifications step.
function ReviewStep({
  dogName,
  name,
  breed,
  birthday,
  foodGoal,
  mealsPerDay,
  vet,
  onBack,
  onNext,
}: {
  dogName: string;
  name: string;
  breed: string;
  birthday: string;
  foodGoal: number;
  mealsPerDay: number;
  vet: string;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">You’re all set</h1>
      <p className="fyp-sub">
        Everything you’ve entered stays private on your device. Ready to start caring for {dogName}?
      </p>

      <div className="obp-review-card">
        <ReviewRow label="Name" value={name.trim() || "—"} />
        <ReviewRow label="Breed" value={breed || "—"} />
        <ReviewRow label="Birthday" value={prettyDate(birthday)} />
        <ReviewRow label="Food goal" value={`${foodGoal} g/day · ${mealsPerDay} meals`} />
        <ReviewRow label="Vet" value={vet || "Not added"} />
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onNext}>
        Continue
      </button>
    </div>
  );
}

// Notifications step (new dark UI). Reminder toggles plus enable / skip actions.
function NotifStep({
  dogName,
  walkNotif,
  onWalkNotif,
  walkTime,
  onWalkTime,
  feedNotif,
  onFeedNotif,
  feedTime,
  onFeedTime,
  vetNotif,
  onVetNotif,
  onBack,
  onEnable,
  onSkip,
}: {
  dogName: string;
  walkNotif: boolean;
  onWalkNotif: (value: boolean) => void;
  walkTime: string;
  onWalkTime: (value: string) => void;
  feedNotif: boolean;
  onFeedNotif: (value: boolean) => void;
  feedTime: string;
  onFeedTime: (value: string) => void;
  vetNotif: boolean;
  onVetNotif: (value: boolean) => void;
  onBack: () => void;
  onEnable: () => void;
  onSkip: () => void;
}): React.ReactElement {
  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">Never miss a moment with {dogName}</h1>
      <p className="fyp-sub">
        Gentle nudges so a walk, meal or vet visit never slips your mind. Pick what helps — you can
        change these anytime.
      </p>

      <div className="obp-notif-grid">
        <NotifOption
          icon="🚶"
          label="Walks"
          enabled={walkNotif}
          onToggle={onWalkNotif}
          time={walkTime}
          onTime={onWalkTime}
        />
        <NotifOption
          icon="🍖"
          label="Feeding"
          enabled={feedNotif}
          onToggle={onFeedNotif}
          time={feedTime}
          onTime={onFeedTime}
        />
        <NotifOption
          icon="🩺"
          label="Vet"
          enabled={vetNotif}
          onToggle={onVetNotif}
          caption="Around 9 AM"
        />
      </div>

      <div className="oba-spacer" />

      <button type="button" className="oba-submit" onClick={onEnable}>
        Turn on reminders
      </button>
      <button type="button" className="oba-link" onClick={onSkip}>
        Set up later
      </button>
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
      <Toggle label={`${label} reminders`} value={enabled} onChange={onToggle} />
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
    <div className="obn obn-celebrate">
      <div className="obp-burst" aria-hidden>
        🎉
      </div>
      <h1 className="fyp-title" style={{ textAlign: "center" }}>
        Welcome aboard!
      </h1>
      <p className="fyp-sub" style={{ textAlign: "center" }}>
        {dogName} is going to love this. Taking you to the dashboard…
      </p>
    </div>
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

