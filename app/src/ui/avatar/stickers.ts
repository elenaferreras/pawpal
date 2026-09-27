import s1 from "./stickers/sticker-1.svg";
import s2 from "./stickers/sticker-2.svg";
import s3 from "./stickers/sticker-3.svg";
import s4 from "./stickers/sticker-4.svg";
import s5 from "./stickers/sticker-5.svg";
import s6 from "./stickers/sticker-6.svg";
import s7 from "./stickers/sticker-7.svg";
import s8 from "./stickers/sticker-8.svg";
import s9 from "./stickers/sticker-9.svg";
import s10 from "./stickers/sticker-10.svg";
import s11 from "./stickers/sticker-11.svg";
import s12 from "./stickers/sticker-12.svg";

/** A selectable hand-drawn dog sticker avatar. */
export interface AvatarSticker {
  id: string;
  label: string;
  url: string;
}

/** Sticker avatars available for selection (Figma "Find your pup" doodles). */
export const AVATAR_STICKERS: AvatarSticker[] = [
  { id: "sticker-1", label: "Pup 1", url: s1 },
  { id: "sticker-2", label: "Pup 2", url: s2 },
  { id: "sticker-3", label: "Pup 3", url: s3 },
  { id: "sticker-4", label: "Pup 4", url: s4 },
  { id: "sticker-5", label: "Pup 5", url: s5 },
  { id: "sticker-6", label: "Pup 6", url: s6 },
  { id: "sticker-7", label: "Pup 7", url: s7 },
  { id: "sticker-8", label: "Pup 8", url: s8 },
  { id: "sticker-9", label: "Pup 9", url: s9 },
  { id: "sticker-10", label: "Pup 10", url: s10 },
  { id: "sticker-11", label: "Pup 11", url: s11 },
  { id: "sticker-12", label: "Pup 12", url: s12 },
];

/** Resolve a sticker id to its asset URL, if it exists. */
export function stickerUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return AVATAR_STICKERS.find((s) => s.id === id)?.url;
}

/** Fallback sticker used when an avatar has no sticker chosen. */
export const DEFAULT_STICKER_ID = AVATAR_STICKERS[0].id;

/** Resolve a sticker id to its URL, falling back to the default dog sticker. */
export function stickerUrlOrDefault(id: string | undefined): string {
  return stickerUrl(id) ?? AVATAR_STICKERS[0].url;
}
