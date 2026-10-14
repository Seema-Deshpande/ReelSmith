-- A transcript can now also come from the free local Whisper (whisper.cpp).
-- 'whisper-local' is used both when it is chosen on purpose and when it is the
-- backup after OpenAI Whisper fails.

-- Up Migration
ALTER TABLE transcripts DROP CONSTRAINT transcripts_provider_check;
ALTER TABLE transcripts
  ADD CONSTRAINT transcripts_provider_check CHECK (provider IN ('whisper', 'whisper-local', 'mock'));

-- Down Migration
ALTER TABLE transcripts DROP CONSTRAINT transcripts_provider_check;
ALTER TABLE transcripts
  ADD CONSTRAINT transcripts_provider_check CHECK (provider IN ('whisper', 'mock'));
