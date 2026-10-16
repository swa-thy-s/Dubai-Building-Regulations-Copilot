import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "./embed";

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  clause_ref: string;
  content: string;
  page_start: number;
  rrf_score: number;
  similarity: number;
  vector_rank: number | null;
  text_rank: number | null;
}

export async function hybridSearch(
  question: string,
  opts: {
    matchCount?: number;
    authorities?: string[];
    includeSupersceded?: boolean;
  } = {},
): Promise<SearchResult[]> {
  const embedding = await embedQuery(question);
  const { data, error } = await getClient().rpc("hybrid_search", {
    query_text: question,
    query_embedding: JSON.stringify(embedding),
    match_count: opts.matchCount ?? 20,
    authorities: opts.authorities ?? null,
    include_superseded: opts.includeSupersceded ?? false,
  });
  if (error) throw new Error(`hybrid_search failed: ${error.message}`);
  return data as SearchResult[];
}
