import { HttpError } from "../helpers/errors.js";
import type { PlanChanges } from "../types/plan.types.js";

// What this file does:
//   Understands a user's feedback on a plan, using simple word patterns. No AI, no key.
//   It only knows a few kinds of request. The Claude planner will understand much more.
//
// Examples:
//   "make it 15 seconds"     -> { targetDurationS: 15 }
//   "shorter"                -> half the current length
//   "no captions"            -> { captionsOn: false }
//   "keep the pauses"        -> { trimSilence: false }
//   "blurred background"     -> { framing: "blurred_fit" }
//   "no captions, 20 seconds" -> both changes at once

const HELP =
  `I couldn't tell what to change. Try: "make it 15 seconds", "shorter" or "longer", ` +
  `"no captions" or "add captions", "keep the pauses" or "trim the silence", ` +
  `"blurred background" or "center crop".`;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Returns what the feedback asks to change. Throws a 400 error with help if it asks for nothing we know.
export function interpretFeedbackWithRules(feedback: string, currentTargetS: number): PlanChanges {
  const text = feedback.toLowerCase();
  const changes: PlanChanges = {};

  const targetDurationS = findLength(text, currentTargetS);
  if (targetDurationS !== undefined) changes.targetDurationS = targetDurationS;

  const captionsOn = findCaptions(text);
  if (captionsOn !== undefined) changes.captionsOn = captionsOn;

  const trimSilence = findSilence(text);
  if (trimSilence !== undefined) changes.trimSilence = trimSilence;

  const framing = findFraming(text);
  if (framing !== undefined) changes.framing = framing;

  if (Object.keys(changes).length === 0) {
    throw HttpError.badRequest(HELP);
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Helpers: each one looks for one kind of request and returns undefined if it finds none
// ---------------------------------------------------------------------------

// "15 seconds", "20s", "2 minutes", "shorter", "longer"
function findLength(text: string, currentTargetS: number): number | undefined {
  const match = /(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|minutes?|mins?)\b/.exec(text);
  if (match) {
    const amount = Number(match[1]);
    const isMinutes = match[2]!.startsWith("m");
    return isMinutes ? amount * 60 : amount;
  }

  if (/\b(shorter|shorten|cut it down)\b/.test(text)) {
    return Math.max(1, Math.round(currentTargetS / 2));
  }
  if (/\b(longer|lengthen|extend)\b/.test(text)) {
    return Math.round(currentTargetS * 1.5);
  }
  return undefined;
}

// "no captions" -> false, "add captions" -> true
function findCaptions(text: string): boolean | undefined {
  if (/\b(no|without|remove|hide|disable)\b.*\bcaptions?\b|\bturn off\b.*\bcaptions?\b/.test(text)) return false;
  if (/\b(add|show|with|enable)\b.*\bcaptions?\b|\bturn on\b.*\bcaptions?\b/.test(text)) return true;
  return undefined;
}

// "keep the pauses" -> false, "trim the silence" -> true
function findSilence(text: string): boolean | undefined {
  if (/\b(keep|leave)\b.*\b(silence|pauses?)\b|\b(don'?t|do not)\s+(trim|cut|remove)\b.*\b(silence|pauses?)\b/.test(text)) return false;
  if (/\b(trim|cut|remove|skip)\b.*\b(silence|pauses?)\b/.test(text)) return true;
  return undefined;
}

// "blurred background" -> blurred_fit, "center crop" -> center_crop
function findFraming(text: string): PlanChanges["framing"] {
  if (/\bblur(red)?\b/.test(text)) return "blurred_fit";
  if (/\bcrop\b/.test(text)) return "center_crop";
  return undefined;
}
