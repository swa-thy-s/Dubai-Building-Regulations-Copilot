import { describe, it, expect } from "vitest";
import { checkGate } from "../gate";
import type { SearchResult } from "../search";

const result = (sim: number, textRank: number | null): SearchResult => ({
  chunk_id: "c1",
  document_id: "doc-1",
  clause_ref: "B.1",
  content: "",
  page_start: 1,
  rrf_score: 0.5,
  similarity: sim,
  vector_rank: 1,
  text_rank: textRank,
});

describe("checkGate", () => {
  it("passes when similarity exceeds threshold", () => {
    const r = checkGate([result(0.7, null)], 0.55);
    expect(r.passed).toBe(true);
  });

  it("passes when similarity is low but FTS rank is in top 5", () => {
    const r = checkGate([result(0.4, 3)], 0.55);
    expect(r.passed).toBe(true);
  });

  it("fails when similarity is low and no FTS hit in top 5", () => {
    const r = checkGate([result(0.4, null)], 0.55);
    expect(r.passed).toBe(false);
    expect(r.reason).toBe("gate");
  });

  it("fails when empty results", () => {
    const r = checkGate([], 0.55);
    expect(r.passed).toBe(false);
  });
});
