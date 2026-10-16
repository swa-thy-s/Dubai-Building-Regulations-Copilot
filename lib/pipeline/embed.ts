import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  ai = new GoogleGenAI({ apiKey: key });
  return ai;
}

export async function embedQuery(text: string): Promise<number[]> {
  const model = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
  const result = await getAI().models.embedContent({
    model,
    contents: text,
    config: { taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 },
  });
  return result.embeddings![0].values!;
}
