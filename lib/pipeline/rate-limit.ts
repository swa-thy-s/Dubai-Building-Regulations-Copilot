import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

let sb: SupabaseClient | null = null;
function getSb(): SupabaseClient {
  if (sb) return sb;
  sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return sb;
}

export function hashIP(ip: string): string {
  const salt = process.env.IP_HASH_SALT || "default-salt";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 16);
}

export async function checkRateLimit(
  ipHash: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const db = getSb();
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600_000);
  const dayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");

  // Per-IP hourly limit: 20 requests
  const { count: ipCount } = await db
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", `ip:${ipHash}`)
    .gte("window_start", hourAgo.toISOString());

  if ((ipCount ?? 0) >= 20) {
    return { allowed: false, reason: "Too many requests. Try again in an hour." };
  }

  // Global daily cap
  const cap = parseInt(process.env.DAILY_REQUEST_CAP || "200", 10);
  const { count: dayCount } = await db
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", "global")
    .gte("window_start", dayStart.toISOString());

  if ((dayCount ?? 0) >= cap) {
    return { allowed: false, reason: "Daily request limit reached. Try again tomorrow." };
  }

  // Record this request
  await db.from("rate_limits").insert([
    { key: `ip:${ipHash}`, window_start: now.toISOString(), count: 1 },
    { key: "global", window_start: now.toISOString(), count: 1 },
  ]);

  return { allowed: true };
}
