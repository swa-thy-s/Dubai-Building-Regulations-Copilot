import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkRateLimit, checkKeyLimit, hashIP } from "../rate-limit";

function fakeDb(opts: { ipCount: number; dayCount: number; oldest?: string }) {
  const inserts: unknown[] = [];
  const db = {
    from() {
      let key = "";
      let isCount = true;
      const q: Record<string, unknown> = {
        select(_cols: string, o?: { head?: boolean }) {
          isCount = !!o?.head;
          return q;
        },
        eq(_c: string, v: string) {
          key = v;
          return q;
        },
        gte() {
          if (isCount) {
            return Promise.resolve({ count: key === "global" ? opts.dayCount : opts.ipCount });
          }
          return q;
        },
        order: () => q,
        limit: () => Promise.resolve({ data: [{ window_start: opts.oldest }] }),
        insert(rows: unknown) {
          inserts.push(rows);
          return Promise.resolve({ error: null });
        },
      };
      return q;
    },
  };
  return { db: db as unknown as SupabaseClient, inserts };
}

const NOW = new Date("2026-10-16T12:00:00Z");

describe("checkRateLimit", () => {
  it("allows and records a request under both limits", async () => {
    const { db, inserts } = fakeDb({ ipCount: 3, dayCount: 10 });
    const r = await checkRateLimit("abc", db, NOW);
    expect(r.allowed).toBe(true);
    expect(inserts).toHaveLength(1);
  });

  it("blocks the 21st request in an hour and reports the reset time", async () => {
    const { db, inserts } = fakeDb({ ipCount: 20, dayCount: 10, oldest: "2026-10-16T11:30:00Z" });
    const r = await checkRateLimit("abc", db, NOW);
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("hourly");
    expect(r.resetAt).toBe("2026-10-16T12:30:00.000Z");
    expect(inserts).toHaveLength(0);
  });

  it("blocks when the global daily cap is reached", async () => {
    process.env.DAILY_REQUEST_CAP = "200";
    const { db } = fakeDb({ ipCount: 0, dayCount: 200 });
    const r = await checkRateLimit("abc", db, NOW);
    expect(r.allowed).toBe(false);
    expect(r.code).toBe("daily");
    expect(r.reason).toBe("The tool is at capacity. Try again later.");
  });
});

describe("hashIP", () => {
  it("never returns the raw IP and is salted", () => {
    process.env.IP_HASH_SALT = "s1";
    const a = hashIP("203.0.113.9");
    expect(a).not.toContain("203.0.113.9");
    process.env.IP_HASH_SALT = "s2";
    expect(hashIP("203.0.113.9")).not.toBe(a);
  });
});

describe("checkKeyLimit", () => {
  it("allows under the limit and records, blocks at the limit", async () => {
    const under = fakeDb({ ipCount: 4, dayCount: 0 });
    expect(await checkKeyLimit("contact:x", 5, 3600_000, under.db, NOW)).toBe(true);
    expect(under.inserts).toHaveLength(1);
    const at = fakeDb({ ipCount: 5, dayCount: 0 });
    expect(await checkKeyLimit("contact:x", 5, 3600_000, at.db, NOW)).toBe(false);
    expect(at.inserts).toHaveLength(0);
  });
});
