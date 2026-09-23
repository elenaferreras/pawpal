import { useEffect, useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { AnimatePresence } from "motion/react";
import { pawpalTheme } from "./lib/theme";
import type { Avatar, ScreenId } from "./types";
import { DbProvider, useDb } from "./lib/store";
import { ToastProvider, useToast } from "./lib/toast";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { getNotifConfig, setupReminderChecks } from "./lib/notifications";
import { completeOAuthRedirect, hasPendingOAuth, isSignedIn } from "./lib/auth";
import {
  getRowKey,
  reconcileFromCloud,
  setDataOwner,
  syncFromSupabase,
} from "./lib/supabase";
import { LiveWalkProvider } from "./components/LiveWalk";
import { BottomNav } from "./components/BottomNav";
import { GooeyFab } from "./components/GooeyFab";
import { WalksStats } from "./components/WalksStats";
import { WalkTrackSheet } from "./components/WalkTrackSheet";
import { Splash } from "./components/Splash";
import { DesktopGate, useIsDesktop } from "./components/DesktopGate";
import { CircleReveal } from "./components/CircleReveal";
import { ScreenTransition } from "./components/ScreenTransition";
import { FoodFormModal } from "./components/FoodFormModal";
import { PoopFormModal } from "./components/PoopFormModal";
import { VetAddModal } from "./components/VetAddModal";
import type { RecordType } from "./components/VetAddModal";
import { Dashboard } from "./screens/Dashboard";
import { Food } from "./screens/Food";
import { Bathroom } from "./screens/Bathroom";
import { Vet } from "./screens/Vet";
import { Notifications } from "./screens/Notifications";
import { Settings } from "./screens/settings/Settings";
import { ProfileDetails } from "./screens/settings/ProfileDetails";
import { NotificationsScreen } from "./screens/settings/NotificationsScreen";
import { AccountScreen } from "./screens/settings/AccountScreen";
import { DogSittingScreen } from "./screens/settings/DogSittingScreen";
import { CoOwnersScreen } from "./screens/settings/CoOwnersScreen";
import { CloudSyncScreen } from "./screens/settings/CloudSyncScreen";
import { DataScreen } from "./screens/settings/DataScreen";
import { OnboardingProposal } from "./screens/OnboardingProposal";
import { SitterApp } from "./screens/SitterApp";
import { SitterClaim } from "./screens/SitterClaim";
import { CoOwnerJoin } from "./screens/CoOwnerJoin";
import {
  loadSitterSession,
  saveSitterSession,
  type SitterState,
} from "./lib/sitter";
import { parseAvatarParam, type JoinResult } from "./lib/coowner";
import { defaultDatabase } from "./lib/storage";
import { subscribeToPush, syncReminderPrefs } from "./lib/push";

export function App(): React.ReactElement {
  const isDesktop = useIsDesktop();
  if (isDesktop) {
    return (
      <Theme theme={pawpalTheme}>
        <DesktopGate />
      </Theme>
    );
  }
  return (
    <Theme theme={pawpalTheme}>
      <LayerProvider>
        <DbProvider>
          <ToastProvider>
            <ConfirmProvider>
              <LiveWalkProvider>
                <Shell />
              </LiveWalkProvider>
            </ConfirmProvider>
          </ToastProvider>
        </DbProvider>
      </LayerProvider>
    </Theme>
  );
}

type QuickModal = "none" | "walk-choose" | "walk-track" | "food" | "poop" | "vet";

function Shell(): React.ReactElement {
  const { db, getDb, update: updateDb, replace } = useDb();
  const toast = useToast();
  const [screen, setScreen] = useState<ScreenId>("home");
  const [showSplash, setShowSplash] = useState(true);
  // Show the welcome/onboarding screen whenever there's no active account —
  // a logged-out (or expired) session must land on the welcome screen even if
  // a stale local profile is still marked as onboarded.
  const [onboarding, setOnboarding] = useState(!isSignedIn() || !db.profile.onboarded);
  // True while we finish a Google OAuth round-trip on the first load after the
  // redirect back from Google — keeps the app content hidden until the session
  // (and any cloud profile) has been resolved.
  const [authResolving, setAuthResolving] = useState(() => hasPendingOAuth());
  const [modal, setModal] = useState<QuickModal>("none");
  const [trackOpen, setTrackOpen] = useState(false);
  // First-run bounce on the track-menu launcher until the user opens it once.
  const [hintTrack, setHintTrack] = useState(() => !localStorage.getItem("pawpal_seen_track_menu"));
  const [editWalkIndex, setEditWalkIndex] = useState<number | null>(null);
  // Date to pre-fill when logging a new walk (e.g. the selected calendar day).
  const [walkPrefillDate, setWalkPrefillDate] = useState<string | null>(null);
  const [editReminderIndex, setEditReminderIndex] = useState<number | null>(null);
  const [editVaccineIndex, setEditVaccineIndex] = useState<number | null>(null);
  const [editCheckupIndex, setEditCheckupIndex] = useState<number | null>(null);
  // Record types the health add-sheet is scoped to (per-category add buttons).
  const [addRecordTypes, setAddRecordTypes] = useState<RecordType[] | undefined>(undefined);
  const [editBathroomIndex, setEditBathroomIndex] = useState<number | null>(null);
  // Deep-link request from the dashboard "Notes for the vet" card.
  const [vetOpenNotes, setVetOpenNotes] = useState(false);
  // Origin of the circular Settings reveal (set from the tapped avatar).
  const [settingsOrigin, setSettingsOrigin] = useState<{ x: number; y: number } | null>(null);
  // Origin of the circular Notifications reveal (set from the tapped bell).
  const [notifOrigin, setNotifOrigin] = useState<{ x: number; y: number } | null>(null);

  // Dog-sitter (guest) mode runs independently of the owner's own app/onboarding.
  const [sitter, setSitter] = useState<SitterState | null>(() => loadSitterSession());
  const [claim, setClaim] = useState<{ open: boolean; code?: string }>(() => {
    const c = new URLSearchParams(window.location.search).get("sit");
    return c ? { open: true, code: c } : { open: false };
  });

  // Co-owner join mode. The code is persisted so it survives the Google OAuth
  // round-trip (which strips the query string on the redirect back).
  const [joinCode, setJoinCode] = useState<string | null>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("join");
    let pending: string | null = fromUrl;
    try {
      pending = fromUrl ?? localStorage.getItem("pawpal_pending_join");
      if (pending) localStorage.setItem("pawpal_pending_join", pending);
    } catch {
      /* ignore */
    }
    return pending;
  });

  // Dog name carried by the invite link, shown on the join screen (persisted
  // alongside the code so it survives the OAuth round-trip).
  const [joinDog, setJoinDog] = useState<string | null>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("dog");
    let dog: string | null = fromUrl;
    try {
      dog = fromUrl ?? localStorage.getItem("pawpal_pending_join_dog");
      if (dog) localStorage.setItem("pawpal_pending_join_dog", dog);
    } catch {
      /* ignore */
    }
    return dog;
  });

  // Dog avatar carried by the invite link (JSON), so the join hero shows the
  // real pup. Persisted as a JSON string to survive the OAuth round-trip.
  const [joinAvatar, setJoinAvatar] = useState<Avatar | null>(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("av");
    let raw: string | null = fromUrl;
    try {
      raw = fromUrl ?? localStorage.getItem("pawpal_pending_join_avatar");
      if (raw) localStorage.setItem("pawpal_pending_join_avatar", raw);
    } catch {
      /* ignore */
    }
    return parseAvatarParam(raw) ?? null;
  });

  const clearJoin = (): void => {
    setJoinCode(null);
    setJoinDog(null);
    setJoinAvatar(null);
    try {
      localStorage.removeItem("pawpal_pending_join");
      localStorage.removeItem("pawpal_pending_join_dog");
      localStorage.removeItem("pawpal_pending_join_avatar");
    } catch {
      /* ignore */
    }
    window.history.replaceState({}, "", window.location.pathname);
  };

  // Adopt the primary owner's data after joining as a co-owner, then drop into
  // the normal app pointed at the shared row.
  const onCoOwnerJoined = (result: JoinResult): void => {
    replace({ ...defaultDatabase(), ...(result.snapshot ?? {}) });
    setDataOwner(getRowKey());
    setOnboarding(false);
    clearJoin();
    navigate("home");
  };

  // Finish the Google OAuth redirect: read the tokens out of the URL, store the
  // session, then pull the account's cloud profile. If they've already
  // onboarded, skip straight into the app; otherwise fall through to onboarding.
  useEffect(() => {
    if (!authResolving) return;
    void (async () => {
      try {
        const session = await completeOAuthRedirect();
        if (session) {
          const payload = await syncFromSupabase();
          if (payload?.profile?.onboarded) {
            replace({ ...getDb(), ...payload } as typeof db);
            setOnboarding(false);
          }
          toast("Signed in with Google \u{1F43E}");
        }
      } catch (e) {
        toast(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
      } finally {
        setAuthResolving(false);
      }
    })();
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kick off the minute-by-minute reminder checks once.
  useEffect(() => {
    setupReminderChecks(getDb);
  }, [getDb]);

  // When a native notification is tapped and the app is already open, the
  // service worker posts a message asking us to surface the home screen.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent): void => {
      if (e.data?.type === "notification-open") {
        setScreen((e.data.screen as ScreenId) ?? "home");
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  // Re-register this device for sitter push notifications when signed in and
  // permission is already granted (no-op otherwise). Also re-runs on sign-in.
  useEffect(() => {
    const sync = (): void => {
      if (!isSignedIn()) return;
      void subscribeToPush();
      // Keep the server's reminder mirror current so reminders fire while the
      // app is closed (see reminder-tick Edge Function).
      void syncReminderPrefs(getNotifConfig(), getDb().profile.mealsPerDay || 4);
    };
    sync();
    window.addEventListener("pawpal:auth", sync);
    return () => window.removeEventListener("pawpal:auth", sync);
  }, [getDb]);

  // Losing the session (explicit sign-out or an expired/revoked token) must
  // return to the welcome screen, not strand the user in the app.
  useEffect(() => {
    const onAuth = (e: Event): void => {
      if (!(e as CustomEvent).detail) {
        setOnboarding(true);
        setScreen("home");
      }
    };
    window.addEventListener("pawpal:auth", onAuth);
    return () => window.removeEventListener("pawpal:auth", onAuth);
  }, []);

  // Live-refresh: while signed in and visible, pull in activities a sitter has
  // logged to the owner's cloud data (additive merge, ~every 12s).
  useEffect(() => {
    const tick = (): void => {
      if (document.visibilityState !== "visible" || !isSignedIn()) return;
      void reconcileFromCloud(getDb, updateDb);
    };
    const id = setInterval(tick, 12000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("pawpal:auth", tick);
    tick();
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("pawpal:auth", tick);
    };
  }, [getDb, updateDb]);

  const navigate = (id: ScreenId): void => {
    setScreen(id);
    window.scrollTo(0, 0);
  };

  // Opens Settings with a circular reveal growing from the tapped avatar.
  const openSettings = (origin: { x: number; y: number }): void => {
    setSettingsOrigin(origin);
    navigate("settings");
  };

  // Opens Notifications with a circular reveal growing from the tapped bell.
  const openNotifications = (origin: { x: number; y: number }): void => {
    setNotifOrigin(origin);
    navigate("notifications");
  };

  // Edit opens the Track-walk sheet pre-filled with the walk.
  const openTrackWalk = (index: number | null): void => {
    setEditWalkIndex(index);
    setModal("walk-track");
  };

  // "Log walk" opens the Track-walk sheet.
  const logWalk = (): void => {
    setEditWalkIndex(null);
    setWalkPrefillDate(null);
    setModal("walk-track");
  };

  // Sitter mode takes over the whole screen (ephemeral guest session).
  if (sitter) {
    return (
      <SitterApp
        state={sitter}
        onEnd={() => {
          setSitter(null);
          setClaim({ open: false });
          window.history.replaceState({}, "", window.location.pathname);
        }}
      />
    );
  }
  if (claim.open) {
    return (
      <SitterClaim
        initialCode={claim.code}
        onClose={() => {
          setClaim({ open: false });
          window.history.replaceState({}, "", window.location.pathname);
        }}
        onClaimed={(s) => {
          saveSitterSession(s);
          setSitter(s);
          setClaim({ open: false });
          window.history.replaceState({}, "", window.location.pathname);
        }}
      />
    );
  }
  // Co-owner join takes over the screen until the invite is redeemed (or closed).
  if (joinCode !== null) {
    return (
      <CoOwnerJoin
        initialCode={joinCode || undefined}
        dogName={joinDog || undefined}
        dogAvatar={joinAvatar || undefined}
        onClose={clearJoin}
        onJoined={onCoOwnerJoined}
      />
    );
  }

  // The four main tabs share one animated slot so switching between them fades
  // instead of cutting. Settings maps to the "home" key so opening the Settings
  // circle-reveal doesn't remount/re-animate the Dashboard behind it.
  const tabKey: ScreenId | null =
    screen === "home" || screen === "settings" || screen === "notifications"
      ? "home"
      : screen === "walks" || screen === "food" || screen === "bathroom" || screen === "vet"
        ? screen
        : null;

  const tabNode: React.ReactElement | null =
    tabKey === "home" ? (
      <Dashboard
        onNavigate={navigate}
        onOpenSettings={openSettings}
        onOpenNotifications={openNotifications}
        onOpenVetNotes={() => {
          setVetOpenNotes(true);
          navigate("vet");
        }}
        onLogWalk={logWalk}
        onLogBathroom={() => setModal("poop")}
      />
    ) : tabKey === "walks" ? (
      <WalksStats
        onAdd={(dateISO) => {
          setWalkPrefillDate(dateISO ?? null);
          setModal("walk-choose");
        }}
        onEdit={(i) => openTrackWalk(i)}
      />
    ) : tabKey === "food" ? (
      <Food onAdd={() => setModal("food")} />
    ) : tabKey === "bathroom" ? (
      <Bathroom
        onAdd={() => {
          setEditBathroomIndex(null);
          setModal("poop");
        }}
        onEdit={(i) => {
          setEditBathroomIndex(i);
          setModal("poop");
        }}
      />
    ) : tabKey === "vet" ? (
      <Vet
        onAdd={(types) => {
          setEditReminderIndex(null);
          setEditVaccineIndex(null);
          setEditCheckupIndex(null);
          setAddRecordTypes(types);
          setModal("vet");
        }}
        onEditReminder={(i) => {
          setEditVaccineIndex(null);
          setEditCheckupIndex(null);
          setEditReminderIndex(i);
          setModal("vet");
        }}
        onEditVaccine={(i) => {
          setEditReminderIndex(null);
          setEditCheckupIndex(null);
          setEditVaccineIndex(i);
          setModal("vet");
        }}
        onEditCheckup={(i) => {
          setEditReminderIndex(null);
          setEditVaccineIndex(null);
          setEditCheckupIndex(i);
          setModal("vet");
        }}
        openNotes={vetOpenNotes}
        onNotesOpened={() => setVetOpenNotes(false)}
      />
    ) : null;

  return (
    <>
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}

      {authResolving ? (
        <div style={{ background: "var(--color-pawpal-page)", minHeight: "100vh" }} />
      ) : onboarding ? (
        <OnboardingProposal
          onDone={() => {
            setOnboarding(false);
            navigate("home");
          }}
          onDogSit={() => setClaim({ open: true })}
        />
      ) : (
        <>
          {tabNode && (
            <div style={{ background: "var(--color-pawpal-page)", minHeight: "100vh" }}>
              <AnimatePresence mode="wait" initial={false}>
                <ScreenTransition key={tabKey ?? "tab"} style={{ minHeight: "100vh" }}>
                  {tabNode}
                </ScreenTransition>
              </AnimatePresence>
            </div>
          )}
          {/* Notifications: full page in the new UI, revealed from the bell. */}
          <AnimatePresence>
            {screen === "notifications" && (
              <CircleReveal origin={notifOrigin}>
                <Notifications
                  onClose={() => navigate("home")}
                  onLogWalk={logWalk}
                  onLogFood={() => setModal("food")}
                  onNavigate={navigate}
                />
              </CircleReveal>
            )}
          </AnimatePresence>

          {/* Settings section: the circular reveal plays only when entering/leaving
              the whole section (home ↔ settings). Navigating between the hub and
              its sub-levels swaps the content inside the same persistent layer, so
              no reveal animation replays. */}
          <AnimatePresence>
            {screen.startsWith("settings") && (
              <CircleReveal origin={settingsOrigin}>
                {screen === "settings-profile" ? (
                  <ProfileDetails onBack={() => navigate("settings")} />
                ) : screen === "settings-notifications" ? (
                  <NotificationsScreen onBack={() => navigate("settings")} />
                ) : screen === "settings-account" ? (
                  <AccountScreen
                    onBack={() => navigate("settings")}
                    onSignedOut={() => {
                      setOnboarding(true);
                      navigate("home");
                    }}
                  />
                ) : screen === "settings-sitting" ? (
                  <DogSittingScreen onBack={() => navigate("settings")} />
                ) : screen === "settings-coowners" ? (
                  <CoOwnersScreen onBack={() => navigate("settings")} />
                ) : screen === "settings-sync" ? (
                  <CloudSyncScreen onBack={() => navigate("settings")} />
                ) : screen === "settings-data" ? (
                  <DataScreen onBack={() => navigate("settings")} />
                ) : (
                  <Settings onNavigate={navigate} onBack={() => navigate("home")} />
                )}
              </CircleReveal>
            )}
          </AnimatePresence>

          <BottomNav
            variant="trigger"
            current={screen === "settings" ? "home" : screen.startsWith("settings") ? "settings" : screen}
            onNavigate={navigate}
            onAction={() => {
              setTrackOpen((v) => {
                if (!v && hintTrack) {
                  setHintTrack(false);
                  localStorage.setItem("pawpal_seen_track_menu", "1");
                }
                return !v;
              });
            }}
            menuOpen={trackOpen}
            hint={hintTrack}
            hidden={screen.startsWith("settings-")}
          />

          <GooeyFab
            open={trackOpen}
            onClose={() => setTrackOpen(false)}
            onWalk={() => navigate("walks")}
            onMeal={() => navigate("food")}
            onDiary={() => toast("Diary coming soon \u{1F43E}")}
            onPoop={() => navigate("bathroom")}
            onVet={() => navigate("vet")}
          />

          <FoodFormModal open={modal === "food"} onClose={() => setModal("none")} />
          <PoopFormModal
            open={modal === "poop"}
            editIndex={editBathroomIndex}
            onClose={() => {
              setModal("none");
              setEditBathroomIndex(null);
            }}
          />
          <VetAddModal
            open={modal === "vet"}
            editReminderIndex={editReminderIndex}
            editVaccineIndex={editVaccineIndex}
            editCheckupIndex={editCheckupIndex}
            addTypes={addRecordTypes}
            onClose={() => {
              setModal("none");
              setEditReminderIndex(null);
              setEditVaccineIndex(null);
              setEditCheckupIndex(null);
            }}
          />
          <WalkTrackSheet
            open={modal === "walk-track" || modal === "walk-choose"}
            startInChooser={modal === "walk-choose"}
            editIndex={editWalkIndex}
            prefillDate={walkPrefillDate}
            onClose={() => {
              setModal("none");
              setEditWalkIndex(null);
              setWalkPrefillDate(null);
            }}
          />
        </>
      )}
    </>
  );
}
