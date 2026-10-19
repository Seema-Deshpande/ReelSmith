#!/bin/sh
# Makes the sample video used for testing: tests/assets/sample-talk.mp4
#   - 640x360 (landscape, so reframing to vertical has something to do), 15 frames per second
#   - the picture is FFmpeg's "testsrc" pattern, which shows a running clock in the middle,
#     so you can see exactly which second of the source you are looking at
#   - the sound is a computer voice reading the sentences below, with a pause after each one
# It needs macOS (the "say" command) and FFmpeg. The result is small and is saved in git,
# so other people and CI do not need to run this.
set -e

OUTPUT="tests/assets/sample-talk.mp4"
SPEECH_FILE="$(mktemp -t sample-speech).aiff"

# [[slnc 1200]] means: stay silent for 1.2 seconds.
say -v Samantha -r 170 -o "$SPEECH_FILE" \
  "Welcome to the ReelSmith test video. [[slnc 1200]] \
Tip one. Keep your videos short. [[slnc 1200]] \
Tip two. Start with a strong hook. [[slnc 1200]] \
Tip three. Add clear captions. [[slnc 1200]] \
Thanks for watching."

mkdir -p tests/assets
ffmpeg -v error -y \
  -f lavfi -i "testsrc=size=640x360:rate=15" \
  -i "$SPEECH_FILE" \
  -af "apad=pad_dur=2" -shortest \
  -c:v libx264 -preset veryfast -crf 32 -pix_fmt yuv420p \
  -c:a aac -b:a 48k -ac 1 \
  -movflags +faststart \
  "$OUTPUT"

rm -f "$SPEECH_FILE"
echo "Made $OUTPUT"
