import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Button } from "../components/Button";
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
import { requestPasswordReset, signIn, signInWithGoogle, signUp } from "../lib/auth";
import { syncFromSupabase } from "../lib/supabase";
import { COMMON_BREEDS, OTHER_BREED } from "../lib/breeds";
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
// Account creation (email/password + Google) shown at the very end of the
// sign-up flow, after the dog's details have been reviewed.
const ACCOUNT_STEP = 13;

interface OnboardingProposalProps {
  onDone: () => void;
  /** "I'm dog sitting today" — hands off to the sitter claim flow. */
  onDogSit: () => void;
}

export function OnboardingProposal({ onDone, onDogSit }: OnboardingProposalProps): React.ReactElement {
  const { db, update, replace } = useDb();
  const toast = useToast();

  const [phase, setPhase] = useState<"auth" | "flow">("auth");
  // True when the user chose "Sign up": their account is created at the end of
  // the flow (the AccountStep) instead of up front.
  const [needsAccount, setNeedsAccount] = useState(false);
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
  // 0 means "not set yet" — the food-goal step seeds a weight-based default.
  const [foodGoal, setFoodGoal] = useState(0);
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
      <AuthGate
        onLoggedIn={handleLoggedIn}
        onStartSignup={() => {
          setNeedsAccount(true);
          goToFlow();
        }}
        onDogSit={onDogSit}
      />
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
        weight={weight}
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
        weight={weight}
        foodGoal={foodGoal}
        mealsPerDay={mealsPerDay}
        vet={vet}
        avatarUrl={AVATAR_STICKERS.find((s) => s.id === sticker)?.url}
        avatarBg={bg}
        onBack={back}
        onNext={() => go(needsAccount ? ACCOUNT_STEP : NOTIF_STEP)}
      />
    );
  } else if (step === ACCOUNT_STEP) {
    stepKey = "account";
    stepNode = (
      <AccountStep
        dogName={dogName}
        onBack={() => go(REVIEW_STEP)}
        onCreated={() => go(NOTIF_STEP)}
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
        onBack={() => go(needsAccount ? ACCOUNT_STEP : REVIEW_STEP)}
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

type AuthMode = "choose" | "login";

// Google's multicolour "G" mark, inlined so it renders without a network fetch.
function GoogleGlyph(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

// Optional account gate shown before the questionnaire. Email + password only.

// "Continue on this device" keeps everything local (device-scoped sync).
function AuthGate({
  onLoggedIn,
  onStartSignup,
  onDogSit,
}: {
  onLoggedIn: () => Promise<void>;
  onStartSignup: () => void;
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

  // Hand off to Google's OAuth flow. This navigates away from the app; the
  // session is finished on the return trip (see completeOAuthRedirect in App).
  const googleSignIn = (): void => {
    setError(null);
    setBusy(true);
    signInWithGoogle();
  };

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
      await signIn(email.trim(), password);
      await onLoggedIn();
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
                onStartSignup();
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

      <h1 className="oba-title">Welcome back!</h1>

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
              autoComplete="current-password"
              value={password}
              placeholder="Your password"
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
        {busy ? "Please wait…" : "Log in"}
      </button>

      <div className="oba-divider">
        <span>or</span>
      </div>

      <button type="button" className="oba-google" onClick={googleSignIn} disabled={busy}>
        <GoogleGlyph />
        Continue with Google
      </button>

      <button type="button" className="oba-link" onClick={() => void forgot()} disabled={busy}>
        Forgot password
      </button>

      <div className="oba-spacer" />
    </div>
  );
}

// Account creation shown at the very end of the sign-up flow, after the dog's
// details have been reviewed. Same email/password + Google UI as the auth
// screen, but its "Create account" action advances the flow instead of
// gating it up front.
function AccountStep({
  dogName,
  onBack,
  onCreated,
}: {
  dogName: string;
  onBack: () => void;
  onCreated: () => void;
}): React.ReactElement {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 6 && !busy;
  const emailError = error != null && !emailOk;
  const passwordError = error != null && emailOk;

  const googleSignIn = (): void => {
    setError(null);
    setBusy(true);
    signInWithGoogle();
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
      const { needsConfirmation } = await signUp(email.trim(), password);
      toast(
        needsConfirmation
          ? "Account created — check your email to confirm ✉️"
          : "Account created 🎉",
      );
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="oba">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="oba-title">Save {dogName}&rsquo;s profile</h1>
      <p
        style={{
          margin: "-14px 0 24px",
          fontFamily: "var(--font-ui)",
          fontSize: 16,
          lineHeight: 1.5,
          color: "color-mix(in srgb, var(--color-pawpal-hero) 70%, transparent)",
        }}
      >
        Create an account to back everything up and sync across your devices.
      </p>

      <div className="oba-fields">
        <div className="oba-field">
          <label className="oba-field-label" htmlFor="acc-email">
            Email
          </label>
          <div className={`oba-input-wrap${emailError ? " error" : ""}`}>
            <input
              id="acc-email"
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
          <label className="oba-field-label" htmlFor="acc-password">
            Password
          </label>
          <div className={`oba-input-wrap${passwordError ? " error" : ""}`}>
            <input
              id="acc-password"
              className="oba-input"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              placeholder="At least 6 characters"
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

      <button type="button" className="oba-submit" onClick={() => void submit()} disabled={busy}>
        {busy ? "Please wait…" : "Create account"}
      </button>

      <div className="oba-divider">
        <span>or</span>
      </div>

      <button type="button" className="oba-google" onClick={googleSignIn} disabled={busy}>
        <GoogleGlyph />
        Continue with Google
      </button>

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

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
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
        {error && <p className="oba-fielderror">Every good dog needs a name</p>}
      </div>

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}

// Breed step (new dark UI). A native dropdown of the most common breeds (opens
// the platform picker on iOS) plus an "Other" option that reveals a free-text
// input for anything not listed.
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
  const isKnownBreed = COMMON_BREEDS.includes(value);
  const [otherActive, setOtherActive] = useState<boolean>(value !== "" && !isKnownBreed);
  const [showError, setShowError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (otherActive) inputRef.current?.focus();
  }, [otherActive]);

  const handleSelect = (selected: string): void => {
    setShowError(false);
    if (selected === OTHER_BREED) {
      setOtherActive(true);
      if (COMMON_BREEDS.includes(value)) onChange("");
    } else {
      setOtherActive(false);
      onChange(selected);
    }
  };

  const selectValue = otherActive ? OTHER_BREED : isKnownBreed ? value : "";
  // When "Other…" is chosen, the free-text breed name must not be left blank.
  const otherEmpty = otherActive && value.trim() === "";

  const handleContinue = (): void => {
    if (otherEmpty) {
      setShowError(true);
      inputRef.current?.focus();
      return;
    }
    onNext();
  };

  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">What breed is {dogName}?</h1>
      <p className="fyp-sub">Helps us tailor care tips. Not sure yet? You can skip this.</p>

      <div className="oba-field">
        <label className="oba-field-label" htmlFor="obn-breed-select">
          Breed
        </label>
        <div className="oba-input-wrap obp-select-wrap">
          <select
            id="obn-breed-select"
            className="oba-input obp-select"
            value={selectValue}
            onChange={(e) => handleSelect(e.target.value)}
          >
            <option value="">Select a breed…</option>
            {COMMON_BREEDS.map((breed) => (
              <option key={breed} value={breed}>
                {breed}
              </option>
            ))}
            <option value={OTHER_BREED}>Other…</option>
          </select>
          <span className="obp-select-caret" aria-hidden>
            <Icon icon={Icons.chevronDown} color="inherit" />
          </span>
        </div>
      </div>

      {otherActive && (
        <div className="oba-field obp-breed-other">
          <label className="oba-field-label" htmlFor="obn-breed">
            Breed name
          </label>
          <div className={`oba-input-wrap${showError ? " error" : ""}`}>
            <input
              id="obn-breed"
              ref={inputRef}
              className="oba-input"
              type="text"
              autoComplete="off"
              value={value}
              placeholder="e.g. Cavapoo"
              aria-invalid={showError}
              onChange={(e) => {
                if (showError) setShowError(false);
                onChange(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleContinue();
              }}
            />
          </div>
          {showError && <p className="oba-fielderror">This field is mandatory</p>}
        </div>
      )}

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={handleContinue}>
          Continue
        </button>
      </div>
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

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
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
          Weight
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
          <span className="oba-input-suffix" aria-hidden>
            kg
          </span>
        </div>
      </div>

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
    </div>
  );
}

// Food goal step (new dark UI). Weight-aware slider with a highlighted
// recommended range and a live gram readout.
const FOOD_GOAL_MIN = 50;
const FOOD_GOAL_MAX = 800;
const FOOD_GOAL_STEP = 10;

// Recommended daily grams by weight, interpolated between these anchor points.
const FOOD_ANCHORS = [
  { kg: 5, min: 50, max: 90 },
  { kg: 10, min: 100, max: 180 },
  { kg: 20, min: 240, max: 370 },
  { kg: 30, min: 360, max: 500 },
  { kg: 40, min: 470, max: 600 },
];

const roundTo10 = (n: number): number => Math.round(n / 10) * 10;

function recommendFoodRange(kg: number): { min: number; max: number } | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  const first = FOOD_ANCHORS[0];
  const last = FOOD_ANCHORS[FOOD_ANCHORS.length - 1];
  if (kg <= first.kg) return { min: first.min, max: first.max };
  if (kg >= last.kg) return { min: last.min, max: last.max };
  for (let i = 0; i < FOOD_ANCHORS.length - 1; i++) {
    const lo = FOOD_ANCHORS[i];
    const hi = FOOD_ANCHORS[i + 1];
    if (kg >= lo.kg && kg <= hi.kg) {
      const t = (kg - lo.kg) / (hi.kg - lo.kg);
      return {
        min: roundTo10(lo.min + (hi.min - lo.min) * t),
        max: roundTo10(lo.max + (hi.max - lo.max) * t),
      };
    }
  }
  return null;
}

function FoodGoalStep({
  dogName,
  weight,
  value,
  onChange,
  onBack,
  onNext,
}: {
  dogName: string;
  weight: string;
  value: number;
  onChange: (value: number) => void;
  onBack: () => void;
  onNext: () => void;
}): React.ReactElement {
  const kg = Number.parseFloat(weight);
  const rec = recommendFoodRange(kg);
  const defaultGoal = rec ? roundTo10((rec.min + rec.max) / 2) : 300;

  // Seed a weight-based default the first time we land here (value 0 = unset).
  useEffect(() => {
    if (value < FOOD_GOAL_MIN) onChange(defaultGoal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = value >= FOOD_GOAL_MIN ? value : defaultGoal;
  const span = FOOD_GOAL_MAX - FOOD_GOAL_MIN;
  const pct = ((shown - FOOD_GOAL_MIN) / span) * 100;
  const bandLeft = rec ? ((rec.min - FOOD_GOAL_MIN) / span) * 100 : 0;
  const bandWidth = rec ? ((rec.max - rec.min) / span) * 100 : 0;

  return (
    <div className="obn">
      <button type="button" aria-label="Back" className="oba-back" onClick={onBack}>
        <Icon icon={Icons.caretLeft} color="inherit" />
      </button>

      <h1 className="fyp-title">{dogName}’s daily food goal</h1>
      <p className="fyp-sub">Set a gentle target — we’ll help you keep the bowl balanced.</p>

      <div className="obp-goal-readout">
        <span className="obp-goal-value">{shown}</span>
        <span className="obp-goal-unit">grams / day</span>
      </div>
      {rec && (
        <p className="obp-goal-rec">
          Recommended for {kg} kg: {rec.min}–{rec.max} g
        </p>
      )}

      <div className="obp-slider">
        <div className="obp-slider-rail" aria-hidden>
          {rec && (
            <div
              className="obp-slider-band"
              style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }}
            />
          )}
          <div className="obp-slider-fill" style={{ width: `${pct}%` }} />
        </div>
        <input
          className="obp-range"
          type="range"
          min={FOOD_GOAL_MIN}
          max={FOOD_GOAL_MAX}
          step={FOOD_GOAL_STEP}
          value={shown}
          aria-label="Daily food goal (grams)"
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <div className="obp-slider-scale" aria-hidden>
        <span>{FOOD_GOAL_MIN} g</span>
        <span>{FOOD_GOAL_MAX} g</span>
      </div>

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
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

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
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

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
        <button type="button" className="oba-skip" onClick={onNext}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

// Review step (new dark UI). Pet ID card summary before the notifications step.
function ReviewStep({
  dogName,
  name,
  breed,
  birthday,
  weight,
  foodGoal,
  mealsPerDay,
  vet,
  avatarUrl,
  avatarBg,
  onBack,
  onNext,
}: {
  dogName: string;
  name: string;
  breed: string;
  birthday: string;
  weight: string;
  foodGoal: number;
  mealsPerDay: number;
  vet: string;
  avatarUrl?: string;
  avatarBg: string;
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

      <div className="obp-idcard">
        <div className="obp-idcard-head">
          <span className="obp-idcard-kicker">Pet Identity Card</span>
          <Icon icon={Icons.pawPrint} color="inherit" />
        </div>

        <span className="obp-idcard-watermark" aria-hidden>
          <Icon icon={Icons.pawPrint} color="inherit" />
        </span>

        <div className="obp-idcard-body">
          <div className="obp-idcard-id">
            <div className="obp-idcard-photo" style={{ background: avatarBg }}>
              {avatarUrl && <img src={avatarUrl} alt="" className="obp-idcard-photo-img" />}
            </div>
            <div className="obp-idcard-headline">
              <span className="obp-idcard-name">{name.trim() || dogName || "—"}</span>
              <span className="obp-idcard-breed">{breed || "Mixed breed"}</span>
            </div>
          </div>

          <dl className="obp-idcard-meta">
            <div>
              <dt>Born</dt>
              <dd>{prettyDate(birthday)}</dd>
            </div>
            <div>
              <dt>Weight</dt>
              <dd>{weight.trim() ? `${weight.trim()} kg` : "—"}</dd>
            </div>
            <div>
              <dt>Daily food</dt>
              <dd>
                {foodGoal} g · {mealsPerDay} meals
              </dd>
            </div>
            <div>
              <dt>Vet</dt>
              <dd>{vet || "Not added"}</dd>
            </div>
          </dl>
        </div>

        <div className="obp-idcard-barcode" aria-hidden>
          {Array.from({ length: 34 }).map((_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onNext}>
          Continue
        </button>
      </div>
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
    <div className="obn obn-notify">
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

      <div className="fyp-footer">
        <button type="button" className="oba-submit" onClick={onEnable}>
          Turn on reminders
        </button>
        <button type="button" className="oba-link" onClick={onSkip}>
          Set up later
        </button>
      </div>
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

