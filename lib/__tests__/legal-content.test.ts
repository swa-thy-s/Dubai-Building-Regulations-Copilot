import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BANNED_CLAIM_RE, checkLegal, findPlaceholders, listFiles } from "../legal-check";

const root = path.resolve(__dirname, "..", "..");
const read = (...p: string[]) => fs.readFileSync(path.join(root, ...p), "utf-8");

describe("legal content", () => {
  it("has no unreplaced [PLACEHOLDER] text", () => {
    expect(checkLegal(root)).toEqual([]);
    expect(findPlaceholders("Contact [CONTACT EMAIL] now")).toEqual(["[CONTACT EMAIL]"]);
    expect(findPlaceholders("use the [contact form](/contact)")).toEqual([]);
  });

  it("contains the required statements", () => {
    expect(read("content", "legal", "disclaimer.md")).toContain("**Dubai Regulations Copilot is a reference tool only.**");
    expect(read("content", "legal", "terms.md")).toContain("**5. Limitation of liability.**");
    const privacy = read("content", "legal", "privacy.md");
    expect(privacy).toContain("90 days");
    expect(privacy).toContain("We have not verified whether the AI providers keep submitted content");
    expect(read("content", "legal", "sources-notice.md")).toContain("is not affiliated with, endorsed by, or sponsored by Dubai Municipality");
  });

  it("holds no personal contact details", () => {
    const all = listFiles(path.join(root, "content", "legal"), [".md"]).map((f) => fs.readFileSync(f, "utf-8")).join("\n");
    expect(all).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
    expect(all).not.toMatch(/\+?\d[\d\s-]{8,}\d/);
  });

  it("never claims a user's design complies, is approved, permitted or safe", () => {
    const files = [...listFiles(path.join(root, "app"), [".tsx", ".ts"]), ...listFiles(path.join(root, "components"), [".tsx"]), path.join(root, "lib", "legal.ts")];
    for (const f of files) expect(fs.readFileSync(f, "utf-8"), f).not.toMatch(BANNED_CLAIM_RE);
    expect(BANNED_CLAIM_RE.test("Your design complies with B.5")).toBe(true);
    expect(BANNED_CLAIM_RE.test("Clause 3.2.1 sets a minimum of 1,200 mm")).toBe(false);
  });
});

describe("wiring (LEGAL.md section 7)", () => {
  it("banner and footer are in the root layout so every route has them", () => {
    const layout = read("app", "layout.tsx");
    expect(layout).toContain("<TopBanner />");
    expect(layout).toContain("<Footer />");
  });

  it("the ask page gates input on the acknowledgement and shows hint, notice and modal", () => {
    const ask = read("app", "ask", "page.tsx");
    expect(ask).toContain('ack.status !== "ok"');
    expect(ask).toContain("<AnswerNotice");
    expect(ask).toContain("<AckModal");
    expect(ask).toContain("INPUT_HINT");
  });

  it("every legal route exists", () => {
    for (const p of ["disclaimer", "terms", "privacy", "sources", "contact"]) {
      expect(fs.existsSync(path.join(root, "app", p, "page.tsx")), p).toBe(true);
    }
  });

  it("the build runs the placeholder check", () => {
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.prebuild).toContain("check:legal");
  });
});
