import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TopBanner from "@/components/TopBanner";
import Footer from "@/components/Footer";
import AnswerNotice from "@/components/AnswerNotice";
import { answerNotice, BANNER_TEXT, INPUT_HINT, MODAL, MODAL_PARAGRAPHS, STRINGS, LEGAL_VERSION, NOTICE_BOLD } from "../legal";

describe("exact notice wording (LEGAL.md section 1)", () => {
  it("banner text", () => {
    expect(BANNER_TEXT).toBe("Reference tool only. Not official, not legal or professional advice. Always confirm with the relevant authority.");
  });
  it("modal checkbox and input hint", () => {
    expect(MODAL.checkbox).toBe("I understand this is a reference tool only and I will verify anything important with the relevant authority.");
    expect(INPUT_HINT).toBe("Reference tool only. Don't enter confidential or personal details.");
    expect(MODAL.title).toBe("Before you use Dubai Regulations Copilot");
  });
  it("modal body keeps the three paragraphs", () => {
    expect(MODAL_PARAGRAPHS).toHaveLength(3);
    expect(MODAL_PARAGRAPHS[0]).toContain("**not** an official source");
    expect(MODAL_PARAGRAPHS[2]).toBe("Do not enter confidential or personal information. Questions are processed by third-party AI services.");
  });
  it("answer footer states verification honestly", () => {
    expect(answerNotice(null)).toContain("have not yet been verified against the official sources");
    expect(answerNotice("2026-10-01")).toContain("last verified on 1 October 2026");
    expect(answerNotice(null).startsWith(NOTICE_BOLD)).toBe(true);
    expect(answerNotice(null)).toContain("the Arabic version prevails legally");
  });
  it("UI strings", () => {
    expect(STRINGS["abstain.title"]).toBe("Not found in the indexed documents.");
    expect(STRINGS["error.capacity"]).toContain("do not rely on it for time-critical decisions");
  });
  it("has a version so the modal can be re-shown", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });
});

describe("components", () => {
  it("top banner shows the exact text and links the disclaimer", () => {
    const html = renderToStaticMarkup(TopBanner());
    expect(html).toContain(BANNER_TEXT);
    expect(html).toContain('href="/disclaimer"');
  });
  it("footer links the five required pages", () => {
    const html = renderToStaticMarkup(Footer());
    for (const p of ["/disclaimer", "/terms", "/privacy", "/sources", "/contact"]) expect(html).toContain(`href="${p}"`);
  });
  it("answer notice renders with and without server text and cannot be omitted", () => {
    expect(renderToStaticMarkup(AnswerNotice({}))).toContain("Reference tool only. Not an official ruling and not advice.");
    expect(renderToStaticMarkup(AnswerNotice({ text: answerNotice("2026-10-01") }))).toContain("last verified on 1 October 2026");
  });
});
