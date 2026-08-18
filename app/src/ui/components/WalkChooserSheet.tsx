import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import { MotionSheet } from "./MotionSheet";
import { useLiveWalk } from "./LiveWalk";

const DARK = "var(--color-pawpal-page)"; // #352B25
const HERO = "var(--color-pawpal-hero)"; // cream

interface WalkChooserSheetProps {
  open: boolean;
  onClose: () => void;
  /** Open the Track-walk sheet to log a walk manually. */
  onManual: () => void;
}

/**
 * "Log a walk" chooser bottom sheet (new design).
 *
 * Dark sheet with a grabber and two large option cards: start a live GPS walk,
 * or log one manually. Only the manual option opens the Track-walk sheet.
 */
export function WalkChooserSheet({
  open,
  onClose,
  onManual,
}: WalkChooserSheetProps): React.ReactElement {
  const { start } = useLiveWalk();

  return (
    <MotionSheet
      open={open}
      onClose={onClose}
      ariaLabel="Log a walk"
      scrimClassName="walk-sheet-scrim"
      sheetClassName="chooser-sheet"
    >
        <span
          aria-hidden
          style={{
            width: 36,
            height: 5,
            borderRadius: 100,
            background: "rgba(233,228,196,0.3)",
            alignSelf: "center",
            marginBottom: 20,
          }}
        />
        <p
          style={{
            margin: "0 0 16px",
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 28,
            color: HERO,
          }}
        >
          Log a walk
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ChooserCard
            bg="var(--color-dash-walk)"
            icon={Icons.mapPin}
            title="Start a walk"
            subtitle="Track live with GPS"
            onClick={() => {
              onClose();
              start();
            }}
          />
          <ChooserCard
            bg="var(--color-track-notes)"
            icon={Icons.pencilSimple}
            title="Log manually"
            subtitle="Add a past walk"
            onClick={() => {
              onClose();
              onManual();
            }}
          />
        </div>
    </MotionSheet>
  );
}

function ChooserCard({
  bg,
  icon,
  title,
  subtitle,
  onClick,
}: {
  bg: string;
  icon: (typeof Icons)[keyof typeof Icons];
  title: string;
  subtitle: string;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        textAlign: "left",
        padding: 18,
        borderRadius: 24,
        border: "none",
        cursor: "pointer",
        background: bg,
        color: DARK,
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: DARK,
          color: bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon icon={icon} color="inherit" />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 700,
            fontSize: 18,
            color: DARK,
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            fontSize: 14,
            color: DARK,
            opacity: 0.65,
          }}
        >
          {subtitle}
        </span>
      </span>
      <span style={{ display: "flex", flexShrink: 0, opacity: 0.7 }}>
        <Icon icon={Icons.caretRight} color="inherit" />
      </span>
    </button>
  );
}
