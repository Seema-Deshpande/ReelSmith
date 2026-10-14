import { withTransaction } from "../config/database.js";
import type { Platform } from "../config/presets.js";
import { checkPlan } from "../helpers/checkPlan.js";
import { pickTargetDuration } from "../helpers/duration.js";
import * as storage from "../helpers/storage.js";
import { jobsQueries } from "../queries/jobs.queries.js";
import { plansQueries } from "../queries/plans.queries.js";
import { makePlan } from "./planner.service.js";
import { probeVideo } from "./probe.service.js";
import { transcribe } from "./transcribe.service.js";

// Processes a new job in the background, one step at a time:
//   1. probe      read the video's details
//   2. duration   decide how long the output will be
//   3. transcribe turn the speech into words
//   4. plan       decide which parts to keep, then wait for the user to approve
// Each step is its own function below. To add a step, write a function like probeStep
// and call it in runPipeline after the previous one.

export async function runPipeline(jobId: string) {
  try {
    await probeStep(jobId);
    await durationStep(jobId);
    await transcribeStep(jobId);
    await planStep(jobId);
  } catch (error) {
    // Any failure ends the job and shows the reason to the user.
    await jobsQueries.markFailed(jobId, errorMessage(error));
  }
}

// Step 1: read the video's details (length, size, audio) and save them.
async function probeStep(jobId: string) {
  const sourcePath = storage.sourcePath(jobId);

  const info = await probeVideo(sourcePath);
  await jobsQueries.insertVideoAsset({ jobId, storageKey: sourcePath, ...info });

  await jobsQueries.setProgress(jobId, 30);
}

// Step 2: decide how long the output clip will be, and save it on the job.
// Uses the length the user asked for, or a preset for the platform if they did not.
async function durationStep(jobId: string) {
  const { job, video } = await loadJob(jobId);

  const seconds = pickTargetDuration(job.platform as Platform, video.duration_s, job.target_duration_s);
  await jobsQueries.setTargetDuration(jobId, seconds);

  await jobsQueries.setProgress(jobId, 40);
}

// Step 3: turn the speech into words and save the transcript.
async function transcribeStep(jobId: string) {
  const { job, video } = await loadJob(jobId);

  const transcript = await transcribe({
    videoPath: storage.sourcePath(jobId),
    videoDurationS: video.duration_s,
    hasAudio: video.has_audio,
    language: job.language,
  });
  await plansQueries.insertTranscript(jobId, transcript.provider, job.language, transcript.words);

  await jobsQueries.setProgress(jobId, 60);
}

// Step 4: make the edit plan and save it. The job then waits for the user to approve it.
async function planStep(jobId: string) {
  const { job, video } = await loadJob(jobId);
  if (!job.target_duration_s) {
    throw new Error("The output length has not been decided yet.");
  }
  const platform = job.platform as Platform;

  const words = await plansQueries.findWords(jobId);
  const plan = await makePlan({
    prompt: job.prompt,
    platform,
    targetDurationS: job.target_duration_s,
    videoDurationS: video.duration_s,
    hasAudio: video.has_audio,
    words,
  });
  checkPlan(plan, video.duration_s, platform);

  // Save everything together: either the whole plan is saved and the job is ready, or nothing is.
  await withTransaction(async (db) => {
    const planId = await plansQueries.insertPlan(jobId, plan, db);
    await plansQueries.insertSegments(planId, plan.segments, db);
    await plansQueries.insertCaptionStyle(planId, plan.captionStyle, db);
    await jobsQueries.markAwaitingApproval(jobId, db);
  });
}

// Loads the job and its video details. Every step after the probe needs both.
async function loadJob(jobId: string) {
  const job = await jobsQueries.findById(jobId);
  const video = await jobsQueries.findVideoAsset(jobId);
  if (!job || !video) {
    throw new Error("The job or its video details are missing.");
  }
  return { job, video };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
