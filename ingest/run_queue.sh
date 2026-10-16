#!/usr/bin/env bash
# Ingest every ready unit in priority order. On the daily embedding quota (exit 75) wait and retry the same unit.
# Usage: ingest/run_queue.sh   (log: data/cache/queue.log)
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
PY=.venv/bin/python
UNITS=(
  "dbc-2021 --part Part A"
  "dubai-real-estate-legislation"
  "alsafat-2023"
  "dbc-wind"
  "dbc-circular"
  "dbc-2021 --part Part F"
  "dbc-2021 --part Part C"
  "dbc-2021 --part Part E"
  "dbc-2021 --part Part D"
  "dbc-2021 --part Part H"
  "dbc-2021 --part Part G"
  "dbc-2021 --part Part J"
  "dbc-2021 --part Part K"
)
mkdir -p data/cache
LOG=data/cache/queue.log
for unit in "${UNITS[@]}"; do
  slug="${unit%% *}"; rest="${unit#* }"
  [ "$rest" = "$unit" ] && args=() || { part="${rest#--part }"; args=(--part "$part"); }
  while true; do
    echo "$(date '+%F %T') START $unit" >> "$LOG"
    $PY -m ingest.main "$slug" "${args[@]}" >> "$LOG" 2>&1
    code=$?
    if [ $code -eq 0 ]; then echo "$(date '+%F %T') DONE  $unit" >> "$LOG"; break; fi
    if [ $code -eq 75 ]; then echo "$(date '+%F %T') QUOTA $unit - waiting 10 min" >> "$LOG"; sleep 600; continue; fi
    echo "$(date '+%F %T') FAIL  $unit (exit $code)" >> "$LOG"; break
  done
done
echo "$(date '+%F %T') QUEUE FINISHED" >> "$LOG"
