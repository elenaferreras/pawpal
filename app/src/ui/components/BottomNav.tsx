import type { ScreenId } from "../types";

const ITEMS: { id: ScreenId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "ph-house" },
  { id: "walks", label: "Walks", icon: "ph-paw-print" },
  { id: "food", label: "Food", icon: "ph-fork-knife" },
  { id: "vet", label: "Health", icon: "ph-first-aid" },
  { id: "profile", label: "Profile", icon: "ph-user" },
];

interface BottomNavProps {
  current: ScreenId;
  onNavigate: (id: ScreenId) => void;
}

export function BottomNav({ current, onNavigate }: BottomNavProps): React.ReactElement {
  return (
    <nav className="nav">
      {ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={"nav-item" + (current === item.id ? " active" : "")}
          onClick={() => onNavigate(item.id)}
        >
          <span className="nav-icon">
            <i className={"ph " + item.icon} />
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
