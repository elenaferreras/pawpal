import { useEffect, useState } from "react";
import { Icon } from "@astryxdesign/core/Icon";
import { Icons } from "../lib/icons";
import type { Avatar } from "../types";
import { DogAvatar } from "./DogAvatar";
import {
  AVATAR_BG_COLORS,
  DEFAULT_AVATAR_BG,
  type AvatarParts,
} from "./presets";
import { AVATAR_STICKERS } from "./stickers";

const DARK = "#352B25";
const YELLOW = "#FFFF83";

interface AvatarSheetProps {
  open: boolean;
  value: Avatar;
  onConfirm: (next: Avatar) => void;
  onClose: () => void;
}

/**
 * "Profile picture" bottom sheet (Figma node 180:3718). Pick a background
 * colour and a preset dog, then confirm with ✓ or cancel with ✕.
 */
export function AvatarSheet({ open, value, onConfirm, onClose }: AvatarSheetProps): React.ReactElement | null {
  const [parts, setParts] = useState<AvatarParts>(() => toParts(value));
  const [bg, setBg] = useState<string>(value.bg ?? DEFAULT_AVATAR_BG);
  const [sticker, setSticker] = useState<string | undefined>(value.sticker);

  // Re-sync the draft whenever the sheet is (re)opened.
  useEffect(() => {
    if (open) {
      setParts(toParts(value));
      setBg(value.bg ?? DEFAULT_AVATAR_BG);
      setSticker(value.sticker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const preview: Avatar = { ...parts, bg, sticker };

  return (
    <div
      role="dialog"
      aria-label="Profile picture"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          background: "rgba(245,245,245,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTopLeftRadius: 34,
          borderTopRightRadius: 34,
          boxShadow: "0px -8px 40px rgba(0,0,0,0.18)",
          paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "92vh",
          overflowY: "auto",
          overflowX: "hidden",
          boxSizing: "border-box",
        }}
      >
        {/* Grabber */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
          <div style={{ width: 36, height: 5, borderRadius: 100, background: "rgba(0,0,0,0.2)" }} />
        </div>

        {/* Toolbar: ✕ · title · ✓ */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 16px",
          }}
        >
          <RoundIconButton label="Cancel" bg={DARK} color="#fff" icon={Icons.x} onClick={onClose} />
          <span style={{ fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 16, color: DARK }}>
            Profile picture
          </span>
          <RoundIconButton
            label="Done"
            bg={YELLOW}
            color={DARK}
            icon={Icons.check}
            onClick={() => onConfirm(preview)}
          />
        </div>

        {/* Selected preview */}
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px" }}>
          <div
            style={{
              width: 136,
              height: 136,
              borderRadius: "50%",
              background: bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <DogAvatar avatar={preview} size={112} />
          </div>
        </div>

        {/* Background colours */}
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            justifyContent: "center",
            padding: "4px 16px 20px",
            flexWrap: "wrap",
          }}
        >
          {AVATAR_BG_COLORS.map((c) => {
            const selected = bg.toUpperCase() === c.hex.toUpperCase();
            return (
              <button
                key={c.key}
                type="button"
                aria-label={c.key}
                aria-pressed={selected}
                onClick={() => setBg(c.hex)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: c.hex,
                  cursor: "pointer",
                  padding: 0,
                  border: selected ? `4px solid ${DARK}` : "none",
                  boxShadow: selected ? `0 0 0 4px ${YELLOW}` : "none",
                }}
              />
            );
          })}
        </div>

        {/* Sticker grid — the selectable dog avatars */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            padding: "0 16px 8px",
            justifyItems: "center",
            boxSizing: "border-box",
          }}
        >
          {AVATAR_STICKERS.map((s) => {
            const selected = sticker === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-label={s.label}
                aria-pressed={selected}
                onClick={() => setSticker(s.id)}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: "50%",
                  background: bg,
                  cursor: "pointer",
                  padding: 0,
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  boxShadow: selected ? `0 0 0 4px ${YELLOW}` : "none",
                }}
              >
                <img src={s.url} alt="" width={80} height={80} style={{ display: "block" }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function RoundIconButton({
  label,
  bg,
  color,
  icon,
  onClick,
}: {
  label: string;
  bg: string;
  color: string;
  icon: (typeof Icons)[keyof typeof Icons];
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: bg,
        color,
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <Icon icon={icon} color="inherit" />
    </button>
  );
}

function toParts(a: Avatar): AvatarParts {
  return { head: a.head, body: a.body, colour: a.colour, eyes: a.eyes, nose: a.nose };
}
