import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { purgeOld } from "../retention";

type Row = Record<string, unknown>;

// In-memory stand-in for the three tables, implementing only the query shapes purgeOld uses.
function fakeDb(tables: Record<string, Row[]>) {
  const db = {
    from(name: string) {
      const rows = () => tables[name];
      let mode: "select" | "delete" | "update" = "select";
      let patch: Row = {};
      const filters: ((r: Row) => boolean)[] = [];
      let limitN = Infinity;
      const run = () => {
        const hit = rows().filter((r) => filters.every((f) => f(r)));
        if (mode === "delete") {
          tables[name] = rows().filter((r) => !hit.includes(r));
          return { data: null, error: null, count: hit.length };
        }
        if (mode === "update") {
          hit.forEach((r) => Object.assign(r, patch));
          return { data: null, error: null, count: hit.length };
        }
        return { data: hit.slice(0, limitN), error: null, count: hit.length };
      };
      const q: Record<string, unknown> = {
        select: () => q,
        delete: () => ((mode = "delete"), q),
        update: (p: Row) => ((mode = "update"), (patch = p), q),
        lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), q),
        in: (c: string, v: unknown[]) => (filters.push((r) => v.includes(r[c])), q),
        limit: (n: number) => ((limitN = n), q),
        then: (res: (v: unknown) => unknown) => Promise.resolve(run()).then(res),
      };
      return q;
    },
  };
  return db as unknown as SupabaseClient;
}

const NOW = new Date("2026-10-17T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe("purgeOld", () => {
  it("deletes old logs and feedback, keeps recent ones", async () => {
    const t = {
      query_logs: [
        { id: "old", created_at: daysAgo(100) },
        { id: "new", created_at: daysAgo(10) },
      ],
      feedback: [
        { id: "f-old", created_at: daysAgo(95), query_log_id: "old" },
        { id: "f-new", created_at: daysAgo(5), query_log_id: "new" },
      ],
      rate_limits: [
        { key: "a", window_start: daysAgo(5) },
        { key: "b", window_start: daysAgo(0) },
      ],
    };
    const r = await purgeOld(fakeDb(t), 90, NOW);
    expect(t.query_logs.map((x) => x.id)).toEqual(["new"]);
    expect(t.feedback.map((x) => x.id)).toEqual(["f-new"]);
    expect(t.rate_limits.map((x) => x.key)).toEqual(["b"]);
    expect(r).toMatchObject({ feedback: 1, queryLogs: 1, rateLimits: 1 });
  });

  it("keeps recent feedback but unlinks it from an expired log", async () => {
    const t = {
      query_logs: [{ id: "old", created_at: daysAgo(120) }],
      feedback: [{ id: "f", created_at: daysAgo(3), query_log_id: "old", comment: "wrong" }],
      rate_limits: [],
    };
    await purgeOld(fakeDb(t), 90, NOW);
    expect(t.query_logs).toHaveLength(0);
    expect(t.feedback).toEqual([expect.objectContaining({ id: "f", query_log_id: null, comment: "wrong" })]);
  });

  it("honours a shorter retention period", async () => {
    const t = { query_logs: [{ id: "x", created_at: daysAgo(40) }], feedback: [], rate_limits: [] };
    await purgeOld(fakeDb(t), 30, NOW);
    expect(t.query_logs).toHaveLength(0);
  });

  it("rejects a retention period below one day", async () => {
    await expect(purgeOld(fakeDb({ query_logs: [], feedback: [], rate_limits: [] }), 0, NOW)).rejects.toThrow();
  });
});
