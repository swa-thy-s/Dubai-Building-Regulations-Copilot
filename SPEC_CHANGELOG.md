# SPEC.md changelog (changes since the first version)

Give this file to Claude Code together with the updated `SPEC.md`, `LEGAL.md` and (for the owner) `PERMISSION_REQUEST_EMAIL.md`. Everything not listed here is unchanged.

## Changed

| Section | Change |
| --- | --- |
| 2. Non-negotiable rules, rule 7 | The old one-line footer rule is replaced. Every page and every answer state (answered, abstained, out-of-scope, error with clauses) must carry the "Reference tool only" notices with the exact wording in `LEGAL.md` 1.1 to 1.4. The app must never say a design or product "complies", "is approved" or "is permitted" |
| 5. Repository layout | `app/page.tsx` is now the landing page. The tool moves to `app/ask/page.tsx`. New routes `disclaimer/`, `terms/`, `privacy/`, `sources/`. New folders `freshness/` and `content/legal/`. New workflows `freshness.yml` and `retention.yml` |
| 10. UI requirements | The tool is no longer the home page: landing page at `/`, tool at `/ask` |
| 12. Environment variables | Added `RETENTION_DAYS` (default 90), `STALE_AFTER_DAYS` (default 45), `LEGAL_VERSION` |
| 14. Build order | New steps 4b (legal pages, modal, retention job), 4c (freshness agent), 4d (landing page). New open item: send permission emails, fill every `LEGAL.md` placeholder, lawyer review, decide on a paid Gemini tier |
| `LEGAL.md` 0 | The first-use modal appears on `/ask`, not on the landing page |

## Added

| Section | What |
| --- | --- |
| 15. Freshness agent | Biweekly GitHub Action that checks the official source pages for new editions, amendments, circulars and new documents. Classifies changes with Gemini and opens a GitHub issue with a checklist. Never ingests or supersedes anything on its own. Blocked or failed sites are recorded as `manual_check_needed` and never counted as verified. New columns and tables: `documents.last_verified_on`, `source_checks`. Shows "last verified" per document and a stale-sources banner after 45 days |
| 16. Legal pages, notices, retention | Build the legal pages and notices from `LEGAL.md`. First-use acknowledgement modal. A `notice` field in the API's final payload so the footer cannot be omitted. Daily job deleting logs and feedback older than `RETENTION_DAYS`. Build fails if any placeholder remains |
| 17. Landing page | Plain landing page at `/`: what it is, who it is for, what it is not, how it works, coverage table from the database, example questions, honest limits, about line, share metadata for LinkedIn, and acceptance tests |

## New files

- `LEGAL.md`: banner, modal, answer footer, Disclaimer, Terms, Privacy Policy, Sources and copyright notice, UI strings, acceptance tests. Placeholders must be filled by the owner.
- `PERMISSION_REQUEST_EMAIL.md`: draft emails to Dubai Municipality and Trakhees (for the owner, not for Claude Code).
