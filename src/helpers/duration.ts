import { PRESETS, type Platform } from "../config/presets.js";

// Rules for how long the output clip can be.
// The clip can never be longer than the platform allows, or longer than the source video.

// The longest clip we can make for this video on this platform.
function longestAllowed(platform: Platform, videoDurationS: number): number {
  return Math.min(PRESETS[platform].maxDurationS, videoDurationS);
}

// The lengths we offer the user: the platform's preset lengths that fit this video.
export function durationChoices(platform: Platform, videoDurationS: number): number[] {
  const limit = longestAllowed(platform, videoDurationS);
  const choices = PRESETS[platform].durationChoicesS.filter((seconds) => seconds <= limit);

  // The video is shorter than the smallest preset, so the only choice is the whole video.
  if (choices.length === 0) {
    return [Math.floor(videoDurationS * 10) / 10];
  }
  return choices;
}

// The length to use for a job.
//   - The user asked for a length: use it, but never longer than the video.
//   - The user did not: use the biggest preset choice that is not above the platform's default.
export function pickTargetDuration(platform: Platform, videoDurationS: number, requestedS: number | null): number {
  if (requestedS) {
    return Math.min(requestedS, longestAllowed(platform, videoDurationS));
  }

  const choices = durationChoices(platform, videoDurationS);
  const notAboveDefault = choices.filter((seconds) => seconds <= PRESETS[platform].defaultDurationS);
  return notAboveDefault.at(-1) ?? choices[0] ?? videoDurationS;
}
