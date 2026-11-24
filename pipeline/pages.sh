#!/bin/bash
# Turns downloaded page images into numbered PNG pages for OCR.
# Usage: bash pipeline/pages.sh WORK_ID SOURCE
#   SOURCE is a *_jp2.zip from the Internet Archive, or a PDF.
# Output: $DRIVE/pages/WORK_ID/0001.png, 0002.png, …  (greyscale, 300 dpi for PDFs)
set -e
W="$1"; SRC="$2"
[ -z "$SRC" ] && { echo "Usage: pages.sh WORK_ID SOURCE(.zip|.pdf)"; exit 1; }
D="${MOUSEION_DRIVE:-/Volumes/Mouseion}"
OUT="$D/pages/$W"; mkdir -p "$OUT"
TMP="$D/pages/.tmp-$W"; rm -rf "$TMP"; mkdir -p "$TMP"   # on the drive: a JP2 zip can be 1 GB
case "$SRC" in
  *.zip)
    unzip -q -j "$SRC" '*.jp2' -d "$TMP"
    n=0
    for f in $(ls "$TMP"/*.jp2 | sort); do
      n=$((n+1)); p=$(printf "%04d" $n)
      opj_decompress -quiet -i "$f" -o "$TMP/$p.tif" >/dev/null
      magick "$TMP/$p.tif" -colorspace Gray "$OUT/$p.png"
      rm -f "$f" "$TMP/$p.tif"
    done ;;
  *.pdf)
    pdftoppm -r 300 -gray -png "$SRC" "$TMP/p"
    n=0
    for f in $(ls "$TMP"/p-*.png | sort -V); do
      n=$((n+1)); mv "$f" "$OUT/$(printf "%04d" $n).png"
    done ;;
  *) echo "Unknown source type: $SRC"; exit 1 ;;
esac
rm -rf "$TMP"
echo "$(ls "$OUT" | wc -l | tr -d ' ') pages in $OUT"
