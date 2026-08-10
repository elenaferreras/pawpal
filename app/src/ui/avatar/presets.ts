import type { Avatar } from "../types";

/** Default background circle colour (Figma "health" purple). */
export const DEFAULT_AVATAR_BG = "#EDD4FD";

/** Selectable background circle colours, from Figma node 180:3718. */
export const AVATAR_BG_COLORS: { key: string; hex: string }[] = [
  { key: "cream", hex: "#FFFFCA" },
  { key: "food", hex: "#E96A41" },
  { key: "walk", hex: "#9CCFFF" },
  { key: "health", hex: "#EDD4FD" },
  { key: "green", hex: "#A9E7A7" },
];

export type AvatarParts = Omit<Avatar, "bg">;

export interface AvatarPreset {
  id: string;
  label: string;
  parts: AvatarParts;
}

/**
 * Curated preset dogs assembled from the existing avatar parts
 * (see avatar/assets.generated.ts). Each renders via <DogAvatar>.
 */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "retriever", label: "Retriever", parts: { head: "Normal", body: "Normal", eyes: "Normal", nose: "Normal", colour: "orange" } },
  { id: "shepherd", label: "Shepherd", parts: { head: "Sheperd", body: "Slim-tall", eyes: "Normal", nose: "Long", colour: "darkgrey" } },
  { id: "poodle", label: "Poodle", parts: { head: "Poodle", body: "Normal", eyes: "Furry Fringe", nose: "Small", colour: "white" } },
  { id: "frenchie", label: "Frenchie", parts: { head: "Box shape", body: "Small", eyes: "Both Spots", nose: "Big Bulldog", colour: "lightbrown" } },
  { id: "sausage", label: "Sausage", parts: { head: "Long", body: "Small thin", eyes: "Normal", nose: "Long", colour: "lightbrown2" } },
  { id: "fluffy", label: "Fluffy", parts: { head: "Furry", body: "Wide", eyes: "Furry Brows", nose: "Big Furry", colour: "lightbrown" } },
  { id: "floppy", label: "Floppy", parts: { head: "Low Ears", body: "Medium", eyes: "Closed", nose: "Droopy", colour: "darkbrown" } },
  { id: "boxer", label: "Boxer", parts: { head: "Big-Wide", body: "Wide", eyes: "Normal", nose: "Pug", colour: "orange" } },
];

/** True when two part sets describe the same dog (ignores background). */
export function partsEqual(a: AvatarParts, b: AvatarParts): boolean {
  return (
    a.head === b.head &&
    a.body === b.body &&
    a.eyes === b.eyes &&
    a.nose === b.nose &&
    a.colour === b.colour
  );
}
