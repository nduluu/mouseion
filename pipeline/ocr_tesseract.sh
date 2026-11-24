#!/bin/bash
# OCR of a folder of pages with Tesseract (tessdata_best models), 3 pages at a time.
# Usage: bash pipeline/ocr_tesseract.sh WORK_ID LANGS [PSM] [FIRST-LAST]
#   LANGS  Tesseract language codes joined with +, e.g. por, hrv, ara, grc+ell, deu_latf
#   PSM    page layout mode: 4 = one column of lines of different sizes (good for verse) [default]
#                            6 = one uniform block of text
#                            1 = automatic (use for two-column pages)
#   FIRST-LAST  only these pages, e.g. 20-30 (to test settings on a sample first)
# Output: $DRIVE/ocr/WORK_ID/tesseract/0001.txt … and 0001.hocr (text with positions)
set -e
W="$1"; L="$2"; PSM="${3:-4}"; RANGE="$4"
[ -z "$L" ] && { echo "Usage: ocr_tesseract.sh WORK_ID LANGS [PSM] [FIRST-LAST]"; exit 1; }
D="${MOUSEION_DRIVE:-/Volumes/Mouseion}"
IN="$D/pages/$W"; OUT="$D/ocr/$W/tesseract"; mkdir -p "$OUT"
TD="$(brew --prefix)/share/tessdata/best"
[ -f "$TD/${L%%+*}.traineddata" ] || TD="$(brew --prefix)/share/tessdata"
FILES=$(ls "$IN"/*.png | sort)
if [ -n "$RANGE" ]; then
  A=${RANGE%-*}; B=${RANGE#*-}
  FILES=$(for f in $FILES; do n=$((10#$(basename "$f" .png))); [ $n -ge $A ] && [ $n -le $B ] && echo "$f"; done)
fi
START=$(date +%s)
echo "$FILES" | parallel -j 3 --bar \
  "tesseract {} $OUT/{/.} --tessdata-dir $TD -l $L --psm $PSM -c preserve_interword_spaces=1 txt hocr 2>/dev/null"
N=$(echo "$FILES" | wc -l | tr -d ' ')
S=$(( $(date +%s) - START ))
echo "$(date '+%F %T') tesseract $W $L psm$PSM: $N pages in ${S}s" | tee -a "$D/logs/ocr.log"
