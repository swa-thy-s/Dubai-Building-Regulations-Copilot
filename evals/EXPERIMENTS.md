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

## 5. Golden set v1: 60 questions, retrieval-only (2026-10-16)

- **Config:** gate=0.68, K=6, hybrid, no rerank. Golden grown from 20 to 60 (20 lookup, 10 numeric, 10 multi-clause, 10 trap, 10 abstain). The 40 new questions were drafted from indexed clause text and are NOT yet architect-verified. Trakhees questions run with the authority filter.
- **Results:** Recall@5 98.9%, MRR 0.972, abstain precision 92.9% (13/14), over-refusal 0%.
- **Leak:** g-048 ("2013 edition" corridor width) passes the similarity gate. A similarity gate cannot see edition mismatch; it relies on the model abstaining. Check in the first full run.
- **Not run:** full-pipeline run blocked by the Gemini free-tier daily quota (20 requests/day/model for gemini-3-flash). Generation metrics (answer accuracy, citation validity, p95, judge) are pending.
- **Report:** `evals/reports/2026-10-16-a34db2c-golden60-retrieval.md`

## 6. Dense vs full-text vs hybrid (spec experiment 2) (2026-10-16)

- **Single change:** which ranking is used to pick the top 5 (rankings come from the same `hybrid_search` call with `match_count=100`, so each leg's 50-candidate pool is complete).
- **Results (46 answerable, golden v1, raw question as query):**

  | Mode | Recall@5 | MRR |
  | --- | --- | --- |
  | hybrid | 98.9% | 0.961 |
  | dense only | 98.9% | 0.978 |
  | full-text only | 47.8% | 0.489 |

- **Finding:** the full-text leg returned no rows for 21 of 46 questions, because `websearch_to_tsquery` ANDs every word of a natural-language question. It adds little today and dense alone is as good.
- **Caveats:** the eval uses the raw question; production feeds the keyword-rich query-prep rewrite to search, which should help full-text. Exact-term lookups (e.g. "RMU", clause numbers) are where full-text should earn its place and the golden set has few of those.
- **Decision:** keep hybrid (no recall loss, protects exact-term queries). Candidate follow-ups: (a) full-text with OR semantics and stopword removal, (b) re-run once the query-prep rewrite can be included in the eval (needs Gemini quota), (c) add exact-term/clause-number questions to the golden set.
- **Report:** `evals/reports/2026-10-16-5783c5d-modes.md`
