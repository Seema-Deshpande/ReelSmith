// Output size and length limits per platform. Check each platform's current rules before launch.
export const PLATFORMS = ["reels", "tiktok", "shorts"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface PlatformPreset {
  width: number;
  height: number;
  maxDurationS: number;
}

export const PRESETS: Record<Platform, PlatformPreset> = {
  reels: { width: 1080, height: 1920, maxDurationS: 90 },
  tiktok: { width: 1080, height: 1920, maxDurationS: 180 },
  shorts: { width: 1080, height: 1920, maxDurationS: 60 },
};
