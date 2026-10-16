import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod/v4";
import { SYSTEM_PROMPT } from "./prompts";
import type { SearchResult } from "./search";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  ai = new GoogleGenAI({ apiKey: key });
  return ai;
}

export const GenerationSchema = z.object({
  abstain: z.boolean(),
  answer_md: z.string(),
  claims: z.array(
    z.object({
      text: z.string(),
      chunk_ids: z.array(z.string()),
    }),
  ),
  conditions: z.array(z.string()),
});

export type GenerationResult = z.infer<typeof GenerationSchema>;

function formatChunks(chunks: SearchResult[]): string {
  return chunks
    .map(
      (c) =>
        `<clause id="${c.chunk_id}" document="Dubai Building Code" edition="2021" authority="DM" ref="${c.clause_ref}" page="${c.page_start}">\n${c.content}\n</clause>`,
    )
    .join("\n\n");
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    abstain: { type: Type.BOOLEAN },
    answer_md: { type: Type.STRING },
    claims: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          chunk_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["text", "chunk_ids"],
      },
    },
    conditions: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["abstain", "answer_md", "claims", "conditions"],
};

function normalize(raw: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw.claims)) {
    raw.claims = raw.claims.map((c: unknown) => {
      if (typeof c === "string") return { text: "", chunk_ids: [c] };
      return c;
    });
  }
  if (!Array.isArray(raw.conditions)) raw.conditions = [];
  return raw;
}

async function callWithRetry(
  model: string,
  userMessage: string,
  maxAttempts = 3,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await getAI().models.generateContent({
        model,
        contents: userMessage,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });
      return result.text ?? "";
    } catch (e: unknown) {
      const status = (e as { status?: number }).status;
      if (status && [429, 500, 503].includes(status) && attempt < maxAttempts - 1) {
        const wait = Math.min(30, 2 ** attempt * 2 + Math.random() * 2);
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      throw e;
    }
  }
  throw new Error("unreachable");
}

export async function generate(
  question: string,
  chunks: SearchResult[],
  feedback?: string,
): Promise<GenerationResult> {
  const model = process.env.GEMINI_GEN_MODEL || "gemini-2.5-flash";
  const context = formatChunks(chunks);

  let userMessage = `${question}\n\n${context}`;
  if (feedback) {
    userMessage += `\n\nPrevious attempt had verification failures:\n${feedback}\nPlease fix these issues in your response.`;
  }

  const text = await callWithRetry(model, userMessage);
  const parsed = normalize(JSON.parse(text));
  return GenerationSchema.parse(parsed);
}
