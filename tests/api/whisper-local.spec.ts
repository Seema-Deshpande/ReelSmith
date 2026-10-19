import { expect, test } from "@playwright/test";
import { isKept, localWhisperIsReady, totalSeconds, uploadAndWait } from "../support/helpers";

// These tests use the sample video: a computer voice reading five sentences with a pause
// after each. Where the sound is, in the source video (found with FFmpeg's silencedetect):
//
//   speech  0.0 - 2.0 | 3.5 - 5.5 | 7.0 - 9.1 | 10.5 - 12.5 | 14.0 - 15.0 |  silence to 18.6
//   pause        2.0-3.5     5.5-7.0     9.1-10.5     12.5-14.0
//
// Local Whisper listens to the real speech, so the plan should keep the sentences and cut the pauses.
// The tests are skipped on a machine where local Whisper is not set up (npm run setup:whisper).

test.skip(!localWhisperIsReady(), "local Whisper is not set up (run: npm run setup:whisper)");

test("local Whisper hears the real speech and the plan cuts the pauses between sentences", async ({ request }) => {
  const job = await uploadAndWait(request, { file: "sample-talk.mp4", language: "en" });

  expect(job.status).toBe("awaiting_approval");
  expect(job.transcriptProvider).toBe("whisper-local");

  // Five sentences, so about five segments.
  const segments = job.plan.segments;
  expect(segments.length).toBeGreaterThanOrEqual(4);
  expect(segments.length).toBeLessThanOrEqual(6);

  // The middle of each pause is cut out.
  for (const pauseMiddle of [2.75, 6.25, 9.8, 13.25]) {
    expect(isKept(segments, pauseMiddle), `second ${pauseMiddle} is in a pause, so it should be cut`).toBe(false);
  }

  // The middle of each sentence is kept.
  for (const speechMiddle of [1.0, 4.5, 8.0, 11.5]) {
    expect(isKept(segments, speechMiddle), `second ${speechMiddle} is speech, so it should be kept`).toBe(true);
  }

  // Everything kept is shorter than the whole video, because the pauses are gone.
  expect(totalSeconds(segments)).toBeLessThan(13);
});
