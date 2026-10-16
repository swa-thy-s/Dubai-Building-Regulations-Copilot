import { describe, it, expect, vi, beforeEach } from "vitest";

const checkRateLimit = vi.fn();
const runPipeline = vi.fn();

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }),
}));
vi.mock("@/lib/pipeline/rate-limit", () => ({
  hashIP: (ip: string) => `hash(${ip})`,
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
}));
vi.mock("@/lib/pipeline/pipeline", () => ({
  runPipeline: (...a: unknown[]) => runPipeline(...a),
}));

vi.mock("@/lib/pipeline/verification", () => ({
  getVerification: async () => ({}),
  latestVerified: () => null,
}));

import { POST } from "../route";

const post = (body: unknown) =>
  POST(new Request("http://x/api/ask", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

beforeEach(() => {
  checkRateLimit.mockReset().mockResolvedValue({ allowed: true });
  runPipeline.mockReset();
});

describe("POST /api/ask validation", () => {
  it("rejects invalid JSON", async () => {
    expect((await post("{nope")).status).toBe(400);
  });
  it("rejects empty and over-length questions", async () => {
    expect((await post({ question: "" })).status).toBe(400);
    expect((await post({ question: "a".repeat(501) })).status).toBe(400);
  });
  it("rejects unknown authorities", async () => {
    expect((await post({ question: "q", authorities: ["Mars"] })).status).toBe(400);
  });
  it("accepts a 500-char question", async () => {
    runPipeline.mockResolvedValue({ abstained: true });
    expect((await post({ question: "a".repeat(500) })).status).toBe(200);
  });
});

describe("POST /api/ask rate limit", () => {
  it("returns 429 with code and reset time, and never calls the pipeline", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false, code: "hourly", reason: "limit", resetAt: "2026-10-16T12:30:00.000Z" });
    const res = await post({ question: "q" });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "hourly", reset_at: "2026-10-16T12:30:00.000Z" });
    expect(runPipeline).not.toHaveBeenCalled();
  });
});

describe("POST /api/ask streaming", () => {
  it("streams progress then the abstain result, passing a hashed IP", async () => {
    runPipeline.mockImplementation(async (_q, _a, _ip, onProgress) => {
      onProgress({ stage: "Searching clauses" });
      return { trace_id: "t", abstained: true, abstain_reason: "gate", answer_md: "", conditions: [], citations: [] };
    });
    const res = await post({ question: "mortgage fees?" });
    const text = await res.text();
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(text).toContain("event: progress");
    expect(text).toContain('"abstain_reason":"gate"');
    expect(text).toContain("Reference tool only. Not an official ruling and not advice.");
    expect(runPipeline.mock.calls[0][2]).toBe("hash(203.0.113.9)");
  });

  it("emits an error event instead of leaking an answer when the pipeline throws", async () => {
    runPipeline.mockRejectedValue(new Error("boom"));
    const text = await (await post({ question: "q" })).text();
    expect(text).toContain("event: error");
    expect(text).not.toContain("event: result");
    expect(text).toContain("Reference tool only. Not an official ruling and not advice.");
  });
});
