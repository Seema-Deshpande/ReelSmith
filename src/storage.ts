import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

// Local-disk file storage. Replace this file with an S3/R2 version when moving to production.
// Each job's files live in their own folder: <uploadDir>/<jobId>/

/** Creates the upload folder if it does not exist. Call once at startup. */
export async function init(): Promise<void> {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

/** Where a job's uploaded video lives. Saved without an extension; FFmpeg detects the format. */
export function sourcePath(jobId: string): string {
  return path.join(config.uploadDir, jobId, "source");
}

/** Moves the uploaded temp file into the job's folder. */
export async function saveSource(jobId: string, tempPath: string): Promise<void> {
  const target = sourcePath(jobId);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.rename(tempPath, target);
}

/** Deletes everything stored for a job. Does nothing if there is nothing to delete. */
export async function removeJobFiles(jobId: string): Promise<void> {
  await fs.rm(path.join(config.uploadDir, jobId), { recursive: true, force: true });
}

/** Deletes one file. Does nothing if it does not exist. */
export async function removeFile(filePath: string): Promise<void> {
  await fs.rm(filePath, { force: true });
}
