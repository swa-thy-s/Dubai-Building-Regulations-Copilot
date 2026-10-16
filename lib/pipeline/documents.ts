import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface DocInfo {
  id: string;
  slug: string;
  title: string;
  edition: string;
  authority: string;
  status: string;
}

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars are not set");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

const TTL_MS = 60_000;
let cache: { at: number; docs: Map<string, DocInfo> } | null = null;

export async function getDocuments(): Promise<Map<string, DocInfo>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.docs;
  const { data, error } = await db()
    .from("documents")
    .select("id, slug, title, edition, authority, status");
  if (error) throw new Error(`documents lookup failed: ${error.message}`);
  const docs = new Map((data as DocInfo[]).map((d) => [d.id, d]));
  cache = { at: Date.now(), docs };
  return docs;
}

export function docOf(docs: Map<string, DocInfo>, documentId: string): DocInfo {
  return (
    docs.get(documentId) ?? {
      id: documentId,
      slug: "unknown",
      title: "Unknown document",
      edition: "",
      authority: "Other",
      status: "current",
    }
  );
}
