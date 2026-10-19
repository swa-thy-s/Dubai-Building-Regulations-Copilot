"""Chunking for a saved web page: cut the page text out of the site chrome, then split it at known section labels.

Configured per document in sources.yaml:
  html_path   saved page (kept in data/raw/web, never committed)
  start / end the text that begins and ends the page's real content (site menus before and after are dropped)
  sections    [[label as it appears in the text, display name], ...] in page order
The text is the page's own wording with whitespace collapsed; nothing is rewritten.
"""
from __future__ import annotations

import hashlib
import html
import re

from ingest.chunk import tokens

BLOCK_TAGS = re.compile(r"</?(p|div|li|ul|ol|tr|td|th|h[1-6]|br|section|article|table)[^>]*>", re.I)


def page_text(raw_html: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw_html, flags=re.S | re.I)
    t = BLOCK_TAGS.sub("\n", t)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    return re.sub(r"\s+", " ", t).strip()


def extract(raw_html: str, start: str, end: str) -> str:
    text = page_text(raw_html)
    i = text.find(start)
    if i < 0:
        raise ValueError(f"start marker not found: {start!r}")
    j = text.find(end, i + len(start))
    if j < 0:
        raise ValueError(f"end marker not found: {end!r}")
    return text[i:j].strip()


def _mk(ref: str, path: list[str], part: str, content: str) -> dict:
    content = content.strip()
    return dict(
        clause_ref=ref, heading_path=path, part=part, page_start=1, page_end=1, content=content,
        content_type="clause", token_count=tokens(content),
        content_hash=hashlib.sha256(f"{ref}\n{content}".encode()).hexdigest(),
    )


def chunk_page(raw_html: str, cfg: dict, title: str) -> tuple[list[dict], dict]:
    body = extract(raw_html, cfg["start"], cfg["end"])
    sections = cfg.get("sections") or [[body[:20], "Page"]]
    cuts: list[tuple[int, str, str]] = []
    pos = 0
    for label, display in sections:
        i = body.find(label, pos)
        if i < 0:
            raise ValueError(f"section label not found in order: {label!r}")
        cuts.append((i, label, display))
        pos = i + len(label)
    chunks = []
    for k, (i, label, display) in enumerate(cuts):
        j = cuts[k + 1][0] if k + 1 < len(cuts) else len(body)
        text = body[i:j].strip()
        if text == label:
            continue
        chunks.append(_mk(display, [title, display], title, text))
    covered = sum(len(c["content"]) for c in chunks)
    stats = dict(
        orphan_rows=max(0, len(body) - covered), unmatched_headings=[], dropped_tables=[], ligature_fixes={},
        unresolved_tokens={}, skipped_pages=[], empty_pages=[],
    )
    return chunks, stats
