import { expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FIXTURES_DIR, LOCAL_WHISPER_MODEL } from "./env";

// Small helpers so the tests read like plain steps.

interface UploadOptions {
  file?: string; // a file in tests/.fixtures, "talk.mp4" by default
  prompt?: string;
  platform?: string;
  targetDurationS?: string;
  language?: string;
  mimeType?: string;
}

// Upload a video the way the web page will: a form with a file and some fields.
export async function uploadVideo(request: APIRequestContext, options: UploadOptions = {}) {
  const fileName = options.file ?? "talk.mp4";
  const form: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    video: {
      name: fileName,
      mimeType: options.mimeType ?? "video/mp4",
      buffer: fs.readFileSync(path.join(FIXTURES_DIR, fileName)),
    },
    prompt: options.prompt ?? "make it short",
    platform: options.platform ?? "reels",
  };
  if (options.targetDurationS !== undefined) form.targetDurationS = options.targetDurationS;
  if (options.language !== undefined) form.language = options.language;

  return request.post("/api/jobs", { multipart: form });
}

// Wait until the background steps are finished (the job is no longer "analyzing").
export async function waitForJob(request: APIRequestContext, jobId: string) {
  let job: any;
  await expect
    .poll(
      async () => {
        job = await (await request.get(`/api/jobs/${jobId}`)).json();
        return job.status;
      },
      { timeout: 20_000, intervals: [250] },
    )
    .not.toBe("analyzing");
  return job;
}

// Upload a video and wait for it to be processed. Returns the finished job.
export async function uploadAndWait(request: APIRequestContext, options: UploadOptions = {}) {
  const response = await uploadVideo(request, options);
  expect(response.status()).toBe(201);
  const { id } = await response.json();
  return waitForJob(request, id);
}

// Add up the length of all segments in a plan.
export function totalSeconds(segments: { startS: number; endS: number }[]) {
  return segments.reduce((sum, segment) => sum + (segment.endS - segment.startS), 0);
}

// Ask for a change to a job's plan, in plain words.
export async function revise(request: APIRequestContext, jobId: string, feedback: string) {
  return request.post(`/api/jobs/${jobId}/revise`, { data: { feedback } });
}

// Approve a job's plan. `switches` are the optional last changes, such as { captionsOn: false }.
export async function approve(request: APIRequestContext, jobId: string, switches?: Record<string, unknown>) {
  return request.post(`/api/jobs/${jobId}/approve`, { data: switches ?? {} });
}

// True when local Whisper is installed and its model is downloaded (npm run setup:whisper).
// Tests that need it are skipped on a machine where it is not set up.
export function localWhisperIsReady() {
  try {
    execFileSync("which", ["whisper-cli"], { stdio: "ignore" });
  } catch {
    return false;
  }
  return fs.existsSync(LOCAL_WHISPER_MODEL);
}

// True when the source second `time` falls inside one of the plan's kept segments.
export function isKept(segments: { startS: number; endS: number }[], time: number) {
  return segments.some((segment) => segment.startS <= time && time <= segment.endS);
}
