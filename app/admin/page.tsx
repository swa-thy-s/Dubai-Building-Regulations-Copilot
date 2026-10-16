"use client";

import { useState, useEffect, useCallback } from "react";

interface QueryLog {
  id: string;
  question: string;
  rewritten_query: string;
  abstained: boolean;
  abstain_reason: string | null;
  verify_passed: boolean | null;
  latency_ms: number;
  model: string;
  created_at: string;
  retrieved: { chunk_id: string; clause_ref: string; rrf_score: number; similarity: number }[];
  answer: { answer_md: string; claims: { text: string; chunk_ids: string[] }[] } | null;
}

interface Feedback {
  id: string;
  query_log_id: string;
  rating: number;
  comment: string | null;
  correct_clause: string | null;
  created_at: string;
}

interface Stats {
  total: number;
  abstained: number;
  abstainRate: string;
  thumbsDown: number;
  thumbsDownRate: string;
  p50: number;
  p95: number;
  queries: QueryLog[];
  feedback: Feedback[];
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const login = async () => {
    setLoginError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      await loadStats();
    } else {
      setLoginError("Wrong password");
    }
  };

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    if (res.ok) {
      setStats(await res.json());
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const copyGolden = (q: QueryLog) => {
    const line = JSON.stringify({
      id: `g-${q.id.slice(0, 8)}`,
      question: q.question,
      type: "lookup",
      authority: "DM",
      gold_chunks: q.retrieved?.slice(0, 3).map((r) => `dbc-2021#${r.clause_ref}`) || [],
      gold_answer: q.answer?.answer_md?.slice(0, 200) || "",
      must_include: [],
      should_abstain: q.abstained,
      notes: "copied from admin",
    });
    navigator.clipboard.writeText(line);
    setCopied(q.id);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!authed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4">
        <h1 className="mb-6 text-xl font-semibold">Admin Login</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="Password"
          className="mb-3 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm focus:border-[var(--accent)] focus:outline-none"
        />
        {loginError && <p className="mb-3 text-sm text-[var(--error)]">{loginError}</p>}
        <button
          onClick={login}
          className="w-full rounded-lg bg-[var(--accent)] py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Log in
        </button>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <p className="text-sm text-[var(--muted)]">Loading...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-6 text-xl font-semibold">Admin Dashboard</h1>

      {/* Stats cards */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Queries (7d)" value={stats.total} />
        <StatCard label="Abstain rate" value={`${stats.abstainRate}%`} />
        <StatCard label="Thumbs down" value={`${stats.thumbsDownRate}%`} />
        <StatCard label="p50 / p95" value={`${(stats.p50 / 1000).toFixed(1)}s / ${(stats.p95 / 1000).toFixed(1)}s`} />
      </div>

      {/* Recent queries */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Recent Queries
        </h2>
        <div className="space-y-2">
          {stats.queries.map((q) => (
            <div key={q.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => setExpanded(expanded === q.id ? null : q.id)}
                  className="text-left text-sm font-medium hover:text-[var(--accent)]"
                >
                  {q.question}
                </button>
                <div className="flex shrink-0 gap-2">
                  {q.abstained && (
                    <span className="rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--warning)]">
                      abstain:{q.abstain_reason}
                    </span>
                  )}
                  <span className="text-xs text-[var(--muted)]">
                    {(q.latency_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              </div>
              {expanded === q.id && (
                <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3 text-xs">
                  <p>
                    <span className="font-semibold">Rewritten:</span> {q.rewritten_query}
                  </p>
                  <p>
                    <span className="font-semibold">Verify:</span>{" "}
                    {q.verify_passed === null ? "skipped" : q.verify_passed ? "passed" : "failed"}
                  </p>
                  <p>
                    <span className="font-semibold">Model:</span> {q.model}
                  </p>
                  {q.retrieved && (
                    <div>
                      <span className="font-semibold">Retrieved:</span>
                      <ul className="mt-1 ml-4 list-disc">
                        {q.retrieved.slice(0, 6).map((r, i) => (
                          <li key={i} className="font-mono">
                            {r.clause_ref} (sim={r.similarity?.toFixed(3)}, rrf={r.rrf_score?.toFixed(3)})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {q.answer && (
                    <div>
                      <span className="font-semibold">Answer:</span>
                      <p className="mt-1 leading-relaxed">{q.answer.answer_md?.slice(0, 400)}</p>
                    </div>
                  )}
                  <button
                    onClick={() => copyGolden(q)}
                    className="mt-2 text-xs font-medium text-[var(--accent)] hover:underline"
                  >
                    {copied === q.id ? "Copied!" : "Copy to golden set"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Thumbs down list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
          Negative Feedback
        </h2>
        {stats.feedback.filter((f) => f.rating === -1).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No negative feedback yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.feedback
              .filter((f) => f.rating === -1)
              .map((f) => (
                <div key={f.id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 text-sm">
                  <p className="text-xs text-[var(--muted)]">
                    Query: {f.query_log_id?.slice(0, 8)}... &middot;{" "}
                    {new Date(f.created_at).toLocaleDateString()}
                  </p>
                  {f.comment && <p className="mt-1">{f.comment}</p>}
                  {f.correct_clause && (
                    <p className="mt-1 font-mono text-xs text-[var(--accent)]">
                      Correct clause: {f.correct_clause}
                    </p>
                  )}
                </div>
              ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
