import { useEffect, useState } from "react";
import { VStack } from "@astryxdesign/core/Stack";
import { Button } from "../../components/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useDb } from "../../lib/store";
import { useToast } from "../../lib/toast";
import { syncFromSupabase } from "../../lib/supabase";
import { getCurrentUser, signIn, signOut, signUp, type AuthUser } from "../../lib/auth";
import { SettingsPage, Panel, PanelTitle, PanelText } from "./shared";

/**
 * Account subpage. Signed in → shows the account + sign out. Signed out → email
 * login / sign-up. When signing in, cloud data is pulled and merged locally.
 */
export function AccountScreen({ onBack }: { onBack: () => void }): React.ReactElement {
  const { db, replace } = useDb();
  const toast = useToast();
  const [user, setUser] = useState<AuthUser | null>(getCurrentUser);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onAuth = (): void => setUser(getCurrentUser());
    window.addEventListener("pawpal:auth", onAuth);
    return () => window.removeEventListener("pawpal:auth", onAuth);
  }, []);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = emailOk && password.length >= 6 && !busy;

  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      setError(!emailOk ? "Enter a valid email address" : "Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email.trim(), password);
        toast(needsConfirmation ? "Account created — check your email ✉️" : "Account created 🎉");
      } else {
        await signIn(email.trim(), password);
        try {
          const payload = await syncFromSupabase();
          if (payload) replace({ ...db, ...payload });
        } catch {
          // Ignore pull failure; local data is untouched.
        }
        toast("Signed in ✓");
      }
      setEmail("");
      setPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const doSignOut = async (): Promise<void> => {
    await signOut();
    toast("Signed out");
  };

  if (user) {
    return (
      <SettingsPage title="Account" onBack={onBack}>
        <Panel>
          <VStack gap={3}>
            <VStack gap={0.5}>
              <PanelTitle>Signed in</PanelTitle>
              <PanelText>{user.email}</PanelText>
            </VStack>
            <Button
              label="Sign out"
              variant="secondary"
              onClick={() => void doSignOut()}
              style={{ width: "100%" }}
            />
          </VStack>
        </Panel>
      </SettingsPage>
    );
  }

  const isSignup = mode === "signup";

  return (
    <SettingsPage title="Account" onBack={onBack}>
      <Panel>
        <VStack gap={3}>
          <VStack gap={0.5}>
            <PanelTitle>{isSignup ? "Create an account" : "Log in"}</PanelTitle>
            <PanelText>Back up and sync your pup across devices.</PanelText>
          </VStack>
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
            style={{ width: "100%" }}
          />
        </VStack>
      </Panel>
    </SettingsPage>
  );
}
