import { describe, it, expect } from "vitest";
import { chunkRefMatches, scoreRetrieval, mustIncludeHit } from "../eval-metrics";

describe("chunkRefMatches", () => {
  it("matches the clause ref after the slug", () => {
    expect(chunkRefMatches("dbc-2021#B.6.4.1.4", "B.6.4.1.4")).toBe(true);
  });
  it("ignores split markers like (1/2)", () => {
    expect(chunkRefMatches("dbc-2021#B.4.2.3", "B.4.2.3 (2/2)")).toBe(true);
  });
  it("does not match a prefix or a malformed gold ref", () => {
    expect(chunkRefMatches("dbc-2021#B.6.4.1", "B.6.4.1.4")).toBe(false);
    expect(chunkRefMatches("B.6.4.1.4", "B.6.4.1.4")).toBe(false);
  });
});

describe("scoreRetrieval", () => {
  const gold = ["dbc-2021#A", "dbc-2021#B"];
  it("computes recall@5 as the share of gold chunks in the top 5", () => {
    const s = scoreRetrieval(gold, ["x", "A", "y", "z", "w", "B"], 6);
    expect(s.recallAt5).toBe(0.5);
    expect(s.recallAtK).toBe(1);
  });
  it("computes MRR from the first gold hit", () => {
    expect(scoreRetrieval(gold, ["x", "y", "B"], 6).mrr).toBeCloseTo(1 / 3);
    expect(scoreRetrieval(gold, ["A"], 6).mrr).toBe(1);
  });
  it("returns zeros on a miss", () => {
    expect(scoreRetrieval(gold, ["x", "y"], 6)).toEqual({ recallAt5: 0, recallAtK: 0, mrr: 0 });
  });
});

describe("mustIncludeHit", () => {
  it("is null with no requirements", () => {
    expect(mustIncludeHit([], "anything")).toBeNull();
  });
  it("ignores case and thousands separators", () => {
    expect(mustIncludeHit(["1,200 mm"], "Width is 1200 MM")).toBe(1);
  });
  it("returns the fraction found", () => {
    expect(mustIncludeHit(["865", "965"], "between 865 mm")).toBe(0.5);
  });
});
