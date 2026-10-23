import { pool, type Db } from "../config/database.js";
import type { CaptionStyleRow, PlanRow } from "../types/job.types.js";
import type { CaptionStyleDraft, PlanDraft, PlanToggles, Segment, Word } from "../types/plan.types.js";

// SQL for transcripts, words, plans, segments and caption styles.
// Functions that save data take an optional `db`, so they can run inside a transaction.

export const plansQueries = {
  // ----- Transcript -----

  async insertTranscript(jobId: string, provider: string, language: string | null, words: Word[]): Promise<void> {
    const { rows } = await pool.query<{ id: string }>(
      "INSERT INTO transcripts (job_id, provider, language) VALUES ($1, $2, $3) RETURNING id",
      [jobId, provider, language],
    );
    const transcriptId = rows[0]?.id;

    // One query for all words: Postgres turns the four lists into rows.
    await pool.query(
      `INSERT INTO words (transcript_id, idx, text, start_s, end_s)
       SELECT $1, * FROM unnest($2::int[], $3::text[], $4::float8[], $5::float8[])`,
      [
        transcriptId,
        words.map((word) => word.idx),
        words.map((word) => word.text),
        words.map((word) => word.startS),
        words.map((word) => word.endS),
      ],
    );
  },

  // Who made the transcript: "mock", "whisper" or "whisper-local". Undefined before transcription.
  async findTranscriptProvider(jobId: string): Promise<string | undefined> {
    const { rows } = await pool.query<{ provider: string }>("SELECT provider FROM transcripts WHERE job_id = $1", [jobId]);
    return rows[0]?.provider;
  },

  async findWords(jobId: string): Promise<Word[]> {
    const { rows } = await pool.query<{ idx: number; text: string; start_s: number; end_s: number }>(
      `SELECT w.idx, w.text, w.start_s, w.end_s
       FROM words w JOIN transcripts t ON t.id = w.transcript_id
       WHERE t.job_id = $1 ORDER BY w.idx`,
      [jobId],
    );
    return rows.map((row) => ({ idx: row.idx, text: row.text, startS: row.start_s, endS: row.end_s }));
  },

  // ----- Plan -----

  // Saves a new plan version for the job and returns the plan's id.
  async insertPlan(jobId: string, plan: PlanDraft, db: Db = pool): Promise<string> {
    const { rows } = await db.query<{ id: string }>(
      `INSERT INTO plans (job_id, version, planner, framing, captions_on, trim_silence, level_audio, target_duration_s)
       VALUES ($1,
               (SELECT COALESCE(MAX(version), 0) + 1 FROM plans WHERE job_id = $1),
               $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [jobId, plan.planner, plan.framing, plan.captionsOn, plan.trimSilence, plan.levelAudio, plan.targetDurationS],
    );
    return rows[0]!.id;
  },

  // Marks the job's newest plan as approved. Toggles that are missing are left as they were.
  async approveLatestPlan(jobId: string, toggles: PlanToggles, db: Db = pool): Promise<void> {
    await db.query(
      `UPDATE plans
       SET approved = true,
           captions_on = COALESCE($2, captions_on),
           trim_silence = COALESCE($3, trim_silence),
           level_audio = COALESCE($4, level_audio),
           framing = COALESCE($5, framing)
       WHERE id = (SELECT id FROM plans WHERE job_id = $1 ORDER BY version DESC LIMIT 1)`,
      [jobId, toggles.captionsOn ?? null, toggles.trimSilence ?? null, toggles.levelAudio ?? null, toggles.framing ?? null],
    );
  },

  // Remembers what the user asked for when they made this plan version.
  async insertRevision(planId: string, feedback: string, db: Db = pool): Promise<void> {
    await db.query("INSERT INTO revisions (plan_id, feedback) VALUES ($1, $2)", [planId, feedback]);
  },

  // The plan the user approved (the newest one, if there are several).
  async findApprovedPlan(jobId: string): Promise<PlanRow | undefined> {
    const { rows } = await pool.query<PlanRow>(
      "SELECT * FROM plans WHERE job_id = $1 AND approved ORDER BY version DESC LIMIT 1",
      [jobId],
    );
    return rows[0];
  },

  async insertSegments(planId: string, segments: Segment[], db: Db = pool): Promise<void> {
    await db.query(
      `INSERT INTO segments (plan_id, position, start_s, end_s)
       SELECT $1, * FROM unnest($2::int[], $3::float8[], $4::float8[])`,
      [planId, segments.map((_, index) => index), segments.map((s) => s.startS), segments.map((s) => s.endS)],
    );
  },

  async insertCaptionStyle(planId: string, style: CaptionStyleDraft, db: Db = pool): Promise<void> {
    await db.query(
      "INSERT INTO caption_styles (plan_id, font, highlight_color, position) VALUES ($1, $2, $3, $4)",
      [planId, style.font, style.highlightColor, style.position],
    );
  },

  async findCaptionStyle(planId: string): Promise<CaptionStyleRow | undefined> {
    const { rows } = await pool.query<CaptionStyleRow>(
      "SELECT font, highlight_color, position FROM caption_styles WHERE plan_id = $1",
      [planId],
    );
    return rows[0];
  },
};
