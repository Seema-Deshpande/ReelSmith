import { config } from "../config/index.js";
import type { PlanDraft, PlannerInput } from "../types/plan.types.js";
import { makeHeuristicPlan } from "./planner.heuristic.js";

// Makes the edit plan for a video. PLANNER_PROVIDER in .env picks who does it:
//   heuristic - simple rules (planner.heuristic.ts). Free, no key.
//   claude    - Claude reads the prompt and transcript. Not built yet.

export async function makePlan(input: PlannerInput): Promise<PlanDraft> {
  if (config.plannerProvider === "heuristic") {
    return makeHeuristicPlan(input);
  }

  throw new Error("The Claude planner is not built yet. Set PLANNER_PROVIDER=heuristic in .env.");
}
