import { useEffect, useState } from "react";
import type { ScreenId } from "./types";
import { DbProvider, useDb } from "./lib/store";
import { ToastProvider } from "./lib/toast";
import { setupReminderChecks } from "./lib/notifications";
import { LiveWalkProvider } from "./components/LiveWalk";
import { BottomNav } from "./components/BottomNav";
import { Splash } from "./components/Splash";
import { WalkChooser } from "./components/WalkChooser";
import { WalkFormModal } from "./components/WalkFormModal";
import { FoodFormModal } from "./components/FoodFormModal";
import { PoopFormModal } from "./components/PoopFormModal";
import { VetAddModal } from "./components/VetAddModal";
import { Home } from "./screens/Home";
import { Walks } from "./screens/Walks";
import { Food } from "./screens/Food";
import { Vet } from "./screens/Vet";
import { Profile } from "./screens/Profile";
import { Onboarding } from "./screens/Onboarding";

export function App(): React.ReactElement {
  return (
    <DbProvider>
      <ToastProvider>
        <LiveWalkProvider>
          <Shell />
        </LiveWalkProvider>
      </ToastProvider>
    </DbProvider>
  );
}

type QuickModal = "none" | "walk-choose" | "walk-manual" | "food" | "poop" | "vet";

function Shell(): React.ReactElement {
  const { db, getDb } = useDb();
  const [screen, setScreen] = useState<ScreenId>("home");
  const [showSplash, setShowSplash] = useState(true);
  const [onboarding, setOnboarding] = useState(!db.profile.onboarded);
  const [modal, setModal] = useState<QuickModal>("none");
  const [editWalkIndex, setEditWalkIndex] = useState<number | null>(null);

  // Kick off the minute-by-minute reminder checks once.
  useEffect(() => {
    setupReminderChecks(getDb);
  }, [getDb]);

  const navigate = (id: ScreenId): void => {
    setScreen(id);
    window.scrollTo(0, 0);
  };

  const openManualWalk = (index: number | null): void => {
    setEditWalkIndex(index);
    setModal("walk-manual");
  };

  return (
    <>
      {showSplash && <Splash avatar={db.profile.avatar} onDone={() => setShowSplash(false)} />}

      {onboarding ? (
        <Onboarding
          onDone={() => {
            setOnboarding(false);
            navigate("home");
          }}
        />
      ) : (
        <>
          {screen === "home" && (
            <Home
              onNavigate={navigate}
              onLogWalk={() => setModal("walk-choose")}
              onLogFood={() => setModal("food")}
              onLogBathroom={() => setModal("poop")}
            />
          )}
          {screen === "walks" && (
            <Walks onAdd={() => setModal("walk-choose")} onEdit={(i) => openManualWalk(i)} />
          )}
          {screen === "food" && <Food onAdd={() => setModal("food")} />}
          {screen === "vet" && <Vet onAdd={() => setModal("vet")} />}
          {screen === "profile" && <Profile />}

          <BottomNav current={screen} onNavigate={navigate} />

          <WalkChooser
            open={modal === "walk-choose"}
            onClose={() => setModal("none")}
            onManual={() => openManualWalk(null)}
          />
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
        </>
      )}
    </>
  );
}
