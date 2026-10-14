import { expect, test } from "@playwright/test";
import { totalSeconds, uploadAndWait } from "../support/helpers";

// These tests upload a video, wait for the background steps, then check the finished job.
// The mock transcript and the heuristic planner are used, so the results are always the same.

test.describe("after an upload the pipeline", () => {
  test("reads the video and makes a plan that waits for approval", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "talk.mp4", platform: "reels" });

    expect(job.status).toBe("awaiting_approval");
    expect(job.progress).toBe(100);
    expect(job.error).toBeNull();
    expect(job.transcriptProvider).toBe("mock"); // the tests use the free mock transcript

    // What ffprobe found.
    expect(job.video).toMatchObject({ width: 320, height: 240, fps: 10, hasAudio: true });
    expect(job.video.durationS).toBeCloseTo(60, 0);

    // The plan.
    expect(job.plan).toMatchObject({
      version: 1,
      planner: "heuristic",
      framing: "center_crop",
      captionsOn: true,
      trimSilence: true,
      levelAudio: true,
      approved: false,
      captionStyle: { font: "Arial Black", highlightColor: "#FFD400", position: "bottom" },
    });
    expect(job.plan.segments.length).toBeGreaterThan(1);
  });

  test("picks 30 seconds for a one minute video when the user gives no length", async ({ request }) => {
    const job = await uploadAndWait(request, { platform: "reels" });

    expect(job.targetDurationS).toBe(30);
    expect(job.durationChoicesS).toEqual([15, 30, 60]);
    expect(totalSeconds(job.plan.segments)).toBeLessThanOrEqual(30.1);
    expect(totalSeconds(job.plan.segments)).toBeGreaterThan(25); // close to the target, not far under it
  });

  test("uses the length the user asked for", async ({ request }) => {
    const job = await uploadAndWait(request, { platform: "tiktok", targetDurationS: "15" });

    expect(job.targetDurationS).toBe(15);
    expect(job.plan.targetDurationS).toBe(15);
    expect(totalSeconds(job.plan.segments)).toBeLessThanOrEqual(15.1);
  });

  test("never makes the output longer than the video", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "short.mp4", targetDurationS: "20" });

    expect(job.targetDurationS).toBeCloseTo(3, 0);
    expect(totalSeconds(job.plan.segments)).toBeLessThanOrEqual(3.1);
    expect(job.durationChoicesS).toHaveLength(1); // the only choice is the whole video
  });

  test("keeps segments in order, inside the video, without overlaps", async ({ request }) => {
    const job = await uploadAndWait(request);

    let previousEnd = 0;
    for (const segment of job.plan.segments) {
      expect(segment.startS).toBeGreaterThanOrEqual(previousEnd);
      expect(segment.endS).toBeGreaterThan(segment.startS);
      expect(segment.endS).toBeLessThanOrEqual(job.video.durationS + 0.05);
      previousEnd = segment.endS;
    }
  });

  test("turns captions off and keeps the start of a video with no sound", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "silent.mp4", platform: "shorts" });

    expect(job.status).toBe("awaiting_approval");
    expect(job.video.hasAudio).toBe(false);
    expect(job.plan).toMatchObject({ captionsOn: false, trimSilence: false, levelAudio: false });
    expect(job.plan.segments).toHaveLength(1);
    expect(job.plan.segments[0].startS).toBe(0);
  });

  test("fails the job with a clear reason when the file is not a real video", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "notvideo.mp4" });

    expect(job.status).toBe("failed");
    expect(job.error).toBe("The file could not be read as a video.");
    expect(job.plan).toBeNull();
    expect(job.video).toBeNull();
  });
});
