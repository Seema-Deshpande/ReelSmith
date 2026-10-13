import type { Platform } from "../config/presets.js";
import type { JobRow, OutputRow, PlanRow, SegmentRow, VideoAssetRow } from "../types/job.types.js";
import { durationChoices } from "./duration.js";

// Turns database rows (snake_case names) into the JSON the API returns (camelCase names).

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

function toVideoResponse(video: VideoAssetRow) {
  return {
    durationS: video.duration_s,
    width: video.width,
    height: video.height,
    fps: video.fps,
    hasAudio: video.has_audio,
  };
}

function toOutputResponse(jobId: string, output: OutputRow) {
  return {
    durationS: output.duration_s,
    sizeBytes: Number(output.size_bytes),
    videoUrl: `/api/jobs/${jobId}/video`,
  };
}

// `video`, `plan` and `output` are null until the job has them.
export function toJobResponse(
  job: JobRow,
  video: VideoAssetRow | undefined,
  plan: PlanRow | undefined,
  segments: SegmentRow[],
  output: OutputRow | undefined,
) {
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
    targetDurationS: job.target_duration_s,
    // The output lengths the user can pick from. Known once the video has been probed.
    durationChoicesS: video ? durationChoices(job.platform as Platform, video.duration_s) : [],
    video: video ? toVideoResponse(video) : null,
    plan: plan ? toPlanResponse(plan, segments) : null,
    estimate: null, // render time estimate arrives with the render step
    output: output ? toOutputResponse(job.id, output) : null,
  };
}
