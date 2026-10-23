import { expect, test } from "@playwright/test";
import { buildFilterGraph, type RenderGraphInput } from "../../src/helpers/renderFilters";

// These tests look at the FFmpeg recipe as text, with no server and no video.

// A recipe input with sensible defaults. Each test changes only what it is about.
function recipe(changes: Partial<RenderGraphInput> = {}) {
  return buildFilterGraph({
    segments: [
      { startS: 1, endS: 3 },
      { startS: 5, endS: 8.5 },
    ],
    framing: "center_crop",
    levelAudio: true,
    hasAudio: true,
    sourceFps: 30,
    width: 1080,
    height: 1920,
    ...changes,
  });
}

test.describe("the render recipe", () => {
  test("cuts every segment out of the picture and the sound, then joins them", async () => {
    const graph = recipe();

    expect(graph).toContain("[0:v]trim=start=1.000:end=3.000,setpts=PTS-STARTPTS[v0]");
    expect(graph).toContain("[0:v]trim=start=5.000:end=8.500,setpts=PTS-STARTPTS[v1]");
    expect(graph).toContain("[0:a]atrim=start=5.000:end=8.500");
    expect(graph).toContain("[v0][a0][v1][a1]concat=n=2:v=1:a=1[joinedV][joinedA]");
  });

  test("fades the sound a little at each cut so there is no click", async () => {
    expect(recipe()).toMatch(/afade=t=in:st=0:d=0\.03,afade=t=out:st=1\.970:d=0\.03\[a0\]/);
  });

  test("crops to fill the frame with a center crop", async () => {
    const graph = recipe({ framing: "center_crop" });

    expect(graph).toContain("scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920");
    expect(graph).not.toContain("overlay");
    expect(graph).toContain("[vout]");
  });

  test("shows the whole picture over a blurred copy of itself with a blurred background", async () => {
    const graph = recipe({ framing: "blurred_fit" });

    expect(graph).toContain("split[forBackground][forFront]");
    expect(graph).toContain("boxblur");
    expect(graph).toContain("overlay=(W-w)/2:(H-h)/2"); // the picture on top of its own blurred copy
  });

  test("levels the sound when asked, and leaves it alone when not", async () => {
    expect(recipe({ levelAudio: true })).toContain("loudnorm=");
    expect(recipe({ levelAudio: false })).not.toContain("loudnorm");
    expect(recipe({ levelAudio: false })).toContain("anull[aout]");
  });

  test("leaves out all sound steps for a video with no sound", async () => {
    const graph = recipe({ hasAudio: false });

    expect(graph).not.toContain("atrim");
    expect(graph).not.toContain("[aout]");
    expect(graph).toContain("concat=n=2:v=1:a=0[joinedV]");
  });

  test("lowers a very fast video to 30 frames per second, but not a slower one", async () => {
    expect(recipe({ sourceFps: 60 })).toContain("fps=30");
    expect(recipe({ sourceFps: 25 })).not.toContain("fps=");
  });

  test("treats following the subject like a center crop, since it is not built yet", async () => {
    expect(recipe({ framing: "follow_subject" })).toBe(recipe({ framing: "center_crop" }));
  });

  test("contains nothing but the edits the user asked for (clean output)", async () => {
    for (const framing of ["center_crop", "blurred_fit"] as const) {
      const graph = recipe({ framing });

      // No text, no logos, no extra clips, no subtitle burning: see the clean-output skill.
      expect(graph).not.toMatch(/drawtext|drawbox|movie=|amovie|watermark|logo|brand|subtitles|ass=|-i /);
    }
  });
});
