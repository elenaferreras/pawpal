import type { Avatar } from "../types";
import { stickerUrlOrDefault } from "./stickers";

// Inline <img> markup for a dog avatar, used where React can't render — e.g. a
// map marker's raw HTML string. Falls back to the default dog sticker.
export function buildDogSVG(avatar: Avatar | undefined, size: number): string {
  const src = stickerUrlOrDefault(avatar?.sticker);
  return `<img src="${src}" alt="" style="display:block;width:${size}px;height:${size}px;object-fit:contain" />`;
}

// Compact circular variant — same sticker art at a smaller size.
export function buildDogFace(avatar: Avatar | undefined, size: number): string {
  return buildDogSVG(avatar, size);
}
