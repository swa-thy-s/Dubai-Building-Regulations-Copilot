import fs from "node:fs";
import path from "node:path";

export const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9 ]*[A-Z0-9]\]/g;

// Claims the app must never make about a user's design, drawing or product (LEGAL.md 1.5).
export const BANNED_CLAIM_RE =
  /\b(your|the user's|this|that)\s+(design|drawing|plan|product|building|project)\s+(complies|is compliant|is approved|is permitted|is safe|meets the code)\b/i;

export function findPlaceholders(text: string): string[] {
  return text.match(PLACEHOLDER_RE) ?? [];
}

export function listFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next" || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full, exts));
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

export function legalSourceFiles(root: string): string[] {
  return [...listFiles(path.join(root, "content", "legal"), [".md"]), path.join(root, "lib", "legal.ts")];
}

export function checkLegal(root: string): string[] {
  const problems: string[] = [];
  for (const f of legalSourceFiles(root)) {
    const found = findPlaceholders(fs.readFileSync(f, "utf-8"));
    if (found.length) problems.push(`${path.relative(root, f)}: unreplaced placeholder ${found.join(", ")}`);
  }
  return problems;
}
