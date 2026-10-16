import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Verification dates live in app_config under one JSON key: { "<document slug>": "YYYY-MM-DD" }.
// A document with no entry has never been checked against its official source.
export const VERIFICATION_KEY = "source_verification";

let client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (client) return client;
  client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

export type Verification = Record<string, string>;

export function parseVerification(raw: string | null | undefined): Verification {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Verification) : {};
  } catch {
    return {};
  }
}

export function latestVerified(v: Verification): string | null {
  const dates = Object.values(v).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  return dates.length ? dates[dates.length - 1] : null;
}

export function isStale(latest: string | null, staleAfterDays: number, now: Date = new Date()): boolean {
  if (!latest) return true;
  return now.getTime() - new Date(latest).getTime() > staleAfterDays * 86_400_000;
}

let cache: { at: number; v: Verification } | null = null;

export async function getVerification(): Promise<Verification> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const { data } = await db().from("app_config").select("value").eq("key", VERIFICATION_KEY).maybeSingle();
  const v = parseVerification(data?.value);
  cache = { at: Date.now(), v };
  return v;
}
