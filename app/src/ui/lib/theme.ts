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
  "--color-pawpal-page": ["#352B25", "#352B25"], // page background (dark brown)
  "--color-food": ["#E96A41", "#E96A41"], // meals accent (orange)

  // Muted label/support text used across the hero (rendered at 40% opacity).
  "--color-pawpal-muted": ["#8C8976", "#8C8976"],

  // "What do you want to track?" radial menu bubbles (Figma node 10:373).
  "--color-track-walk": ["#EDD4FD", "#EDD4FD"], // purple
  "--color-track-meal": ["#FFFF83", "#FFFF83"], // yellow
  "--color-track-diary": ["#9DBA9C", "#9DBA9C"], // green
  "--color-track-poop": ["#E96A41", "#E96A41"], // orange
  "--color-track-vet": ["#8592E0", "#8592E0"], // blue
  "--color-track-meds": ["#9DBA9C", "#9DBA9C"], // green (vet medications card)
  "--color-track-notes": ["#C4DFFE", "#C4DFFE"], // light blue (vet "Notes" card)

  // Meals widget (Figma node 12:659). Pacman reuses --color-pawpal-fab.
  "--color-meal-widget-bg": ["#1E1C1E", "#1E1C1E"], // dark pill
  "--color-meal-dot": ["#D9D9D9", "#D9D9D9"], // meal dot (eaten shown faded)

  // "Zipi's Walks" step heatmap (Figma node 31:259).
  "--color-walkcell": ["#C4DFFE", "#C4DFFE"], // active day cell (light blue)
  "--color-walkcell-dot": ["#FFFF83", "#FFFF83"], // active day dot (yellow)
  "--color-walkcell-empty": ["#5E5349", "#5E5349"], // empty/future day cell
  "--color-walkcell-empty-dot": ["#463B32", "#463B32"], // empty day dot (brown)

  // Dashboard food-ring widget (Figma node 34:1418).
  "--color-pill-steps": ["#B3D0FB", "#B3D0FB"], // light-blue "steps" pill

  // Today dashboard cards (Figma node 58:978).
  "--color-dash-walk": ["#9CCFFF", "#9CCFFF"], // "Ready for a walk?" card (blue)
  "--color-dash-pooped": ["#EDD4FD", "#EDD4FD"], // "Pooped" card + "Notes" header (purple)
  "--color-dash-trained": ["#FFFF83", "#FFFF83"], // "Trained" card (yellow)
  "--color-dash-surface": ["#3E332C", "#3E332C"], // dark "Meals" card surface

  // Settings list groups (Figma Profile details node 180:3354) — a deeper
  // surface than the dashboard cards, used for grouped label/value rows.
  "--color-settings-group": ["#221D1A", "#221D1A"],
};

export const pawpalTheme = defineTheme({
  name: "pawpal",
  extends: butterTheme,
  tokens: pawpalTokens,
});
