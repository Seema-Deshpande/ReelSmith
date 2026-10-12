import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "../errors.js";
import { jobsQueries } from "../queries/jobs.queries.js";
import type { OutputRow, PlanRow, SegmentRow } from "../queries/jobs.queries.js";
import type { CreateJobInput } from "../schemas/job.schema.js";
import * as storage from "../storage.js";

// Business rules and orchestration. No req/res here, so it can be reused by workers and tests.

export async function createJob(input: CreateJobInput, uploadedTempPath: string): Promise<{ id: string; status: string }> {
  const id = randomUUID();
  try {
    await storage.saveSource(id, uploadedTempPath);
    await jobsQueries.insert({
      id,
      prompt: input.prompt,
      platform: input.platform,
      language: input.language ?? null,
      ttlHours: config.jobTtlHours,
    });
  } catch (err) {
    await storage.removeJobFiles(id);
    throw err;
  }
  return { id, status: "analyzing" };
}

/** Reshapes database rows (snake_case) into the JSON the API returns (camelCase). */
function toPlanResponse(plan: PlanRow, segments: SegmentRow[]) {
  return {
    version: plan.version,
    planner: plan.planner,
    framing: plan.framing,
    captionsOn: plan.captions_on,
    trimSilence: plan.trim_silence,
    levelAudio: plan.level_audio,
    targetDurationS: plan.target_duration_s,
    approved: plan.approved,
    segments: segments.map((s) => ({ position: s.position, startS: s.start_s, endS: s.end_s })),
  };
}

function toOutputResponse(jobId: string, output: OutputRow) {
  return {
    durationS: output.duration_s,
    sizeBytes: Number(output.size_bytes),
    videoUrl: `/api/jobs/${jobId}/video`,
  };
}

/** A job with its latest plan and output. `plan` and `output` are null until they exist. */
export async function getJob(id: string) {
  const job = await jobsQueries.findById(id);
  if (!job) throw HttpError.notFound("job not found");

  const plan = await jobsQueries.findLatestPlan(id);
  const segments = plan ? await jobsQueries.findSegments(plan.id) : [];
  const output = await jobsQueries.findOutput(id);

  return {
    id: job.id,
    prompt: job.prompt,
    platform: job.platform,
    language: job.language,
    status: job.status,
    progress: job.progress,
    error: job.error,
    createdAt: job.created_at,
    expiresAt: job.expires_at,
    plan: plan ? toPlanResponse(plan, segments) : null,
    estimate: null, // render time estimate arrives with the render step
    output: output ? toOutputResponse(id, output) : null,
  };
}
