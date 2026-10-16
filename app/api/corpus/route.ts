import { getSupabase } from "@/lib/supabase";
import { getVerification, latestVerified, isStale } from "@/lib/pipeline/verification";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("documents")
    .select("slug, title, authority, edition, status, source_url, ingested_at:created_at")
    .order("authority", { ascending: true })
    .order("title", { ascending: true });

  if (error) {
    return Response.json({ error: "Failed to fetch documents" }, { status: 500 });
  }

  const verification = await getVerification();
  const staleAfter = parseInt(process.env.STALE_AFTER_DAYS || "45", 10);
  const documents = (data ?? []).map((d) => ({ ...d, last_verified: verification[d.slug] ?? null }));
  return Response.json({
    documents,
    stale: isStale(latestVerified(verification), staleAfter),
  });
}
