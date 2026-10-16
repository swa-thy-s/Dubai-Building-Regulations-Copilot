"""Article-level chunking for a PDF that bundles several Dubai laws (one document per law)."""
from __future__ import annotations

import hashlib
import re
from collections import Counter

import pymupdf

from ingest import ligatures
from ingest.chunk import tokens

ARTICLE_RE = re.compile(r"^Article \((\d+)\)\s*$")
CHAPTER_RE = re.compile(r"^(Chapter|Part|Section)\s+\w+\s*$", re.I)
ITEM_RE = re.compile(r"^\d+\.(\s|$)")
KIND_RE = re.compile(r"^(Executive Council Resolution|Law|Decree|Regulation|Bylaw)\s+No\.\s*\((\d+)\)\s+of\s+(\d{4})", re.I)
KIND_SLUG = {"executive council resolution": "ecr", "law": "law", "decree": "decree", "regulation": "regulation", "bylaw": "bylaw"}
MAX_TOKENS = 700
MIN_TEXT_CHARS = 150


def law_ranges(pdf_path: str) -> list[dict]:
    doc = pymupdf.open(pdf_path)
    by_page: dict[int, list[str]] = {}
    for lvl, title, page in doc.get_toc():
        if lvl == 1:
            by_page.setdefault(page, []).append(" ".join(title.split()))
    pages = sorted(by_page)
    out = []
    for i, first in enumerate(pages):
        last = pages[i + 1] - 1 if i + 1 < len(pages) else len(doc)
        title = " ".join(by_page[first])
        m = KIND_RE.match(title)
        if not m:
            raise ValueError(f"Cannot read law number from TOC title: {title!r}")
        kind, num, year = m.group(1).lower(), m.group(2), m.group(3)
        out.append(dict(slug=f"{KIND_SLUG[kind]}-{num}-{year}", title=title, edition=year, first=first, last=last))
    return out


def _page_lines(page: pymupdf.Page) -> list[str]:
    text = page.get_text("text")
    lines = [ln.strip() for ln in text.split("\n")]
    for i, ln in enumerate(lines):
        if ln.startswith("©"):  # footer block: copyright + translation disclaimer
            lines = lines[:i]
            break
    while lines and (not lines[-1] or re.fullmatch(r"\d{1,3}", lines[-1])):
        lines.pop()
    return [ln for ln in lines if ln]


def _mk(ref, path, part, p0, p1, content) -> dict:
    content = content.strip()
    return dict(
        clause_ref=ref, heading_path=path, part=part, page_start=p0, page_end=p1, content=content,
        content_type="clause", token_count=tokens(content),
        content_hash=hashlib.sha256(f"{ref}\n{content}".encode()).hexdigest(),
    )


def hard_split(lines: list[str], limit: int = MAX_TOKENS, overlap_words: int = 60) -> list[list[str]]:
    """Last resort for a long run with no numbered items: overlapping word windows.

    The overlap keeps a table row that straddles a boundary whole in at least one window.
    """
    if tokens(" ".join(lines)) <= limit * 1.5:
        return [lines]
    words = " ".join(lines).split()
    step = int(limit / 1.35)
    out, i = [], 0
    while i < len(words):
        out.append([" ".join(words[i : i + step])])
        if i + step >= len(words):
            break
        i += step - overlap_words
    return out


def _split_items(lines: list[str]) -> list[list[str]]:
    """Group lines into numbered items so a long article splits on item boundaries.

    Lines before the first numbered item (the article heading) stay with that item.
    """
    groups: list[list[str]] = [[]]
    has_item = False
    for ln in lines:
        if ITEM_RE.match(ln):
            if has_item:
                groups.append([])
            has_item = True
        groups[-1].append(ln)
    return groups


def chunk_law(pdf_path: str, law: dict, repair_ligatures: bool = True) -> tuple[list[dict], dict]:
    doc = pymupdf.open(pdf_path)
    fixes, unresolved = Counter(), Counter()
    rows: list[tuple[int, str]] = []
    skipped = []
    for pno in range(law["first"], law["last"] + 1):
        lines = _page_lines(doc[pno - 1])
        if sum(len(x) for x in lines) < MIN_TEXT_CHARS and pno == law["first"]:
            skipped.append(pno)  # divider page carrying only the law title
            continue
        rows.extend((pno, ln) for ln in lines)

    short = law["title"]
    chunks: list[dict] = []
    seen: Counter = Counter()
    chapter = ""
    cur_ref, cur_page, cur_lines, cur_last = "Preamble", None, [], None

    def flush():
        nonlocal cur_lines
        if not cur_lines or cur_page is None:
            cur_lines = []
            return
        text_lines = list(cur_lines)
        cur_lines = []
        groups = _split_items(text_lines)
        pieces, buf = [], []
        for g in groups:
            joined = " ".join(buf + g)
            if buf and tokens(joined) > MAX_TOKENS:
                pieces.append(buf)
                buf = list(g)
            else:
                buf = buf + g
        if buf:
            pieces.append(buf)
        pieces = [q for piece in pieces for q in hard_split(piece)]
        for k, piece in enumerate(pieces):
            ref = cur_ref if len(pieces) == 1 else f"{cur_ref} ({k + 1}/{len(pieces)})"
            seen[ref] += 1
            if seen[ref] > 1:
                ref = f"{ref} #{seen[ref]}"
            content = " ".join(piece)
            if repair_ligatures:
                content = ligatures.repair(content, fixes, unresolved)
            path = [short] + ([chapter] if chapter else []) + [cur_ref]
            chunks.append(_mk(ref, path, short, cur_page, cur_last or cur_page, content))

    for pno, ln in rows:
        m = ARTICLE_RE.match(ln)
        if m:
            flush()
            cur_ref, cur_page, cur_last = f"Article {m.group(1)}", pno, pno
            cur_lines = [ln]
            continue
        if CHAPTER_RE.match(ln) and cur_page is not None and not cur_lines[1:]:
            pass
        if CHAPTER_RE.match(ln):
            chapter = ln
            continue
        if cur_page is None:
            cur_page = pno
        cur_lines.append(ln)
        cur_last = pno
    flush()

    covered = set()
    for c in chunks:
        covered.update(range(c["page_start"], c["page_end"] + 1))
    empty = [p for p in range(law["first"], law["last"] + 1) if p not in covered and p not in skipped]
    stats = dict(
        orphan_rows=0, unmatched_headings=[], dropped_tables=[], ligature_fixes=dict(fixes),
        unresolved_tokens=dict(unresolved.most_common(40)), skipped_pages=skipped, empty_pages=empty,
    )
    return chunks, stats
