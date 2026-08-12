import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import type { ScreenId } from "../types";
import {
  TodayIcon,
  WalksIcon,
  MealsIcon,
  VetIcon,
  ProfileIcon,
} from "./TabIcons";

const ITEMS: {
  id: ScreenId;
  label: string;
  icon: React.ReactElement;
  /** Colour applied to the icon + label when this tab is active. */
  activeColor: string;
}[] = [
  { id: "home", label: "Today", icon: <TodayIcon />, activeColor: "#ffff83" },
  { id: "walks", label: "Walks", icon: <WalksIcon />, activeColor: "#9ccfff" },
  { id: "food", label: "Meals", icon: <MealsIcon />, activeColor: "#e96a41" },
  { id: "vet", label: "Vet", icon: <VetIcon />, activeColor: "#edd4fd" },
  { id: "settings", label: "Settings", icon: <ProfileIcon />, activeColor: "#fbef79" },
];

interface BottomNavProps {
  /** "full" = tab bar + fab (legacy design); "trigger" = only the grid launcher. */
  variant?: "full" | "trigger";
  current?: ScreenId;
  onNavigate?: (id: ScreenId) => void;
  onAction?: () => void;
  /** When true, the tab pill slides out and the fab becomes a close (✕). */
  menuOpen?: boolean;
  /** Hide the nav entirely (e.g. on Settings, which closes with its own ✕). */
  hidden?: boolean;
}

export function BottomNav({
  variant = "full",
  current,
  onNavigate,
  onAction,
  menuOpen = false,
  hidden = false,
}: BottomNavProps): React.ReactElement | null {
  if (hidden) return null;

  // New design: a single yellow launcher. On the home screen it opens the track
  // menu (grid icon); on any other screen it becomes a Home button back to Today.
  if (variant === "trigger") {
    const goHome = !menuOpen && current !== "home";
    return (
      <nav className={"nav nav--trigger" + (menuOpen ? " nav-open" : "")}>
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : goHome ? "Home" : "Open menu"}
          aria-expanded={menuOpen}
          className={"nav-fab nav-fab-grid"}
          onClick={goHome ? () => onNavigate?.("home") : onAction}
        >
          <Icon
            icon={menuOpen ? Icons.x : goHome ? Icons.house : Icons.layoutGrid}
            color="inherit"
          />
        </button>
      </nav>
    );
  }

  return (
    <nav className={"nav" + (menuOpen ? " nav-open" : "")}>
      <div className="nav-pill">
        {ITEMS.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={"nav-item" + (active ? " active" : "")}
              style={
                active
                  ? ({ "--nav-active": item.activeColor } as React.CSSProperties)
                  : undefined
              }
              onClick={() => onNavigate?.(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      {onAction && (
        <button
          type="button"
          aria-label={menuOpen ? "Close" : "Quick add"}
          className={"nav-fab" + (menuOpen ? " nav-fab-open" : "")}
          onClick={onAction}
        >
          <Icon icon={Icons.plus} color="inherit" />
        </button>
      )}
    </nav>
  );
}
