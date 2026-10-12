-- Removes the rows created by db/seed.sql. Run with: npm run db:unseed
\set ON_ERROR_STOP on
BEGIN;
DELETE FROM jobs WHERE id IN (
  'b0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000002',
  'b0000000-0000-0000-0000-000000000003'
);  -- cascades to assets, transcripts, words, plans, segments, keyframes, styles, revisions, outputs
DELETE FROM users WHERE id = 'a0000000-0000-0000-0000-000000000001';
COMMIT;
