import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { prepareQuery } from "./query-prep";
import { hybridSearch, type SearchResult } from "./search";
import { checkGate } from "./gate";
import { generate, type GenerationResult } from "./generate";
import { verify } from "./verify";
import { llmModel } from "./llm";
import { buildCitations, nearestClauses, type Citation } from "./citations";
import { getDocuments } from "./documents";

export type { Citation };

let sb: SupabaseClient | null = null;
function getSb(): SupabaseClient {
  if (sb) return sb;
  sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return sb;
}

export interface PipelineResult {
  trace_id: string;
  abstained: boolean;
  abstain_reason: string | null;
  answer_md: string;
  conditions: string[];
  citations: Citation[];
  nearest?: Citation[];
}

export interface PipelineProgress {
  stage: string;
}

export async function runPipeline(
  question: string,
  authorities: string[] | undefined,
  ipHash: string,
  onProgress?: (p: PipelineProgress) => void,
): Promise<PipelineResult> {
  const start = Date.now();
  const gate = parseFloat(process.env.GATE_THRESHOLD || "0.64");
  const k = parseInt(process.env.K_CONTEXT || "6", 10);
  const model = llmModel();

  // Query prep is opt-in: on the golden set it did not improve retrieval and added seconds of latency.
  let searchQuery = question;
  if (process.env.QUERY_PREP === "on") {
    onProgress?.({ stage: "Rewriting query" });
    searchQuery = (await prepareQuery(question)).search_query || question;
  }

  // Search
  onProgress?.({ stage: "Searching clauses" });
  let results: SearchResult[];
  try {
    results = await hybridSearch(searchQuery, {
      matchCount: 20,
      authorities: authorities?.length ? authorities : undefined,
    });
  } catch (e) {
    // Embedding quota or a temporary outage must read as "at capacity", not as a crash or a false "not found".
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pipeline] search failed:", msg);
    const status = (e as { status?: number }).status;
    const capacity = status === 429 || status === 503 || /\b(429|503|RESOURCE_EXHAUSTED|UNAVAILABLE)\b/.test(msg);
    const traceId = await logQuery({
      question,
      rewrittenQuery: searchQuery,
      retrieved: [],
      answer: null,
      abstained: true,
      abstainReason: `search_error: ${msg.slice(0, 200)}`,
      verifyPassed: null,
      latencyMs: Date.now() - start,
      model,
      ipHash,
    });
    return {
      trace_id: traceId,
      abstained: true,
      abstain_reason: capacity ? "capacity" : "generation_error",
      answer_md: "",
      conditions: [],
      citations: [],
    };
  }

  const docs = await getDocuments();

  // Gate
  const gateResult = checkGate(results, gate);
  if (!gateResult.passed) {
    const traceId = await logQuery({
      question,
      rewrittenQuery: searchQuery,
      retrieved: results.slice(0, k),
      answer: null,
      abstained: true,
      abstainReason: "gate",
      verifyPassed: null,
      latencyMs: Date.now() - start,
      model,
      ipHash,
    });
    return {
      trace_id: traceId,
      abstained: true,
      abstain_reason: "gate",
      answer_md: "",
      conditions: [],
      citations: [],
      nearest: nearestClauses(results, docs),
    };
  }

  const context = results.slice(0, k);

  // Generate
  onProgress?.({ stage: "Generating answer" });
  let gen: GenerationResult;
  try {
    gen = await generate(question, context, docs);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error("[pipeline] generation failed:", errMsg);
    const status = (e as { status?: number }).status;
    const capacity = status === 429 || status === 503 || /\b(429|503)\b/.test(errMsg);
    const traceId = await logQuery({
      question,
      rewrittenQuery: searchQuery,
      retrieved: context,
      answer: null,
      abstained: true,
      abstainReason: `generation_error: ${errMsg}`,
      verifyPassed: null,
      latencyMs: Date.now() - start,
      model,
      ipHash,
    });
    return {
      trace_id: traceId,
      abstained: true,
      abstain_reason: capacity ? "capacity" : "generation_error",
      answer_md: "",
      conditions: [],
      citations: [],
    };
  }

  // Model-side abstain
  if (gen.abstain) {
    const traceId = await logQuery({
      question,
      rewrittenQuery: searchQuery,
      retrieved: context,
      answer: gen,
      abstained: true,
      abstainReason: "model",
      verifyPassed: null,
      latencyMs: Date.now() - start,
      model,
      ipHash,
    });
    return {
      trace_id: traceId,
      abstained: true,
      abstain_reason: "model",
      answer_md: "",
      conditions: [],
      citations: [],
      nearest: nearestClauses(results, docs),
    };
  }

  // Verify
  onProgress?.({ stage: "Checking citations" });
  let verifyResult = verify(gen, context);

  if (!verifyResult.passed) {
    // Retry once with feedback
    onProgress?.({ stage: "Fixing citations" });
    try {
      gen = await generate(question, context, docs, verifyResult.failures.join("\n"));
      verifyResult = verify(gen, context);
    } catch {
      // If retry fails, abstain
    }
  }

  if (!verifyResult.passed) {
    const traceId = await logQuery({
      question,
      rewrittenQuery: searchQuery,
      retrieved: context,
      answer: gen,
      abstained: true,
      abstainReason: "verify",
      verifyPassed: false,
      latencyMs: Date.now() - start,
      model,
      ipHash,
    });
    return {
      trace_id: traceId,
      abstained: true,
      abstain_reason: "verify",
      answer_md: "",
      conditions: [],
      citations: [],
      nearest: nearestClauses(results, docs),
    };
  }

  const { citations, answer_md } = buildCitations(gen, context, docs);

  const traceId = await logQuery({
    question,
    rewrittenQuery: searchQuery,
    retrieved: context,
    answer: gen,
    abstained: false,
    abstainReason: null,
    verifyPassed: true,
    latencyMs: Date.now() - start,
    model,
    ipHash,
  });

  return {
    trace_id: traceId,
    abstained: false,
    abstain_reason: null,
    answer_md,
    conditions: gen.conditions,
    citations,
  };
}

interface LogParams {
  question: string;
  rewrittenQuery: string;
  retrieved: SearchResult[];
  answer: GenerationResult | null;
  abstained: boolean;
  abstainReason: string | null;
  verifyPassed: boolean | null;
  latencyMs: number;
  model: string;
  ipHash: string;
}

async function logQuery(p: LogParams): Promise<string> {
  try {
    const { data, error } = await getSb()
      .from("query_logs")
      .insert({
        question: p.question,
        rewritten_query: p.rewrittenQuery,
        retrieved: p.retrieved.map((r) => ({
          chunk_id: r.chunk_id,
          clause_ref: r.clause_ref,
          rrf_score: r.rrf_score,
          similarity: r.similarity,
        })),
        answer: p.answer,
        abstained: p.abstained,
        abstain_reason: p.abstainReason,
        verify_passed: p.verifyPassed,
        latency_ms: p.latencyMs,
        model: p.model,
        ip_hash: p.ipHash,
      })
      .select("id")
      .single();
    if (error) {
      console.error("Failed to log query:", error.message);
      return "log-failed";
    }
    return data.id;
  } catch (e) {
    console.error("Failed to log query:", e);
    return "log-failed";
  }
}
