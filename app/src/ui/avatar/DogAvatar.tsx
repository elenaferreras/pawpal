import type { Avatar } from "../types";
import { stickerUrlOrDefault } from "./stickers";

interface DogAvatarProps {
  avatar: Avatar;
  size: number;
  className?: string;
}

// Dog avatar — a hand-drawn sticker (falls back to the default dog sticker).
export function DogAvatar({ avatar, size, className }: DogAvatarProps): React.ReactElement {
  return (
    <div className={className}>
      <img
        src={stickerUrlOrDefault(avatar.sticker)}
        alt=""
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    </div>
  );
}

interface DogFaceProps {
  avatar?: Avatar;
  size: number;
  className?: string;
}

// Circular avatar for compact spots (home header) — same sticker art.
export function DogFace({ avatar, size, className }: DogFaceProps): React.ReactElement {
  return (
    <div className={className}>
      <img
        src={stickerUrlOrDefault(avatar?.sticker)}
        alt=""
        width={size}
        height={size}
        style={{ display: "block" }}
      />
    </div>
  );
}
