"""Repair table cells that were read backwards because the table is rotated on the page.

A cell is reversed only when its words are mostly not English forwards but mostly are when the whole cell string is
reversed ("sertaeht dna sameniC" -> "Cinemas and theatres"). Numbers and short cells are left alone.
"""
from __future__ import annotations

import hashlib
import re

from ingest import ligatures
from ingest.chunk import tokens

WORD = re.compile(r"[A-Za-z]{3,}")


def _ratio(text: str) -> tuple[float, int]:
    ws = WORD.findall(text)
    if not ws:
        return 0.0, 0
    return sum(1 for w in ws if ligatures.known(w)) / len(ws), len(ws)


def fix_cell(cell: str) -> str:
    text = cell.strip()
    fwd, n = _ratio(text)
    if n == 0 or fwd >= 0.5:
        return cell
    rev_text = text[::-1]
    rev, _ = _ratio(rev_text)
    if rev >= 0.6 and rev > fwd + 0.3:
        return cell.replace(text, rev_text)
    return cell


def fix_table(content: str) -> tuple[str, int]:
    fixed = 0
    out = []
    for line in content.split("\n"):
        if line.startswith("|") and "---" not in line:
            cells = line.split("|")
            new = [fix_cell(c) for c in cells]
            fixed += sum(1 for a, b in zip(cells, new) if a != b)
            line = "|".join(new)
        out.append(line)
    return "\n".join(out), fixed


def repair_chunks(chunks: list[dict]) -> int:
    """Fix table chunks in place; returns the number of cells reversed."""
    total = 0
    for c in chunks:
        if c["content_type"] != "table":
            continue
        content, n = fix_table(c["content"])
        if n:
            c["content"] = content
            c["token_count"] = tokens(content)
            c["content_hash"] = hashlib.sha256(f"{c['clause_ref']}\n{content}".encode()).hexdigest()
            total += n
    return total
