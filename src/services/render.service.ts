import fs from "node:fs/promises";
import { withTransaction } from "../config/database.js";
import { PRESETS, type Platform } from "../config/presets.js";
import { AUDIO_LABEL, VIDEO_LABEL, buildFilterGraph, type RenderGraphInput } from "../helpers/renderFilters.js";
import { runFfmpeg } from "../helpers/runFfmpeg.js";
import * as storage from "../helpers/storage.js";
import { jobsQueries } from "../queries/jobs.queries.js";
import { plansQueries } from "../queries/plans.queries.js";
import type { Segment } from "../types/plan.types.js";
import { probeVideo } from "./probe.service.js";

// What this file does:
//   Makes the finished clip for an approved job: cuts the plan's segments out of the uploaded video,
//   reframes them to the platform's size, levels the sound, and saves the result.
//
// The job's status goes: queued -> rendering -> done (or failed, with a reason).
// The recipe for FFmpeg is written in helpers/renderFilters.ts.

const PROGRESS_SAVE_EVERY_MS = 1000; // do not write to the database more often than this

// Captions are not built yet, so no clip has them. Each output records this honestly.
// Change it to true when the caption step is added to the render.
const CAPTIONS_BURNED_IN = false;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Renders one job. It does nothing if the job is not queued (it was deleted, or is already rendering).
// It never throws for a bad render: it marks the job "failed" instead.
export async function renderJob(jobId: string) {
  // 1. Claim the job. This is what stops one job from being rendered twice.
  const claimed = await jobsQueries.markRendering(jobId);
  if (!claimed) return;

  try {
    // 2. Make the clip and save it.
    await renderClaimedJob(jobId);
  } catch (error) {
    // The details go to the log. The user gets a plain message.
    console.error(`Render failed for job ${jobId}:`, error);
    await storage.removeOutputFiles(jobId);
    await jobsQueries.markFailed(jobId, "The video could not be rendered. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderClaimedJob(jobId: string) {
  // 1. Load everything the render needs.
  const job = await jobsQueries.findById(jobId);
  const video = await jobsQueries.findVideoAsset(jobId);
  const plan = await plansQueries.findApprovedPlan(jobId);
  if (!job || !video || !plan) {
    throw new Error("The job, its video or its approved plan is missing.");
  }

  const segmentRows = await jobsQueries.findSegments(plan.id);
  const segments: Segment[] = segmentRows.map((row) => ({ startS: row.start_s, endS: row.end_s }));
  const clipLengthS = segments.reduce((sum, segment) => sum + (segment.endS - segment.startS), 0);
  const preset = PRESETS[job.platform as Platform];

  // 2. Write the recipe.
  const filterGraph = buildFilterGraph({
    segments,
    framing: plan.framing as RenderGraphInput["framing"], // the database only allows these values
    levelAudio: plan.level_audio,
    hasAudio: video.has_audio,
    sourceFps: video.fps,
    width: preset.width,
    height: preset.height,
  });

  // 3. Run FFmpeg, saving the progress as it goes.
  const outputFile = storage.outputPath(jobId);
  await storage.prepareOutputFolder(jobId);
  await runFfmpeg(
    ffmpegArguments(storage.sourcePath(jobId), filterGraph, video.has_audio, outputFile),
    clipLengthS,
    progressSaver(jobId),
  );

  // 4. Measure the finished clip and save it. The clip and the "done" status are saved together.
  const clip = await probeVideo(outputFile);
  const { size } = await fs.stat(outputFile);

  await withTransaction(async (db) => {
    await jobsQueries.insertOutput(
      {
        jobId,
        planId: plan.id,
        storageKey: outputFile,
        durationS: clip.durationS,
        sizeBytes: size,
        captionsBurnedIn: CAPTIONS_BURNED_IN,
      },
      db,
    );
    await jobsQueries.markDone(jobId, db);
  });
}

// What we tell FFmpeg: read the video, run the recipe, and write an MP4 that plays everywhere.
function ffmpegArguments(sourcePath: string, filterGraph: string, hasAudio: boolean, outputFile: string) {
  const picture = ["-map", VIDEO_LABEL, "-c:v", "libx264", "-preset", "veryfast", "-crf", "23"];
  const sound = hasAudio ? ["-map", AUDIO_LABEL, "-c:a", "aac", "-b:a", "128k"] : ["-an"];

  return ["-i", sourcePath, "-filter_complex", filterGraph, ...picture, ...sound, "-movflags", "+faststart", outputFile];
}

// Returns a function that saves progress to the database, but only when it changed
// and at most once a second, so a render does not flood the database.
function progressSaver(jobId: string) {
  let lastPercent = -1;
  let lastSavedAt = 0;

  return (percent: number) => {
    const tooSoon = Date.now() - lastSavedAt < PROGRESS_SAVE_EVERY_MS;
    if (percent === lastPercent || tooSoon) return;

    lastPercent = percent;
    lastSavedAt = Date.now();
    jobsQueries.setProgress(jobId, percent).catch((error) => console.error("Could not save progress:", error));
  };
}
