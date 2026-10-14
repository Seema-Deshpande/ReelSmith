import { config } from "../config/index.js";
import type { Word } from "../types/plan.types.js";

// What this file does:
//   Turns the speech in a video into a list of words with times (a "transcript").
//   TRANSCRIBE_PROVIDER in .env picks who does it:
//     mock    - makes up words. Free, no key. Good for building and testing.
//     whisper - OpenAI Whisper, the real one. Not built yet.

interface TranscribeInput {
  videoDurationS: number;
  hasAudio: boolean;
}

export interface Transcript {
  provider: string;
  words: Word[];
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function transcribe(input: TranscribeInput): Promise<Transcript> {
  const provider = config.transcribeProvider;

  // A video with no sound has no speech.
  if (!input.hasAudio) {
    return { provider, words: [] };
  }

  if (provider === "mock") {
    return { provider, words: makeUpWords(input.videoDurationS) };
  }

  throw new Error("Whisper transcription is not built yet. Set TRANSCRIBE_PROVIDER=mock in .env.");
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
      words.push({ idx: words.length, text, startS: round(time), endS: round(time + lengthS) });
      time += lengthS + 0.05;
    }

    time += PAUSE_BETWEEN_SENTENCES_S;
    sentenceNumber++;
  }
  return words;
}

function round(seconds: number) {
  return Math.round(seconds * 100) / 100;
}
