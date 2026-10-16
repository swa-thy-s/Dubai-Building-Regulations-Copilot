"""Chunking for documents whose clauses carry a numeric reference at the start of a heading line.

Configured per document in sources.yaml:
  clause_re    regex with two groups: reference, title (e.g. "301.01 Enabled Access")
  chapter_re   optional regex for chapter lines (kept in heading_path, not a chunk)
  noise_res    regexes for running header/footer lines to drop
  first_page / last_page   page range holding the body
Text before the first clause is kept as per-page "Front matter" chunks so nothing is silently lost.
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter

import pymupdf

from ingest import ligatures
from ingest.chunk import tokens
from ingest.legislation import _split_items, hard_split

MAX_TOKENS = 700


def _mk(ref, path, part, p0, p1, content, ctype="clause") -> dict:
    content = content.strip()
    return dict(
        clause_ref=ref, heading_path=path, part=part, page_start=p0, page_end=p1, content=content,
        content_type=ctype, token_count=tokens(content),
        content_hash=hashlib.sha256(f"{ref}\n{content}".encode()).hexdigest(),
    )


def _lines(page: pymupdf.Page, noise: list[re.Pattern]) -> list[str]:
    out = []
    for ln in page.get_text("text").split("\n"):
        ln = " ".join(ln.split())
        if not ln or re.fullmatch(r"\d{1,3}", ln) or any(p.search(ln) for p in noise):
            continue
        if re.fullmatch(r"[؀-ۿﭐ-﷿ﹰ-﻿\s/–-]+", ln):  # Arabic-only banner lines
            continue
        out.append(ln)
    return out


def chunk_numbered(pdf_path: str, cfg: dict, label: str, repair_ligatures: bool = False) -> tuple[list[dict], dict]:
    doc = pymupdf.open(pdf_path)
    pats = cfg["clause_re"] if isinstance(cfg["clause_re"], list) else [cfg["clause_re"]]
    clause_res = [re.compile(x) for x in pats]
    start_page = cfg.get("clause_start_page", cfg.get("first_page", 1))
    chapter_re = re.compile(cfg["chapter_re"]) if cfg.get("chapter_re") else None
    noise = [re.compile(p) for p in cfg.get("noise_res", [])]
    first, last = cfg.get("first_page", 1), cfg.get("last_page", len(doc))
    fixes, unresolved = Counter(), Counter()
    seen: Counter = Counter()
    chunks: list[dict] = []
    chapter = ""
    cur = None  # dict(ref, title, page, last, lines)
    carry: list[str] = []  # heading-only fragments merged into the next clause
    front: dict[int, list[str]] = {}

    def fix(text: str) -> str:
        return ligatures.repair(text, fixes, unresolved) if repair_ligatures else text

    def flush():
        nonlocal cur
        if not cur:
            return
        if len(cur["lines"]) == 1:  # heading with no body of its own
            carry.extend(cur["lines"])
            cur = None
            return
        groups = _split_items(carry + cur["lines"])
        carry.clear()
        pieces, buf = [], []
        for g in groups:
            if buf and tokens(" ".join(buf + g)) > MAX_TOKENS:
                pieces.append(buf)
                buf = list(g)
            else:
                buf = buf + g
        if buf:
            pieces.append(buf)
        pieces = [q for piece in pieces for q in hard_split(piece)]
        for k, piece in enumerate(pieces):
            ref = cur["ref"] if len(pieces) == 1 else f"{cur['ref']} ({k + 1}/{len(pieces)})"
            seen[ref] += 1
            if seen[ref] > 1:
                ref = f"{ref} #{seen[ref]}"
            path = [label] + ([chapter] if chapter else []) + [f"{cur['ref']} {cur['title']}".strip()]
            chunks.append(_mk(ref, path, label, cur["page"], cur["last"], fix(" ".join(piece))))
        cur = None

    for pno in range(first, last + 1):
        for ln in _lines(doc[pno - 1], noise):
            m = next((mm for mm in (r.match(ln) for r in clause_res) if mm), None) if pno >= start_page else None
            if m:
                flush()
                cur = dict(ref=m.group(1), title=m.group(2).strip(), page=pno, last=pno, lines=[ln])
                continue
            if chapter_re and chapter_re.match(ln):
                chapter = ln
                if cur is None:
                    front.setdefault(pno, []).append(ln)
                continue
            if cur is None:
                front.setdefault(pno, []).append(ln)
            else:
                cur["lines"].append(ln)
                cur["last"] = pno
    flush()

    for pno, lines in sorted(front.items()):
        text = " ".join(lines)
        if len(text) < 40:
            continue
        prefix = cfg.get("front_prefix", "Front matter")
        ref = f"{prefix} p{pno}"
        for k, piece in enumerate(_split_text(text)):
            r = ref if k == 0 else f"{ref} ({k + 1})"
            chunks.insert(0, _mk(r, [label, prefix], label, pno, pno, fix(piece), cfg.get("front_type", "definition")))
    chunks.sort(key=lambda c: (c["page_start"], c["clause_ref"]))

    covered = set()
    for c in chunks:
        covered.update(range(c["page_start"], c["page_end"] + 1))
    empty = [p for p in range(first, last + 1) if p not in covered]
    stats = dict(
        orphan_rows=sum(len(v) for v in front.values()), unmatched_headings=[], dropped_tables=[],
        ligature_fixes=dict(fixes), unresolved_tokens=dict(unresolved.most_common(40)), skipped_pages=[], empty_pages=empty,
    )
    return chunks, stats


def _split_text(text: str) -> list[str]:
    words = text.split()
    step = int(MAX_TOKENS / 1.35)
    return [" ".join(words[i : i + step]) for i in range(0, len(words), step)] or [text]
