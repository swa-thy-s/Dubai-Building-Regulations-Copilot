import { describe, it, expect } from "vitest";
import { decide, hashText, looksBlocked, normalizeText } from "../lib";

const page = "x".repeat(600);

describe("normalizeText / hashText", () => {
  it("strips scripts, tags and whitespace so cosmetic changes do not alter the hash", () => {
    const a = normalizeText("<html><script>var a=1</script><p>Hello   World</p></html>");
    const b = normalizeText("<div>\n hello world </div>");
    expect(a).toBe("hello world");
    expect(hashText(a)).toBe(hashText(b));
  });
});

describe("looksBlocked", () => {
  it("flags bot-check pages, error statuses and near-empty pages", () => {
    expect(looksBlocked(200, "just a moment" + " ".repeat(500))).toBe(true);
    expect(looksBlocked(403, page)).toBe(true);
    expect(looksBlocked(200, "tiny")).toBe(true);
    expect(looksBlocked(200, page)).toBe(false);
  });
});

describe("decide", () => {
  it("never verifies a document without a URL", () => {
    expect(decide(false, null, {}, null).status).toBe("manual_check_needed");
  });
  it("never verifies when the fetch failed or was blocked", () => {
    expect(decide(true, null, {}, "none").status).toBe("manual_check_needed");
    expect(decide(true, { status: 403, text: page }, {}, "none").status).toBe("manual_check_needed");
  });
  it("needs review when the classifier failed or found something", () => {
    expect(decide(true, { status: 200, text: page }, {}, null).status).toBe("needs_review");
    expect(decide(true, { status: 200, text: page }, {}, "new_edition").status).toBe("needs_review");
  });
  it("verifies only a fetched, unblocked page with no change found", () => {
    const r = decide(true, { status: 200, text: page }, { hash: hashText(page) }, "none");
    expect(r.status).toBe("verified");
    expect(r.hash).toBe(hashText(page));
  });
});
