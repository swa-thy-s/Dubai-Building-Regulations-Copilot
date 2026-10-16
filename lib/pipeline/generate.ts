import { z } from "zod/v4";
import { SYSTEM_PROMPT } from "./prompts";
import { chatJson } from "./llm";
import type { SearchResult } from "./search";
import { docOf, type DocInfo } from "./documents";

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

const attr = (v: string) => v.replace(/"/g, "'");

function formatChunks(chunks: SearchResult[], docs: Map<string, DocInfo>): string {
  return chunks
    .map((c) => {
      const d = docOf(docs, c.document_id);
      return `<clause id="${c.chunk_id}" document="${attr(d.title)}" edition="${attr(d.edition)}" authority="${d.authority}" ref="${attr(c.clause_ref)}" page="${c.page_start}">\n${c.content}\n</clause>`;
    })
    .join("\n\n");
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    abstain: { type: "boolean" },
    answer_md: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          chunk_ids: { type: "array", items: { type: "string" } },
        },
        required: ["text", "chunk_ids"],
        additionalProperties: false,
      },
    },
    conditions: { type: "array", items: { type: "string" } },
  },
  required: ["abstain", "answer_md", "claims", "conditions"],
  additionalProperties: false,
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

export async function generate(
  question: string,
  chunks: SearchResult[],
  docs: Map<string, DocInfo>,
  feedback?: string,
): Promise<GenerationResult> {
  const context = formatChunks(chunks, docs);

  let userMessage = `${question}\n\n${context}`;
  if (feedback) {
    userMessage += `\n\nPrevious attempt had verification failures:\n${feedback}\nPlease fix these issues in your response.`;
  }

  const text = await chatJson({
    system: SYSTEM_PROMPT,
    user: userMessage,
    schemaName: "answer",
    schema: RESPONSE_SCHEMA,
  });
  const parsed = normalize(JSON.parse(text));
  return GenerationSchema.parse(parsed);
}
