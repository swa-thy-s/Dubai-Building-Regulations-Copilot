"use client";

import { useState } from "react";
import Link from "next/link";

export default function ContactPage() {
  const [message, setMessage] = useState("");
  const [reach, setReach] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, reach: reach || undefined }),
      });
      if (res.ok) {
        setState("sent");
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Could not send your message.");
    } catch {
      setError("Could not send your message. Check your connection.");
    }
    setState("error");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold">Contact</h1>
      <p className="mt-2 text-sm leading-relaxed">
        Use this form to report a wrong or out-of-date answer, ask for an extract to be changed or removed, or make a
        privacy request (see the <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>).
        For a privacy request, include the exact text of your question and the approximate time.
      </p>
      <p className="mt-2 text-sm leading-relaxed">
        <strong>Do not include confidential or personal information.</strong> We do not ask for your name or email. If you
        want a reply, add a way to reach you below (optional).
      </p>
      {state === "sent" ? (
        <p role="status" className="mt-6 rounded-lg border border-[var(--border)] p-4 text-sm">
          Thank you. Your message was received.
        </p>
      ) : (
        <form onSubmit={send} className="mt-6 space-y-4">
          <div>
            <label htmlFor="msg" className="text-sm font-medium">Message</label>
            <textarea
              id="msg"
              required
              minLength={5}
              maxLength={2000}
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-[var(--muted)]">{message.length}/2000</p>
          </div>
          <div>
            <label htmlFor="reach" className="text-sm font-medium">How to reach you (optional)</label>
            <input
              id="reach"
              maxLength={200}
              value={reach}
              onChange={(e) => setReach(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
            />
          </div>
          {state === "error" && <p role="alert" className="text-sm text-[var(--error)]">{error}</p>}
          <button
            type="submit"
            disabled={state === "sending" || message.trim().length < 5}
            className="rounded-lg bg-[var(--accent-solid)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state === "sending" ? "Sending…" : "Send"}
          </button>
        </form>
      )}
    </main>
  );
}
