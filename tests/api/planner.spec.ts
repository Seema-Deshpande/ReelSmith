import { expect, test } from "@playwright/test";
import { makeHeuristicPlan } from "../../src/services/planner.heuristic";
import type { PlannerInput } from "../../src/types/plan.types";
import { isKept } from "../support/helpers";

// These tests call the planner directly, with no server. They check how it cuts pauses.

// A planner input with sensible defaults. Each test changes only what it is about.
function plannerInput(changes: Partial<PlannerInput>): PlannerInput {
  return {
    prompt: "make it short",
    platform: "reels",
    targetDurationS: 30,
    videoDurationS: 20,
    hasAudio: true,
    words: [],
    silences: [],
    ...changes,
  };
}

// Words with no gaps between them, the way local Whisper reports them: each word ends exactly
// where the next one starts, even across a pause.
const wordsWithNoGaps = [
  { idx: 0, text: "Hello", startS: 0, endS: 1 },
  { idx: 1, text: "there", startS: 1, endS: 4 }, // this word runs across the pause from 1.2 s to 3.5 s
  { idx: 2, text: "friend", startS: 4, endS: 6 },
];

test.describe("the rule-based planner and silences", () => {
  test("cuts a silence out of the middle of a phrase, even when the word times run through it", async () => {
    const plan = makeHeuristicPlan(
      plannerInput({ words: wordsWithNoGaps, silences: [{ startS: 1.2, endS: 3.5 }] }),
    );

    expect(plan.segments).toHaveLength(2);
    expect(isKept(plan.segments, 0.5)).toBe(true); // speech before the pause
    expect(isKept(plan.segments, 2.3)).toBe(false); // the middle of the pause
    expect(isKept(plan.segments, 5)).toBe(true); // speech after the pause
  });

  test("does not find the pause without the silences (this is why they are measured)", async () => {
    const plan = makeHeuristicPlan(plannerInput({ words: wordsWithNoGaps, silences: [] }));

    expect(plan.segments).toHaveLength(1); // the words touch, so it looks like one long phrase
    expect(isKept(plan.segments, 2.3)).toBe(true);
  });

  test("still splits phrases at gaps between words when there are no silences", async () => {
    const words = [
      { idx: 0, text: "one", startS: 0.5, endS: 1 },
      { idx: 1, text: "two", startS: 3, endS: 3.5 }, // a 2 s gap before this word
    ];

    const plan = makeHeuristicPlan(plannerInput({ words }));

    expect(plan.segments).toHaveLength(2);
  });

  test("ignores a silence at the very end of the video", async () => {
    const words = [{ idx: 0, text: "bye", startS: 1, endS: 3 }];

    const plan = makeHeuristicPlan(plannerInput({ words, silences: [{ startS: 3, endS: 20 }] }));

    expect(plan.segments).toHaveLength(1);
    expect(isKept(plan.segments, 2)).toBe(true);
  });

  test("drops a tiny sliver of sound left between two silences", async () => {
    // Speech from 0 to 6, but silence from 0.1 to 5: only 0.1 s before it and 1 s after it are left.
    const words = [{ idx: 0, text: "word", startS: 0, endS: 6 }];

    const plan = makeHeuristicPlan(plannerInput({ words, silences: [{ startS: 0.1, endS: 5 }] }));

    expect(plan.segments).toHaveLength(1);
    expect(isKept(plan.segments, 5.5)).toBe(true);
    expect(isKept(plan.segments, 2)).toBe(false);
  });

  test("keeps the start of the video when there are no words at all", async () => {
    const plan = makeHeuristicPlan(plannerInput({ words: [], silences: [{ startS: 4, endS: 8 }] }));

    expect(plan.segments).toEqual([{ startS: 0, endS: 20 }]);
  });
});
