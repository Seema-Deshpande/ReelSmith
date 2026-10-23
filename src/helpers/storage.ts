import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.js";

// Files are stored on local disk, one folder per job:
//   uploads/<jobId>/source     the video the user uploaded
//   outputs/<jobId>/clip.mp4   the finished clip

// The folder for one job.
function jobDir(jobId: string) {
  return path.join(config.uploadDir, jobId);
}

// The uploaded video for one job.
export function sourcePath(jobId: string) {
  return path.join(jobDir(jobId), "source");
}

// The finished clip for one job.
export function outputPath(jobId: string) {
  return path.join(config.outputDir, jobId, "clip.mp4");
}

// Create the main upload and output folders when the server starts.
export async function init() {
  await fs.mkdir(config.uploadDir, { recursive: true });
  await fs.mkdir(config.outputDir, { recursive: true });
}

// Create the folder a job's clip will be saved in.
export async function prepareOutputFolder(jobId: string) {
  await fs.mkdir(path.dirname(outputPath(jobId)), { recursive: true });
}

// Delete a job's finished clip (used when a render fails half way).
export async function removeOutputFiles(jobId: string) {
  await fs.rm(path.dirname(outputPath(jobId)), { recursive: true, force: true });
}

// Move the uploaded temp file into the job's folder.
export async function saveSource(jobId: string, tempPath: string) {
  await fs.mkdir(jobDir(jobId), { recursive: true });
  await fs.rename(tempPath, sourcePath(jobId));
}

// Delete everything stored for a job: the upload and the finished clip.
export async function removeJobFiles(jobId: string) {
  await fs.rm(jobDir(jobId), { recursive: true, force: true });
  await removeOutputFiles(jobId);
}

// Delete a single file.
export async function removeFile(filePath: string) {
  await fs.rm(filePath, { force: true });
}

// True if the file exists.
export async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
