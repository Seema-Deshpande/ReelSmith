import { pool, type Db } from "../config/database.js";
import type { JobRow, NewJob, NewVideoAsset, OutputRow, PlanRow, SegmentRow, VideoAssetRow } from "../types/job.types.js";

// SQL only. No business rules and no HTTP here.
// The types used below are in src/types/job.types.ts.

export const jobsQueries = {
  // ----- Save -----

  async insert(job: NewJob): Promise<void> {
    await pool.query(
      `INSERT INTO jobs (id, prompt, platform, language, target_duration_s, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6))`,
      [job.id, job.prompt, job.platform, job.language, job.targetDurationS, job.ttlHours],
    );
  },

  async insertVideoAsset(asset: NewVideoAsset): Promise<void> {
    await pool.query(
      `INSERT INTO video_assets (job_id, storage_key, duration_s, width, height, fps, has_audio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [asset.jobId, asset.storageKey, asset.durationS, asset.width, asset.height, asset.fps, asset.hasAudio],
    );
  },

  // ----- Update -----

  async setProgress(jobId: string, progress: number): Promise<void> {
    await pool.query("UPDATE jobs SET progress = $2 WHERE id = $1", [jobId, progress]);
  },

  async setTargetDuration(jobId: string, seconds: number): Promise<void> {
    await pool.query("UPDATE jobs SET target_duration_s = $2 WHERE id = $1", [jobId, seconds]);
  },

  // The plan is ready: the job now waits for the user to approve it.
  async markAwaitingApproval(jobId: string, db: Db = pool): Promise<void> {
    await db.query("UPDATE jobs SET status = 'awaiting_approval', progress = 100 WHERE id = $1", [jobId]);
  },

  async markFailed(jobId: string, message: string): Promise<void> {
    await pool.query("UPDATE jobs SET status = 'failed', error = $2 WHERE id = $1", [jobId, message]);
  },

  // ----- Read -----

  async findById(id: string): Promise<JobRow | undefined> {
    const { rows } = await pool.query<JobRow>("SELECT * FROM jobs WHERE id = $1", [id]);
    return rows[0];
  },

  async findVideoAsset(jobId: string): Promise<VideoAssetRow | undefined> {
    const { rows } = await pool.query<VideoAssetRow>(
      "SELECT duration_s, width, height, fps, has_audio FROM video_assets WHERE job_id = $1",
      [jobId],
    );
    return rows[0];
  },

  async findLatestPlan(jobId: string): Promise<PlanRow | undefined> {
    const { rows } = await pool.query<PlanRow>(
      "SELECT * FROM plans WHERE job_id = $1 ORDER BY version DESC LIMIT 1",
      [jobId],
    );
    return rows[0];
  },

  async findSegments(planId: string): Promise<SegmentRow[]> {
    const { rows } = await pool.query<SegmentRow>(
      "SELECT position, start_s, end_s FROM segments WHERE plan_id = $1 ORDER BY position",
      [planId],
    );
    return rows;
  },

  async findOutput(jobId: string): Promise<OutputRow | undefined> {
    const { rows } = await pool.query<OutputRow>(
      "SELECT duration_s, size_bytes FROM outputs WHERE job_id = $1",
      [jobId],
    );
    return rows[0];
  },
};
