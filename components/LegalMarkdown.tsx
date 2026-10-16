import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export function readLegal(name: string): string {
  return fs.readFileSync(path.join(process.cwd(), "content", "legal", `${name}.md`), "utf-8");
}

// Content is our own static files from content/legal, never user input.
export default function LegalMarkdown({ name }: { name: string }) {
  const html = marked.parse(readLegal(name), { async: false }) as string;
  return <div className="legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
