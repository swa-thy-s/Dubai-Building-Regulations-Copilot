import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("documents")
    .select("title, authority, edition, status, ingested_at:created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
  }

  return Response.json({ documents: data });
}
