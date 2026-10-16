#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env.local" });

import * as fs from "fs";
import { hybridSearch } from "../lib/pipeline/search";

const PROBES = [
  "What are the current mortgage interest rates in Dubai?",
  "How do I apply for a golden visa?",
  "What is the fire resistance rating for a steel beam?",
  "How much does a building permit cost?",
  "What is the best paint colour for a villa exterior?",
  "Who won the football world cup?",
  "What are the UAE labour law rules on overtime?",
  "How long does a trade licence take to renew?",
  "What is the recipe for machboos?",
  "Rules for building something",
  "What is the minimum ceiling height?",
  "Is my design compliant?",
  "What are Trakhees requirements for warehouses in JAFZA?",
  "What is the speed limit on Sheikh Zayed Road?",
  "Explain how to calculate rent increases for tenants",
];

async function main() {
  const golden = fs
    .readFileSync("evals/golden.jsonl", "utf-8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  const items = [
    ...golden.map((g) => ({ id: g.id, q: g.question, label: g.should_abstain ? "abstain" : "answer" })),
    ...PROBES.map((q, i) => ({ id: `p-${i + 1}`, q, label: "abstain" })),
  ];
  const rows: unknown[] = [];
  for (const it of items) {
    const r = await hybridSearch(it.q);
    const top5 = r.slice(0, 5);
    rows.push({
      id: it.id,
      label: it.label,
      q: it.q,
      topSim: r[0]?.similarity ?? 0,
      maxSim: Math.max(0, ...r.map((x) => x.similarity)),
      fts: top5.some((x) => x.text_rank !== null && x.text_rank <= 5),
      ftsBestRank: Math.min(99, ...top5.map((x) => x.text_rank ?? 99)),
    });
    await new Promise((res) => setTimeout(res, 200));
  }
  fs.writeFileSync(process.argv[2] || "gate-sweep.json", JSON.stringify(rows, null, 1));
}
main();
