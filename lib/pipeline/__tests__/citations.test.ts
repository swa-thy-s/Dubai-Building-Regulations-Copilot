import { describe, it, expect } from "vitest";
import { buildCitations, nearestClauses } from "../citations";
import type { SearchResult } from "../search";
import type { DocInfo } from "../documents";

const chunk = (id: string, ref: string, content: string, page = 10): SearchResult => ({
  chunk_id: id,
  document_id: "d",
  clause_ref: ref,
  content,
  page_start: page,
  rrf_score: 1,
  similarity: 1,
  vector_rank: 1,
  text_rank: null,
});

const docs = new Map<string, DocInfo>([
  ["d", { id: "d", slug: "x", title: "Test Law", edition: "2007", authority: "RERA", status: "current" }],
]);

const ctx = [chunk("a", "B.1", "Verbatim clause A: 1,200 mm."), chunk("b", "B.2", "Clause B.", 12)];

describe("buildCitations", () => {
  it("dedupes clauses, numbers by first use, and quotes the verbatim clause text", () => {
    const { citations } = buildCitations(
      {
        abstain: false,
        answer_md: "x",
        conditions: [],
        claims: [
          { text: "paraphrase 1", chunk_ids: ["a"] },
          { text: "paraphrase 2", chunk_ids: ["a", "b"] },
        ],
      },
      ctx,
      docs,
    );
    expect(citations.map((c) => [c.n, c.clause_ref, c.page])).toEqual([
      [1, "B.1", 10],
      [2, "B.2", 12],
    ]);
    expect(citations[0].quote).toBe("Verbatim clause A: 1,200 mm.");
    expect(citations[0]).toMatchObject({ document: "Test Law", edition: "2007", authority: "RERA" });
  });

  it("remaps claim markers to citation numbers, expanding multi-clause claims", () => {
    const { answer_md } = buildCitations(
      {
        abstain: false,
        conditions: [],
        answer_md: "Width is 1,200 mm [1]. Also see this [2].",
        claims: [
          { text: "t1", chunk_ids: ["a"] },
          { text: "t2", chunk_ids: ["a", "b"] },
        ],
      },
      ctx,
      docs,
    );
    expect(answer_md).toBe("Width is 1,200 mm [1]. Also see this [1][2].");
  });

  it("leaves unknown markers untouched", () => {
    const { answer_md } = buildCitations(
      { abstain: false, conditions: [], answer_md: "odd [9]", claims: [{ text: "t", chunk_ids: ["a"] }] },
      ctx,
      docs,
    );
    expect(answer_md).toBe("odd [9]");
  });
});


describe("nearestClauses", () => {
  const more = [...ctx, chunk("a", "B.1", "dup of a")];
  it("returns up to n distinct clauses with verbatim quotes and real document metadata", () => {
    const out = nearestClauses(more, docs, 3);
    expect(out.map((c) => c.clause_ref)).toEqual(["B.1", "B.2"]);
    expect(out[0]).toMatchObject({ n: 1, document: "Test Law", edition: "2007", authority: "RERA", quote: "Verbatim clause A: 1,200 mm." });
  });
  it("honours the limit and handles no results", () => {
    expect(nearestClauses(ctx, docs, 1)).toHaveLength(1);
    expect(nearestClauses([], docs)).toEqual([]);
  });
});
