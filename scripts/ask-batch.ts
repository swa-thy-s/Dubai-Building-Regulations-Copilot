#!/usr/bin/env tsx
// Run scenario questions straight through the pipeline (no HTTP, no per-visitor rate limit; logged as ip "eval").
// Usage: pnpm exec tsx scripts/ask-batch.ts [evals/scenarios.json] [out.md]
import { config } from "dotenv";
config({ path: ".env.local" });
import * as fs from "fs";
import { runPipeline } from "../lib/pipeline/pipeline";

async function main() {
  const file = process.argv[2] || "evals/scenarios.json";
  const out = process.argv[3] || "evals/reports/scenarios-latest.md";
  const items: { id: string; question: string }[] = JSON.parse(fs.readFileSync(file, "utf-8"));
  let md = `# Scenario run (${new Date().toISOString().slice(0, 16)})\n\nEach question is asked on its own: the app keeps no conversation memory, so follow-ups such as "your previous answer" have nothing to refer to.\n`;
  for (const it of items) {
    const t = Date.now();
    let r;
    try {
      r = await runPipeline(it.question, undefined, "eval");
    } catch (e) {
      md += `\n## ${it.id}\n\n**Q:** ${it.question}\n\n**ERROR:** ${e}\n`;
      continue;
    }
    const ms = Date.now() - t;
    const state = r.abstained ? `ABSTAINED (${r.abstain_reason})` : "ANSWERED";
    console.log(`${it.id.padEnd(5)} ${state.padEnd(24)} ${ms}ms  ${r.citations.length} citations`);
    md += `\n## ${it.id}  ${state}  (${ms} ms)\n\n**Q:** ${it.question}\n\n`;
    if (!r.abstained) {
      md += `**A:** ${r.answer_md}\n\n`;
      if (r.conditions.length) md += `Conditions: ${r.conditions.join(" | ")}\n\n`;
      md += `Sources: ${r.citations.map((c) => `[${c.n}] ${c.document} ${c.edition} ${c.clause_ref} p${c.page}`).join("; ")}\n`;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  fs.mkdirSync("evals/reports", { recursive: true });
  fs.writeFileSync(out, md);
  console.log("written", out);
}
main();
