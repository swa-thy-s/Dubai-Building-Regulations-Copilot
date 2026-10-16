import type { SupabaseClient } from "@supabase/supabase-js";

export interface PurgeResult {
  feedback: number;
  queryLogs: number;
  rateLimits: number;
  cutoff: string;
}

const DAY_MS = 86_400_000;

// Deletes feedback and query logs older than retentionDays. Feedback is removed first because it references
// query_logs; newer feedback that points at an expired log keeps its text but loses the link.
export async function purgeOld(
  db: SupabaseClient,
  retentionDays: number,
  now: Date = new Date(),
): Promise<PurgeResult> {
  if (!Number.isFinite(retentionDays) || retentionDays < 1) throw new Error("retentionDays must be >= 1");
  const cutoff = new Date(now.getTime() - retentionDays * DAY_MS).toISOString();

  const fb = await db.from("feedback").delete({ count: "exact" }).lt("created_at", cutoff);
  if (fb.error) throw new Error(`feedback purge failed: ${fb.error.message}`);

  let queryLogs = 0;
  for (;;) {
    const { data, error } = await db.from("query_logs").select("id").lt("created_at", cutoff).limit(500);
    if (error) throw new Error(`query_logs select failed: ${error.message}`);
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    if (!ids.length) break;
    const unlink = await db.from("feedback").update({ query_log_id: null }).in("query_log_id", ids);
    if (unlink.error) throw new Error(`feedback unlink failed: ${unlink.error.message}`);
    const del = await db.from("query_logs").delete({ count: "exact" }).in("id", ids);
    if (del.error) throw new Error(`query_logs purge failed: ${del.error.message}`);
    queryLogs += del.count ?? ids.length;
  }

  // Rate-limit counters only need the last day; keep two to be safe.
  const rl = await db
    .from("rate_limits")
    .delete({ count: "exact" })
    .lt("window_start", new Date(now.getTime() - 2 * DAY_MS).toISOString());
  if (rl.error) throw new Error(`rate_limits purge failed: ${rl.error.message}`);

  return { feedback: fb.count ?? 0, queryLogs, rateLimits: rl.count ?? 0, cutoff };
}
