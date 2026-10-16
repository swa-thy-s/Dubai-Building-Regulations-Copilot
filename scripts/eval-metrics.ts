export function chunkRefMatches(goldRef: string, retrievedRef: string): boolean {
  const parts = goldRef.split("#");
  if (parts.length !== 2) return false;
  const base = retrievedRef.replace(/\s*\(\d+\/\d+\)$/, "").trim();
  return base === parts[1];
}

export function scoreRetrieval(goldChunks: string[], retrievedRefs: string[], k: number) {
  const top5 = retrievedRefs.slice(0, 5);
  const topK = retrievedRefs.slice(0, k);
  let hitsAt5 = 0;
  let hitsAtK = 0;
  let firstRank = Infinity;
  for (const gold of goldChunks) {
    if (top5.some((r) => chunkRefMatches(gold, r))) hitsAt5++;
    if (topK.some((r) => chunkRefMatches(gold, r))) hitsAtK++;
    const idx = retrievedRefs.findIndex((r) => chunkRefMatches(gold, r));
    if (idx >= 0 && idx < firstRank) firstRank = idx;
  }
  const n = goldChunks.length || 1;
  return {
    recallAt5: hitsAt5 / n,
    recallAtK: hitsAtK / n,
    mrr: firstRank < Infinity ? 1 / (firstRank + 1) : 0,
  };
}

const norm = (t: string) => t.toLowerCase().replace(/,/g, "");

export function mustIncludeHit(mustInclude: string[], answer: string): number | null {
  if (!mustInclude.length) return null;
  const a = norm(answer);
  return mustInclude.filter((m) => a.includes(norm(m))).length / mustInclude.length;
}
