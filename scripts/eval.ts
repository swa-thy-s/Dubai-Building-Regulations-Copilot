#!/usr/bin/env tsx
/**
 * Retrieval-only eval runner.
 * Usage: pnpm eval --tag baseline [--retrieval-only] [--only <type>]
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { hybridSearch, type SearchResult } from "../lib/pipeline/search";
import { runPipeline } from "../lib/pipeline/pipeline";
import { scoreRetrieval, mustIncludeHit, qualify } from "./eval-metrics";
import { getDocuments, docOf } from "../lib/pipeline/documents";

interface GoldenQuestion {
  id: string;
  question: string;
  type: string;
  authority: string;
  gold_chunks: string[];
  gold_answer: string;
  must_include: string[];
  should_abstain: boolean;
  notes: string;
}

function parseGolden(filePath: string): GoldenQuestion[] {
  return fs
    .readFileSync(filePath, "utf-8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

function parseArgs() {
  const args = process.argv.slice(2);
  let tag = "unnamed";
  let retrievalOnly = false;
  let onlyType: string | null = null;
  let checkBaseline = false;
  let noDb = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tag" && args[i + 1]) tag = args[++i];
    else if (args[i] === "--retrieval-only") retrievalOnly = true;
    else if (args[i] === "--only" && args[i + 1]) onlyType = args[++i];
    else if (args[i] === "--check-baseline") checkBaseline = true;
    else if (args[i] === "--no-db") noDb = true;
  }
  return { tag, retrievalOnly, onlyType, checkBaseline, noDb };
}

interface QuestionResult {
  id: string;
  question: string;
  type: string;
  should_abstain: boolean;
  gold_chunks: string[];
  retrieved_refs: string[];
  retrieved_top5_refs: string[];
  recall_at_5: number;
  recall_at_k: number;
  mrr: number;
  best_similarity: number;
  would_abstain: boolean;
  latency_ms: number;
  full?: {
    abstained: boolean;
    abstain_reason: string | null;
    answer_md: string;
    n_citations: number;
    must_include_hit: number | null;
    latency_ms: number;
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms)),
  ]);
}

async function evalQuestion(
  q: GoldenQuestion,
  k: number,
  gate: number,
): Promise<QuestionResult> {
  const start = Date.now();
  let results: SearchResult[];
  try {
    results = await withTimeout(hybridSearch(q.question, {
      authorities: q.authority === "Trakhees" ? ["Trakhees"] : undefined,
    }), 60_000);
  } catch (e) {
    console.error(`  ✗ ${q.id}: search failed: ${e}`);
    return {
      id: q.id,
      question: q.question,
      type: q.type,
      should_abstain: q.should_abstain,
      gold_chunks: q.gold_chunks,
      retrieved_refs: [],
      retrieved_top5_refs: [],
      recall_at_5: 0,
      recall_at_k: 0,
      mrr: 0,
      best_similarity: 0,
      would_abstain: true,
      latency_ms: Date.now() - start,
    };
  }
  const latency = Date.now() - start;

  const docs = await getDocuments();
  const retrievedRefs = results.map((r) => qualify(docOf(docs, r.document_id).slug, r.clause_ref));
  const top5Refs = retrievedRefs.slice(0, 5);

  const { recallAt5, recallAtK, mrr } = scoreRetrieval(q.gold_chunks, retrievedRefs, k);

  const bestSim = results[0]?.similarity ?? 0;
  const topFtsInTop5 = results
    .slice(0, 5)
    .some((r) => r.text_rank !== null && r.text_rank <= 5);
  const wouldAbstain = bestSim < gate && !topFtsInTop5;

  return {
    id: q.id,
    question: q.question,
    type: q.type,
    should_abstain: q.should_abstain,
    gold_chunks: q.gold_chunks,
    retrieved_refs: retrievedRefs.slice(0, 10),
    retrieved_top5_refs: top5Refs,
    recall_at_5: recallAt5,
    recall_at_k: recallAtK,
    mrr,
    best_similarity: bestSim,
    would_abstain: wouldAbstain,
    latency_ms: latency,
  };
}

async function main() {
  const { tag, onlyType, retrievalOnly, checkBaseline, noDb } = parseArgs();
  const goldenPath = path.resolve("evals/golden.jsonl");
  let questions = parseGolden(goldenPath);

  if (onlyType) {
    questions = questions.filter((q) => q.type === onlyType);
  }

  const k = parseInt(process.env.K_CONTEXT || "6", 10);
  const gate = parseFloat(process.env.GATE_THRESHOLD || "0.64");

  console.log(`\nEval run: tag=${tag}, questions=${questions.length}, K=${k}, gate=${gate}\n`);

  const results: QuestionResult[] = [];
  for (const q of questions) {
    process.stdout.write(`  ${q.id} ${q.question.slice(0, 60)}...`);
    const r = await evalQuestion(q, k, gate);
    if (!retrievalOnly) {
      const t0 = Date.now();
      try {
        const p = await withTimeout(
          runPipeline(q.question, q.authority === "Trakhees" ? ["Trakhees"] : undefined, "eval"),
          180_000,
        );
        r.full = {
          abstained: p.abstained,
          abstain_reason: p.abstain_reason,
          answer_md: p.answer_md,
          n_citations: p.citations.length,
          must_include_hit: mustIncludeHit(q.must_include, p.answer_md),
          latency_ms: Date.now() - t0,
        };
      } catch (e) {
        r.full = { abstained: true, abstain_reason: `error: ${e}`, answer_md: "", n_citations: 0, must_include_hit: null, latency_ms: Date.now() - t0 };
      }
      r.would_abstain = r.full.abstained;
      await new Promise((res) => setTimeout(res, parseInt(process.env.EVAL_DELAY_MS || "500", 10)));
    }
    const status = q.should_abstain
      ? r.would_abstain
        ? "✓ abstain"
        : "✗ should abstain"
      : r.recall_at_5 > 0
        ? `✓ R@5=${r.recall_at_5.toFixed(2)}`
        : `✗ miss`;
    console.log(` ${status} (${r.latency_ms}ms)`);
    results.push(r);

    // Rate-limit: 200ms between requests to avoid Gemini quota
    await new Promise((res) => setTimeout(res, 200));
  }

  // Compute aggregate metrics
  const answerable = results.filter((r) => !r.should_abstain);
  const abstainable = results.filter((r) => r.should_abstain);

  const avgRecall5 =
    answerable.length > 0
      ? answerable.reduce((s, r) => s + r.recall_at_5, 0) / answerable.length
      : 0;
  const avgRecallK =
    answerable.length > 0
      ? answerable.reduce((s, r) => s + r.recall_at_k, 0) / answerable.length
      : 0;
  const avgMRR =
    answerable.length > 0
      ? answerable.reduce((s, r) => s + r.mrr, 0) / answerable.length
      : 0;
  const abstainPrecision =
    abstainable.length > 0
      ? abstainable.filter((r) => r.would_abstain).length / abstainable.length
      : 1;
  const overRefusal =
    answerable.length > 0
      ? answerable.filter((r) => r.would_abstain).length / answerable.length
      : 0;
  const avgLatency =
    results.reduce((s, r) => s + r.latency_ms, 0) / results.length;

  const fullRows = results.filter((r) => r.full);
  const answeredRows = answerable.filter((r) => r.full && !r.full.abstained);
  const withMust = answeredRows.filter((r) => r.full!.must_include_hit !== null);
  const answerAccuracy =
    answerable.length > 0 && fullRows.length
      ? answerable.filter((r) => r.full && r.full.must_include_hit === 1).length / answerable.length
      : null;
  const lat = fullRows.map((r) => r.full!.latency_ms).sort((a, b) => a - b);
  const p95 = lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : null;
  const verifyAbstains = fullRows.filter((r) => r.full!.abstain_reason === "verify").length;
  const genErrors = fullRows.filter((r) => (r.full!.abstain_reason ?? "").startsWith("generation_error") || (r.full!.abstain_reason ?? "").startsWith("error")).length;
  void withMust;

  // Get git SHA
  let gitSha = "unknown";
  try {
    const { execSync } = await import("child_process");
    gitSha = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {}

  const metrics = {
    recall_at_5: avgRecall5,
    recall_at_k: avgRecallK,
    mrr: avgMRR,
    abstain_precision: abstainPrecision,
    over_refusal: overRefusal,
    avg_latency_ms: avgLatency,
    ...(fullRows.length
      ? { answer_accuracy: answerAccuracy, p95_latency_ms: p95, verify_abstains: verifyAbstains, generation_errors: genErrors }
      : {}),
  };

  console.log("\n=== Metrics ===");
  console.log(`  Recall@5:          ${(avgRecall5 * 100).toFixed(1)}%  (target ≥85%)`);
  console.log(`  Recall@K(${k}):      ${(avgRecallK * 100).toFixed(1)}%`);
  console.log(`  MRR:               ${avgMRR.toFixed(3)}`);
  console.log(`  Abstain precision: ${(abstainPrecision * 100).toFixed(1)}%  (target ≥90%)`);
  console.log(`  Over-refusal:      ${(overRefusal * 100).toFixed(1)}%  (target ≤10%)`);
  console.log(`  Avg latency:       ${avgLatency.toFixed(0)}ms`);
  if (fullRows.length) {
    console.log(`  Answer accuracy:   ${((answerAccuracy ?? 0) * 100).toFixed(1)}%  (target ≥85%)`);
    console.log(`  p95 latency:       ${p95}ms  (target <8000ms)`);
    console.log(`  Verify abstains:   ${verifyAbstains}   Generation errors: ${genErrors}`);
  }

  // Write report
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const reportName = `${date}-${gitSha}-${tag}.md`;
  const reportDir = path.resolve("evals/reports");
  fs.mkdirSync(reportDir, { recursive: true });

  let report = `# Eval report: ${tag}\n\n`;
  report += `- **Date:** ${now.toISOString()}\n`;
  report += `- **Git SHA:** ${gitSha}\n`;
  report += `- **Questions:** ${questions.length} (${answerable.length} answerable, ${abstainable.length} should-abstain)\n`;
  report += `- **Config:** K=${k}, gate=${gate}, ${retrievalOnly ? "retrieval-only" : "full pipeline"}\n\n`;

  report += `## Metrics\n\n`;
  report += `| Metric | Value | Target |\n`;
  report += `| --- | --- | --- |\n`;
  report += `| Recall@5 | ${(avgRecall5 * 100).toFixed(1)}% | ≥85% |\n`;
  report += `| Recall@K(${k}) | ${(avgRecallK * 100).toFixed(1)}% | — |\n`;
  report += `| MRR | ${avgMRR.toFixed(3)} | Track |\n`;
  report += `| Abstain precision | ${(abstainPrecision * 100).toFixed(1)}% | ≥90% |\n`;
  report += `| Over-refusal | ${(overRefusal * 100).toFixed(1)}% | ≤10% |\n`;
  report += `| Avg latency | ${avgLatency.toFixed(0)}ms | — |\n`;
  if (fullRows.length) {
    report += `| Answer accuracy (must_include) | ${((answerAccuracy ?? 0) * 100).toFixed(1)}% | ≥85% |\n`;
    report += `| p95 pipeline latency | ${p95}ms | <8000ms |\n`;
    report += `| Verify abstains / generation errors | ${verifyAbstains} / ${genErrors} | — |\n`;
  }
  report += `\n`;
  if (fullRows.length) {
    const bad = answerable.filter((r) => r.full && (r.full.abstained || r.full.must_include_hit !== 1));
    report += `## Answer failures\n\n`;
    if (!bad.length) report += `None.\n\n`;
    else {
      report += `| ID | Abstained | Reason | must_include hit | Answer |\n| --- | --- | --- | --- | --- |\n`;
      for (const r of bad) report += `| ${r.id} | ${r.full!.abstained} | ${r.full!.abstain_reason ?? ""} | ${r.full!.must_include_hit ?? "n/a"} | ${r.full!.answer_md.replace(/\|/g, "/").replace(/\n/g, " ").slice(0, 160)} |\n`;
      report += `\n`;
    }
  }

  report += `## Failures\n\n`;
  const failures = answerable.filter((r) => r.recall_at_5 === 0);
  if (failures.length === 0) {
    report += `None — all answerable questions had at least one gold chunk in top 5.\n\n`;
  } else {
    report += `| ID | Question | Gold | Top 5 retrieved |\n`;
    report += `| --- | --- | --- | --- |\n`;
    for (const f of failures) {
      report += `| ${f.id} | ${f.question.slice(0, 50)} | ${f.gold_chunks.join(", ")} | ${f.retrieved_top5_refs.join(", ")} |\n`;
    }
    report += `\n`;
  }

  report += `## All results\n\n`;
  report += `| ID | Type | R@5 | MRR | Sim | Abstain? | Gold | Top 5 |\n`;
  report += `| --- | --- | --- | --- | --- | --- | --- | --- |\n`;
  for (const r of results) {
    report += `| ${r.id} | ${r.type} | ${r.recall_at_5.toFixed(2)} | ${r.mrr.toFixed(2)} | ${r.best_similarity.toFixed(3)} | ${r.would_abstain ? "yes" : "no"} | ${r.gold_chunks.join(", ")} | ${r.retrieved_top5_refs.join(", ")} |\n`;
  }

  const reportPath = path.join(reportDir, reportName);
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport written: ${reportPath}`);

  // Write to Supabase eval tables
  if (!noDb) try {
    const sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: run, error: runErr } = await sb
      .from("eval_runs")
      .insert({
        git_sha: gitSha,
        tag,
        config: { k, gate, mode: retrievalOnly ? "retrieval-only" : "full" },
        metrics,
      })
      .select("id")
      .single();

    if (runErr) {
      console.error(`Warning: could not write eval_runs: ${runErr.message}`);
    } else if (run) {
      const rows = results.map((r) => ({
        run_id: run.id,
        question_id: r.id,
        retrieved: {
          refs: r.retrieved_refs,
          top5: r.retrieved_top5_refs,
          best_sim: r.best_similarity,
        },
        answer: r.full ? { abstained: r.full.abstained, reason: r.full.abstain_reason, answer_md: r.full.answer_md } : null,
        scores: {
          recall_at_5: r.recall_at_5,
          recall_at_k: r.recall_at_k,
          mrr: r.mrr,
          would_abstain: r.would_abstain,
        },
      }));

      const { error: resErr } = await sb.from("eval_results").insert(rows);
      if (resErr) {
        console.error(`Warning: could not write eval_results: ${resErr.message}`);
      } else {
        console.log(`Eval results written to Supabase (run_id: ${run.id})`);
      }
    }
  } catch (e) {
    console.error(`Warning: Supabase write failed: ${e}`);
  }

  if (checkBaseline) {
    const basePath = path.resolve("evals/baseline.json");
    const base = JSON.parse(fs.readFileSync(basePath, "utf-8"));
    const drop = base.recall_at_5 - avgRecall5;
    console.log(`\nBaseline check: recall@5 ${(avgRecall5 * 100).toFixed(1)}% vs baseline ${(base.recall_at_5 * 100).toFixed(1)}%`);
    if (drop > 0.05) {
      console.error(`FAIL: recall@5 dropped ${(drop * 100).toFixed(1)} points (limit 5).`);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
