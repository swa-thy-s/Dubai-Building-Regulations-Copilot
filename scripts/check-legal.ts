#!/usr/bin/env tsx
// Build-time guard: fails if any legal text still contains a [PLACEHOLDER].
import { checkLegal } from "../lib/legal-check";

const problems = checkLegal(process.cwd());
if (problems.length) {
  console.error("Legal check failed:\n" + problems.map((p) => "  " + p).join("\n"));
  process.exit(1);
}
console.log("Legal check passed: no unreplaced placeholders.");
