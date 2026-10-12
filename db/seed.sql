-- Development seed data. Run with: npm run db:seed
-- Safe to run more than once (fixed ids, ON CONFLICT DO NOTHING). Do NOT run in production.
-- Remove it with: npm run db:unseed

\set ON_ERROR_STOP on
BEGIN;

INSERT INTO users (id, email) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'demo@example.com')
ON CONFLICT DO NOTHING;

-- Job 1: finished, with a revised plan (v1 -> v2) and a rendered output.
INSERT INTO jobs (id, user_id, prompt, platform, language, status, progress, created_at, expires_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Make a punchy vertical clip of the best tips', 'reels', 'en', 'done', 100,
   now() - interval '1 hour', now() + interval '7 days')
ON CONFLICT DO NOTHING;

INSERT INTO video_assets (job_id, storage_key, duration_s, width, height, fps, has_audio) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'uploads/demo-1.mp4', 42.5, 1920, 1080, 30, true)
ON CONFLICT DO NOTHING;

INSERT INTO transcripts (id, job_id, provider, language) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'mock', 'en')
ON CONFLICT DO NOTHING;

INSERT INTO words (transcript_id, idx, text, start_s, end_s) VALUES
  ('c0000000-0000-0000-0000-000000000001', 0, 'Here',     0.50,  0.80),
  ('c0000000-0000-0000-0000-000000000001', 1, 'are',      0.80,  1.00),
  ('c0000000-0000-0000-0000-000000000001', 2, 'three',    1.00,  1.40),
  ('c0000000-0000-0000-0000-000000000001', 3, 'quick',    1.40,  1.80),
  ('c0000000-0000-0000-0000-000000000001', 4, 'tips',     1.80,  2.30),
  ('c0000000-0000-0000-0000-000000000001', 5, 'for',     12.00, 12.20),
  ('c0000000-0000-0000-0000-000000000001', 6, 'better',  12.20, 12.60),
  ('c0000000-0000-0000-0000-000000000001', 7, 'videos',  12.60, 13.10),
  ('c0000000-0000-0000-0000-000000000001', 8, 'Thanks',  40.00, 40.50),
  ('c0000000-0000-0000-0000-000000000001', 9, 'for',     40.50, 40.70),
  ('c0000000-0000-0000-0000-000000000001', 10, 'watching', 40.70, 41.40)
ON CONFLICT DO NOTHING;

-- Plan v1 (not approved) and plan v2 created from the feedback below.
INSERT INTO plans (id, job_id, version, planner, framing, target_duration_s, approved, created_at) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 1,
   'heuristic', 'center_crop', 30, false, now() - interval '55 minutes'),
  ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 2,
   'heuristic', 'follow_subject', 15, true, now() - interval '50 minutes')
ON CONFLICT DO NOTHING;

INSERT INTO segments (id, plan_id, position, start_s, end_s) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 0,  0.5, 20.0),
  ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002', 0,  0.5,  8.0),
  ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 1, 12.0, 19.0)
ON CONFLICT DO NOTHING;

INSERT INTO crop_keyframes (segment_id, t_s, center_x, center_y) VALUES
  ('e0000000-0000-0000-0000-000000000002', 0.0, 0.50, 0.45),
  ('e0000000-0000-0000-0000-000000000002', 4.0, 0.58, 0.45),
  ('e0000000-0000-0000-0000-000000000002', 7.5, 0.52, 0.45),
  ('e0000000-0000-0000-0000-000000000003', 0.0, 0.50, 0.45)
ON CONFLICT DO NOTHING;

INSERT INTO caption_styles (plan_id, font, highlight_color, position) VALUES
  ('d0000000-0000-0000-0000-000000000002', 'Arial Black', '#FFD400', 'bottom')
ON CONFLICT DO NOTHING;

INSERT INTO revisions (id, plan_id, feedback) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'make it 15 seconds')
ON CONFLICT DO NOTHING;

INSERT INTO outputs (job_id, plan_id, storage_key, duration_s, size_bytes) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
   'outputs/demo-1.mp4', 15.0, 3145728)
ON CONFLICT DO NOTHING;

-- Job 2: waiting for the user to approve its plan.
INSERT INTO jobs (id, user_id, prompt, platform, status, progress, expires_at) VALUES
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001',
   'Trim the silences and add captions', 'tiktok', 'awaiting_approval', 100, now() + interval '7 days')
ON CONFLICT DO NOTHING;

INSERT INTO plans (id, job_id, version, planner) VALUES
  ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 1, 'heuristic')
ON CONFLICT DO NOTHING;

INSERT INTO segments (plan_id, position, start_s, end_s) VALUES
  ('d0000000-0000-0000-0000-000000000003', 0, 1.0, 25.0)
ON CONFLICT DO NOTHING;

-- Job 3: failed, to exercise the error path in the UI.
INSERT INTO jobs (id, user_id, prompt, platform, status, progress, error, expires_at) VALUES
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001',
   'Make it exciting', 'shorts', 'failed', 20, 'ffprobe could not read the file', now() + interval '7 days')
ON CONFLICT DO NOTHING;

COMMIT;
