import { QUERY_PREP_PROMPT } from "./prompts";
import { chatJson } from "./llm";

const PREP_SCHEMA = {
  type: "object",
  properties: {
    search_query: { type: "string" },
    authority_hint: { type: ["string", "null"] },
    in_scope: { type: "boolean" },
    topic_terms: { type: "array", items: { type: "string" } },
  },
  required: ["search_query", "authority_hint", "in_scope", "topic_terms"],
  additionalProperties: false,
};

export interface QueryPrepResult {
  search_query: string;
  authority_hint: string | null;
  in_scope: boolean;
  topic_terms: string[];
}

export async function prepareQuery(
  question: string,
): Promise<QueryPrepResult> {
  try {
    const text = await chatJson({
      system: QUERY_PREP_PROMPT,
      user: question,
      schemaName: "query_prep",
      schema: PREP_SCHEMA,
      temperature: 0,
      maxAttempts: 2,
      timeoutMs: 30_000,
    });
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
