import { PRESETS } from "../config/presets.js";
import type { PlanDraft, PlannerInput, Segment, Word } from "../types/plan.types.js";

// What this file does:
//   Makes an edit plan with simple rules. No AI, no key, always the same answer for the same input.
//
// The rules:
//   1. Group the spoken words into phrases. A pause longer than PHRASE_PAUSE_S starts a new phrase.
//   2. Keep phrases from the start of the video until the target length is used up.
//      The pauses between phrases are cut out, so the clip has no dead air.
//   3. If there is no speech, keep the first part of the video.
//   The user's prompt is not used by this planner. Only the Claude planner reads it.

const PHRASE_PAUSE_S = 0.6; // a pause longer than this ends a phrase
const PADDING_S = 0.15; // extra time kept before and after each phrase so words are not clipped

export function makeHeuristicPlan(input: PlannerInput): PlanDraft {
  const phrases = groupIntoPhrases(input.words);
  const segments = pickSegments(phrases, input);

  return {
    planner: "heuristic",
    framing: "center_crop", // subject tracking is not built yet
    captionsOn: input.words.length > 0, // nothing to show if nobody speaks
    trimSilence: input.words.length > 0,
    levelAudio: input.hasAudio,
    targetDurationS: input.targetDurationS,
    segments,
    captionStyle: { font: "Arial Black", highlightColor: "#FFD400", position: "bottom" },
  };
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

// Rule 1: split the words into phrases. A phrase is a start time and an end time.
function groupIntoPhrases(words: Word[]): Segment[] {
  const phrases: Segment[] = [];

  for (const word of words) {
    const current = phrases.at(-1);
    const startsNewPhrase = !current || word.startS - current.endS > PHRASE_PAUSE_S;

    if (startsNewPhrase) {
      phrases.push({ startS: word.startS, endS: word.endS });
    } else {
      current.endS = word.endS;
    }
  }
  return phrases;
}

// Rules 2 and 3: choose which parts of the video to keep.
function pickSegments(phrases: Segment[], input: PlannerInput): Segment[] {
  const maxLengthS = Math.min(input.targetDurationS, PRESETS[input.platform].maxDurationS);

  // Rule 3: no speech, so keep the start of the video.
  if (phrases.length === 0) {
    return [{ startS: 0, endS: Math.min(maxLengthS, input.videoDurationS) }];
  }

  const segments: Segment[] = [];
  let totalS = 0;

  for (const phrase of phrases) {
    const startS = Math.max(0, phrase.startS - PADDING_S);
    const endS = Math.min(input.videoDurationS, phrase.endS + PADDING_S);
    const lengthS = endS - startS;

    if (totalS + lengthS > maxLengthS) {
      if (segments.length === 0) {
        // The very first phrase is already too long: keep as much of it as fits.
        segments.push({ startS: round(startS), endS: round(startS + maxLengthS) });
      }
      break;
    }

    segments.push({ startS: round(startS), endS: round(endS) });
    totalS += lengthS;
  }
  return segments;
}

function round(seconds: number) {
  return Math.round(seconds * 100) / 100;
}
