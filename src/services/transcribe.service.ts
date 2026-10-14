import { config } from "../config/index.js";
import { roundSeconds } from "../helpers/roundSeconds.js";
import type { Word } from "../types/plan.types.js";
import { transcribeWithLocalWhisper } from "./transcribe.local.js";
import { transcribeWithWhisper } from "./transcribe.whisper.js";

// What this file does:
//   Turns the speech in a video into a list of words with times (a "transcript").
//   TRANSCRIBE_PROVIDER in .env picks who does it:
//     mock    - makes up words. Free, no key. Good for building and testing.
//     whisper - OpenAI Whisper (transcribe.whisper.ts). Costs money, needs OPENAI_API_KEY.
//               If it fails (no credits, bad key, OpenAI down), local Whisper is used as the backup.
//     local   - whisper.cpp on this computer (transcribe.local.ts). Free. Set up with: npm run setup:whisper

interface TranscribeInput {
  videoPath: string;
  videoDurationS: number;
  hasAudio: boolean;
  language: string | null; // for example "en"; null lets Whisper work it out
}

export interface Transcript {
  provider: "mock" | "whisper" | "whisper-local"; // who really made the words
  words: Word[];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function transcribe(input: TranscribeInput): Promise<Transcript> {
  const provider = config.transcribeProvider;

  // A video with no sound has no speech, so there is nothing to send to anyone.
  if (!input.hasAudio) {
    return { provider: provider === "local" ? "whisper-local" : provider, words: [] };
  }

  if (provider === "mock") {
    return { provider, words: makeUpWords(input.videoDurationS) };
  }

  if (provider === "local") {
    return { provider: "whisper-local", words: await transcribeWithLocalWhisper(input.videoPath, input.language) };
  }

  return transcribeWithBackup(input);
}

// ---------------------------------------------------------------------------
// OpenAI Whisper with a free backup
// ---------------------------------------------------------------------------

// Try OpenAI Whisper first. If it fails for any reason, try local Whisper instead.
// If both fail, the error says what went wrong with each.
async function transcribeWithBackup(input: TranscribeInput): Promise<Transcript> {
  try {
    return { provider: "whisper", words: await transcribeWithWhisper(input.videoPath, input.language) };
  } catch (openAiError) {
    const openAiReason = errorMessage(openAiError);
    console.warn(`OpenAI Whisper failed (${openAiReason}) Using local Whisper instead.`);

    try {
      return { provider: "whisper-local", words: await transcribeWithLocalWhisper(input.videoPath, input.language) };
    } catch (localError) {
      throw new Error(`${openAiReason} The free local backup did not work either: ${errorMessage(localError)}`);
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

// ---------------------------------------------------------------------------
// Mock provider
// ---------------------------------------------------------------------------

const SAMPLE_WORDS = [
  "Here", "are", "three", "quick", "tips", "for", "better", "videos", "first", "keep", "it", "short",
  "second", "start", "with", "a", "hook", "third", "add", "captions", "so", "everyone", "can", "follow", "along",
];
const WORDS_PER_SENTENCE = [5, 7, 6, 8]; // repeats, so the sentences have different lengths
const PAUSE_BETWEEN_SENTENCES_S = 0.9;
const FIRST_WORD_AT_S = 0.5;

// Makes up speech for the whole video: sentences of a few words with a pause after each one.
// The same video length always gives the same words, so tests are repeatable.
function makeUpWords(videoDurationS: number): Word[] {
  const words: Word[] = [];
  let time = FIRST_WORD_AT_S;
  let sentenceNumber = 0;

  while (time < videoDurationS - 0.5) {
    const wordsInSentence = WORDS_PER_SENTENCE[sentenceNumber % WORDS_PER_SENTENCE.length]!;

    for (let i = 0; i < wordsInSentence; i++) {
      const text = SAMPLE_WORDS[words.length % SAMPLE_WORDS.length]!;
      const lengthS = 0.2 + 0.04 * text.length; // longer words take longer to say
      if (time + lengthS > videoDurationS - 0.3) {
        return words; // out of video
      }
      words.push({ idx: words.length, text, startS: roundSeconds(time), endS: roundSeconds(time + lengthS) });
      time += lengthS + 0.05;
    }

    time += PAUSE_BETWEEN_SENTENCES_S;
    sentenceNumber++;
  }
  return words;
}
