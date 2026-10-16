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

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  code?: "hourly" | "daily";
  resetAt?: string;
}

export async function checkRateLimit(
  ipHash: string,
  db: SupabaseClient = getSb(),
  now: Date = new Date(),
): Promise<RateLimitResult> {
  const hourAgo = new Date(now.getTime() - 3600_000);
  const dayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");

  // Per-IP hourly limit: 20 requests
  const { count: ipCount } = await db
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", `ip:${ipHash}`)
    .gte("window_start", hourAgo.toISOString());

  if ((ipCount ?? 0) >= 20) {
    const { data: oldest } = await db
      .from("rate_limits")
      .select("window_start")
      .eq("key", `ip:${ipHash}`)
      .gte("window_start", hourAgo.toISOString())
      .order("window_start", { ascending: true })
      .limit(1);
    const first = oldest?.[0]?.window_start
      ? new Date(oldest[0].window_start)
      : now;
    return {
      allowed: false,
      code: "hourly",
      reason: "You have reached the hourly limit.",
      resetAt: new Date(first.getTime() + 3600_000).toISOString(),
    };
  }

  // Global daily cap
  const cap = parseInt(process.env.DAILY_REQUEST_CAP || "200", 10);
  const { count: dayCount } = await db
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", "global")
    .gte("window_start", dayStart.toISOString());

  if ((dayCount ?? 0) >= cap) {
    return {
      allowed: false,
      code: "daily",
      reason: "The tool is at capacity. Try again later.",
    };
  }

  // Record this request
  await db.from("rate_limits").insert([
    { key: `ip:${ipHash}`, window_start: now.toISOString(), count: 1 },
    { key: "global", window_start: now.toISOString(), count: 1 },
  ]);

  return { allowed: true };
}

export async function checkKeyLimit(
  key: string,
  limit: number,
  windowMs: number,
  db: SupabaseClient = getSb(),
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - windowMs).toISOString();
  const { count } = await db
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("window_start", since);
  if ((count ?? 0) >= limit) return false;
  await db.from("rate_limits").insert({ key, window_start: now.toISOString(), count: 1 });
  return true;
}
