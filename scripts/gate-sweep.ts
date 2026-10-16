#!/usr/bin/env tsx
// Gate threshold sweep: best-similarity and full-text signals for every golden question plus extra out-of-scope
// probes, then a report with abstain precision / over-refusal per threshold and a recommendation.
import { config } from "dotenv";
config({ path: ".env.local" });

import * as fs from "fs";
import { execSync } from "child_process";
import { hybridSearch } from "../lib/pipeline/search";

const PROBES = [
  "How do I apply for a golden visa?",
  "Who won the football world cup?",
  "What is the recipe for machboos?",
  "What is the speed limit on Sheikh Zayed Road?",
  "What is the best paint colour for a villa exterior?",
  "What are the UAE labour law rules on overtime?",
  "How long does a trade licence take to renew?",
  "What is the best insulation material for a villa roof?",
  "Can you check whether my floor plan complies?",
  "Rules for building something",
  "How do I cook rice?",
  "What is the weather in Dubai in July?",
];

interface Row { id: string; label: "abstain" | "answer"; q: string; topSim: number; fts: boolean }

export function evaluateThreshold(rows: Row[], t: number) {
  const gated = (r: Row) => r.topSim < t && !r.fts;
  const ab = rows.filter((r) => r.label === "abstain");
  const an = rows.filter((r) => r.label === "answer");
  return {
    t,
    abstainPrecision: ab.length ? ab.filter(gated).length / ab.length : 1,
    overRefusal: an.length ? an.filter(gated).length / an.length : 0,
  };
}

export function recommend(rows: Row[]): number {
  let best = { t: 0.68, score: -1 };
  for (let t = 0.5; t <= 0.85; t += 0.01) {
    const e = evaluateThreshold(rows, Math.round(t * 100) / 100);
    if (e.overRefusal > 0.05) continue;
    // prefer high abstain precision, then the lowest threshold that achieves it (fewer false refusals on unseen questions)
    const score = e.abstainPrecision - e.t * 0.01;
    if (score > best.score) best = { t: e.t, score };
  }
  return best.t;
}

async function main() {
  const golden = fs.readFileSync("evals/golden.jsonl", "utf-8").trim().split("\n").map((l) => JSON.parse(l));
  const items = [
    ...golden.map((g) => ({ id: g.id, q: g.question, label: g.should_abstain ? "abstain" : "answer", auth: g.authority })),
    ...PROBES.map((q, i) => ({ id: `p-${i + 1}`, q, label: "abstain", auth: "DM" })),
  ] as { id: string; q: string; label: "abstain" | "answer"; auth: string }[];
  const rows: Row[] = [];
  for (const it of items) {
    const r = await hybridSearch(it.q, { authorities: it.auth === "Trakhees" ? ["Trakhees"] : undefined });
    rows.push({ id: it.id, label: it.label, q: it.q, topSim: r[0]?.similarity ?? 0, fts: r.slice(0, 5).some((x) => x.text_rank !== null && x.text_rank <= 5) });
    await new Promise((res) => setTimeout(res, 200));
  }
  const sha = execSync("git rev-parse --short HEAD").toString().trim();
  const date = new Date().toISOString().slice(0, 10);
  const noFts = (l: string) => rows.filter((r) => r.label === l && !r.fts).map((r) => r.topSim).sort((a, b) => a - b);
  const an = noFts("answer"), ab = noFts("abstain");
  const rec = recommend(rows);
  let md = `# Gate sweep (${date}, ${sha})\n\n- Questions: ${rows.filter((r) => r.label === "answer").length} answerable, ${rows.filter((r) => r.label === "abstain").length} should-abstain (golden + ${PROBES.length} probes)\n`;
  md += `- Answerable without a full-text hit: min similarity ${an[0]?.toFixed(3)}, median ${an[Math.floor(an.length / 2)]?.toFixed(3)}\n`;
  md += `- Abstain without a full-text hit: max similarity ${ab[ab.length - 1]?.toFixed(3)}, median ${ab[Math.floor(ab.length / 2)]?.toFixed(3)}\n`;
  md += `- **Recommended threshold: ${rec}** (highest abstain precision with over-refusal at most 5%, preferring the lower threshold). Current: ${process.env.GATE_THRESHOLD}\n\n`;
  md += `| Threshold | Abstain precision | Over-refusal |\n| --- | --- | --- |\n`;
  for (let t = 0.55; t <= 0.8001; t += 0.02) {
    const e = evaluateThreshold(rows, Math.round(t * 100) / 100);
    md += `| ${e.t.toFixed(2)} | ${(e.abstainPrecision * 100).toFixed(1)}% | ${(e.overRefusal * 100).toFixed(1)}% |\n`;
  }
  md += `\n## Items closest to the recommended threshold\n\n| Label | ID | Similarity | Full-text hit | Question |\n| --- | --- | --- | --- | --- |\n`;
  for (const r of [...rows].sort((a, b) => Math.abs(a.topSim - rec) - Math.abs(b.topSim - rec)).slice(0, 15)) {
    md += `| ${r.label} | ${r.id} | ${r.topSim.toFixed(3)} | ${r.fts ? "yes" : "no"} | ${r.q.slice(0, 70)} |\n`;
  }
  fs.mkdirSync("evals/reports", { recursive: true });
  const out = `evals/reports/${date}-${sha}-gate-sweep.md`;
  fs.writeFileSync(out, md);
  console.log(md);
  console.log("written", out);
}
if (process.argv[1]?.endsWith("gate-sweep.ts")) main();
