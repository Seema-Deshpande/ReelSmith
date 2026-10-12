-- Schema smoke test. Run with: npm run db:test
-- Inserts a valid job -> plan -> segment chain, then checks that bad data is rejected.
-- Everything runs in one transaction and is rolled back at the end, so no rows are left behind.

\set ON_ERROR_STOP on
BEGIN;

-- Valid chain must succeed.
INSERT INTO users (id, email) VALUES ('00000000-0000-0000-0000-000000000001', 'smoke@example.com');
INSERT INTO jobs (id, user_id, prompt, platform, expires_at)
VALUES ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
        'make it 15 seconds', 'reels', now() + interval '1 day');
INSERT INTO plans (id, job_id, version, planner)
VALUES ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 1, 'heuristic');
INSERT INTO segments (id, plan_id, position, start_s, end_s)
VALUES ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020', 0, 2, 9);
INSERT INTO crop_keyframes (segment_id, t_s, center_x, center_y)
VALUES ('00000000-0000-0000-0000-000000000030', 0, 0.5, 0.5);

-- Each statement below must be rejected; a DO block fails the test if it is accepted.
CREATE FUNCTION pg_temp.expect_reject(label text, stmt text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE stmt;
  EXCEPTION WHEN integrity_constraint_violation THEN
    RAISE NOTICE 'ok   rejected: %', label;
    RETURN;
  END;
  RAISE EXCEPTION 'FAIL accepted bad data: %', label;
END $$;

SELECT pg_temp.expect_reject('unknown platform',
  $$INSERT INTO jobs (prompt, platform, expires_at) VALUES ('t', 'youtube', now())$$);
SELECT pg_temp.expect_reject('unknown status',
  $$INSERT INTO jobs (prompt, platform, status, expires_at) VALUES ('t', 'reels', 'oops', now())$$);
SELECT pg_temp.expect_reject('progress over 100',
  $$INSERT INTO jobs (prompt, platform, progress, expires_at) VALUES ('t', 'reels', 101, now())$$);
SELECT pg_temp.expect_reject('segment ends before it starts',
  $$INSERT INTO segments (plan_id, position, start_s, end_s) VALUES ('00000000-0000-0000-0000-000000000020', 1, 5, 2)$$);
SELECT pg_temp.expect_reject('duplicate segment position',
  $$INSERT INTO segments (plan_id, position, start_s, end_s) VALUES ('00000000-0000-0000-0000-000000000020', 0, 10, 12)$$);
SELECT pg_temp.expect_reject('duplicate plan version',
  $$INSERT INTO plans (job_id, version, planner) VALUES ('00000000-0000-0000-0000-000000000010', 1, 'claude')$$);
SELECT pg_temp.expect_reject('unknown framing',
  $$INSERT INTO plans (job_id, version, planner, framing) VALUES ('00000000-0000-0000-0000-000000000010', 2, 'claude', 'zoom')$$);
SELECT pg_temp.expect_reject('crop center outside 0..1',
  $$INSERT INTO crop_keyframes (segment_id, t_s, center_x, center_y) VALUES ('00000000-0000-0000-0000-000000000030', 1, 1.5, 0.5)$$);
SELECT pg_temp.expect_reject('plan for missing job',
  $$INSERT INTO plans (job_id, version, planner) VALUES (gen_random_uuid(), 1, 'claude')$$);

-- Only one approved plan per job.
UPDATE plans SET approved = true WHERE id = '00000000-0000-0000-0000-000000000020';
SELECT pg_temp.expect_reject('second approved plan on a job',
  $$INSERT INTO plans (job_id, version, planner, approved) VALUES ('00000000-0000-0000-0000-000000000010', 2, 'claude', true)$$);

-- Deleting the job must cascade to plans and segments.
DELETE FROM jobs WHERE id = '00000000-0000-0000-0000-000000000010';
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM plans WHERE job_id = '00000000-0000-0000-0000-000000000010')
     OR EXISTS (SELECT 1 FROM segments WHERE id = '00000000-0000-0000-0000-000000000030') THEN
    RAISE EXCEPTION 'FAIL delete did not cascade';
  END IF;
  RAISE NOTICE 'ok   delete cascaded from job to plans and segments';
END $$;

ROLLBACK;
