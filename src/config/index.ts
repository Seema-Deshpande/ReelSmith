import path from "node:path";
import { readChoice, readNumber, readRequired } from "../helpers/env.js";

// All settings come from environment variables (see .env.example).
// This is the only file that reads them; the rest of the app imports `config`.

const maxUploadMb = readNumber("MAX_UPLOAD_MB", 500);

export const config = {
  // Port the server listens on.
  port: readNumber("PORT", 3000),

  // Postgres connection string, for example postgres://localhost/reelsmith
  databaseUrl: readRequired("DATABASE_URL"),

  // Most database connections open at the same time.
  dbPoolMax: readNumber("DB_POOL_MAX", 10),

  // Folder where uploaded videos are stored.
  uploadDir: path.resolve(process.env.UPLOAD_DIR || "uploads"),

  // Largest video accepted, in bytes.
  maxUploadBytes: Math.floor(maxUploadMb * 1024 * 1024),

  // How long a job and its files are kept before cleanup.
  jobTtlHours: readNumber("JOB_TTL_HOURS", 48),

  // Who turns speech into text: "mock" makes up a transcript (free, no key); "whisper" is the real one.
  transcribeProvider: readChoice("TRANSCRIBE_PROVIDER", ["mock", "whisper"], "mock"),

  // Who makes the edit plan: "heuristic" uses simple rules (free, no key); "claude" is the real one.
  plannerProvider: readChoice("PLANNER_PROVIDER", ["heuristic", "claude"], "heuristic"),
};
