#!/bin/sh
# One-time setup for the free local Whisper backup (whisper.cpp). Safe to run again.
#   1. installs the whisper.cpp program with Homebrew
#   2. downloads the multilingual "base" model (about 150 MB) into models/
set -e

MODEL_FILE="models/ggml-base.bin"
MODEL_URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"

if ! command -v whisper-cli >/dev/null 2>&1; then
  echo "Installing whisper.cpp with Homebrew..."
  brew install whisper.cpp
else
  echo "whisper-cli is already installed."
fi

if [ ! -f "$MODEL_FILE" ]; then
  echo "Downloading the model (about 150 MB)..."
  mkdir -p models
  curl -L --fail -o "$MODEL_FILE.part" "$MODEL_URL"
  mv "$MODEL_FILE.part" "$MODEL_FILE"
else
  echo "The model is already in $MODEL_FILE."
fi

echo "Done. Local Whisper is ready."
