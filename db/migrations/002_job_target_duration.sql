-- Output length the user wants (seconds). Set at upload if the user gives one,
-- otherwise filled in by the pipeline after the video is probed.

-- Up Migration
ALTER TABLE jobs
  ADD COLUMN target_duration_s double precision CHECK (target_duration_s > 0);

-- Down Migration
ALTER TABLE jobs DROP COLUMN target_duration_s;
