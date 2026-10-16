"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface Citation {
  n: number;
  chunk_id: string;
  document: string;
  edition: string;
  authority: string;
  clause_ref: string;
  page: number;
  quote: string;
}

interface PipelineResult {
  trace_id: string;
  abstained: boolean;
  abstain_reason: string | null;
  answer_md: string;
  conditions: string[];
  citations: Citation[];
}

type Authority = "All" | "DM" | "Trakhees";

const EXAMPLES = [
  "What is the minimum corridor width for an office building?",
  "What are the ventilation requirements for basement car parks?",
  "Maximum building height allowed without a fire lift?",
  "What is the minimum door width for an accessible toilet?",
  "Staircase handrail height requirements?",
];

const DISCLAIMER =
  "Reference tool, not an official ruling. Confirm with the relevant authority. English text is a translation; the Arabic version prevails legally.";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [authority, setAuthority] = useState<Authority>("All");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<"up" | "down" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackBox, setShowFeedbackBox] = useState(false);
  const [showCorpus, setShowCorpus] = useState(false);
  const [corpus, setCorpus] = useState<
    { title: string; authority: string; edition: string; status: string; ingested_at: string }[]
  >([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const lastQuestionRef = useRef("");

  const charCount = question.length;
  const canSubmit = question.trim().length > 0 && charCount <= 500 && !loading;

  const submit = useCallback(
    async (q?: string) => {
      const text = q ?? question;
      if (!text.trim() || loading) return;
      lastQuestionRef.current = text;
      setLoading(true);
      setStage("Sending request");
      setResult(null);
      setError(null);
      setFeedbackSent(null);
      setShowFeedbackBox(false);

      const authorities = authority === "All" ? undefined : [authority];

      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, authorities }),
        });

        if (res.status === 429) {
          const data = await res.json();
          if (data.code === "hourly" && data.reset_at) {
            const t = new Date(data.reset_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            setError(`You have reached the hourly limit. Try again at ${t}.`);
          } else {
            setError(data.error || "The tool is at capacity. Try again later.");
          }
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setError("Something went wrong. Please try again.");
          setLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setError("No response stream.");
          setLoading(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        const processLines = (text: string) => {
          const lines = text.split("\n");
          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (eventType === "progress") {
                  setStage(data.stage || "Processing");
                } else if (eventType === "result") {
                  setResult(data as PipelineResult);
                } else if (eventType === "error") {
                  setError(data.message || "An error occurred.");
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lastDoubleNewline = buffer.lastIndexOf("\n\n");
          if (lastDoubleNewline !== -1) {
            const complete = buffer.slice(0, lastDoubleNewline);
            buffer = buffer.slice(lastDoubleNewline + 2);
            processLines(complete);
          }
        }
        if (buffer.trim()) {
          processLines(buffer);
        }
      } catch {
        setError("Network error. Check your connection and try again.");
      } finally {
        setLoading(false);
        setStage("");
      }
    },
    [question, authority, loading],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) submit();
    }
  };

  const sendFeedback = async (vote: "up" | "down", comment?: string) => {
    if (!result?.trace_id) return;
    setFeedbackSent(vote);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query_log_id: result.trace_id,
          vote,
          comment: comment || undefined,
        }),
      });
    } catch {
      // silently fail
    }
  };

  const scrollToCitation = (n: number) => {
    const el = document.getElementById(`citation-${n}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[var(--accent)]");
      setTimeout(() => el.classList.remove("ring-2", "ring-[var(--accent)]"), 2000);
    }
  };

  const renderAnswer = (md: string) => {
    const parts = md.split(/(\[\d+\])/g);
    return parts.map((part, i) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const n = parseInt(match[1], 10);
        return (
          <button
            key={i}
            onClick={() => scrollToCitation(n)}
            className="inline-flex items-center justify-center text-[var(--accent)] font-mono text-xs font-semibold hover:underline cursor-pointer align-super"
            aria-label={`Citation ${n}`}
          >
            [{n}]
          </button>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  useEffect(() => {
    if (result && answerRef.current) {
      answerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const loadCorpus = async () => {
    setShowCorpus(true);
    if (corpus.length > 0) return;
    try {
      const res = await fetch("/api/corpus");
      if (res.ok) {
        const data = await res.json();
        setCorpus(data.documents || []);
      }
    } catch {
      // silently fail
    }
  };

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Dubai Regulations Copilot
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Ask questions about Dubai building codes. Answers cite specific clauses.
        </p>
      </header>

      {/* Authority filter */}
      <div className="mb-4 flex gap-2" role="radiogroup" aria-label="Authority filter">
        {(["All", "DM", "Trakhees"] as Authority[]).map((a) => (
          <button
            key={a}
            role="radio"
            aria-checked={authority === a}
            onClick={() => setAuthority(a)}
            className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              authority === a
                ? "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--foreground)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
            }`}
          >
            {a === "DM" ? "Municipality" : a === "Trakhees" ? "Trakhees" : "All"}
          </button>
        ))}
      </div>

      {/* Question input */}
      <div className="relative">
        <label htmlFor="question-input" className="sr-only">
          Your question
        </label>
        <textarea
          ref={textareaRef}
          id="question-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Dubai building regulations..."
          rows={3}
          maxLength={500}
          disabled={loading}
          className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm leading-relaxed placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between">
          <span
            className={`text-xs ${charCount > 500 ? "text-[var(--error)]" : "text-[var(--muted)]"}`}
          >
            {charCount}/500
          </span>
          <button
            onClick={() => submit()}
            disabled={!canSubmit}
            className="rounded-lg bg-[var(--accent-solid)] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? "Asking..." : "Ask"}
          </button>
        </div>
      </div>

      {/* Example questions */}
      {!result && !loading && !error && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--muted)]">
            Example questions
          </p>
          <div className="flex flex-col gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => {
                  setQuestion(ex);
                  submit(ex);
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-left text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-light)]"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="mt-6 flex items-center gap-3" aria-live="polite" role="status">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <span className="text-sm text-[var(--muted)]">{stage || "Processing..."}</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="mt-6 rounded-lg border border-[var(--error)] bg-[var(--error)]/10 p-4">
          <p className="text-sm text-[var(--error)]">{error}</p>
          <button
            onClick={() => submit(lastQuestionRef.current)}
            className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Answer */}
      {result && !loading && (
        <div ref={answerRef} className="mt-6 space-y-4" aria-live="polite">
          {result.abstained ? (
            result.abstain_reason === "capacity" || result.abstain_reason === "generation_error" ? (
              <div className="rounded-lg border border-[var(--error)] bg-[var(--error)]/10 p-4">
                <p className="text-sm text-[var(--error)]">
                  {result.abstain_reason === "capacity"
                    ? "The tool is at capacity. Try again later."
                    : "Something went wrong generating the answer. Please try again."}
                </p>
                <button
                  onClick={() => submit(lastQuestionRef.current)}
                  className="mt-2 text-sm font-medium text-[var(--accent)] hover:underline"
                >
                  Retry
                </button>
              </div>
            ) : (
              <AbstainCard reason={result.abstain_reason} />
            )
          ) : (
            <>
              {/* Answer text */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
                <p className="text-sm leading-relaxed">{renderAnswer(result.answer_md)}</p>
              </div>

              {/* Conditions */}
              {result.conditions.length > 0 && (
                <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--warning)]">
                    Conditions & Caveats
                  </p>
                  <ul className="space-y-1">
                    {result.conditions.map((c, i) => (
                      <li key={i} className="text-sm text-[var(--foreground)]">
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Citation cards */}
              {result.citations.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    Sources
                  </p>
                  {result.citations.map((cit) => (
                    <CitationCard key={cit.n} citation={cit} />
                  ))}
                </div>
              )}

              {/* Feedback */}
              <FeedbackRow
                feedbackSent={feedbackSent}
                showFeedbackBox={showFeedbackBox}
                feedbackText={feedbackText}
                onThumbsUp={() => sendFeedback("up")}
                onThumbsDown={() => {
                  setShowFeedbackBox(true);
                  setFeedbackSent("down");
                }}
                onSubmitComment={() => {
                  sendFeedback("down", feedbackText);
                  setShowFeedbackBox(false);
                }}
                onFeedbackTextChange={setFeedbackText}
              />
            </>
          )}

          {/* Disclaimer */}
          <p className="text-xs leading-relaxed text-[var(--muted)]">{DISCLAIMER}</p>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto pt-8">
        <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          <button onClick={loadCorpus} className="hover:text-[var(--accent)] hover:underline">
            What&apos;s indexed
          </button>
          <span>Dubai Regulations Copilot</span>
        </div>
      </footer>

      {/* Corpus modal */}
      {showCorpus && (
        <CorpusModal documents={corpus} onClose={() => setShowCorpus(false)} />
      )}
    </main>
  );
}

function AbstainCard({ reason }: { reason: string | null }) {
  const isOutOfScope = reason === "out_of_scope";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-sm font-medium">
        {isOutOfScope
          ? "This tool covers Dubai building codes and approvals only."
          : "Not found in the indexed documents."}
      </p>
      {!isOutOfScope && (
        <p className="mt-2 text-xs text-[var(--muted)]">
          The answer may exist in a document that has not yet been indexed. Currently, only select
          parts of the Dubai Building Code (2021) are available.
        </p>
      )}
    </div>
  );
}

function CitationCard({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false);
  const quote = citation.quote || "";
  const isLong = quote.length > 150;

  return (
    <div
      id={`citation-${citation.n}`}
      className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 transition-shadow"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-bold text-[var(--accent)]">[{citation.n}]</span>
        <span className="font-mono text-xs font-semibold">{citation.clause_ref}</span>
        <span className="rounded-full bg-[var(--badge-dm)]/15 px-2 py-0.5 text-[10px] font-semibold text-[var(--badge-dm)]">
          {citation.authority}
        </span>
        <span className="rounded-full bg-[var(--border)] px-2 py-0.5 text-[10px] font-semibold">
          {citation.edition}
        </span>
      </div>
      <p className="text-xs text-[var(--muted)]">
        {citation.document} &middot; p.{citation.page}
      </p>
      {quote && (
        <div className="mt-2">
          <p className={`text-xs leading-relaxed ${!expanded && isLong ? "line-clamp-3" : ""}`}>
            {quote}
          </p>
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-xs text-[var(--accent)] hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FeedbackRow({
  feedbackSent,
  showFeedbackBox,
  feedbackText,
  onThumbsUp,
  onThumbsDown,
  onSubmitComment,
  onFeedbackTextChange,
}: {
  feedbackSent: "up" | "down" | null;
  showFeedbackBox: boolean;
  feedbackText: string;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onSubmitComment: () => void;
  onFeedbackTextChange: (v: string) => void;
}) {
  if (feedbackSent === "up") {
    return <p className="text-xs text-[var(--success)]">Thanks for the feedback!</p>;
  }

  return (
    <div className="space-y-2">
      {!feedbackSent && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--muted)]">Was this helpful?</span>
          <button
            onClick={onThumbsUp}
            className="text-sm hover:text-[var(--success)]"
            aria-label="Thumbs up"
          >
            &#x1F44D;
          </button>
          <button
            onClick={onThumbsDown}
            className="text-sm hover:text-[var(--error)]"
            aria-label="Thumbs down"
          >
            &#x1F44E;
          </button>
        </div>
      )}
      {showFeedbackBox && (
        <div className="space-y-2">
          <textarea
            value={feedbackText}
            onChange={(e) => onFeedbackTextChange(e.target.value)}
            placeholder="What was wrong? (optional)"
            rows={2}
            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            onClick={onSubmitComment}
            className="rounded-lg bg-[var(--accent-solid)] px-3 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            Send feedback
          </button>
        </div>
      )}
      {feedbackSent === "down" && !showFeedbackBox && (
        <p className="text-xs text-[var(--success)]">Thanks for the feedback!</p>
      )}
    </div>
  );
}

function CorpusModal({
  documents,
  onClose,
}: {
  documents: { title: string; authority: string; edition: string; status: string; ingested_at: string }[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Indexed documents"
    >
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--card)] p-6 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">What&apos;s Indexed</h2>
          <button
            onClick={onClose}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Close"
          >
            &#x2715;
          </button>
        </div>
        {documents.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Loading...</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc, i) => (
              <div key={i} className="rounded-lg border border-[var(--border)] p-3">
                <p className="text-sm font-medium">{doc.title}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                  <span>{doc.authority}</span>
                  <span>&middot;</span>
                  <span>{doc.edition}</span>
                  <span>&middot;</span>
                  <span className={doc.status === "active" ? "text-[var(--success)]" : ""}>
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
