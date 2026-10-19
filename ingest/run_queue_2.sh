#!/usr/bin/env bash
# Second queue: the UAE Fire and Life Safety Code, then the DEWA circulars/guidelines and the DDA fit-out form
# (everything in ingest/sources_dewa.yaml). Same resume-from-cache behaviour as run_queue.sh. Log: data/cache/queue2.log
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/bin:$PATH"
PY=.venv/bin/python
UNITS=("uae-flsc-2018" $($PY -c "import yaml;print(' '.join(d['slug'] for d in yaml.safe_load(open('ingest/sources_dewa.yaml'))['documents']))"))
mkdir -p data/cache
LOG=data/cache/queue2.log
for slug in "${UNITS[@]}"; do
  while true; do
    echo "$(date '+%F %T') START $slug" >> "$LOG"
    $PY -m ingest.main "$slug" >> "$LOG" 2>&1
    code=$?
    if [ $code -eq 0 ]; then echo "$(date '+%F %T') DONE  $slug" >> "$LOG"; break; fi
    if [ $code -eq 75 ]; then echo "$(date '+%F %T') QUOTA $slug - waiting 10 min" >> "$LOG"; sleep 600; continue; fi
    echo "$(date '+%F %T') FAIL  $slug (exit $code)" >> "$LOG"; break
  done
done
echo "$(date '+%F %T') QUEUE 2 FINISHED" >> "$LOG"
