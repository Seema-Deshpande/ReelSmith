import { PRESETS } from "../config/presets.js";
import { roundSeconds } from "../helpers/roundSeconds.js";
import type { PlanDraft, PlannerInput, Segment, Word } from "../types/plan.types.js";

// What this file does:
//   Makes an edit plan with simple rules. No AI, no key, always the same answer for the same input.
//
// The rules:
//   1. Group the spoken words into phrases. A pause longer than PHRASE_PAUSE_S starts a new phrase.
//   2. Cut the silences measured in the audio out of the phrases. Whisper's word times often run
//      straight through a pause, so the audio is the only reliable way to find where pauses are.
//   3. Keep phrases from the start of the video until the target length is used up.
//      The pauses between phrases are cut out, so the clip has no dead air.
//   4. If there is no speech, keep the first part of the video.
//   The user's prompt is not used by this planner. Only the Claude planner reads it.

const PHRASE_PAUSE_S = 0.6; // a pause longer than this ends a phrase
const MIN_SPEECH_S = 0.3; // a piece of speech shorter than this is dropped (a click or a breath)
const PADDING_S = 0.15; // extra time kept before and after each phrase so words are not clipped

export function makeHeuristicPlan(input: PlannerInput): PlanDraft {
  const phrases = cutOutSilences(groupIntoPhrases(input.words), input.silences);
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

// Rule 2: remove the silent stretches from inside each phrase. A phrase with a silence in the middle
// becomes two phrases. The silences must be in order, as FFmpeg reports them.
function cutOutSilences(phrases: Segment[], silences: Segment[]): Segment[] {
  const pieces: Segment[] = [];

  for (const phrase of phrases) {
    let startS = phrase.startS; // the start of the part of this phrase we have not handled yet

    for (const silence of silences) {
      const isBeforeOrAfterPhrase = silence.endS <= startS || silence.startS >= phrase.endS;
      if (isBeforeOrAfterPhrase) continue;

      if (silence.startS > startS) {
        pieces.push({ startS, endS: silence.startS }); // the speech before the silence
      }
      startS = Math.max(startS, silence.endS);
    }

    if (startS < phrase.endS) {
      pieces.push({ startS, endS: phrase.endS }); // the speech after the last silence
    }
  }

  return pieces.filter((piece) => piece.endS - piece.startS >= MIN_SPEECH_S);
}

// Rules 3 and 4: choose which parts of the video to keep.
function pickSegments(phrases: Segment[], input: PlannerInput): Segment[] {
  const maxLengthS = Math.min(input.targetDurationS, PRESETS[input.platform].maxDurationS);

  // Rule 4: no speech, so keep the start of the video.
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
        segments.push({ startS: roundSeconds(startS), endS: roundSeconds(startS + maxLengthS) });
      }
      break;
    }

    segments.push({ startS: roundSeconds(startS), endS: roundSeconds(endS) });
    totalS += lengthS;
  }
  return segments;
}
