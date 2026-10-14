import { runProgram } from "../helpers/runProgram.js";

// What this file does:
//   Looks at a video file and tells us its length, size, frame rate and whether it has sound.
//   It uses ffprobe, a tool that comes with FFmpeg.
//
// Example result:
//   { durationS: 3, width: 640, height: 360, fps: 30, hasAudio: true }

export interface VideoInfo {
  durationS: number; // length in seconds
  width: number; // in pixels
  height: number; // in pixels
  fps: number; // frames per second
  hasAudio: boolean;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Describe a video file. Throws an Error with a plain message if it is not a usable video.
export async function probeVideo(videoPath: string): Promise<VideoInfo> {
  // 1. Ask ffprobe about the file.
  const result = await runFfprobe(videoPath);

  // 2. A video file contains "streams": one for the picture, and one for the sound if it has any.
  const streams = result.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const hasAudio = streams.some((stream) => stream.codec_type === "audio");

  if (!videoStream) {
    throw new Error("The file has no video track.");
  }

  // 3. Check the video has a length. Most files report it on the file itself;
  //    some only report it on the video stream.
  const durationS = Number(result.format?.duration ?? videoStream.duration);
  if (!(durationS > 0)) {
    throw new Error("The video has no length.");
  }

  // 4. Return what we found.
  return {
    durationS,
    width: videoStream.width ?? 0,
    height: videoStream.height ?? 0,
    fps: fractionToNumber(videoStream.r_frame_rate),
    hasAudio,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Run ffprobe on a file and return its result as an object.
async function runFfprobe(videoPath: string): Promise<FfprobeResult> {
  try {
    const stdout = await runProgram(
      "ffprobe",
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", videoPath],
      30_000, // give up after 30 seconds
    );
    return JSON.parse(stdout);
  } catch {
    throw new Error("The file could not be read as a video.");
  }
}

// ffprobe writes frame rates as fractions. "30000/1001" becomes 29.97.
function fractionToNumber(fraction: string | undefined): number {
  const [numerator, denominator] = (fraction ?? "").split("/").map(Number);
  if (!numerator || !denominator) {
    return 0;
  }
  return numerator / denominator;
}

// ---------------------------------------------------------------------------
// The shape of ffprobe's output (only the parts we use). The names are ffprobe's, not ours.
// ---------------------------------------------------------------------------

interface FfprobeStream {
  codec_type?: string; // "video" or "audio"
  width?: number;
  height?: number;
  r_frame_rate?: string; // for example "30000/1001"
  duration?: string;
}

interface FfprobeResult {
  streams?: FfprobeStream[];
  format?: { duration?: string };
}
