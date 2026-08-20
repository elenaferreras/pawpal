import { useEffect, useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { AnimatePresence } from "motion/react";
import { pawpalTheme } from "./lib/theme";
import type { ScreenId } from "./types";
import { DbProvider, useDb } from "./lib/store";
import { ToastProvider, useToast } from "./lib/toast";
import { ConfirmProvider } from "./components/ConfirmDialog";
import { setupReminderChecks } from "./lib/notifications";
import { isSignedIn } from "./lib/auth";
import { reconcileFromCloud } from "./lib/supabase";
import { LiveWalkProvider } from "./components/LiveWalk";
import { BottomNav } from "./components/BottomNav";
import { GooeyFab } from "./components/GooeyFab";
import { WalksStats } from "./components/WalksStats";
import { WalkTrackSheet } from "./components/WalkTrackSheet";
import { Splash } from "./components/Splash";
import { DesktopGate, useIsDesktop } from "./components/DesktopGate";
import { WalkChooser } from "./components/WalkChooser";
import { WalkChooserSheet } from "./components/WalkChooserSheet";
import { CircleReveal } from "./components/CircleReveal";
import { ScreenTransition } from "./components/ScreenTransition";
import { WalkFormModal } from "./components/WalkFormModal";
import { FoodFormModal } from "./components/FoodFormModal";
import { PoopFormModal } from "./components/PoopFormModal";
import { VetAddModal } from "./components/VetAddModal";
import { Home } from "./screens/Home";
import { Dashboard } from "./screens/Dashboard";
import { Walks } from "./screens/Walks";
import { Food } from "./screens/Food";
import { Bathroom } from "./screens/Bathroom";
import { Vet } from "./screens/Vet";
import { Notifications } from "./screens/Notifications";
import { Settings } from "./screens/settings/Settings";
import { ProfileDetails } from "./screens/settings/ProfileDetails";
import { NotificationsScreen } from "./screens/settings/NotificationsScreen";
import { AccountScreen } from "./screens/settings/AccountScreen";
import { DogSittingScreen } from "./screens/settings/DogSittingScreen";
import { CloudSyncScreen } from "./screens/settings/CloudSyncScreen";
import { DataScreen } from "./screens/settings/DataScreen";
import { Onboarding } from "./screens/Onboarding";
import { OnboardingProposal } from "./screens/OnboardingProposal";
import { SitterApp } from "./screens/SitterApp";
import { SitterClaim } from "./screens/SitterClaim";
import {
  loadSitterSession,
  saveSitterSession,
  type SitterState,
} from "./lib/sitter";
import { subscribeToPush } from "./lib/push";

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

type QuickModal = "none" | "walk-choose" | "walk-manual" | "walk-track" | "food" | "poop" | "vet";

type ObVariant = "classic" | "proposal";

type DesignMode = "new" | "old";

function initialObVariant(): ObVariant {
  const param = new URLSearchParams(window.location.search).get("onboarding");
  return param === "classic" ? "classic" : "proposal";
}

function initialDesign(): DesignMode {
  try {
    return localStorage.getItem("pawpal-design") === "old" ? "old" : "new";
  } catch {
    return "new";
  }
}

function Shell(): React.ReactElement {
  const { db, getDb, update: updateDb } = useDb();
  const toast = useToast();
  const [screen, setScreen] = useState<ScreenId>("home");
  const [showSplash, setShowSplash] = useState(true);
  const [onboarding, setOnboarding] = useState(!db.profile.onboarded);
  const [obVariant, setObVariant] = useState<ObVariant>(initialObVariant);
  const [modal, setModal] = useState<QuickModal>("none");
  const [trackOpen, setTrackOpen] = useState(false);
  const [design] = useState<DesignMode>(initialDesign);
  const [editWalkIndex, setEditWalkIndex] = useState<number | null>(null);
  const [editReminderIndex, setEditReminderIndex] = useState<number | null>(null);
  const [editBathroomIndex, setEditBathroomIndex] = useState<number | null>(null);
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

  // Kick off the minute-by-minute reminder checks once.
  useEffect(() => {
    setupReminderChecks(getDb);
  }, [getDb]);

  // Re-register this device for sitter push notifications when signed in and
  // permission is already granted (no-op otherwise). Also re-runs on sign-in.
  useEffect(() => {
    const sync = (): void => {
      if (isSignedIn()) void subscribeToPush();
    };
    sync();
    window.addEventListener("pawpal:auth", sync);
    return () => window.removeEventListener("pawpal:auth", sync);
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

  const openManualWalk = (index: number | null): void => {
    setEditWalkIndex(index);
    setModal("walk-manual");
  };

  // New-design edit opens the Track-walk sheet pre-filled with the walk.
  const openTrackWalk = (index: number | null): void => {
    setEditWalkIndex(index);
    setModal("walk-track");
  };

  // "Log walk" opens the new Track-walk sheet in new design, else the chooser.
  const logWalk = (): void => {
    setEditWalkIndex(null);
    setModal(design === "new" ? "walk-track" : "walk-choose");
  };

  // Design toggle button is hidden; design defaults to "new".

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
      design === "new" ? (
        <Dashboard
          onNavigate={navigate}
          onOpenSettings={openSettings}
          onOpenNotifications={openNotifications}
          onLogWalk={logWalk}
          onLogBathroom={() => setModal("poop")}
        />
      ) : (
        <Home
          onNavigate={navigate}
          onLogWalk={logWalk}
          onLogFood={() => setModal("food")}
          onLogBathroom={() => setModal("poop")}
        />
      )
    ) : tabKey === "walks" ? (
      design === "new" ? (
        <WalksStats onAdd={() => setModal("walk-choose")} onEdit={(i) => openTrackWalk(i)} />
      ) : (
        <Walks onAdd={() => setModal("walk-choose")} onEdit={(i) => openManualWalk(i)} />
      )
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
        onAdd={() => {
          setEditReminderIndex(null);
          setModal("vet");
        }}
        onEditReminder={(i) => {
          setEditReminderIndex(i);
          setModal("vet");
        }}
      />
    ) : null;

  return (
    <>
      {showSplash && <Splash onDone={() => setShowSplash(false)} />}

      {onboarding ? (
        <>
          {obVariant === "proposal" ? (
            <OnboardingProposal
              onDone={() => {
                setOnboarding(false);
                navigate("home");
              }}
              onDogSit={() => setClaim({ open: true })}
            />
          ) : (
            <Onboarding
              onDone={() => {
                setOnboarding(false);
                navigate("home");
              }}
            />
          )}
          <button
            type="button"
            className="ob-variant-toggle"
            onClick={() => setObVariant((v) => (v === "proposal" ? "classic" : "proposal"))}
          >
            {obVariant === "proposal" ? "Proposal · tap for Classic" : "Classic · tap for Proposal"}
          </button>
        </>
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
                  <AccountScreen onBack={() => navigate("settings")} />
                ) : screen === "settings-sitting" ? (
                  <DogSittingScreen onBack={() => navigate("settings")} />
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
            variant={design === "new" ? "trigger" : "full"}
            current={screen === "settings" ? "home" : screen.startsWith("settings") ? "settings" : screen}
            onNavigate={navigate}
            onAction={() => setTrackOpen((v) => !v)}
            menuOpen={trackOpen}
            hidden={screen.startsWith("settings-")}
          />

          <GooeyFab
            open={trackOpen}
            onClose={() => setTrackOpen(false)}
            onWalk={design === "new" ? () => navigate("walks") : logWalk}
            onMeal={design === "new" ? () => navigate("food") : () => setModal("food")}
            onDiary={() => toast("Diary coming soon \u{1F43E}")}
            onPoop={design === "new" ? () => navigate("bathroom") : () => setModal("poop")}
            onVet={design === "new" ? () => navigate("vet") : () => setModal("vet")}
          />

          {design === "new" ? (
            <WalkChooserSheet
              open={modal === "walk-choose"}
              onClose={() => setModal("none")}
              onManual={() => {
                setEditWalkIndex(null);
                setModal("walk-track");
              }}
            />
          ) : (
            <WalkChooser
              open={modal === "walk-choose"}
              onClose={() => setModal("none")}
              onManual={() => openManualWalk(null)}
            />
          )}
          <WalkFormModal
            open={modal === "walk-manual"}
            editIndex={editWalkIndex}
            onClose={() => {
              setModal("none");
              setEditWalkIndex(null);
            }}
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
            onClose={() => {
              setModal("none");
              setEditReminderIndex(null);
            }}
          />
          <WalkTrackSheet
            open={modal === "walk-track"}
            editIndex={editWalkIndex}
            onClose={() => {
              setModal("none");
              setEditWalkIndex(null);
            }}
          />
        </>
      )}
    </>
  );
}
