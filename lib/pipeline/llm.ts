export class LlmError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

export interface ChatJsonOptions {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  temperature?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  backoffMs?: number;
}

const RETRYABLE = [429, 500, 502, 503, 504];

export function llmModel(): string {
  return process.env.LLM_MODEL || "IFM/K2-Horizon-375B-A23B";
}

export async function chatJson(opts: ChatJsonOptions): Promise<string> {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LlmError("LLM_API_KEY is not set");
  const base = (process.env.LLM_BASE_URL || "https://api.ifm.ai/v1").replace(/\/$/, "");
  const attempts = opts.maxAttempts ?? 3;
  const backoff = opts.backoffMs ?? 2000;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const last = attempt === attempts - 1;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 90_000);
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmModel(),
          temperature: opts.temperature ?? 0.1,
          messages: [
            { role: "system", content: opts.system },
            { role: "user", content: opts.user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: opts.schemaName, strict: true, schema: opts.schema },
          },
        }),
      });
      if (!res.ok) {
        const body = (await res.text()).slice(0, 300);
        if (RETRYABLE.includes(res.status) && !last) {
          await sleep(backoff * 2 ** attempt + Math.random() * backoff);
          continue;
        }
        throw new LlmError(`LLM request failed (${res.status}): ${body}`, res.status);
      }
      const data = await res.json();
      const content: string = data?.choices?.[0]?.message?.content?.trim() ?? "";
      if (!content) throw new LlmError("LLM returned empty content");
      return content.replace(/^```(?:json)?\s*|\s*```$/g, "");
    } catch (e) {
      if (e instanceof LlmError) throw e;
      if (!last) {
        await sleep(backoff * 2 ** attempt);
        continue;
      }
      throw new LlmError(`LLM network error: ${e instanceof Error ? e.message : String(e)}`, 503);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new LlmError("unreachable");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
