-- The stretches of a video that have no sound, measured from its audio with FFmpeg.
-- Stored as a list like [{"startS": 2.03, "endS": 3.46}]. Used to cut pauses out of the plan.

-- Up Migration
ALTER TABLE video_assets
  ADD COLUMN silences jsonb NOT NULL DEFAULT '[]';

-- Down Migration
ALTER TABLE video_assets DROP COLUMN silences;
