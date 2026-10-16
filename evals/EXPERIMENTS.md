# Experiment log

## 1. Baseline (2026-10-16)

- **Config:** hybrid search (vector + FTS, RRF k=60), clause-level chunks, no rerank, gate=0.55, K=6
- **Change:** first run, establishing baseline
- **Results:**
  - Recall@5: 100.0% (18/18 answerable questions)
  - MRR: 0.956
  - Abstain precision: 0.0% (2 should-abstain questions were NOT gated — similarity too high)
  - Over-refusal: 0.0%
  - Avg latency: 837ms
- **Decision:** retrieval quality is strong. Gate threshold 0.55 is too low — out-of-scope queries still score >0.65 similarity. Will calibrate in experiment 4 (threshold sweep).
- **Report:** `evals/reports/2026-10-16-f6c5d97-baseline.md`
