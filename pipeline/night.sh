#!/bin/bash
# Runs every job in the queue folder, one after the other, while keeping the Mac awake.
# Usage (in the evening, laptop plugged in, lid open):
#   bash pipeline/night.sh
# A job is any .sh file in $DRIVE/queue, e.g. queue/01-mendes-ocr.sh containing:
#   bash ~/mouseion/pipeline/ocr_tesseract.sh mendes-iliad por 4
# Jobs run in name order. Finished jobs move to archive/; a failed job stays in the queue
# and the night continues with the next one. Everything is written to logs/night-DATE.log.
D="${MOUSEION_DRIVE:-/Volumes/Mouseion}"
LOG="$D/logs/night-$(date +%F).log"
caffeinate -i -w $$ &          # keep the Mac awake until this script ends
echo "== night run $(date '+%F %T')" >> "$LOG"
for job in $(ls "$D/queue"/*.sh 2>/dev/null | sort); do
  echo "-- $(date '+%T') start $(basename "$job")" >> "$LOG"
  if bash "$job" >> "$LOG" 2>&1; then
    mv "$job" "$D/archive/"
    echo "-- $(date '+%T') done" >> "$LOG"
  else
    echo "-- $(date '+%T') FAILED (left in queue)" >> "$LOG"
  fi
done
echo "== end $(date '+%F %T')" >> "$LOG"
tail -n 30 "$LOG"
