import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { Icons } from "../lib/icons";
import type { ScreenId } from "../types";

const ITEMS: { id: ScreenId; label: string; icon: (typeof Icons)[keyof typeof Icons] }[] = [
  { id: "home", label: "Home", icon: Icons.house },
  { id: "walks", label: "Walks", icon: Icons.pawPrint },
  { id: "food", label: "Food", icon: Icons.forkKnife },
  { id: "vet", label: "Health", icon: Icons.stethoscope },
  { id: "profile", label: "Profile", icon: Icons.user },
];

interface BottomNavProps {
  current: ScreenId;
  onNavigate: (id: ScreenId) => void;
}

export function BottomNav({ current, onNavigate }: BottomNavProps): React.ReactElement {
  return (
    <nav className="nav">
      {ITEMS.map((item) => {
        const active = current === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={"nav-item" + (active ? " active" : "")}
            onClick={() => onNavigate(item.id)}
          >
            <span className="nav-icon">
              <Icon icon={item.icon} color={active ? "accent" : "secondary"} />
            </span>
            <Text type="supporting" color={active ? "accent" : "secondary"}>
              {item.label}
            </Text>
          </button>
        );
      })}
    </nav>
  );
}
