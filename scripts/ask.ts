#!/usr/bin/env tsx
/**
 * CLI to test hybrid search: `pnpm ask "minimum corridor width"`
 * Loads .env.local, embeds the question, calls hybrid_search, prints results.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { hybridSearch } from "../lib/pipeline/search";

async function main() {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    console.error("Usage: pnpm ask <question>");
    process.exit(1);
  }

  console.log(`\nQuery: ${question}\n`);
  const results = await hybridSearch(question);

  const k = parseInt(process.env.K_CONTEXT || "6", 10);
  const gate = parseFloat(process.env.GATE_THRESHOLD || "0.64");
  const bestSim = results[0]?.similarity ?? 0;
  const topFtsInTop5 = results
    .slice(0, 5)
    .some((r) => r.text_rank !== null && r.text_rank <= 5);

  if (bestSim < gate && !topFtsInTop5) {
    console.log(
      `⚠ GATE: best similarity ${bestSim.toFixed(3)} < ${gate}, no FTS hit in top 5. Would abstain.\n`,
    );
  }

  console.log(
    `${"#".padEnd(3)} ${"Score".padEnd(8)} ${"Sim".padEnd(8)} ${"VRank".padEnd(7)} ${"TRank".padEnd(7)} ${"Ref".padEnd(30)} Page`,
  );
  console.log("-".repeat(80));

  for (let i = 0; i < Math.min(results.length, 20); i++) {
    const r = results[i];
    const marker = i < k ? "→" : " ";
    console.log(
      `${marker}${String(i + 1).padEnd(2)} ${r.rrf_score.toFixed(4).padEnd(8)} ${(r.similarity?.toFixed(3) ?? "—").padEnd(8)} ${String(r.vector_rank ?? "—").padEnd(7)} ${String(r.text_rank ?? "—").padEnd(7)} ${r.clause_ref.padEnd(30)} ${r.page_start}`,
    );
  }

  console.log(`\n--- Top ${k} context chunks ---\n`);
  for (let i = 0; i < Math.min(k, results.length); i++) {
    const r = results[i];
    console.log(`[${r.clause_ref}] (p${r.page_start}, sim=${r.similarity?.toFixed(3)})`);
    console.log(r.content.slice(0, 300));
    console.log("...\n");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
