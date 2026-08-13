import { useEffect, useState } from "react";
import { Theme } from "@astryxdesign/core/theme";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { pawpalTheme } from "./lib/theme";
import type { ScreenId } from "./types";
import { DbProvider, useDb } from "./lib/store";
import { ToastProvider, useToast } from "./lib/toast";
import { setupReminderChecks } from "./lib/notifications";
import { isSignedIn } from "./lib/auth";
import { reconcileFromCloud } from "./lib/supabase";
import { LiveWalkProvider } from "./components/LiveWalk";
import { BottomNav } from "./components/BottomNav";
import { TrackMenu } from "./components/TrackMenu";
import { WalksStats } from "./components/WalksStats";
import { WalkTrackSheet } from "./components/WalkTrackSheet";
import { Splash } from "./components/Splash";
import { DesktopGate, useIsDesktop } from "./components/DesktopGate";
import { WalkChooser } from "./components/WalkChooser";
import { WalkChooserSheet } from "./components/WalkChooserSheet";
import { WalkFormModal } from "./components/WalkFormModal";
import { FoodFormModal } from "./components/FoodFormModal";
import { PoopFormModal } from "./components/PoopFormModal";
import { VetAddModal } from "./components/VetAddModal";
import { Home } from "./screens/Home";
import { Dashboard } from "./screens/Dashboard";
import { Walks } from "./screens/Walks";
import { Food } from "./screens/Food";
import { Vet } from "./screens/Vet";
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
            <LiveWalkProvider>
              <Shell />
            </LiveWalkProvider>
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
  const [design, setDesign] = useState<DesignMode>(initialDesign);
  const [editWalkIndex, setEditWalkIndex] = useState<number | null>(null);

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

  const openManualWalk = (index: number | null): void => {
    setEditWalkIndex(index);
    setModal("walk-manual");
  };

  // "Log walk" opens the new Track-walk sheet in new design, else the chooser.
  const logWalk = (): void => setModal(design === "new" ? "walk-track" : "walk-choose");

  const toggleDesign = (): void => {
    setDesign((d) => {
      const next = d === "new" ? "old" : "new";
      try {
        localStorage.setItem("pawpal-design", next);
      } catch {
        // ignore storage failures
      }
      return next;
    });
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
          {screen === "home" &&
            (design === "new" ? (
              <Dashboard
                onNavigate={navigate}
                onLogWalk={logWalk}
                onLogFood={() => setModal("food")}
                onLogBathroom={() => setModal("poop")}
              />
            ) : (
              <Home
                onNavigate={navigate}
                onLogWalk={logWalk}
                onLogFood={() => setModal("food")}
                onLogBathroom={() => setModal("poop")}
              />
            ))}
          {screen === "walks" &&
            (design === "new" ? (
              <WalksStats onAdd={() => setModal("walk-choose")} />
            ) : (
              <Walks onAdd={() => setModal("walk-choose")} onEdit={(i) => openManualWalk(i)} />
            ))}
          {screen === "food" && <Food onAdd={() => setModal("food")} />}
          {screen === "vet" && <Vet onAdd={() => setModal("vet")} />}
          {screen === "settings" && (
            <Settings onNavigate={navigate} onBack={() => navigate("home")} />
          )}
          {screen === "settings-profile" && (
            <ProfileDetails onBack={() => navigate("settings")} />
          )}
          {screen === "settings-notifications" && (
            <NotificationsScreen onBack={() => navigate("settings")} />
          )}
          {screen === "settings-account" && <AccountScreen onBack={() => navigate("settings")} />}
          {screen === "settings-sitting" && (
            <DogSittingScreen onBack={() => navigate("settings")} />
          )}
          {screen === "settings-sync" && <CloudSyncScreen onBack={() => navigate("settings")} />}
          {screen === "settings-data" && <DataScreen onBack={() => navigate("settings")} />}

          <button type="button" className="design-toggle" onClick={toggleDesign}>
            {design === "new" ? "New · tap for Old" : "Old · tap for New"}
          </button>

          <BottomNav
            variant={design === "new" ? "trigger" : "full"}
            current={screen.startsWith("settings") ? "settings" : screen}
            onNavigate={navigate}
            onAction={() => setTrackOpen((v) => !v)}
            menuOpen={trackOpen}
            hidden={screen.startsWith("settings")}
          />

          <TrackMenu
            open={trackOpen}
            onClose={() => setTrackOpen(false)}
            onWalk={design === "new" ? () => navigate("walks") : logWalk}
            onMeal={design === "new" ? () => navigate("food") : () => setModal("food")}
            onDiary={() => toast("Diary coming soon \u{1F43E}")}
            onPoop={() => setModal("poop")}
            onVet={design === "new" ? () => navigate("vet") : () => setModal("vet")}
          />

          {design === "new" ? (
            <WalkChooserSheet
              open={modal === "walk-choose"}
              onClose={() => setModal("none")}
              onManual={() => setModal("walk-track")}
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
          <PoopFormModal open={modal === "poop"} onClose={() => setModal("none")} />
          <VetAddModal open={modal === "vet"} onClose={() => setModal("none")} />
          <WalkTrackSheet open={modal === "walk-track"} onClose={() => setModal("none")} />
        </>
      )}
    </>
  );
}
