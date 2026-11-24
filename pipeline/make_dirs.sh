#!/bin/bash
# Creates the folder layout on the external drive.
# Usage: bash pipeline/make_dirs.sh
set -e
D="${MOUSEION_DRIVE:-/Volumes/Mouseion}"
if [ ! -d "$D" ]; then echo "Drive not found: $D (plug it in, or set MOUSEION_DRIVE)"; exit 1; fi
mkdir -p "$D"/{inbox,pages,ocr,proof,texts,cards,queue,logs,archive}
cat <<EOF
Created in $D:
  inbox/    downloads exactly as received (never edited)
  pages/    one PNG per page, per work   (pages/<work-id>/0001.png …)
  ocr/      raw OCR output, per engine   (ocr/<work-id>/tesseract/, ocr/<work-id>/vision/ …)
  proof/    pages you corrected by hand  (the reference for measuring errors)
  texts/    clean text ready for Mouseion
  cards/    one work card per work       (copy pipeline/workcard.yaml)
  queue/    jobs for the night run       (one .sh file per job)
  logs/     what ran, when, and what went wrong
  archive/  finished jobs and old queue files
EOF
