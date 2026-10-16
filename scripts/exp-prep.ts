#!/usr/bin/env tsx
// Experiment: raw question vs query-prep rewrite as the search query (retrieval-only).
import { config } from "dotenv";
config({ path: ".env.local" });
import * as fs from "fs";
import { hybridSearch } from "../lib/pipeline/search";
import { prepareQuery } from "../lib/pipeline/query-prep";
import { scoreRetrieval } from "./eval-metrics";

async function main() {
  const golden = fs.readFileSync("evals/golden.jsonl", "utf-8").trim().split("\n").map((l) => JSON.parse(l)).filter((q) => !q.should_abstain && q.gold_chunks.length);
  const rows: { raw: ReturnType<typeof scoreRetrieval>; prep: ReturnType<typeof scoreRetrieval>; ms: number; q: string; sq: string }[] = [];
  let i = 0;
  async function worker() {
    while (i < golden.length) {
      const q = golden[i++];
      const t = Date.now();
      const p = await prepareQuery(q.question);
      const ms = Date.now() - t;
      const [a, b] = await Promise.all([hybridSearch(q.question, { matchCount: 20 }), hybridSearch(p.search_query, { matchCount: 20 })]);
      rows.push({ raw: scoreRetrieval(q.gold_chunks, a.map((r) => r.clause_ref), 6), prep: scoreRetrieval(q.gold_chunks, b.map((r) => r.clause_ref), 6), ms, q: q.question, sq: p.search_query });
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  const avg = (f: (r: (typeof rows)[0]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
  const fellBack = rows.filter((r) => r.sq === r.q).length;
  console.log(`n=${rows.length} prep fell back to raw on ${fellBack}`);
  console.log(`raw : R@5 ${(avg((r) => r.raw.recallAt5) * 100).toFixed(1)}%  MRR ${avg((r) => r.raw.mrr).toFixed(3)}`);
  console.log(`prep: R@5 ${(avg((r) => r.prep.recallAt5) * 100).toFixed(1)}%  MRR ${avg((r) => r.prep.mrr).toFixed(3)}  avg prep ${Math.round(avg((r) => r.ms))}ms`);
  for (const r of rows.filter((r) => r.prep.mrr < r.raw.mrr - 0.01 || r.prep.recallAt5 < r.raw.recallAt5)) console.log("worse with prep:", r.q.slice(0, 60), "|", r.sq.slice(0, 70));
}
main();
