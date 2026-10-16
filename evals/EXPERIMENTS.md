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

## 4. Gate threshold sweep (2026-10-16)

- **Config:** same as baseline; only `GATE_THRESHOLD` changes. Data from `scripts/gate-sweep.ts` over the 20 golden questions plus 15 extra out-of-scope/vague probes (probes are not in the golden set).
- **Observations (best RRF-top similarity):**
  - Answerable with FTS top-5 hit: 0.654-0.785 (pass via FTS escape regardless of threshold)
  - Answerable without FTS hit: min 0.729
  - Clearly out-of-scope (mortgage, visa, labour law, etc.): 0.465-0.628
  - In-domain but not covered (g-020 fire rating 0.667, vague "rules for building" 0.658, Trakhees warehouses 0.708): above 0.65
- **Change:** `GATE_THRESHOLD` 0.55 -> 0.68 (margin 0.05 below the lowest non-FTS answerable question; gates all clearly out-of-scope probes and both golden abstain questions).
- **Results:** Recall@5 100%, MRR 0.956, abstain precision 100% (was 0%), over-refusal 0%.
- **Known leaks:** Trakhees-warehouse probe (0.708) and two FTS-rescued probes ("Is my design compliant?", "minimum ceiling height") still pass the gate. Left to the model abstain and verify layers; a Trakhees-aware check (no Trakhees docs indexed) is a candidate follow-up.
- **Caveat:** only 18 answerable questions, so the margin is thin. Re-check when the golden set grows to 60 and more documents are ingested.
- **Report:** `evals/reports/2026-10-16-e375e1f-gate-0.68.md`
