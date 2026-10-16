import type { SearchResult } from "./search";

export interface GateResult {
  passed: boolean;
  reason?: string;
  bestSimilarity: number;
}

export function checkGate(
  results: SearchResult[],
  threshold: number,
): GateResult {
  const bestSim = results[0]?.similarity ?? 0;
  const topFtsInTop5 = results
    .slice(0, 5)
    .some((r) => r.text_rank !== null && r.text_rank <= 5);

  if (bestSim < threshold && !topFtsInTop5) {
    return { passed: false, reason: "gate", bestSimilarity: bestSim };
  }
  return { passed: true, bestSimilarity: bestSim };
}
