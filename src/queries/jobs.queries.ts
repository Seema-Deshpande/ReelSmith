import { query } from "../db.js";

// SQL only. No business rules and no HTTP here.

export interface JobRow {
  id: string;
  prompt: string;
  platform: string;
  language: string | null;
  status: string;
  progress: number;
  error: string | null;
  created_at: Date;
  expires_at: Date;
}

export interface PlanRow {
  id: string;
  version: number;
  planner: string;
  framing: string;
  captions_on: boolean;
  trim_silence: boolean;
  level_audio: boolean;
  target_duration_s: number | null;
  approved: boolean;
}

export interface SegmentRow {
  position: number;
  start_s: number;
  end_s: number;
}

export interface OutputRow {
  duration_s: number;
  size_bytes: string; // bigint comes back as a string
}

export interface NewJob {
  id: string;
  prompt: string;
  platform: string;
  language: string | null;
  ttlHours: number;
}

export const jobsQueries = {
  async insert(job: NewJob): Promise<void> {
    await query(
      `INSERT INTO jobs (id, prompt, platform, language, expires_at)
       VALUES ($1, $2, $3, $4, now() + make_interval(hours => $5))`,
      [job.id, job.prompt, job.platform, job.language, job.ttlHours],
    );
  },

  async findById(id: string): Promise<JobRow | undefined> {
    const { rows } = await query<JobRow>("SELECT * FROM jobs WHERE id = $1", [id]);
    return rows[0];
  },

  async findLatestPlan(jobId: string): Promise<PlanRow | undefined> {
    const { rows } = await query<PlanRow>(
      "SELECT * FROM plans WHERE job_id = $1 ORDER BY version DESC LIMIT 1",
      [jobId],
    );
    return rows[0];
  },

  async findSegments(planId: string): Promise<SegmentRow[]> {
    const { rows } = await query<SegmentRow>(
      "SELECT position, start_s, end_s FROM segments WHERE plan_id = $1 ORDER BY position",
      [planId],
    );
    return rows;
  },

  async findOutput(jobId: string): Promise<OutputRow | undefined> {
    const { rows } = await query<OutputRow>(
      "SELECT duration_s, size_bytes FROM outputs WHERE job_id = $1",
      [jobId],
    );
    return rows[0];
  },
};
