import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is not set (see .env.example)"),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  UPLOAD_DIR: z.string().default("uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(500),
  JOB_TTL_HOURS: z.coerce.number().positive().default(48),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n  ");
  throw new Error(`Invalid environment:\n  ${problems}`);
}
const env = parsed.data;

/** The only place that reads environment variables. */
export const config = {
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  dbPoolMax: env.DB_POOL_MAX,
  uploadDir: path.resolve(env.UPLOAD_DIR),
  maxUploadBytes: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024),
  jobTtlHours: env.JOB_TTL_HOURS,
} as const;
