// Exact notice wording comes from LEGAL.md. Bump LEGAL_VERSION when any wording changes so the modal reappears.
export const LEGAL_VERSION = "2026-10-19.1";
export const LEGAL_UPDATED = "19 October 2026";
export const APP_NAME = "Dubai Regulations Copilot";

export const BANNER_TEXT =
  "Reference tool only. Not official, not legal or professional advice. Always confirm with the relevant authority.";

export const MODAL = {
  title: `Before you use ${APP_NAME}`,
  checkbox:
    "I understand this is a reference tool only and I will verify anything important with the relevant authority.",
  button: "Continue",
} as const;

export const MODAL_PARAGRAPHS: string[] = [
  `${APP_NAME} is a **reference tool only**. It helps you find and read clauses from published Dubai building regulations. It is **not** an official source, it is **not** affiliated with or endorsed by Dubai Municipality, Trakhees, RERA, the Dubai Land Department or any other government body, and it does **not** give legal, engineering, architectural or compliance advice.`,
  `Answers may be incomplete, out of date or wrong. **Do not rely on it for design, permit, construction or legal decisions.** Always check the original document and confirm requirements with the relevant authority or a qualified professional.`,
  `Do not enter confidential or personal information. Questions are processed by third-party AI services.`,
];

export const INPUT_HINT = "Reference tool only. Don't enter confidential or personal details.";

export const STRINGS = {
  "abstain.title": "Not found in the indexed documents.",
  "abstain.body":
    "This tool only covers the documents listed on the Sources page. Check the official document or ask the relevant authority.",
  outofscope: "This tool covers Dubai building codes and approvals only. Reference tool only.",
  "stale.banner":
    "Some sources have not been verified recently. Check the official document before relying on any answer.",
  "feedback.prompt": "Wrong or out of date? Tell us.",
  "error.capacity":
    "The tool is at capacity. Try again later. This is a reference tool only; do not rely on it for time-critical decisions.",
} as const;

export const NOTICE_BOLD = "Reference tool only. Not an official ruling and not advice.";

const NOTICE_BASE =
  NOTICE_BOLD + " Check the cited clause in the official document and confirm with the relevant authority before relying on this. English text is a translation; the Arabic version prevails legally.";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function answerNotice(lastVerified: string | null, partial = false): string {
  if (partial) return `${NOTICE_BASE} Some of the documents shown have not yet been verified against the official sources.`;
  return lastVerified
    ? `${NOTICE_BASE} Documents shown were last verified on ${formatDate(lastVerified)}.`
    : `${NOTICE_BASE} Documents shown have not yet been verified against the official sources.`;
}

// The footer speaks only for the documents the answer actually shows: the oldest verification date among them,
// or a warning when any of them has never been verified.
export function noticeFor(shownSlugs: string[], verification: Record<string, string>): string {
  const slugs = [...new Set(shownSlugs)];
  if (slugs.length === 0) {
    const all = Object.values(verification).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    return answerNotice(all.length ? all[all.length - 1] : null);
  }
  const dates = slugs.map((s) => verification[s]);
  if (dates.some((d) => !d)) return answerNotice(null, dates.some(Boolean));
  return answerNotice((dates as string[]).sort()[0]);
}
