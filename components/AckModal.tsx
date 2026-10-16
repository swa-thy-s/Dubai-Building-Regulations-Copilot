"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MODAL, MODAL_PARAGRAPHS } from "@/lib/legal";

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
      )}
    </>
  );
}

export default function AckModal({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const boxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    boxRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ack-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-[var(--card)] p-6 sm:rounded-2xl"
      >
        <h2 id="ack-title" className="text-lg font-semibold">
          {MODAL.title}
        </h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed">
          {MODAL_PARAGRAPHS.map((p, i) => (
            <p key={i}>
              <Rich text={p} />
            </p>
          ))}
        </div>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input
            ref={boxRef}
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>{MODAL.checkbox}</span>
        </label>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onAccept}
            disabled={!checked}
            className="rounded-lg bg-[var(--accent-solid)] px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {MODAL.button}
          </button>
          <p className="text-xs">
            <Link href="/disclaimer" className="underline underline-offset-2">Disclaimer</Link>
            {" · "}
            <Link href="/terms" className="underline underline-offset-2">Terms</Link>
            {" · "}
            <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
