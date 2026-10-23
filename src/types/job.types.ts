// Types for job data. The SQL that uses them is in src/queries/jobs.queries.ts.

// ---------------------------------------------------------------------------
// Rows read from the database. Field names match the database columns (snake_case).
// ---------------------------------------------------------------------------

export interface JobRow {
  id: string;
  prompt: string;
  platform: string;
  language: string | null;
  status: string;
  progress: number;
  error: string | null;
  target_duration_s: number | null;
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

export interface VideoAssetRow {
  duration_s: number;
  width: number;
  height: number;
  fps: number;
  has_audio: boolean;
  silences: { startS: number; endS: number }[]; // stretches with no sound; empty until they are measured
}

export interface CaptionStyleRow {
  font: string;
  highlight_color: string;
  position: string;
}

export interface OutputRow {
  duration_s: number;
  size_bytes: string; // the database returns bigint numbers as text
  captions_burned_in: boolean;
}

// ---------------------------------------------------------------------------
// Data we pass in to save a new row. Field names are camelCase.
// ---------------------------------------------------------------------------

export interface NewJob {
  id: string;
  prompt: string;
  platform: string;
  language: string | null;
  targetDurationS: number | null; // null when the user did not choose one
  ttlHours: number; // how many hours until the job expires
}

export interface NewVideoAsset {
  jobId: string;
  storageKey: string;
  durationS: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

// A finished clip, ready to be saved.
export interface NewOutput {
  jobId: string;
  planId: string;
  storageKey: string;
  durationS: number;
  sizeBytes: number;
  captionsBurnedIn: boolean;
}
