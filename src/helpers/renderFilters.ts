import type { Segment } from "../types/plan.types.js";

// What this file does:
//   Writes the FFmpeg "filter graph": the recipe that turns the source video into the finished clip.
//   It is a plain function with no side effects, so it is easy to test.
//
// The recipe, in order:
//   1. For every segment of the plan: cut that piece out of the video and the sound.
//   2. Join the pieces one after another.
//   3. Reframe the picture to the platform's size (for example 1080x1920).
//   4. Level the sound, if the user wants that.
//
// Only edits the user asked for are allowed in here: cutting, joining, scaling, cropping, blurring
// the background of a "blurred_fit" clip, and audio leveling. No logo, no badge, no text (see the
// clean-output skill). Captions will be added as their own step later.

const FADE_S = 0.03; // a tiny fade at each cut so there is no click in the sound
const MAX_FPS = 30; // phones can film at 60 frames per second; the clip does not need it

export interface RenderGraphInput {
  segments: Segment[];
  framing: "center_crop" | "blurred_fit" | "follow_subject";
  levelAudio: boolean;
  hasAudio: boolean;
  sourceFps: number;
  width: number; // size of the finished clip, in pixels
  height: number;
}

// The labels of the finished picture and sound inside the graph. The caller maps them to the file.
export const VIDEO_LABEL = "[vout]";
export const AUDIO_LABEL = "[aout]";

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

// Returns the filter graph as the text FFmpeg expects. Steps are separated by semicolons.
export function buildFilterGraph(input: RenderGraphInput): string {
  const steps: string[] = [];

  // 1 and 2. Cut every segment, then join the pieces.
  steps.push(...cutSegments(input));
  steps.push(joinPieces(input));

  // 3. Reframe the picture.
  steps.push(...reframe(input));

  // 4. Level the sound.
  if (input.hasAudio) {
    steps.push(`[joinedA]${input.levelAudio ? "loudnorm=I=-16:TP=-1.5:LRA=11" : "anull"}${AUDIO_LABEL}`);
  }

  return steps.join(";");
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

// One cut for the picture and one for the sound, per segment. Piece number 2 is [v2] and [a2].
function cutSegments(input: RenderGraphInput): string[] {
  const steps: string[] = [];

  input.segments.forEach((segment, index) => {
    const start = seconds(segment.startS);
    const end = seconds(segment.endS);
    steps.push(`[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS[v${index}]`);

    if (input.hasAudio) {
      const fadeOutAt = seconds(Math.max(0, segment.endS - segment.startS - FADE_S));
      const fades = `afade=t=in:st=0:d=${FADE_S},afade=t=out:st=${fadeOutAt}:d=${FADE_S}`;
      steps.push(`[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,${fades}[a${index}]`);
    }
  });

  return steps;
}

// Puts the pieces one after another: [v0][a0][v1][a1]... concat ... [joinedV][joinedA]
function joinPieces(input: RenderGraphInput): string {
  const pieces = input.segments
    .map((_, index) => (input.hasAudio ? `[v${index}][a${index}]` : `[v${index}]`))
    .join("");
  const outputs = input.hasAudio ? "[joinedV][joinedA]" : "[joinedV]";

  return `${pieces}concat=n=${input.segments.length}:v=1:a=${input.hasAudio ? 1 : 0}${outputs}`;
}

// Fits the picture to the platform's size.
//   center_crop  - enlarge until the picture covers the whole frame, then cut off the edges.
//   blurred_fit  - show the whole picture in the middle, over a blurred, enlarged copy of itself.
function reframe(input: RenderGraphInput): string[] {
  const { width, height } = input;
  const limitFps = input.sourceFps > MAX_FPS ? `fps=${MAX_FPS},` : "";
  const coverFrame = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;

  if (input.framing === "blurred_fit") {
    return [
      `[joinedV]${limitFps}split[forBackground][forFront]`,
      `[forBackground]${coverFrame},boxblur=luma_radius=25:luma_power=3,setsar=1[background]`,
      `[forFront]scale=${width}:${height}:force_original_aspect_ratio=decrease,setsar=1[front]`,
      `[background][front]overlay=(W-w)/2:(H-h)/2,format=yuv420p${VIDEO_LABEL}`,
    ];
  }

  // center_crop. Following the subject is not built yet, so it is cropped the same way.
  return [`[joinedV]${limitFps}${coverFrame},setsar=1,format=yuv420p${VIDEO_LABEL}`];
}

// FFmpeg reads times in seconds. Three decimals is plenty.
function seconds(value: number): string {
  return value.toFixed(3);
}
