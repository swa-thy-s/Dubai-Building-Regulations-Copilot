#!/usr/bin/env bash
# Waits for the ingestion queue to finish, then reruns the evaluation processes against the larger corpus.
# Reports land in evals/reports/. Nothing is committed or deployed from here. Log: data/cache/post.log
set -u
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$HOME/.local/bin:$PATH"
LOG=data/cache/post.log
until grep -q "QUEUE FINISHED" data/cache/queue.log 2>/dev/null; do sleep 120; done
echo "$(date '+%F %T') queue finished; starting post-index checks" >> "$LOG"
run() { echo "$(date '+%F %T') RUN $*" >> "$LOG"; "$@" >> "$LOG" 2>&1; echo "$(date '+%F %T') EXIT $? $*" >> "$LOG"; }
run pnpm exec tsx scripts/eval.ts --tag post-index-retrieval --retrieval-only
run pnpm exec tsx scripts/gate-sweep.ts
run pnpm exec tsx scripts/exp-modes.ts
run pnpm exec tsx scripts/eval.ts --tag post-index-full
echo "$(date '+%F %T') POST CHECKS FINISHED" >> "$LOG"
