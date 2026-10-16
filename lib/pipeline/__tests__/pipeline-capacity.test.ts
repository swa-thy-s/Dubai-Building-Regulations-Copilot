import { describe, it, expect, vi, beforeEach } from "vitest";

const hybridSearch = vi.fn();
const generate = vi.fn();
const logged: Record<string, unknown>[] = [];

vi.mock("../search", () => ({ hybridSearch: (...a: unknown[]) => hybridSearch(...a) }));
vi.mock("../generate", () => ({ generate: (...a: unknown[]) => generate(...a) }));
vi.mock("../documents", () => ({ getDocuments: async () => new Map() }));
vi.mock("../query-prep", () => ({ prepareQuery: async (q: string) => ({ search_query: q }) }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        logged.push(row);
        return { select: () => ({ single: async () => ({ data: { id: "trace-1" }, error: null }) }) };
      },
    }),
  }),
}));

import { runPipeline } from "../pipeline";

beforeEach(() => {
  hybridSearch.mockReset();
  generate.mockReset();
  logged.length = 0;
  process.env.SUPABASE_URL = "http://x";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "k";
});

describe("runPipeline when the search or embedding service is unavailable", () => {
  it("returns the capacity state on a 429, logs it, and never calls generation", async () => {
    hybridSearch.mockRejectedValue(Object.assign(new Error("RESOURCE_EXHAUSTED quota"), { status: 429 }));
    const r = await runPipeline("minimum corridor width?", undefined, "iphash");
    expect(r).toMatchObject({ abstained: true, abstain_reason: "capacity", answer_md: "", citations: [] });
    expect(generate).not.toHaveBeenCalled();
    expect(logged[0]).toMatchObject({ abstained: true, ip_hash: "iphash" });
    expect(String(logged[0].abstain_reason)).toContain("search_error");
  });

  it("treats other search failures as a generic error state, not as 'not found'", async () => {
    hybridSearch.mockRejectedValue(new Error("connection reset"));
    const r = await runPipeline("q", undefined, "h");
    expect(r.abstain_reason).toBe("generation_error");
    expect(r.abstain_reason).not.toBe("gate");
    expect(generate).not.toHaveBeenCalled();
  });
});
