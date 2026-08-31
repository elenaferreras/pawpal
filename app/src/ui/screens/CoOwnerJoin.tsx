import { useEffect, useRef, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { getCurrentUser, signIn, signInWithGoogle, signUp } from "../lib/auth";
import { formatCode, joinAsCoOwner, type JoinResult } from "../lib/coowner";
import { Icons } from "../lib/icons";
import { DogFace } from "../avatar/DogAvatar";
import type { Avatar } from "../types";
import { Button } from "../components/Button";

interface CoOwnerJoinProps {
  initialCode?: string;
  dogName?: string;
  dogAvatar?: Avatar;
  onClose: () => void;
  onJoined: (result: JoinResult) => void;
}

/**
 * Co-owner join screen. Reached from a `?join=CODE` invite link. A co-owner
 * must have their own account, so this gates on sign-in before redeeming the
 * code. Google sign-in navigates away and returns; the pending code is held by
 * App so the join resumes on the trip back.
 */
export function CoOwnerJoin({
  initialCode,
  dogName,
  dogAvatar,
  onClose,
  onJoined,
}: CoOwnerJoinProps): React.ReactElement {
  const [code, setCode] = useState(initialCode ? formatCode(initialCode) : "");
  const [signedIn, setSignedIn] = useState(() => !!getCurrentUser());
  // Auth path: pick one first ("choose"), then reveal the email fields.
  const [authView, setAuthView] = useState<"choose" | "login" | "signup">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const clean = code.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
  const codeOk = clean.length >= 6;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const dog = dogName?.trim() || null;
  const signupMode = authView === "signup";
  // A valid code from the invite link means we can hide the manual entry field.
  const hasLinkCode =
    !!initialCode && initialCode.replace(/[^0-9a-zA-Z]/g, "").length >= 6;
  // Route the error to the field it belongs to: an invalid email blames the
  // email field; anything else (short/invalid password, auth failure) the
  // password field.
  const emailError = error != null && !emailOk;
  const passwordError = error != null && emailOk;

  const join = async (): Promise<void> => {
    if (!codeOk) return;
    setBusy(true);
    setError(null);
    try {
      const result = await joinAsCoOwner(clean);
      onJoined(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join. Please try again.");
      setBusy(false);
    }
  };

  // Pick up a sign-in that completed elsewhere (notably the Google OAuth
  // round-trip, which reloads the app). Once signed in with a valid code,
  // resume the join automatically so the trip back "just works".
  const resumed = useRef(false);
  useEffect(() => {
    const onAuth = (): void => {
      const now = !!getCurrentUser();
      setSignedIn(now);
      if (now && !resumed.current && codeOk) {
        resumed.current = true;
        void join();
      }
    };
    window.addEventListener("pawpal:auth", onAuth);
    return () => window.removeEventListener("pawpal:auth", onAuth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeOk]);

  const authenticate = async (): Promise<void> => {
    if (!emailOk || password.length < 6) {
      setError(
        !emailOk ? "Enter a valid email address" : "Password must be at least 6 characters",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (signupMode) {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo("Check your email to confirm your account, then reopen this link.");
          setBusy(false);
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      setSignedIn(true);
      setBusy(false);
      // Redeem the invite now that we have an account.
      await join();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="obw obw--plain cojoin">
      <button type="button" className="cojoin-close" aria-label="Close" onClick={onClose}>
        <Icon icon={Icons.x} color="inherit" />
      </button>

      <div className="obw-ctas obw-ctas--top">
        {/* Visual hero: you + the dog, joined together. */}
        <div className="cojoin-hero" aria-hidden>
          <div className="cojoin-pair">
            <div
              className="cojoin-avatar cojoin-avatar--dog"
              style={dogAvatar?.bg ? { background: dogAvatar.bg } : undefined}
            >
              {dogAvatar ? (
                <DogFace avatar={dogAvatar} size={104} className="cojoin-dogface" />
              ) : (
                <img src="onboarding/dog-orange.svg" alt="" className="cojoin-dogimg" />
              )}
            </div>
            <span className="cojoin-link">
              <Icon icon={Icons.pawPrint} color="inherit" />
            </span>
            <div className="cojoin-avatar cojoin-avatar--you">
              <Icon icon={Icons.user} color="inherit" />
            </div>
          </div>
          <div className="cojoin-labels">
            <span>{dog || "Your pup"}</span>
            <span>You</span>
          </div>
        </div>

        <div className="obw-heading">
          <h1 className="obw-title">{dog ? `Join ${dog}'s family` : "Join the family"}</h1>
          <p className="obw-sub">
            You've been invited to share full access to {dog || "a dog"} on PawPal
            — every walk, meal and note, always in sync.
          </p>
        </div>

        <div className="obw-buttons">
          {!hasLinkCode && (
            <input
              className="sitclaim-input"
              value={code}
              onChange={(e) => {
                setCode(formatCode(e.target.value.replace(/[^0-9a-zA-Z]/g, "")));
                setError(null);
              }}
              placeholder="XXXX-XXXX"
              inputMode="text"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={9}
              aria-label="Invite code"
            />
          )}

          {signedIn ? (
            <>
              {error && <p className="sitclaim-error">{error}</p>}
              <Button
                variant="primary"
                fullWidth
                onClick={() => void join()}
                isDisabled={!codeOk || busy}
              >
                {busy ? "Joining\u2026" : dog ? `Join ${dog}` : "Join"}
              </Button>
            </>
          ) : authView === "choose" ? (
            <>
              <Button variant="primary" fullWidth onClick={() => signInWithGoogle()}>
                Continue with Google
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setAuthView("signup");
                }}
              >
                Sign up with email
              </Button>
              <button
                type="button"
                className="cojoin-alt"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setAuthView("login");
                }}
              >
                Already have an account? Log in
              </button>
            </>
          ) : (
            <>
              <div className={`oba-input-wrap${emailError ? " error" : ""}`}>
                <input
                  className="oba-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  placeholder="you@example.com"
                  aria-label="Email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                    setInfo(null);
                  }}
                />
              </div>
              {emailError && <p className="cojoin-field-error">{error}</p>}
              <div className={`oba-input-wrap${passwordError ? " error" : ""}`}>
                <input
                  className="oba-input"
                  type="password"
                  autoComplete={signupMode ? "new-password" : "current-password"}
                  value={password}
                  placeholder="Password"
                  aria-label="Password"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                    setInfo(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void authenticate();
                  }}
                />
              </div>
              {passwordError && <p className="cojoin-field-error">{error}</p>}
              {info && <p className="sitclaim-info">{info}</p>}
              <Button
                variant="primary"
                fullWidth
                onClick={() => void authenticate()}
                isDisabled={busy || !codeOk}
              >
                {busy
                  ? "Please wait\u2026"
                  : signupMode
                    ? "Sign up & join"
                    : "Log in & join"}
              </Button>
              <button
                type="button"
                className="cojoin-alt"
                onClick={() => {
                  setError(null);
                  setInfo(null);
                  setAuthView("choose");
                }}
              >
                More sign-in options
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
