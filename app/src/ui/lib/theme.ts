import { defineTheme } from "@astryxdesign/core/theme";
import { butterTheme } from "@astryxdesign/theme-butter/built";

/**
 * PawPal theme.
 *
 * Extends the Butter design-system theme rather than cloning it, so we inherit
 * every base token, component style and font, and only layer PawPal-specific
 * design decisions on top. Colours captured from the Figma dashboard are defined
 * here as tokens (never hardcoded in components) and consumed via `var(--…)`.
 *
 * Typed as a plain token map so we can add PawPal-namespaced tokens alongside
 * the design-system's own token overrides.
 */
const pawpalTokens: Record<string, [light: string, dark: string]> = {
  // Dashboard bar chart — exact Figma bar colour, mapped onto the data-viz
  // yellow ramp so charts stay theme-aware.
  "--color-data-yellow-3": ["#FFFF83", "#FFFF83"],

  // Brand surfaces from the Figma dashboard.
  "--color-pawpal-hero": ["#E9E4C4", "#E9E4C4"], // cream hero card
  "--color-pawpal-fab": ["#FBEF79", "#FBEF79"], // floating action button
  "--color-pawpal-page": ["#000000", "#000000"], // page background

  // Muted label/support text used across the hero (rendered at 40% opacity).
  "--color-pawpal-muted": ["#8C8976", "#8C8976"],

  // "What do you want to track?" radial menu bubbles (Figma node 10:373).
  "--color-track-walk": ["#EDD4FD", "#EDD4FD"], // purple
  "--color-track-meal": ["#9DBA9C", "#9DBA9C"], // green
  "--color-track-diary": ["#9DBA9C", "#9DBA9C"], // green
  "--color-track-poop": ["#E96A41", "#E96A41"], // orange
  "--color-track-vet": ["#8592E0", "#8592E0"], // blue
};

export const pawpalTheme = defineTheme({
  name: "pawpal",
  extends: butterTheme,
  tokens: pawpalTokens,
});
