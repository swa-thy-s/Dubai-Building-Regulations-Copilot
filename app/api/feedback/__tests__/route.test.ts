import { describe, it, expect, vi, beforeEach } from "vitest";

const inserted: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserted.push(row);
        return { error: null };
      },
    }),
  }),
}));

import { POST } from "../route";

const post = (b: unknown) => POST(new Request("http://x/api/feedback", { method: "POST", body: JSON.stringify(b) }));
const ID = "123e4567-e89b-12d3-a456-426614174000";

beforeEach(() => {
  inserted.length = 0;
});

describe("POST /api/feedback", () => {
  it("stores a thumbs up as rating 1 and a thumbs down as -1", async () => {
    expect((await post({ query_log_id: ID, vote: "up" })).status).toBe(200);
    expect((await post({ query_log_id: ID, vote: "down", comment: "wrong clause" })).status).toBe(200);
    expect(inserted.map((r) => r.rating)).toEqual([1, -1]);
    expect(inserted[1].comment).toBe("wrong clause");
  });

  it("rejects a rating without a vote or a query id", async () => {
    expect((await post({ query_log_id: ID })).status).toBe(400);
    expect((await post({ vote: "up" })).status).toBe(400);
    expect((await post({ kind: "rating" })).status).toBe(400);
  });

  it("records a missing topic with the question, even when the log id is not a uuid", async () => {
    const res = await post({ kind: "missing_topic", query_log_id: "log-failed", question: "Can my landlord refuse a renovation?" });
    expect(res.status).toBe(200);
    expect(inserted[0]).toMatchObject({
      query_log_id: null,
      rating: null,
      comment: "[missing topic] Can my landlord refuse a renovation?",
    });
  });

  it("keeps a valid log id on a missing topic", async () => {
    await post({ kind: "missing_topic", query_log_id: ID, question: "q" });
    expect(inserted[0].query_log_id).toBe(ID);
  });

  it("rejects invalid JSON and bad votes", async () => {
    expect((await POST(new Request("http://x", { method: "POST", body: "{nope" }))).status).toBe(400);
    expect((await post({ query_log_id: ID, vote: "maybe" })).status).toBe(400);
  });
});
