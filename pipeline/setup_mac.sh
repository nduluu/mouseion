#!/bin/bash
# One-time setup on macOS (Apple Silicon). Safe to run again.
# Usage: bash pipeline/setup_mac.sh
set -e

if ! command -v brew >/dev/null; then
  echo "Homebrew is missing. Install it first from https://brew.sh (one command), then run this again."
  exit 1
fi

echo "== Command-line tools"
brew install python@3.12 git tesseract tesseract-lang ocrmypdf poppler openjpeg imagemagick parallel

echo "== Better Tesseract models for the scripts we need first (tessdata_best)"
TD="$(brew --prefix)/share/tessdata"
mkdir -p "$TD/best"
for l in por hrv ara grc ell lat ita deu deu_latf fra spa rus; do
  if [ ! -f "$TD/best/$l.traineddata" ]; then
    curl -fsSL -o "$TD/best/$l.traineddata" "https://github.com/tesseract-ocr/tessdata_best/raw/main/$l.traineddata" \
      && echo "  $l" || echo "  $l: not found, skipped"
  fi
done
echo "  (use them with: --tessdata-dir $TD/best)"

PY="$(brew --prefix)/bin/python3.12"

echo "== Python environment 1: downloading and Apple Vision OCR (~/venvs/mouseion)"
"$PY" -m venv ~/venvs/mouseion
~/venvs/mouseion/bin/pip install -q --upgrade pip
~/venvs/mouseion/bin/pip install -q internetarchive ocrmac pyyaml rapidfuzz

echo "== Python environment 2: Kraken, for historical prints and difficult scripts (~/venvs/kraken)"
"$PY" -m venv ~/venvs/kraken
~/venvs/kraken/bin/pip install -q --upgrade pip
~/venvs/kraken/bin/pip install -q kraken

echo
echo "Done. Check the versions:"
tesseract --version | head -1
ocrmypdf --version
~/venvs/mouseion/bin/ia --version
~/venvs/kraken/bin/kraken --version
