import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.js";

// Files are stored on local disk, one folder per job:
//   uploads/<jobId>/source

// The folder for one job.
function jobDir(jobId: string) {
  return path.join(config.uploadDir, jobId);
}

// The uploaded video for one job.
export function sourcePath(jobId: string) {
  return path.join(jobDir(jobId), "source");
}

// Create the main upload folder when the server starts.
export async function init() {
  await fs.mkdir(config.uploadDir, { recursive: true });
}

// Move the uploaded temp file into the job's folder.
export async function saveSource(jobId: string, tempPath: string) {
  await fs.mkdir(jobDir(jobId), { recursive: true });
  await fs.rename(tempPath, sourcePath(jobId));
}

// Delete a job's whole folder.
export async function removeJobFiles(jobId: string) {
  await fs.rm(jobDir(jobId), { recursive: true, force: true });
}

// Delete a single file.
export async function removeFile(filePath: string) {
  await fs.rm(filePath, { force: true });
}
