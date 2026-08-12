import s1 from "./stickers/sticker-1.svg";
import s2 from "./stickers/sticker-2.svg";
import s3 from "./stickers/sticker-3.svg";
import s4 from "./stickers/sticker-4.svg";
import s5 from "./stickers/sticker-5.svg";
import s6 from "./stickers/sticker-6.svg";

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
];

/** Resolve a sticker id to its asset URL, if it exists. */
export function stickerUrl(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return AVATAR_STICKERS.find((s) => s.id === id)?.url;
}
