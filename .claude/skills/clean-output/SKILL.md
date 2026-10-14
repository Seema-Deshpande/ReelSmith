---
name: clean-output
description: Keep ReelSmith's rendered videos clean, with no watermark, logo, "made with AI" badge or branding added by us. Use whenever you write or change rendering, FFmpeg filters, captions, output settings, render tests, or add any tool or API that touches the video.
---

# Clean output

ReelSmith edits the user's own footage from a prompt: it cuts segments, reframes, burns in captions and levels audio. The clip the user downloads must contain **only their video plus the edits they asked for**. We never add our own mark to it.

## What ReelSmith does and does not do

- It does **edit** existing footage: cut, trim silences, reframe, captions, audio leveling.
- It does **not generate** new video or voice. No synthetic pictures are made, so there is nothing for us to label.
- If a future feature does generate pictures or voice (AI video, AI voice, face or lip changes), stop and ask the user before building it. Platforms and laws may require labels on such content, and that is a decision for them, not a default for us to turn off.

## Rules for the render code

1. **Nothing of ours on the picture.** The FFmpeg filter graph may contain: trim/cut, scale/crop/blurred-background fit, burned-in captions (`.ass` subtitles), and audio filters. No `overlay` with an image, no `drawtext` that isn't the user's caption, no logo, no corner badge, no intro or outro clip.
2. **No watermark option exists.** Do not add settings like `WATERMARK`, `BRANDING` or `FREE_TIER_MARK`, and do not add a code path that stamps free-tier or demo output. If the owner ever wants branding, it must be a separate opt-in feature the user switches on, off by default, and it needs a clear request first.
3. **Third-party tools must be clean.** Before using an API, library or model that touches the video, check that it does not add its own watermark on the free or default tier. If it does, do not adopt it. Tell the user instead.
4. **Captions are only what the user asked for.** Caption text comes from the transcript. Do not add promotional text, credits or hashtags.
5. **Do not add hidden marks either.** No tags, comments or extra streams that say the clip was made with ReelSmith or AI. The output should have the video stream, at most one audio stream, and no extra data, attachment or subtitle streams (captions are burned in).
6. **Be honest about what happens to the source's metadata.** Re-encoding with FFmpeg writes a new file. Whatever metadata or content credentials were in the source may not carry over, and that is a side effect, not a feature. Do not promise users that credentials are kept or removed. Do not build anything whose purpose is to strip watermarks or provenance marks from an uploaded video.

## Tests to write with the render step

Add these to `tests/api/` once rendering exists. They use the small fixtures from `tests/support/globalSetup.ts`.

- **Streams:** run `ffprobe` on the output and check exactly one video stream, zero or one audio stream, and no data, attachment or subtitle streams.
- **Tags:** the output's metadata must not contain `ReelSmith`, `AI` or `generated`. (The default `encoder` tag FFmpeg writes is fine.)
- **Corners are untouched:** render a clip with captions off, take one frame, and compare the four corner regions against the same frame cut from the source with the same crop. They must match. Overlaid logos and badges almost always sit in a corner, so this catches them.
- **Length:** output duration equals the total of the plan's segments, within 0.1 s.

## Before you say it is done

1. Read the final FFmpeg filter list. Every filter must be explainable as "the user asked for this edit".
2. Search the change for `overlay`, `drawtext`, `movie=`, `watermark`, `logo` and `brand`. Each hit needs a reason.
3. Run `npm run typecheck` and `npm test`.
4. In your report, say what you checked and what you did not, such as "corner comparison written, not yet run on real footage".
