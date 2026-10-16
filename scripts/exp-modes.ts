#!/usr/bin/env tsx
// Experiment 2: dense-only vs full-text-only vs hybrid (retrieval-only).
import { config } from "dotenv";
config({ path: ".env.local" });
import * as fs from "fs";
import { execSync } from "child_process";
import { hybridSearch, type SearchResult } from "../lib/pipeline/search";
import { scoreRetrieval } from "./eval-metrics";

type Mode = "hybrid" | "dense" | "fts";
const modes: Mode[] = ["hybrid", "dense", "fts"];

function order(results: SearchResult[], mode: Mode): string[] {
  if (mode === "hybrid") return results.map((r) => r.clause_ref);
  const key = mode === "dense" ? "vector_rank" : "text_rank";
  return results
    .filter((r) => r[key] !== null)
    .sort((a, b) => (a[key] as number) - (b[key] as number))
    .map((r) => r.clause_ref);
}

async function main() {
  const golden = fs
    .readFileSync("evals/golden.jsonl", "utf-8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l))
    .filter((q) => !q.should_abstain && q.gold_chunks.length);

  const agg: Record<Mode, { r5: number[]; mrr: number[]; byType: Record<string, number[]> }> = {
    hybrid: { r5: [], mrr: [], byType: {} },
    dense: { r5: [], mrr: [], byType: {} },
    fts: { r5: [], mrr: [], byType: {} },
  };
  let ftsEmpty = 0;

  for (const q of golden) {
    const res = await hybridSearch(q.question, { matchCount: 100 });
    if (!res.some((r) => r.text_rank !== null)) ftsEmpty++;
    for (const m of modes) {
      const s = scoreRetrieval(q.gold_chunks, order(res, m), 6);
      agg[m].r5.push(s.recallAt5);
      agg[m].mrr.push(s.mrr);
      (agg[m].byType[q.type] ||= []).push(s.recallAt5);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
  const sha = execSync("git rev-parse --short HEAD").toString().trim();
  const date = new Date().toISOString().slice(0, 10);
  const types = [...new Set(golden.map((q) => q.type))];
  let md = `# Experiment 2: dense vs full-text vs hybrid\n\n- Git SHA: ${sha}\n- Questions: ${golden.length} answerable (golden v1)\n- Questions where full-text returned nothing: ${ftsEmpty}\n\n`;
  md += `| Mode | Recall@5 | MRR | ${types.map((t) => `R@5 ${t}`).join(" | ")} |\n| --- | --- | --- | ${types.map(() => "---").join(" | ")} |\n`;
  for (const m of modes) {
    md += `| ${m} | ${(avg(agg[m].r5) * 100).toFixed(1)}% | ${avg(agg[m].mrr).toFixed(3)} | ${types.map((t) => ((avg(agg[m].byType[t] || []) * 100).toFixed(1) + "%")).join(" | ")} |\n`;
  }
  fs.writeFileSync(`evals/reports/${date}-${sha}-modes.md`, md);
  console.log(md);
}
main();
