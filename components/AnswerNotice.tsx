import { answerNotice, NOTICE_BOLD } from "@/lib/legal";

// Shown under every answer, abstain, out-of-scope and error state. Not collapsible.
export default function AnswerNotice({ text }: { text?: string }) {
  const full = text ?? answerNotice(null);
  const rest = full.startsWith(NOTICE_BOLD) ? full.slice(NOTICE_BOLD.length) : full;
  return (
    <p role="note" className="rounded-lg border border-[var(--border)] p-3 text-xs leading-relaxed text-[var(--foreground)]">
      {full.startsWith(NOTICE_BOLD) && <strong>{NOTICE_BOLD}</strong>}
      {rest}
    </p>
  );
}
