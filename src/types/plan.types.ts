import type { Platform } from "../config/presets.js";

// Types for the transcript and the edit plan. Names are camelCase (not database rows).

// One spoken word with its time in the source video.
export interface Word {
  idx: number; // position in the transcript, starting at 0
  text: string;
  startS: number;
  endS: number;
}

// One piece of the source video to keep. The output is these pieces joined in order.
export interface Segment {
  startS: number;
  endS: number;
}

export interface CaptionStyleDraft {
  font: string;
  highlightColor: string;
  position: string; // "bottom", "middle" or "top"
}

// A plan as made by a planner, before it is saved.
export interface PlanDraft {
  planner: "heuristic" | "claude";
  framing: "follow_subject" | "center_crop" | "blurred_fit";
  captionsOn: boolean;
  trimSilence: boolean;
  levelAudio: boolean;
  targetDurationS: number;
  segments: Segment[];
  captionStyle: CaptionStyleDraft;
}

// Everything a planner needs to make a plan.
export interface PlannerInput {
  prompt: string;
  platform: Platform;
  targetDurationS: number;
  videoDurationS: number;
  hasAudio: boolean;
  words: Word[];
  silences: Segment[]; // stretches of the video with no sound, measured from the audio
}

// The settings a user can switch on a plan. A field that is missing means "leave it as it is".
export interface PlanToggles {
  captionsOn?: boolean;
  trimSilence?: boolean;
  levelAudio?: boolean;
  framing?: "center_crop" | "blurred_fit"; // follow_subject is not built yet
}

// What a piece of feedback asks to change: the toggles, and maybe a new output length.
export interface PlanChanges extends PlanToggles {
  targetDurationS?: number;
}
