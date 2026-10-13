import type { Platform } from "../config/presets.js";
import { pickTargetDuration } from "../helpers/duration.js";
import * as storage from "../helpers/storage.js";
import { jobsQueries } from "../queries/jobs.queries.js";
import { probeVideo } from "./probe.service.js";

// Processes a new job in the background, one step at a time.
// Each step is its own function below. To add a step (transcribe, then plan),
// write a function like probeStep and call it in runPipeline after the previous one.

export async function runPipeline(jobId: string) {
  try {
    await probeStep(jobId);
    await durationStep(jobId);
    // Next: transcribeStep, then planStep.
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
  const job = await jobsQueries.findById(jobId);
  const video = await jobsQueries.findVideoAsset(jobId);
  if (!job || !video) {
    throw new Error("The job or its video details are missing.");
  }

  const seconds = pickTargetDuration(job.platform as Platform, video.duration_s, job.target_duration_s);
  await jobsQueries.setTargetDuration(jobId, seconds);

  await jobsQueries.setProgress(jobId, 40);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}
