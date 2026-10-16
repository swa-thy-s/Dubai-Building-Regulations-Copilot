import { describe, it, expect } from "vitest";
import { evaluateThreshold, recommend } from "../gate-sweep";

const row = (label: "abstain" | "answer", topSim: number, fts = false) => ({ id: "x", label, q: "q", topSim, fts });

describe("gate sweep maths", () => {
  const rows = [
    row("answer", 0.8), row("answer", 0.75), row("answer", 0.72), row("answer", 0.6, true),
    row("abstain", 0.55), row("abstain", 0.62), row("abstain", 0.66), row("abstain", 0.9, true),
  ];

  it("a full-text hit always lets a question through", () => {
    const e = evaluateThreshold(rows, 0.95);
    expect(e.overRefusal).toBeCloseTo(3 / 4); // the 0.6 answerable has an FTS hit and is not gated
    expect(e.abstainPrecision).toBeCloseTo(3 / 4); // the 0.9 abstain has an FTS hit and is not gated
  });

  it("reports precision and over-refusal at a threshold", () => {
    expect(evaluateThreshold(rows, 0.7)).toMatchObject({ abstainPrecision: 0.75, overRefusal: 0 });
  });

  it("recommends a threshold that separates the groups without over-refusing", () => {
    const t = recommend(rows);
    expect(t).toBeGreaterThan(0.66);
    expect(t).toBeLessThanOrEqual(0.72);
    expect(evaluateThreshold(rows, t).overRefusal).toBeLessThanOrEqual(0.05);
  });

  it("refuses to trade more than 5% over-refusal for abstain precision", () => {
    const hard = [row("answer", 0.6), row("answer", 0.8), row("abstain", 0.7)];
    const t = recommend(hard);
    expect(evaluateThreshold(hard, t).overRefusal).toBeLessThanOrEqual(0.5); // 1 of 2 at most when no option fits
  });
});
