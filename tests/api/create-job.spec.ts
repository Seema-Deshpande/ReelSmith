import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { TEST_UPLOAD_DIR } from "../support/env";
import { uploadVideo } from "../support/helpers";

test.describe("POST /api/jobs: accepting an upload", () => {
  test("accepts a video and answers right away with the job id", async ({ request }) => {
    const response = await uploadVideo(request);

    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.status).toBe("analyzing");
  });

  test("saves the video on disk in the job's folder", async ({ request }) => {
    const { id } = await (await uploadVideo(request)).json();

    expect(fs.existsSync(path.join(TEST_UPLOAD_DIR, id, "source"))).toBe(true);
  });

  test("accepts an optional language", async ({ request }) => {
    const response = await uploadVideo(request, { language: "en-US" });
    expect(response.status()).toBe(201);
  });
});

test.describe("POST /api/jobs: rejecting bad requests", () => {
  test("rejects an unknown platform", async ({ request }) => {
    const response = await uploadVideo(request, { platform: "youtube" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("platform");
  });

  test("rejects an empty prompt", async ({ request }) => {
    const response = await uploadVideo(request, { prompt: "   " });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("prompt");
  });

  test("rejects a badly written language code", async ({ request }) => {
    const response = await uploadVideo(request, { language: "english" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("language");
  });

  test("rejects a request with no video file", async ({ request }) => {
    const response = await request.post("/api/jobs", { multipart: { prompt: "x", platform: "reels" } });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("video file is required");
  });

  test("rejects a file that says it is not a video", async ({ request }) => {
    const response = await uploadVideo(request, { mimeType: "text/plain" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toBe("video must be a video file");
  });

  test("rejects a file bigger than the upload limit", async ({ request }) => {
    const sixMegabytes = Buffer.alloc(6 * 1024 * 1024);
    const response = await request.post("/api/jobs", {
      multipart: {
        video: { name: "big.mp4", mimeType: "video/mp4", buffer: sixMegabytes },
        prompt: "x",
        platform: "reels",
      },
    });

    expect(response.status()).toBe(413);
  });

  test("does not leave files behind when a request is rejected", async ({ request }) => {
    const before = fs.readdirSync(TEST_UPLOAD_DIR).length;

    await uploadVideo(request, { platform: "youtube" });
    await uploadVideo(request, { mimeType: "text/plain" });

    expect(fs.readdirSync(TEST_UPLOAD_DIR).length).toBe(before);
  });
});

test.describe("POST /api/jobs: output length", () => {
  test("rejects a length longer than the platform allows", async ({ request }) => {
    const response = await uploadVideo(request, { platform: "shorts", targetDurationS: "120" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("shorts allows at most 60 seconds");
  });

  test("rejects a length that is not a number", async ({ request }) => {
    const response = await uploadVideo(request, { targetDurationS: "abc" });

    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("must be a number of seconds");
  });

  test("rejects a length of zero", async ({ request }) => {
    const response = await uploadVideo(request, { targetDurationS: "0" });
    expect(response.status()).toBe(400);
  });

  test("treats an empty length as not given", async ({ request }) => {
    const response = await uploadVideo(request, { targetDurationS: "" });
    expect(response.status()).toBe(201);
  });
});
