#!/bin/bash
# Downloads an Internet Archive item into the inbox.
# Usage: bash pipeline/fetch_ia.sh ITEM_ID [jp2|pdf|txt|all]
#   jp2  page images in full quality (best for OCR; can be large)   [default]
#   pdf  the PDF only (smaller; images are compressed)
#   txt  the Archive's own OCR text, to judge whether it is usable before doing our own
#   all  metadata + jp2 + txt
set -e
ID="$1"; WHAT="${2:-jp2}"
[ -z "$ID" ] && { echo "Usage: fetch_ia.sh ITEM_ID [jp2|pdf|txt|all]"; exit 1; }
D="${MOUSEION_DRIVE:-/Volumes/Mouseion}"
IA=~/venvs/mouseion/bin/ia
mkdir -p "$D/inbox"
cd "$D/inbox"
"$IA" metadata "$ID" > "$ID.metadata.json"
case "$WHAT" in
  jp2) "$IA" download "$ID" --glob="*_jp2.zip" ;;
  pdf) "$IA" download "$ID" --glob="*.pdf" --exclude="*_text.pdf" ;;
  txt) "$IA" download "$ID" --glob="*_djvu.txt" ;;
  all) "$IA" download "$ID" --glob="*_jp2.zip|*_djvu.txt" ;;
esac
echo "$(date '+%F %T') fetched $ID ($WHAT)" >> "$D/logs/fetch.log"
ls -lh "$D/inbox/$ID"
