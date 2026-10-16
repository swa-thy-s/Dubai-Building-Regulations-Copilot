import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { chatJson, LlmError } from "../llm";

const opts = { system: "s", user: "u", schemaName: "x", schema: { type: "object" }, backoffMs: 0 };
const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

beforeEach(() => {
  process.env.LLM_API_KEY = "test-key";
  process.env.LLM_BASE_URL = "https://llm.test/v1/";
  process.env.LLM_MODEL = "m1";
});
afterEach(() => vi.unstubAllGlobals());

describe("chatJson", () => {
  it("posts a strict json_schema request with bearer auth and returns content", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok('{"a":1}'));
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatJson(opts)).toBe('{"a":1}');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://llm.test/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("m1");
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("strips markdown fences", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok('```json\n{"a":1}\n```')));
    expect(await chatJson(opts)).toBe('{"a":1}');
  });

  it("retries a 503 and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(ok("{}"));
    vi.stubGlobal("fetch", fetchMock);
    expect(await chatJson(opts)).toBe("{}");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces the status after exhausting retries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("quota", { status: 429 })));
    await expect(chatJson(opts)).rejects.toMatchObject({ status: 429 });
  });

  it("does not retry a 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(chatJson(opts)).rejects.toBeInstanceOf(LlmError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok("  ")));
    await expect(chatJson(opts)).rejects.toThrow(/empty/);
  });

  it("fails fast without an API key", async () => {
    delete process.env.LLM_API_KEY;
    await expect(chatJson(opts)).rejects.toThrow(/LLM_API_KEY/);
  });
});
