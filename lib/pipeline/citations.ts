import type { GenerationResult } from "./generate";
import type { SearchResult } from "./search";
import { docOf, type DocInfo } from "./documents";

export interface Citation {
  n: number;
  chunk_id: string;
  slug: string;
  document: string;
  edition: string;
  authority: string;
  clause_ref: string;
  page: number;
  quote: string;
}

const QUOTE_MAX = 1200;

export function buildCitations(
  gen: GenerationResult,
  context: SearchResult[],
  docs: Map<string, DocInfo>,
): { citations: Citation[]; answer_md: string } {
  const order: string[] = [];
  for (const claim of gen.claims) {
    for (const id of claim.chunk_ids) if (!order.includes(id)) order.push(id);
  }
  const numberOf = new Map(order.map((id, i) => [id, i + 1]));

  const citations = order.map((id, i) => {
    const chunk = context.find((c) => c.chunk_id === id);
    const doc = docOf(docs, chunk?.document_id ?? "");
    return {
      n: i + 1,
      chunk_id: id,
      slug: doc.slug,
      document: doc.title,
      edition: doc.edition,
      authority: doc.authority,
      clause_ref: chunk?.clause_ref ?? "",
      page: chunk?.page_start ?? 0,
      quote: (chunk?.content ?? "").slice(0, QUOTE_MAX),
    };
  });

  // The model marks sentences with the claim number; show clause numbers instead.
  const answer_md = gen.answer_md.replace(/\[(\d+)\]/g, (whole, d: string) => {
    const claim = gen.claims[parseInt(d, 10) - 1];
    if (!claim) return whole;
    const nums = [...new Set(claim.chunk_ids.map((id) => numberOf.get(id)))].filter(
      (n): n is number => n !== undefined,
    );
    return nums.map((n) => `[${n}]`).join("");
  });

  // A run of markers such as [1][2][3][2] shows each citation once, in order of first appearance.
  const tidy = answer_md.replace(/(?:\[\d+\])+/g, (run) => [...new Set(run.match(/\[\d+\]/g) ?? [])].join(""));
  return { citations, answer_md: tidy };
}

// Closest clauses shown with an abstain (spec F4). They are retrieval results, not claims: the UI labels them as
// "may not answer your question".
export function nearestClauses(results: SearchResult[], docs: Map<string, DocInfo>, n = 3): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const r of results) {
    if (seen.has(r.chunk_id)) continue;
    seen.add(r.chunk_id);
    const doc = docOf(docs, r.document_id);
    out.push({
      n: out.length + 1,
      chunk_id: r.chunk_id,
      slug: doc.slug,
      document: doc.title,
      edition: doc.edition,
      authority: doc.authority,
      clause_ref: r.clause_ref,
      page: r.page_start,
      quote: r.content.slice(0, QUOTE_MAX),
    });
    if (out.length >= n) break;
  }
  return out;
}
