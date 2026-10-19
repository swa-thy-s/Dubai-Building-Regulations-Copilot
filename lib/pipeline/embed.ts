import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  ai = new GoogleGenAI({ apiKey: key });
  return ai;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "Please retry in 14.1s" / "retry in 436.2ms" from the API's own message.
export function retryDelayMs(message: string): number | null {
  const m = message.match(/retry in ([\d.]+)\s*(ms|s)\b/i);
  if (!m) return null;
  return m[2].toLowerCase() === "ms" ? parseFloat(m[1]) : parseFloat(m[1]) * 1000;
}

export async function embedQuery(text: string, maxAttempts = 3): Promise<number[]> {
  const model = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await getAI().models.embedContent({
        model,
        contents: text,
        config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 },
      });
      return result.embeddings![0].values!;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number }).status;
      // A per-minute limit clears in seconds, so wait as the API asks. A daily limit will not, so fail at once.
      const transient = status === 429 && !/PerDay/i.test(msg);
      if (!transient || attempt >= maxAttempts - 1) throw e;
      await sleep(Math.min((retryDelayMs(msg) ?? 5000) + 500, 20_000));
    }
  }
}
