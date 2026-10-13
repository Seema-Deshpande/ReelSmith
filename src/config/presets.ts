// Output size and length rules per platform. Check each platform's current rules before launch.
// To add a platform, add one entry here. Everything else follows from this list.
//
//   maxDurationS      longest clip the platform accepts
//   durationChoicesS  output lengths we offer the user (all must be <= maxDurationS)
//   defaultDurationS  length used when the user does not choose one
export const PRESETS = {
  reels: { width: 1080, height: 1920, maxDurationS: 90, durationChoicesS: [15, 30, 60, 90], defaultDurationS: 30 },
  tiktok: { width: 1080, height: 1920, maxDurationS: 180, durationChoicesS: [15, 30, 60, 180], defaultDurationS: 30 },
  shorts: { width: 1080, height: 1920, maxDurationS: 60, durationChoicesS: [15, 30, 60], defaultDurationS: 30 },
};

export type Platform = keyof typeof PRESETS;
export const PLATFORMS = Object.keys(PRESETS) as [Platform, ...Platform[]];
