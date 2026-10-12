-- Reelsmith initial schema (PostgreSQL 13+, uses built-in gen_random_uuid()).
-- Mirrors the ER diagram in README.md.
-- Applied by node-pg-migrate (npm run db:migrate), which wraps each migration in a transaction.

-- Up Migration

CREATE TABLE users (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text NOT NULL UNIQUE,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES users (id) ON DELETE SET NULL,  -- nullable until auth exists
    prompt      text NOT NULL,
    platform    text NOT NULL CHECK (platform IN ('reels', 'tiktok', 'shorts')),
    language    text,
    status      text NOT NULL DEFAULT 'analyzing'
                CHECK (status IN ('analyzing', 'awaiting_approval', 'queued', 'rendering', 'done', 'failed')),
    progress    integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    error       text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL
);
CREATE INDEX jobs_user_id_idx ON jobs (user_id);
CREATE INDEX jobs_status_idx ON jobs (status);
CREATE INDEX jobs_expires_at_idx ON jobs (expires_at);  -- cleanup task

CREATE TABLE video_assets (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       uuid NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
    storage_key  text NOT NULL,  -- local path or S3/R2 key
    duration_s   double precision NOT NULL CHECK (duration_s > 0),
    width        integer NOT NULL CHECK (width > 0),
    height       integer NOT NULL CHECK (height > 0),
    fps          double precision NOT NULL CHECK (fps > 0),
    has_audio    boolean NOT NULL
);

CREATE TABLE transcripts (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id    uuid NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
    provider  text NOT NULL CHECK (provider IN ('whisper', 'mock')),
    language  text
);

CREATE TABLE words (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id  uuid NOT NULL REFERENCES transcripts (id) ON DELETE CASCADE,
    idx            integer NOT NULL CHECK (idx >= 0),
    text           text NOT NULL,
    start_s        double precision NOT NULL CHECK (start_s >= 0),
    end_s          double precision NOT NULL,
    UNIQUE (transcript_id, idx),
    CHECK (end_s >= start_s)
);

CREATE TABLE plans (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id            uuid NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
    version           integer NOT NULL CHECK (version >= 1),
    planner           text NOT NULL CHECK (planner IN ('claude', 'heuristic')),
    framing           text NOT NULL DEFAULT 'follow_subject'
                      CHECK (framing IN ('follow_subject', 'center_crop', 'blurred_fit')),
    captions_on       boolean NOT NULL DEFAULT true,
    trim_silence      boolean NOT NULL DEFAULT true,
    level_audio       boolean NOT NULL DEFAULT true,
    target_duration_s double precision CHECK (target_duration_s > 0),
    approved          boolean NOT NULL DEFAULT false,
    created_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (job_id, version)
);
-- At most one approved plan per job.
CREATE UNIQUE INDEX plans_one_approved_per_job_idx ON plans (job_id) WHERE approved;

CREATE TABLE segments (
    id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id   uuid NOT NULL REFERENCES plans (id) ON DELETE CASCADE,
    position  integer NOT NULL CHECK (position >= 0),
    start_s   double precision NOT NULL CHECK (start_s >= 0),
    end_s     double precision NOT NULL,
    UNIQUE (plan_id, position),
    CHECK (end_s > start_s)
);

CREATE TABLE crop_keyframes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id  uuid NOT NULL REFERENCES segments (id) ON DELETE CASCADE,
    t_s         double precision NOT NULL CHECK (t_s >= 0),  -- seconds from segment start
    center_x    double precision NOT NULL CHECK (center_x BETWEEN 0 AND 1),
    center_y    double precision NOT NULL CHECK (center_y BETWEEN 0 AND 1),
    UNIQUE (segment_id, t_s)
);

CREATE TABLE caption_styles (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id          uuid NOT NULL UNIQUE REFERENCES plans (id) ON DELETE CASCADE,
    font             text NOT NULL,
    highlight_color  text NOT NULL,
    position         text NOT NULL
);

CREATE TABLE revisions (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id     uuid NOT NULL REFERENCES plans (id) ON DELETE CASCADE,  -- plan created by this feedback
    feedback    text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revisions_plan_id_idx ON revisions (plan_id);

CREATE TABLE outputs (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id       uuid NOT NULL UNIQUE REFERENCES jobs (id) ON DELETE CASCADE,
    plan_id      uuid NOT NULL REFERENCES plans (id),  -- plan version rendered
    storage_key  text NOT NULL,
    duration_s   double precision NOT NULL CHECK (duration_s > 0),
    size_bytes   bigint NOT NULL CHECK (size_bytes > 0),
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outputs_plan_id_idx ON outputs (plan_id);

-- Down Migration
DROP TABLE outputs, revisions, caption_styles, crop_keyframes, segments, plans,
           words, transcripts, video_assets, jobs, users;
