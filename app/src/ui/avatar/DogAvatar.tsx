import { useMemo } from "react";
import type { Avatar } from "../types";
import { buildDogSVG, buildDogFace } from "./build";
import { stickerUrl } from "./stickers";

interface DogAvatarProps {
  avatar: Avatar;
  size: number;
  className?: string;
}

// Full standing dog, composed from the original Figma SVG parts.
export function DogAvatar({ avatar, size, className }: DogAvatarProps): React.ReactElement {
  const sticker = stickerUrl(avatar.sticker);
  const html = useMemo(() => buildDogSVG(avatar, size), [avatar, size]);
  if (sticker) {
    return (
      <div className={className}>
        <img src={sticker} alt="" width={size} height={size} style={{ display: "block" }} />
      </div>
    );
  }
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

interface DogFaceProps {
  avatar?: Avatar;
  size: number;
  className?: string;
}

// Circular head-only face for compact spots (home header).
export function DogFace({ avatar, size, className }: DogFaceProps): React.ReactElement {
  const sticker = stickerUrl(avatar?.sticker);
  const html = useMemo(() => buildDogFace(avatar, size), [avatar, size]);
  if (sticker) {
    return (
      <div className={className}>
        <img src={sticker} alt="" width={size} height={size} style={{ display: "block" }} />
      </div>
    );
  }
  return (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
