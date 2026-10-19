# Owner checklist (written 2026-10-17)

Everything below needs you. Nothing here blocks the code; items marked "blocks" stop something from going live.

## 1. Indexing status and what is still waiting on Google (updated 2026-10-19, evening)

**Live now (1,167 chunks, 25 documents):** DBC 2021 Parts A, B and F; the 17 real-estate laws; Al Sa'fat; the Wind Code (draft); the DBC Circular; and from official websites the DDA Fit-Out and Building Modification permit pages and DDA Circulars 318 and 338.

**Parsed and queued, in this order (the queue runs the small permit documents first):** Trakhees CP-01 and CP-02, the Dubai Municipality FAQ and three permit-procedure flowcharts (about 38 chunks), then DBC Parts C, E, D, H, G, J and K (about 1,520 chunks). See `docs/WEB_SOURCES.md` for where each came from and what could not be indexed.

The embedding key still reports the Gemini **free tier** (1,000 embeddings a day, 100 a minute), so billing is not attached to that key's project. The daily allowance ran out again this evening; it resets around 12:30 tomorrow. In Google AI Studio, link the key's project to your billing account (or create a new key inside the billed project and replace `GEMINI_API_KEY` in `.env.local` and Vercel). Only embeddings still use Gemini.

To continue (safe to rerun, it resumes from the cache): `bash ingest/run_queue.sh`. Do not run it while you are testing the app: ingestion and live questions share the same embedding limit, and questions fail with "at capacity" while the queue is running or the day's allowance is spent.

After new documents go live, run `python -m ingest.record_sources` to write their official links and verification dates, then rerun the checks by hand (reports go to `evals/reports/`, nothing is committed or deployed):
```
pnpm exec tsx scripts/eval.ts --tag post-index-retrieval --retrieval-only
pnpm exec tsx scripts/gate-sweep.ts
pnpm exec tsx scripts/eval.ts --tag post-index-full
pnpm exec tsx scripts/ask-batch.ts evals/scenarios.json
```
Review the gate sweep's recommended threshold before changing `GATE_THRESHOLD`.

## 2. GitHub settings

- Variable `APP_URL` = `https://dubai-building-regulations-copilot.vercel.app` (keep-alive workflow).
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `LLM_API_KEY` (PR retrieval eval, retention and freshness jobs).
- Optional variable `RETENTION_DAYS` (default 90).

## 3. Legal pages: what I filled in, and what you must still do

The pages come from `LEGAL.md` unchanged except for these replacements (`content/legal/`). **A lawyer should review them before a public launch.**

| Placeholder | What I used | Why / what to check |
| --- | --- | --- |
| App name | Dubai Regulations Copilot | |
| Owner name | "an independent individual (the owner)" | No personal details published |
| Contact email | An in-app form at `/contact` (stored in the `feedback` table, rate limited, optional "how to reach you") | No email address is published. Read `/contact` messages from the Supabase `feedback` table (comments start with `[contact]`) or `/admin` |
| Country of owner | Removed | Not needed once the owner is not named |
| Governing law and courts | "the laws of the Emirate of Dubai and the federal laws of the UAE applicable in it, and the courts of Dubai" | **My assumption.** Confirm or change in `content/legal/terms.md` |
| Last updated | 17 October 2026 | Bump `LEGAL_VERSION` in `lib/legal.ts` when wording changes so everyone sees the modal again |
| Retention days | 90 | The daily job `retention.yml` enforces it |
| AI providers | IFM (K2 Horizon) for answers, Google (Gemini) for search embeddings | The Privacy Policy says we have **not verified** whether either provider keeps or trains on submitted content. Check their terms for the tiers you use, then tighten that paragraph in `content/legal/privacy.md` |

Other legal points you should know:

- **Official links are missing.** `LEGAL.md` section 5 says each source needs an official link and a "last verified" date. No document has a `source_url` yet and none has been verified, so `/sources` shows "Not provided" and "Not yet verified", and every answer footer says documents have not been verified. That is accurate, but a public launch should have real links. Add them in the `documents.source_url` column and I will wire up verification.
- **Copyright and quoting rights are unresolved.** Al Sa'fat is stamped "SHARED – CONFIDENTIAL". The Wind Code is a draft. Before any public or paid launch, confirm Dubai Municipality's and the Government of Dubai's terms for quoting these documents.
- **Scope wording.** The out-of-scope message still says "building codes and approvals only", but the real-estate laws are now indexed (fees, rent increases, jointly owned property). Decide whether to widen the scope text in `lib/legal.ts` and the landing page.
- **Emails to authorities:** skipped as you asked. `PERMISSION_REQUEST_EMAIL.md` was not used.

## 4. Decisions about documents (see `ingest/sources.yaml`)

| Document | State | Decision needed |
| --- | --- | --- |
| Seismic Design Code | Not indexed: text layer unreliable | An official clean PDF, or approve OCR plus a full manual check |
| Structural Codes Guidelines, Soil Testing Guidelines | Not indexed: scanned Arabic | OCR plus whether non-English text should be indexed |
| Sustainable Dubai report 2016 | Not indexed: an annual report, not a regulation | Say if you still want it |
| Excel calculators and schedules | Not indexed | None, unless you want the tables turned into text |
| Wind Code | Ready, draft edition | Allow answers from a draft? |
| Al Sa'fat | Ready, confidential stamp | Confirm it may be quoted |

Your wall-removal question: approval procedures are not in any file you have. DBC Part A Table A.1 and Law 27/2007 Article 8 help partly. For the rest you need Dubai Municipality's permit procedures for modifications and fit-out, and your developer's or Owners Association's fit-out rules. I have not named links because I cannot verify them.

## 5. Verification only you can do

- Spot check: `data/spotcheck_new_sources.md` (new sources) and `data/spotcheck_part_b.md` (Step 1, still unconfirmed).
- An architect should verify golden questions g-021 to g-069 (gold answers were drafted from the text by me). g-062 is your own wall question and expects a "not found".
- Hand-grade 20 answers for the LLM judge calibration (spec 11.4).
- The Trakhees question: DBC Part A says the Code replaces the regulations of Dubai Municipality, DDA, Trakhees and DSOA. The golden questions g-045 to g-047 assume "Trakhees filter returns nothing", which may be wrong. Decide how the Trakhees chip should behave.

## 6. Housekeeping

- Rotate the IFM API key (it was pasted in chat).
- Clear my manual test rows from `query_logs` before the pilot (eval runs are already hidden from `/admin`).
- Vercel still holds the old `GEMINI_GEN_MODEL` variable. It is unused and safe to delete.
