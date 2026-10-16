import { isAdminAuthenticated } from "../auth";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sb = getSupabase();
  const [queriesRes, feedbackRes] = await Promise.all([
    sb
      .from("query_logs")
      .select("id, question, rewritten_query, abstained, abstain_reason, verify_passed, latency_ms, model, created_at, retrieved, answer")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(100),
    sb
      .from("feedback")
      .select("id, query_log_id, rating, comment, correct_clause, created_at")
      .gte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const queries = queriesRes.data || [];
  const feedback = feedbackRes.data || [];

  const total = queries.length;
  const abstained = queries.filter((q) => q.abstained).length;
  const thumbsDown = feedback.filter((f) => f.rating === -1).length;
  const latencies = queries.map((q) => q.latency_ms).filter(Boolean).sort((a: number, b: number) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  return Response.json({
    total,
    abstained,
    abstainRate: total ? ((abstained / total) * 100).toFixed(1) : "0",
    thumbsDown,
    thumbsDownRate: total ? ((thumbsDown / total) * 100).toFixed(1) : "0",
    p50,
    p95,
    queries,
    feedback,
  });
}
