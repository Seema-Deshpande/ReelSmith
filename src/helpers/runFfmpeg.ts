import { spawn } from "node:child_process";

// What this file does:
//   Runs FFmpeg for a long job (a render) and reports how far along it is.
//   runProgram waits for the end and only gives the output back. A render takes a while,
//   and the user wants to see progress, so this reads FFmpeg's progress as it goes.

const RENDER_TIMEOUT_MS = 30 * 60 * 1000; // stop a render that runs longer than 30 minutes
const KEEP_ERROR_CHARS = 2000; // how much of FFmpeg's error text to keep

// Runs FFmpeg with these arguments. `onProgress` is called with a number from 0 to 99 as it works.
// `expectedDurationS` is how long the finished clip will be, which is how progress is worked out.
// Throws an Error that includes the end of FFmpeg's error text if it fails.
export function runFfmpeg(args: string[], expectedDurationS: number, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // -progress pipe:1 makes FFmpeg print "out_time_us=1234567" lines on its normal output.
    const ffmpeg = spawn("ffmpeg", ["-hide_banner", "-nostats", "-loglevel", "error", "-progress", "pipe:1", "-y", ...args]);

    let errorText = "";
    ffmpeg.stderr.on("data", (chunk) => {
      errorText = (errorText + chunk).slice(-KEEP_ERROR_CHARS);
    });

    ffmpeg.stdout.on("data", (chunk) => {
      for (const match of String(chunk).matchAll(/out_time_us=(\d+)/g)) {
        const doneS = Number(match[1]) / 1_000_000;
        onProgress(Math.min(99, Math.floor((doneS / expectedDurationS) * 100)));
      }
    });

    const timer = setTimeout(() => ffmpeg.kill("SIGKILL"), RENDER_TIMEOUT_MS);

    ffmpeg.on("error", (error) => {
      clearTimeout(timer);
      reject(error); // for example, FFmpeg is not installed
    });

    ffmpeg.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg stopped with code ${code}. ${errorText}`));
    });
  });
}
