import type { GenerationResult } from "./generate";
import type { SearchResult } from "./search";

export interface Citation {
  n: number;
  chunk_id: string;
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
): { citations: Citation[]; answer_md: string } {
  const order: string[] = [];
  for (const claim of gen.claims) {
    for (const id of claim.chunk_ids) if (!order.includes(id)) order.push(id);
  }
  const numberOf = new Map(order.map((id, i) => [id, i + 1]));

  const citations = order.map((id, i) => {
    const chunk = context.find((c) => c.chunk_id === id);
    return {
      n: i + 1,
      chunk_id: id,
      document: "Dubai Building Code",
      edition: "2021",
      authority: "DM",
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

  return { citations, answer_md };
}
