import { roundSeconds } from "../helpers/roundSeconds.js";
import { runProgram } from "../helpers/runProgram.js";
import type { Segment } from "../types/plan.types.js";

// What this file does:
//   Finds the stretches of a video where nobody makes a sound, by listening to the audio.
//   It uses FFmpeg's "silencedetect" filter. We do not guess pauses from the transcript,
//   because Whisper's word times often run straight through a pause.
//
// Example result for a video with a pause from 2.03 s to 3.46 s:
//   [{ startS: 2.03, endS: 3.46 }]

const QUIET_LEVEL = "-35dB"; // sound quieter than this counts as silence
const MIN_SILENCE_S = 0.6; // only silences at least this long are reported
const DETECT_TIMEOUT_MS = 5 * 60 * 1000; // give FFmpeg 5 minutes

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Returns the silent stretches of the video, in order. A video with no sound has none to report.
export async function findSilences(videoPath: string, videoDurationS: number, hasAudio: boolean): Promise<Segment[]> {
  if (!hasAudio) {
    return [];
  }

  // 1. Run FFmpeg's silence detector. It prints its findings as messages, not as normal output.
  const { stderr } = await runProgram(
    "ffmpeg",
    ["-hide_banner", "-nostats", "-i", videoPath, "-vn", "-af", `silencedetect=noise=${QUIET_LEVEL}:d=${MIN_SILENCE_S}`, "-f", "null", "-"],
    DETECT_TIMEOUT_MS,
  );

  // 2. Read the messages.
  return parseSilences(stderr, videoDurationS);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// FFmpeg's messages look like:
//   [silencedetect @ 0x...] silence_start: 2.03111
//   [silencedetect @ 0x...] silence_end: 3.46 | silence_duration: 1.43
// A silence that lasts until the end of the video has a start but no end.
function parseSilences(messages: string, videoDurationS: number): Segment[] {
  const silences: Segment[] = [];
  let startS: number | undefined;

  for (const line of messages.split("\n")) {
    const start = /silence_start: (-?[\d.]+)/.exec(line);
    if (start) {
      startS = Math.max(0, Number(start[1]));
    }

    const end = /silence_end: ([\d.]+)/.exec(line);
    if (end && startS !== undefined) {
      silences.push({ startS: roundSeconds(startS), endS: roundSeconds(Number(end[1])) });
      startS = undefined;
    }
  }

  if (startS !== undefined) {
    silences.push({ startS: roundSeconds(startS), endS: roundSeconds(videoDurationS) });
  }
  return silences;
}
