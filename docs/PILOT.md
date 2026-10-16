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

## Metrics against targets (golden v1, 60 questions)

| Layer | Metric | Target | Latest | Status |
| --- | --- | --- | --- | --- |
| Retrieval | Recall@5 | 85% or more | 98.9% | Met (retrieval-only, 2026-10-16) |
| Retrieval | MRR | Track | 0.972 | Tracked |
| Abstention | Abstain precision | 90% or more | 92.9% (13/14, gate only) | Met on gate alone |
| Abstention | Over-refusal | 10% or less | 0% | Met |
| Generation | Citation validity | 100% | Enforced by `verify` | Pending full run |
| Generation | Answer accuracy (`must_include`) | 85% or more | not measured | Blocked: Gemini daily quota |
| Generation | Faithfulness, completeness (judge) | Average 4 or more | not measured | Blocked: quota, and needs owner hand-grading of 20 answers (spec 11.4) |
| Ops | p95 latency | Under 8 s | not measured end to end | Blocked: quota |

## Before inviting testers
- [ ] Gemini capacity: free tier gives about 20 requests per day per model, and each question uses 2. Enable billing on the Google AI project or move to a model with a larger quota.
- [ ] Owner spot check of Step 1 (`data/spotcheck_part_b.md`) confirmed.
- [ ] Architect verifies the 40 new golden questions (g-021 to g-060), especially gold answers.
- [ ] 3 to 5 firms identified and given the brief above.

## Owner setup still open
- [ ] GitHub, Settings > Secrets and variables > Actions > **Variables**: add `APP_URL` = `https://dubai-building-regulations-copilot.vercel.app` (keep-alive workflow).
- [ ] GitHub **Secrets** for the PR retrieval eval in `.github/workflows/ci.yml`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`. Without them the `retrieval-eval` job fails; `checks` still runs.
- [ ] Before the pilot: clear dev/test rows from `query_logs` (rows with `ip_hash = 'eval'` are already hidden in `/admin`; manual test questions are not).

## Step 6 document decisions (see `ingest/sources.yaml`)
| Document | State | Needs from owner |
| --- | --- | --- |
| Dubai Building Code Circular (17 Jan 2022) | Clean 1-page English letter; chunker gives 0 chunks | Worth indexing? Then a letter adapter |
| Al Sa'fat Green Building System 2nd ed. 2023 | Pages stamped "SHARED - CONFIDENTIAL" | Confirm it may be indexed and quoted |
| Dubai Wind Code | English, but cover says "Draft Copy 2013" | Allow answers from a draft? Edition badge would say so |
| Seismic Design Code | Garbled text layer (font encoding); numbers untrustworthy | An official clean copy, or approve OCR plus a full manual check |
| Structural Codes Guidelines, Soil Testing Guidelines | Scanned Arabic, 6 and 3 pages | English versions, or leave out (app is English only) |

The ingestion chunker is outline-driven and built for the DBC. Each new document type needs an adapter and its own spot check (spec 7.5) before it goes live.
