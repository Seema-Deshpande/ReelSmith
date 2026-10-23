import { withTransaction } from "../config/database.js";
import type { Platform } from "../config/presets.js";
import { checkPlan } from "../helpers/checkPlan.js";
import { pickTargetDuration } from "../helpers/duration.js";
import { HttpError } from "../helpers/errors.js";
import { jobsQueries } from "../queries/jobs.queries.js";
import { plansQueries } from "../queries/plans.queries.js";
import type { ApproveInput } from "../schemas/job.schema.js";
import type { JobRow } from "../types/job.types.js";
import type { PlanDraft } from "../types/plan.types.js";
import { getJob } from "./jobs.service.js";
import { interpretFeedback, makePlan } from "./planner.service.js";
import { enqueueRender } from "./render.queue.js";

// What this file does:
//   The two things a user can do while a job waits for approval:
//     revise  - ask for a change in plain words. This makes a new version of the plan.
//     approve - accept the plan. The job is then queued to be rendered (render.queue.ts).
//   Both only work while the job is "awaiting_approval".

// ---------------------------------------------------------------------------
// Main functions
// ---------------------------------------------------------------------------

// Make a new version of the plan from the user's feedback. Returns the updated job.
export async function reviseJob(jobId: string, feedback: string) {
  // 1. Load what we need and check the job can be changed.
  const job = await jobsQueries.findById(jobId);
  if (!job) throw HttpError.notFound("job not found");
  requireWaitingForApproval(job);

  const video = await jobsQueries.findVideoAsset(jobId);
  const oldPlan = await jobsQueries.findLatestPlan(jobId);
  if (!video || !oldPlan || !oldPlan.target_duration_s) {
    throw HttpError.conflict("The job has no plan yet.");
  }
  const platform = job.platform as Platform;

  // 2. Work out what the user wants changed.
  const changes = await interpretFeedback(feedback, oldPlan.target_duration_s);

  // 3. Make the new plan. Anything the user did not mention stays as it was.
  const targetDurationS = pickTargetDuration(platform, video.duration_s, changes.targetDurationS ?? oldPlan.target_duration_s);
  const words = await plansQueries.findWords(jobId);
  const newPlan = await makePlan({
    prompt: job.prompt,
    platform,
    targetDurationS,
    videoDurationS: video.duration_s,
    hasAudio: video.has_audio,
    words,
    silences: video.silences,
  });
  newPlan.captionsOn = words.length > 0 && (changes.captionsOn ?? oldPlan.captions_on); // no words, no captions
  newPlan.trimSilence = changes.trimSilence ?? oldPlan.trim_silence;
  newPlan.levelAudio = changes.levelAudio ?? oldPlan.level_audio;
  newPlan.framing = changes.framing ?? (oldPlan.framing as PlanDraft["framing"]);
  checkPlan(newPlan, video.duration_s, platform);

  // 4. Keep the caption style the user already had.
  const oldStyle = await plansQueries.findCaptionStyle(oldPlan.id);
  const captionStyle = oldStyle
    ? { font: oldStyle.font, highlightColor: oldStyle.highlight_color, position: oldStyle.position }
    : newPlan.captionStyle;

  // 5. Save it all together, checking again that nobody approved the job in the meantime.
  await withTransaction(async (db) => {
    requireWaitingForApproval(await jobsQueries.lockById(jobId, db));

    const planId = await plansQueries.insertPlan(jobId, newPlan, db);
    await plansQueries.insertSegments(planId, newPlan.segments, db);
    await plansQueries.insertCaptionStyle(planId, captionStyle, db);
    await plansQueries.insertRevision(planId, feedback, db);
    await jobsQueries.setTargetDuration(jobId, targetDurationS, db);
  });

  return getJob(jobId);
}

// Accept the plan, with any last switches the user changed, and start the render. Returns the updated job.
export async function approveJob(jobId: string, toggles: ApproveInput) {
  await withTransaction(async (db) => {
    // The lock makes sure two approvals at the same time cannot both succeed.
    const job = await jobsQueries.lockById(jobId, db);
    if (!job) throw HttpError.notFound("job not found");
    requireWaitingForApproval(job);

    await plansQueries.approveLatestPlan(jobId, toggles, db);
    await jobsQueries.markQueued(jobId, db);
  });

  // Read the job before the render starts, so the answer says "queued".
  const queuedJob = await getJob(jobId);
  enqueueRender(jobId);
  return queuedJob;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Throws a 409 unless the job is waiting for the user to approve it.
function requireWaitingForApproval(job: JobRow | undefined) {
  if (!job) throw HttpError.notFound("job not found");

  if (job.status !== "awaiting_approval") {
    throw HttpError.conflict(
      `The job is not waiting for approval (its status is "${job.status}"). Only a job that is waiting for approval can be changed.`,
    );
  }
}
