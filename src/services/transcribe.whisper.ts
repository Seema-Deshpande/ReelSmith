import fs from "node:fs/promises";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import { config } from "../config/index.js";
import { roundSeconds } from "../helpers/roundSeconds.js";
import { runProgram } from "../helpers/runProgram.js";
import type { Word } from "../types/plan.types.js";

// What this file does:
//   Turns the speech in a video into words with times, using OpenAI's Whisper.
//   It costs a little money for each minute of audio, and the audio is sent to OpenAI.
//
// How:
//   1. FFmpeg pulls the sound out of the video as a small mono MP3.
//   2. We send that MP3 to Whisper and ask for the time of every word.
//   3. We turn Whisper's answer into our own list of words.

const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Whisper refuses files bigger than 25 MB
const EXTRACT_TIMEOUT_MS = 5 * 60 * 1000; // give FFmpeg 5 minutes to get the sound
const WHISPER_TIMEOUT_MS = 5 * 60 * 1000; // give Whisper 5 minutes to answer

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Returns the spoken words of a video. Throws an Error with a plain message if anything goes wrong.
// `language` is a code like "en" or "en-US", or null to let Whisper work it out.
export async function transcribeWithWhisper(videoPath: string, language: string | null): Promise<Word[]> {
  if (!config.openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env to use Whisper.");
  }

  // The sound is saved next to the video and always deleted afterwards.
  const audioPath = path.join(path.dirname(videoPath), "audio.mp3");

  try {
    // 1. Get the sound out of the video.
    await extractAudio(videoPath, audioPath);

    // 2. Check the file is small enough to send.
    const { size } = await fs.stat(audioPath);
    if (size > MAX_AUDIO_BYTES) {
      throw new Error("The sound is too long to transcribe (over 25 MB). Try a shorter video.");
    }

    // 3. Ask Whisper, then turn its answer into our words.
    const answer = await askWhisper(audioPath, language);
    return toWords(answer.words ?? []);
  } finally {
    await fs.rm(audioPath, { force: true });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Save the sound of a video as a small MP3: mono, 16 kHz, 32 kbps. That is plenty for speech
// and keeps about 100 minutes of audio under Whisper's 25 MB limit.
async function extractAudio(videoPath: string, audioPath: string) {
  try {
    await runProgram(
      "ffmpeg",
      ["-v", "error", "-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", audioPath],
      EXTRACT_TIMEOUT_MS,
    );
  } catch {
    throw new Error("The sound could not be taken out of the video.");
  }
}

// Send the MP3 to Whisper and return its answer. We ask for the time of every word.
async function askWhisper(audioPath: string, language: string | null) {
  // OpenAI reads OPENAI_BASE_URL from the environment if it is set. We use that in tests.
  // maxRetries is 0 on purpose: in testing, the library's automatic retry after an error
  // failed with "Connection error" after about 16 seconds and hid the real reason.
  // With no retries, the job fails at once and shows what OpenAI said.
  const client = new OpenAI({ apiKey: config.openaiApiKey, timeout: WHISPER_TIMEOUT_MS, maxRetries: 0 });

  const audioFile = await toFile(await fs.readFile(audioPath), "audio.mp3");

  try {
    return await client.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      response_format: "verbose_json",
      timestamp_granularities: ["word"],
      language: language ? language.slice(0, 2) : undefined, // Whisper wants "en", not "en-US"
    });
  } catch (error) {
    throw new Error(explainWhisperError(error));
  }
}

// Turn an error from OpenAI into a message a person can act on.
function explainWhisperError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 401) {
      return "OpenAI rejected the key. Check OPENAI_API_KEY in .env.";
    }
    if (error.status === 429 && error.type === "insufficient_quota") {
      return "The OpenAI account has no credits left. Add credits at platform.openai.com (Billing), or set TRANSCRIBE_PROVIDER=mock.";
    }
    if (error.status === 429) {
      return "OpenAI is busy right now (rate limit). Try again in a minute.";
    }
  }
  const reason = error instanceof Error ? error.message : "unknown error";
  return `Whisper could not transcribe the audio: ${reason}`;
}

// Whisper's words look like { word: " Here", start: 0.5, end: 0.86 }. Ours look like Word.
function toWords(whisperWords: { word: string; start: number; end: number }[]): Word[] {
  return whisperWords
    .map((item) => ({ text: item.word.trim(), startS: roundSeconds(item.start), endS: roundSeconds(item.end) }))
    .filter((item) => item.text !== "")
    .map((item, index) => ({ idx: index, ...item }));
}
