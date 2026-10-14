import { randomUUID } from "node:crypto";
import { config } from "../config/index.js";
import { HttpError } from "../helpers/errors.js";
import { toJobResponse } from "../helpers/jobResponse.js";
import * as storage from "../helpers/storage.js";
import { jobsQueries } from "../queries/jobs.queries.js";
import { plansQueries } from "../queries/plans.queries.js";
import type { CreateJobInput } from "../schemas/job.schema.js";
import { runPipeline } from "./pipeline.service.js";

// The job rules live here. There is no web code in this file (no req or res),
// so background workers and tests can call these functions too.

// Create a job: save the uploaded video, then record the job in the database.
export async function createJob(input: CreateJobInput, path: string) {
  const id = randomUUID();

  try {
    await storage.saveSource(id, path);
    await jobsQueries.insert({
      id,
      prompt: input.prompt,
      platform: input.platform,
      language: input.language ?? null,
      targetDurationS: input.targetDurationS ?? null,
      ttlHours: config.jobTtlHours,
    });
  } catch (error) {
    // Do not leave the video behind if the job could not be saved.
    await storage.removeJobFiles(id);
    throw error;
  }

  // Process the video in the background; the client checks progress with GET /api/jobs/:id.
  runPipeline(id).catch((error) => console.error(`Pipeline crashed for job ${id}:`, error));

  return { id, status: "analyzing" };
}

// Get one job with its latest plan and output.
export async function getJob(id: string) {
  const job = await jobsQueries.findById(id);
  if (!job) {
    throw HttpError.notFound("job not found");
  }

  const video = await jobsQueries.findVideoAsset(id);
  const plan = await jobsQueries.findLatestPlan(id);
  const segments = plan ? await jobsQueries.findSegments(plan.id) : [];
  const captionStyle = plan ? await plansQueries.findCaptionStyle(plan.id) : undefined;
  const output = await jobsQueries.findOutput(id);
  const transcriptProvider = await plansQueries.findTranscriptProvider(id);

  return toJobResponse({ job, video, plan, segments, captionStyle, transcriptProvider, output });
}
