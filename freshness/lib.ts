import { createHash } from "node:crypto";

export type Change = "none" | "new_edition" | "amendment" | "new_document" | "unclear";
export type CheckStatus = "verified" | "needs_review" | "manual_check_needed";

export interface PreviousState {
  hash?: string;
  checked_on?: string;
}

export interface CheckOutcome {
  status: CheckStatus;
  reason: string;
  hash?: string;
}

export function normalizeText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

const BLOCK_MARKERS = ["just a moment", "enable javascript and cookies", "access denied", "captcha", "verify you are human"];

export function looksBlocked(status: number, text: string): boolean {
  if (status === 403 || status === 429 || status === 503) return true;
  const head = text.slice(0, 600);
  return text.length < 400 || BLOCK_MARKERS.some((m) => head.includes(m));
}

// A document counts as verified only when its page was fetched, was not a bot-check page, and nothing points at a
// newer edition, amendment or document. Everything else needs a person.
export function decide(
  hasUrl: boolean,
  fetched: { status: number; text: string } | null,
  previous: PreviousState,
  change: Change | null,
): CheckOutcome {
  if (!hasUrl) return { status: "manual_check_needed", reason: "No official source URL is recorded for this document." };
  if (!fetched) return { status: "manual_check_needed", reason: "The page could not be fetched." };
  if (looksBlocked(fetched.status, fetched.text)) {
    return { status: "manual_check_needed", reason: `The site blocked or did not return a usable page (HTTP ${fetched.status}).` };
  }
  const hash = hashText(fetched.text);
  if (change === null) return { status: "needs_review", reason: "Page fetched but could not be classified.", hash };
  if (change !== "none") return { status: "needs_review", reason: `Page suggests: ${change.replace("_", " ")}.`, hash };
  const changed = previous.hash !== undefined && previous.hash !== hash;
  return {
    status: "verified",
    reason: changed ? "Page text changed, but no new edition, amendment or document was found." : "No change found.",
    hash,
  };
}
