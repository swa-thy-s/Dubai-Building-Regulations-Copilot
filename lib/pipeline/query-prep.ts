import { GoogleGenAI } from "@google/genai";
import { QUERY_PREP_PROMPT } from "./prompts";

let ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (ai) return ai;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  ai = new GoogleGenAI({ apiKey: key });
  return ai;
}

export interface QueryPrepResult {
  search_query: string;
  authority_hint: string | null;
  in_scope: boolean;
  topic_terms: string[];
}

export async function prepareQuery(
  question: string,
): Promise<QueryPrepResult> {
  const model = process.env.GEMINI_GEN_MODEL || "gemini-2.5-flash";
  try {
    const result = await getAI().models.generateContent({
      model,
      contents: question,
      config: {
        systemInstruction: QUERY_PREP_PROMPT,
        temperature: 0,
        responseMimeType: "application/json",
      },
    });
    const text = result.text ?? "";
    const parsed = JSON.parse(text);
    return {
      search_query: parsed.search_query || question,
      authority_hint: parsed.authority_hint || null,
      in_scope: parsed.in_scope !== false,
      topic_terms: Array.isArray(parsed.topic_terms)
        ? parsed.topic_terms
        : [],
    };
  } catch {
    return {
      search_query: question,
      authority_hint: null,
      in_scope: true,
      topic_terms: [],
    };
  }
}
