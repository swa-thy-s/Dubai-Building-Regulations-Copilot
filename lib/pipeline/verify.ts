import type { GenerationResult } from "./generate";
import type { SearchResult } from "./search";

export interface VerifyResult {
  passed: boolean;
  failures: string[];
}

const NUMBER_WITH_UNIT =
  /\d[\d,]*\.?\d*\s*(?:mm|cm|m²|m2|m|%|minutes?|persons?|workers?|storeys?|floors?|°|degrees?|kPa|kg|kN|hours?|h\b|days?)/gi;

const MARKER_RE = /\[(\d+)\]/g;

export function verify(
  gen: GenerationResult,
  chunks: SearchResult[],
): VerifyResult {
  const failures: string[] = [];
  const chunkIds = new Set(chunks.map((c) => c.chunk_id));
  const chunkTexts = new Map(chunks.map((c) => [c.chunk_id, c.content]));

  // 1. Every chunk_id in claims exists in the retrieved set
  for (const claim of gen.claims) {
    for (const cid of claim.chunk_ids) {
      if (!chunkIds.has(cid)) {
        failures.push(`Cited chunk_id "${cid}" not in retrieved set`);
      }
    }
  }

  // 2. Every number+unit in answer_md appears in at least one cited chunk
  const numbers = gen.answer_md.match(NUMBER_WITH_UNIT) ?? [];
  for (const numStr of numbers) {
    const normalized = numStr.replace(/,/g, "").replace(/\s+/g, " ").trim();
    const citedChunkIds = gen.claims.flatMap((c) => c.chunk_ids);
    const foundInChunk = citedChunkIds.some((cid) => {
      const text = chunkTexts.get(cid);
      if (!text) return false;
      const normalizedText = text.replace(/,/g, "").replace(/\s+/g, " ");
      return normalizedText.includes(normalized.replace(/\s+/g, " "));
    });
    if (!foundInChunk) {
      // Also check without commas in the number
      const numOnly = normalized.replace(/[^\d.]/g, "");
      const anyChunkHasNum = citedChunkIds.some((cid) => {
        const text = chunkTexts.get(cid) ?? "";
        return text.includes(numOnly);
      });
      if (!anyChunkHasNum) {
        failures.push(
          `Number "${numStr.trim()}" in answer not found in any cited chunk`,
        );
      }
    }
  }

  // 3. Every [n] marker maps to a citation
  const markers = [...gen.answer_md.matchAll(MARKER_RE)].map((m) =>
    parseInt(m[1]),
  );
  for (const n of markers) {
    if (n < 1 || n > gen.claims.length) {
      failures.push(`Marker [${n}] has no corresponding claim`);
    }
  }

  return { passed: failures.length === 0, failures };
}
