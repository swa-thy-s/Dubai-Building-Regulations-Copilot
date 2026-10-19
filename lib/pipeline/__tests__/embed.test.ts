import { describe, it, expect, vi, beforeEach } from "vitest";

const embedContent = vi.fn();
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { embedContent: (...a: unknown[]) => embedContent(...a) };
  },
}));

import { embedQuery, retryDelayMs } from "../embed";

const ok = { embeddings: [{ values: [0.1, 0.2] }] };
const rateLimit = (msg: string) => Object.assign(new Error(msg), { status: 429 });

beforeEach(() => {
  embedContent.mockReset();
  process.env.GEMINI_API_KEY = "k";
  vi.useFakeTimers();
});

describe("retryDelayMs", () => {
  it("reads seconds and milliseconds from the API message", () => {
    expect(retryDelayMs("Please retry in 14.5s.")).toBe(14500);
    expect(retryDelayMs("retry in 436.2ms")).toBeCloseTo(436.2);
    expect(retryDelayMs("no hint")).toBeNull();
  });
});

describe("embedQuery", () => {
  it("waits and retries a per-minute rate limit", async () => {
    embedContent.mockRejectedValueOnce(rateLimit("PerMinute quota. Please retry in 2s.")).mockResolvedValueOnce(ok);
    const p = embedQuery("q");
    await vi.advanceTimersByTimeAsync(3000);
    expect(await p).toEqual([0.1, 0.2]);
    expect(embedContent).toHaveBeenCalledTimes(2);
  });

  it("does not retry a daily quota", async () => {
    embedContent.mockRejectedValue(rateLimit("EmbedContentRequestsPerDay quota exceeded"));
    await expect(embedQuery("q")).rejects.toMatchObject({ status: 429 });
    expect(embedContent).toHaveBeenCalledTimes(1);
  });

  it("does not retry other errors, and gives up after the attempt limit", async () => {
    embedContent.mockRejectedValueOnce(Object.assign(new Error("bad"), { status: 400 }));
    await expect(embedQuery("q")).rejects.toMatchObject({ status: 400 });
    expect(embedContent).toHaveBeenCalledTimes(1);

    embedContent.mockReset();
    embedContent.mockRejectedValue(rateLimit("PerMinute. retry in 1s"));
    const p = embedQuery("q", 2);
    const assertion = expect(p).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(embedContent).toHaveBeenCalledTimes(2);
  });
});
