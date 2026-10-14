import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../config/index.js";
import { roundSeconds } from "../helpers/roundSeconds.js";
import { runProgram } from "../helpers/runProgram.js";
import type { Word } from "../types/plan.types.js";

// What this file does:
//   Turns the speech in a video into words with times, using whisper.cpp on this computer.
//   It is free, and the audio never leaves the machine. It is slower than OpenAI on a laptop.
//   Set it up once with: npm run setup:whisper
//
// How:
//   1. FFmpeg pulls the sound out of the video as a 16 kHz mono WAV (what whisper.cpp reads).
//   2. whisper.cpp writes a JSON file with one entry per word.
//   3. We turn that JSON into our own list of words.

const EXTRACT_TIMEOUT_MS = 5 * 60 * 1000; // give FFmpeg 5 minutes to get the sound
const WHISPER_TIMEOUT_MS = 20 * 60 * 1000; // give whisper.cpp 20 minutes

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Returns the spoken words of a video. Throws an Error with a plain message if anything goes wrong.
// `language` is a code like "en" or "en-US", or null to let Whisper work it out.
export async function transcribeWithLocalWhisper(videoPath: string, language: string | null): Promise<Word[]> {
  // 1. Check the model file is there before doing any work.
  await checkModelExists();

  // The temporary files are saved next to the video and always deleted afterwards.
  const folder = path.dirname(videoPath);
  const wavPath = path.join(folder, "audio-local.wav");
  const resultPrefix = path.join(folder, "whisper-local"); // whisper.cpp adds ".json"

  try {
    // 2. Get the sound out of the video, then run whisper.cpp on it.
    await extractWav(videoPath, wavPath);
    await runWhisperCpp(wavPath, resultPrefix, language);

    // 3. Read its answer.
    const resultText = await fs.readFile(`${resultPrefix}.json`, "utf8");
    return toWords(JSON.parse(resultText).transcription ?? []);
  } finally {
    await fs.rm(wavPath, { force: true });
    await fs.rm(`${resultPrefix}.json`, { force: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkModelExists() {
  try {
    await fs.access(config.whisperCppModel);
  } catch {
    throw new Error("Local Whisper is not set up (the model file is missing). Run: npm run setup:whisper");
  }
}

async function extractWav(videoPath: string, wavPath: string) {
  try {
    await runProgram("ffmpeg", ["-v", "error", "-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", wavPath], EXTRACT_TIMEOUT_MS);
  } catch {
    throw new Error("The sound could not be taken out of the video.");
  }
}

// -ml 1 and -sow make whisper.cpp write one word per entry. -oj writes the JSON file.
async function runWhisperCpp(wavPath: string, resultPrefix: string, language: string | null) {
  const languageCode = language ? language.slice(0, 2) : "auto"; // whisper.cpp wants "en", not "en-US"

  try {
    await runProgram(
      config.whisperCppBin,
      ["-m", config.whisperCppModel, "-f", wavPath, "-l", languageCode, "-ml", "1", "-sow", "-oj", "-of", resultPrefix, "-np"],
      WHISPER_TIMEOUT_MS,
    );
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") {
      throw new Error("Local Whisper is not installed. Run: npm run setup:whisper");
    }
    throw new Error("Local Whisper could not transcribe the audio.");
  }
}

// whisper.cpp's entries look like { offsets: { from: 500, to: 690 }, text: " are" } (times in milliseconds).
function toWords(entries: { offsets: { from: number; to: number }; text: string }[]): Word[] {
  return entries
    .map((entry) => ({
      text: entry.text.trim(),
      startS: roundSeconds(entry.offsets.from / 1000),
      endS: roundSeconds(entry.offsets.to / 1000),
    }))
    .filter((word) => word.text !== "" && !isSoundNote(word.text))
    .map((word, index) => ({ idx: index, ...word }));
}

// Whisper writes notes like [BLANK_AUDIO] or (music) for sounds that are not speech. Skip them.
function isSoundNote(text: string) {
  return /^[[(].*[\])]$/.test(text);
}
