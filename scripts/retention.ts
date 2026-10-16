#!/usr/bin/env tsx
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { purgeOld } from "../lib/retention";

async function main() {
  const days = parseInt(process.env.RETENTION_DAYS || "90", 10);
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const r = await purgeOld(db, days);
  console.log(`Retention ${days} days (cutoff ${r.cutoff}): feedback ${r.feedback}, query_logs ${r.queryLogs}, rate_limits ${r.rateLimits}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
