import { expect, test } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { TEST_OUTPUT_DIR, TEST_UPLOAD_DIR } from "../support/env";
import { approve, totalSeconds, uploadAndWait, waitForRender } from "../support/helpers";
import { renderJobFor } from "../support/helpers";
import { describeFile, downloadClip, saveFrame, squarePsnr } from "../support/media";

// After a plan is approved, the job is rendered into a finished clip.
// Captions are not built yet, so these clips have none (and say so: captionsBurnedIn is false).

test.describe("rendering an approved plan", () => {
  test("turns the plan into a finished clip", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4", platform: "reels" });

    expect(job.status).toBe("done");
    expect(job.progress).toBe(100);
    expect(job.error).toBeNull();
    expect(job.output.videoUrl).toBe(`/api/jobs/${job.id}/video`);
    expect(job.output.sizeBytes).toBeGreaterThan(1000);
    expect(job.output.captionsBurnedIn).toBe(false); // captions are not built yet, and the API says so
  });

  test("makes a clip as long as the plan says", async ({ request }) => {
    const job = await renderJobFor(request, { file: "sample-talk.mp4" });

    const clip = await describeFile(await downloadClip(request, job.id));

    expect(clip.durationS).toBeCloseTo(totalSeconds(job.plan.segments), 0);
    expect(Math.abs(clip.durationS - totalSeconds(job.plan.segments))).toBeLessThan(0.3);
    expect(job.output.durationS).toBeCloseTo(clip.durationS, 1);
  });

  test("makes a vertical clip at the platform's size", async ({ request }) => {
    const job = await renderJobFor(request, { file: "sample-talk.mp4", platform: "tiktok" });

    const clip = await describeFile(await downloadClip(request, job.id));
    const picture = clip.streams.find((stream) => stream.codec_type === "video");

    expect(picture).toMatchObject({ width: 1080, height: 1920 });
  });

  test("also works with a blurred background", async ({ request }) => {
    const job = await renderJobFor(request, { file: "sample-talk.mp4" }, { framing: "blurred_fit" });

    expect(job.status).toBe("done");
    const clip = await describeFile(await downloadClip(request, job.id));
    expect(clip.streams.find((stream) => stream.codec_type === "video")).toMatchObject({ width: 1080, height: 1920 });
  });

  test("renders a video that has no sound, with no sound track in the clip", async ({ request }) => {
    const job = await renderJobFor(request, { file: "silent.mp4" });

    expect(job.status).toBe("done");
    const clip = await describeFile(await downloadClip(request, job.id));
    expect(clip.streams.filter((stream) => stream.codec_type === "audio")).toHaveLength(0);
  });

  test("shows the progress and the job moves on from queued", async ({ request }) => {
    const planned = await uploadAndWait(request, { file: "talk.mp4" });

    const approved = await (await approve(request, planned.id)).json();
    expect(approved.status).toBe("queued"); // the answer to the approval, before the render starts

    const finished = await waitForRender(request, planned.id);
    expect(finished.status).toBe("done");
  });

  test("fails the job with a plain message when the render cannot run, and leaves no clip behind", async ({ request }) => {
    const planned = await uploadAndWait(request, { file: "talk.mp4" });
    fs.rmSync(path.join(TEST_UPLOAD_DIR, planned.id, "source")); // the video disappears before the render

    await approve(request, planned.id);
    const job = await waitForRender(request, planned.id);

    expect(job.status).toBe("failed");
    expect(job.error).toBe("The video could not be rendered. Please try again.");
    expect(job.output).toBeNull();
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, planned.id))).toBe(false);
  });
});

// The clean-output rules: the clip contains only the user's video and the edits they asked for.
test.describe("the clip is clean", () => {
  test("has one picture, at most one sound track, and nothing else", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4" });

    const clip = await describeFile(await downloadClip(request, job.id));
    const kinds = clip.streams.map((stream) => stream.codec_type);

    expect(kinds.filter((kind) => kind === "video")).toHaveLength(1);
    expect(kinds.filter((kind) => kind === "audio").length).toBeLessThanOrEqual(1);
    expect(kinds.filter((kind) => !["video", "audio"].includes(kind))).toEqual([]); // no subtitle, data or attachment
  });

  test("carries no mark of ReelSmith or AI in its tags", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4" });

    const clip = await describeFile(await downloadClip(request, job.id));

    for (const tag of clip.allTags) {
      expect(tag, `tag "${tag}"`).not.toMatch(/reelsmith|generated|\bai\b|watermark/);
    }
  });

  test("leaves the four corners of the picture untouched", async ({ request }) => {
    const job = await renderJobFor(request, { file: "sample-talk.mp4" });
    const firstSegmentStartS = job.plan.segments[0].startS;
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "reelsmith-corners-"));

    // The first picture of the clip, and the same moment of the source with the same crop and scale applied.
    const clipPng = path.join(folder, "clip.png");
    const expectedPng = path.join(folder, "expected.png");
    await saveFrame(await downloadClip(request, job.id), 0, clipPng);
    await saveFrame(
      path.join("tests", ".fixtures", "sample-talk.mp4"),
      firstSegmentStartS,
      expectedPng,
      "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920",
    );

    // A logo or a badge nearly always sits in a corner, so the corners must match the source.
    const size = 120;
    const corners = [[0, 0], [1080 - size, 0], [0, 1920 - size], [1080 - size, 1920 - size]];
    for (const [x, y] of corners) {
      expect(await squarePsnr(clipPng, expectedPng, x!, y!, size), `corner at ${x},${y}`).toBeGreaterThan(25);
    }
  });

  test("the corner check really would notice a logo", async ({ request }) => {
    // Proof that the test above can fail: put a white box in the corner of a picture and compare again.
    const job = await renderJobFor(request, { file: "sample-talk.mp4" });
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "reelsmith-logo-"));
    const clipPath = await downloadClip(request, job.id);
    const cleanPng = path.join(folder, "clean.png");
    const markedPng = path.join(folder, "marked.png");

    await saveFrame(clipPath, 0, cleanPng);
    await saveFrame(clipPath, 0, markedPng, "drawbox=x=20:y=20:w=150:h=150:color=white:t=fill");

    expect(await squarePsnr(cleanPng, markedPng, 0, 0, 120)).toBeLessThan(20); // the corner with the box
    expect(await squarePsnr(cleanPng, markedPng, 960, 1800, 120)).toBeGreaterThan(40); // a corner without it
  });
});

test.describe("GET /api/jobs/:id/video", () => {
  test("sends the whole clip", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4" });

    const response = await request.get(`/api/jobs/${job.id}/video`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("video/mp4");
    expect((await response.body()).length).toBe(job.output.sizeBytes);
  });

  test("sends just a part when asked, so a player can skip around", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4" });

    const response = await request.get(`/api/jobs/${job.id}/video`, { headers: { Range: "bytes=0-99" } });

    expect(response.status()).toBe(206);
    expect((await response.body()).length).toBe(100);
  });

  test("makes the browser save the file when download=1", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4" });

    const response = await request.get(`/api/jobs/${job.id}/video?download=1`);

    expect(response.headers()["content-disposition"]).toBe(`attachment; filename="reelsmith-${job.id.slice(0, 8)}.mp4"`);
  });

  test("answers 404 before the clip is ready", async ({ request }) => {
    const planned = await uploadAndWait(request, { file: "talk.mp4" }); // planned, but not approved

    const response = await request.get(`/api/jobs/${planned.id}/video`);

    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("The video is not ready yet.");
  });

  test("answers 404 for a job that does not exist", async ({ request }) => {
    const response = await request.get("/api/jobs/00000000-0000-0000-0000-0000000000ff/video");
    expect(response.status()).toBe(404);
  });
});

test.describe("DELETE /api/jobs/:id", () => {
  test("removes a finished job, its clip and its upload", async ({ request }) => {
    const job = await renderJobFor(request, { file: "talk.mp4" });
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, job.id, "clip.mp4"))).toBe(true);

    const response = await request.delete(`/api/jobs/${job.id}`);

    expect(response.status()).toBe(204);
    expect((await request.get(`/api/jobs/${job.id}`)).status()).toBe(404);
    expect((await request.get(`/api/jobs/${job.id}/video`)).status()).toBe(404);
    expect(fs.existsSync(path.join(TEST_OUTPUT_DIR, job.id))).toBe(false);
    expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, job.id))).toBe(false);
  });

  test("removes a job that failed", async ({ request }) => {
    const failed = await uploadAndWait(request, { file: "notvideo.mp4" });
    expect(failed.status).toBe("failed");

    expect((await request.delete(`/api/jobs/${failed.id}`)).status()).toBe(204);
  });

  test("answers 404 when the job is already gone", async ({ request }) => {
    const job = await uploadAndWait(request, { file: "talk.mp4" });
    await request.delete(`/api/jobs/${job.id}`);

    expect((await request.delete(`/api/jobs/${job.id}`)).status()).toBe(404);
  });

  test("answers 400 for an id that is not valid", async ({ request }) => {
    expect((await request.delete("/api/jobs/not-an-id")).status()).toBe(400);
  });
});
