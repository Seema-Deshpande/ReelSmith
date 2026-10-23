import fs from "fs";
import os from "os";
import path from "path";
import type { APIRequestContext } from "@playwright/test";
import { runProgram } from "../../src/helpers/runProgram";

// Helpers for looking inside video files, so tests can check what a render really produced.

const TIMEOUT_MS = 60_000;

// Saves a job's finished clip into a fresh temporary folder and returns the path to the file.
export async function downloadClip(request: APIRequestContext, jobId: string) {
  const response = await request.get(`/api/jobs/${jobId}/video`);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "reelsmith-clip-"));
  const filePath = path.join(folder, "clip.mp4");

  fs.writeFileSync(filePath, await response.body());
  return filePath;
}

interface StreamInfo {
  codec_type: string;
  width?: number;
  height?: number;
  tags?: Record<string, string>;
}

// What ffprobe says about a file: its streams and its length.
export async function describeFile(filePath: string) {
  const { stdout } = await runProgram(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", filePath],
    TIMEOUT_MS,
  );
  const result = JSON.parse(stdout) as { streams: StreamInfo[]; format: { duration: string; tags?: Record<string, string> } };

  return {
    streams: result.streams,
    durationS: Number(result.format.duration),
    // Every tag in the file, from the file itself and from each stream, as lower-case text.
    allTags: [result.format.tags ?? {}, ...result.streams.map((stream) => stream.tags ?? {})].flatMap((tags) =>
      Object.entries(tags).map(([name, value]) => `${name}=${value}`.toLowerCase()),
    ),
  };
}

// Saves one picture from a video. `atS` is the second to take it from. `filters` is an optional FFmpeg filter.
export async function saveFrame(videoPath: string, atS: number, pngPath: string, filters?: string) {
  const filterArguments = filters ? ["-vf", filters] : [];
  await runProgram("ffmpeg", ["-v", "error", "-y", "-ss", String(atS), "-i", videoPath, "-frames:v", "1", ...filterArguments, pngPath], TIMEOUT_MS);
}

// How alike a square of two pictures is, in decibels. Above about 30 is almost the same picture;
// a logo or a badge in the square drops it far below 20.
export async function squarePsnr(firstPng: string, secondPng: string, x: number, y: number, size: number) {
  const square = `crop=${size}:${size}:${x}:${y}`;
  const { stderr } = await runProgram(
    "ffmpeg",
    ["-hide_banner", "-i", firstPng, "-i", secondPng, "-lavfi", `[0:v]${square}[a];[1:v]${square}[b];[a][b]psnr`, "-f", "null", "-"],
    TIMEOUT_MS,
  );

  const match = /average:(\S+)/.exec(stderr);
  if (!match) throw new Error(`Could not read the PSNR from FFmpeg: ${stderr}`);
  return match[1] === "inf" ? Infinity : Number(match[1]);
}
