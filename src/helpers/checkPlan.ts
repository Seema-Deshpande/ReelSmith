import { PRESETS, type Platform } from "../config/presets.js";
import type { PlanDraft } from "../types/plan.types.js";

// Safety check for a plan before we save it. A planner (especially an AI one) can make mistakes,
// so every plan goes through here. Throws an Error that says what is wrong.

const TOLERANCE_S = 0.05; // allow tiny rounding differences

export function checkPlan(plan: PlanDraft, videoDurationS: number, platform: Platform): void {
  if (plan.segments.length === 0) {
    throw new Error("The plan has no segments.");
  }

  let previousEndS = 0;
  let totalS = 0;

  for (const [index, segment] of plan.segments.entries()) {
    const name = `Segment ${index + 1}`;

    if (segment.endS <= segment.startS) {
      throw new Error(`${name} ends before it starts.`);
    }
    if (segment.startS < previousEndS - TOLERANCE_S) {
      throw new Error(`${name} overlaps the one before it.`);
    }
    if (segment.endS > videoDurationS + TOLERANCE_S) {
      throw new Error(`${name} goes past the end of the video.`);
    }

    previousEndS = segment.endS;
    totalS += segment.endS - segment.startS;
  }

  const maxS = PRESETS[platform].maxDurationS;
  if (totalS > maxS + TOLERANCE_S) {
    throw new Error(`The plan is ${totalS.toFixed(1)}s long, but ${platform} allows ${maxS}s.`);
  }
}
