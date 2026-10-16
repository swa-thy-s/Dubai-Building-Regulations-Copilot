import { describe, it, expect } from "vitest";
import { verify } from "../verify";
import type { GenerationResult } from "../generate";
import type { SearchResult } from "../search";

const chunk = (id: string, ref: string, content: string): SearchResult => ({
  chunk_id: id,
  document_id: "doc-1",
  clause_ref: ref,
  content,
  page_start: 1,
  rrf_score: 0.5,
  similarity: 0.8,
  vector_rank: 1,
  text_rank: 1,
});

describe("verify", () => {
  it("passes when all citations are valid and numbers are in chunks", () => {
    const chunks = [
      chunk("c1", "B.5.2", "The minimum area is 10.5 m² with dimension 3 m."),
    ];
    const gen: GenerationResult = {
      abstain: false,
      answer_md: "The minimum area is 10.5 m² [1].",
      claims: [{ text: "minimum area 10.5 m²", chunk_ids: ["c1"] }],
      conditions: [],
    };
    const result = verify(gen, chunks);
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it("rejects a fake chunk_id not in the retrieved set", () => {
    const chunks = [chunk("c1", "B.5.2", "some content")];
    const gen: GenerationResult = {
      abstain: false,
      answer_md: "Answer [1].",
      claims: [{ text: "claim", chunk_ids: ["c999"] }],
      conditions: [],
    };
    const result = verify(gen, chunks);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("c999"))).toBe(true);
  });

  it("rejects a number with unit not found in any cited chunk", () => {
    const chunks = [
      chunk("c1", "B.5.2", "The width is 1200 mm."),
    ];
    const gen: GenerationResult = {
      abstain: false,
      answer_md: "The width is 1500 mm [1].",
      claims: [{ text: "width", chunk_ids: ["c1"] }],
      conditions: [],
    };
    const result = verify(gen, chunks);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("1500 mm"))).toBe(true);
  });

  it("rejects a marker [n] with no corresponding claim", () => {
    const chunks = [chunk("c1", "B.5.2", "content")];
    const gen: GenerationResult = {
      abstain: false,
      answer_md: "Answer [1] and [2].",
      claims: [{ text: "claim", chunk_ids: ["c1"] }],
      conditions: [],
    };
    const result = verify(gen, chunks);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.includes("[2]"))).toBe(true);
  });

  it("passes when numbers contain commas matching chunk text", () => {
    const chunks = [
      chunk("c1", "B.6.4.1.5", "height between landings shall be not more than 3,660 mm"),
    ];
    const gen: GenerationResult = {
      abstain: false,
      answer_md: "Maximum height is 3,660 mm [1].",
      claims: [{ text: "height 3660", chunk_ids: ["c1"] }],
      conditions: [],
    };
    const result = verify(gen, chunks);
    expect(result.passed).toBe(true);
  });
});
