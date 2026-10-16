# Pilot plan (Step 5)

## What testers get
A link to the app and a one-page brief:
- Ask real building-code questions from your current projects. Part B of the Dubai Building Code 2021 (Municipality) is the only document indexed so far; "What's indexed" lists the corpus.
- Every answer shows the clause, edition, authority and page. Check the clause, not just the answer.
- Use thumbs down and "what was wrong" whenever an answer is wrong, missing, or unclear. Say which clause it should have used if you know.
- Do not paste confidential project details. The model runs on the Gemini API; do not assume it is private.
- This is a reference tool, not an official ruling.

## Weekly triage (owner, 30 min)
1. Open `/admin`. Read every thumbs-down and every abstained query from the last 7 days.
2. For each real miss: "Copy to golden set", fix the gold chunks and answer, add to `evals/golden.jsonl`.
3. Rerun `pnpm eval --tag week-N`, commit the report, add a line to `evals/EXPERIMENTS.md`.
4. Check abstain rate, thumbs-down rate, p95 latency against the table below.

## Metrics against targets (golden v1, 60 questions, K2 Horizon, 2026-10-16)

| Layer | Metric | Target | Latest | Status |
| --- | --- | --- | --- | --- |
| Retrieval | Recall@5 | 85% or more | 98.9% | Met |
| Retrieval | MRR | Track | 0.972 | Tracked |
| Generation | Citation validity | 100% | `verify` rejects unknown clause ids, unsupported numbers and orphan markers; 0 invalid citations shipped | Met (enforced in code) |
| Generation | Answer accuracy (`must_include`) | 85% or more | 95.7% (before the g-010 verify fix; g-010 now passes) | Met |
| Generation | Faithfulness, completeness (judge) | Average 4 or more | not measured | Needs owner hand-grading of 20 answers (spec 11.4) |
| Abstention | Abstain precision | 90% or more | 100% | Met |
| Abstention | Over-refusal | 10% or less | 2.2% (1 of 46, g-010, since fixed) | Met |
| Ops | p95 latency | Under 8 s | 5.7 s (eval; production p95 comes from `/admin`) | Met |

## Before inviting testers
- [x] LLM capacity: generation now runs on K2 Horizon (no daily cap seen). Gemini is used only for embeddings.
- [ ] Owner spot check of Step 1 (`data/spotcheck_part_b.md`) confirmed.
- [ ] Architect verifies the 40 new golden questions (g-021 to g-060), especially gold answers.
- [ ] 3 to 5 firms identified and given the brief above.

## Owner setup still open
- [ ] GitHub, Settings > Secrets and variables > Actions > **Variables**: add `APP_URL` = `https://dubai-building-regulations-copilot.vercel.app` (keep-alive workflow).
- [ ] GitHub **Secrets** for the PR retrieval eval in `.github/workflows/ci.yml`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`. Without them the `retrieval-eval` job fails; `checks` still runs.
- [ ] Before the pilot: clear dev/test rows from `query_logs` (rows with `ip_hash = 'eval'` are already hidden in `/admin`; manual test questions are not).

## Step 6: what is indexed and what is ready (updated 2026-10-17)

Live now: Dubai Building Code 2021, Part B (400 chunks). Everything below is parsed and checked, and waits only for embedding capacity.

| Source | Chunks | State |
| --- | --- | --- |
| DBC 2021 Part A General | 65 | Ready (`python -m ingest.main dbc-2021 --part "Part A"`). Table A.1 defines renovation vs modification |
| DBC 2021 Parts C, D, E, F, G, H, J, K | 210, 144, 102, 182, 361, 358, 26, 639 | Ready, same command with `--part "Part X"` |
| Dubai Real Estate Legislation (17 laws, authority RERA) | 344 | Ready: `python -m ingest.main dubai-real-estate-legislation`. Includes Law 27/2007 on jointly owned property |
| Al Sa'fat Green Building System, 2nd ed. 2023 | 132 | Ready. Stamped "SHARED - CONFIDENTIAL" |
| Dubai Wind Code (Draft Copy 2013) | 30 | Ready. Draft; formulas unreliable |
| DBC Circular (17 Jan 2022) | 1 | Ready |
| Seismic Design Code | 0 | Not indexed: text layer unreliable (see `ingest/sources.yaml`) |
| Structural Codes and Guidelines, Soil Testing Guidelines | 0 | Not indexed: scanned Arabic, no OCR |
| Sustainable Dubai report 2016 | 0 | Not indexed: an annual report, not a regulation |
| Excel calculators and schedules (AC unit, solar, glazed) | 0 | Not indexed: spreadsheets, no clause text |

About 2,590 new chunks need embedding. The Gemini free tier allows 1,000 embedding requests per day, and the live app also uses it (one per question). Options: enable billing on the Google AI project (finishes in minutes), or ingest in stages. Ingestion now stops cleanly when the daily quota is hit, keeps its cache and resumes on the next run.

After the new documents go live, redo: ingest QA spot checks per source, gate threshold sweep, golden set review (some should-abstain questions become answerable), retrieval and full evals, experiments, Lighthouse.
