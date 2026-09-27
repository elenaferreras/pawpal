// Translate the human's step count for a walk into the dog's own paw-steps.
// A dog's legs are shorter than yours, so it takes more strides to cover the
// same ground — the number is always a little bigger, which is the fun part.
// "Cute but grounded": the stride is estimated from the dog's weight (nudged by
// breed when weight is missing), one dog step = one stride (not per-leg).

import type { Profile } from "../types";

// Average adult human walking stride, in metres — the same value LiveWalk uses
// to derive human steps from GPS distance.
const HUMAN_STRIDE_M = 0.75;

// Rough weight (kg) fallbacks by breed size, used only when the profile weight
// can't be parsed. Keys are lowercased breed-name fragments.
const BREED_KG: Array<[RegExp, number]> = [
  [/chihuahua|yorkshire|pomeranian|maltese|toy|papillon/, 4],
  [/dachshund|shih tzu|pug|jack russell|cavalier|terrier|beagle|cocker|poodle/, 10],
  [/bulldog|french|border collie|australian shepherd|boxer|spaniel/, 22],
  [/labrador|golden|german shepherd|retriever|rottweiler|shepherd|husky|dane|mastiff/, 34],
];
const DEFAULT_KG = 12;

/** Best-effort kilograms from the profile's free-text weight, else a breed guess. */
function estimateWeightKg(profile: Pick<Profile, "weight" | "breed">): number {
  const raw = String(profile.weight ?? "").replace(",", ".");
  const match = raw.match(/\d+(\.\d+)?/);
  if (match) {
    const n = parseFloat(match[0]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const breed = String(profile.breed ?? "").toLowerCase();
  for (const [re, kg] of BREED_KG) if (re.test(breed)) return kg;
  return DEFAULT_KG;
}

/**
 * Convert a human step count into the dog's paw-steps for the same distance.
 * Returns a whole number; returns 0 when there are no human steps.
 */
export function dogStepsFromHuman(
  humanSteps: number,
  profile: Pick<Profile, "weight" | "breed">,
): number {
  if (!Number.isFinite(humanSteps) || humanSteps <= 0) return 0;
  const kg = estimateWeightKg(profile);
  // Dog stride grows with the cube root of body mass; clamp to a believable range.
  const dogStrideM = Math.min(0.65, Math.max(0.18, 0.15 * Math.cbrt(kg)));
  // More strides to cover the same ground → multiplier > 1, clamped so it stays
  // dog-like but never absurd.
  const multiplier = Math.min(4.5, Math.max(1.1, HUMAN_STRIDE_M / dogStrideM));
  return Math.round(humanSteps * multiplier);
}
