"""Page-level chunks for short documents (circulars, forms, guidelines), including pages read by OCR."""
from __future__ import annotations

import hashlib
import re

from ingest.chunk import tokens
from ingest.legislation import hard_split

MIN_CHARS = 20


def chunk_pages(pages: list[str], label: str, prefix: str = "Page") -> tuple[list[dict], dict]:
    chunks: list[dict] = []
    empty: list[int] = []
    for n, text in enumerate(pages, start=1):
        text = re.sub(r"\s+", " ", text).strip()
        if len(text) < MIN_CHARS:
            empty.append(n)
            continue
        pieces = hard_split([text])
        for k, piece in enumerate(pieces):
            content = piece[0]
            ref = f"{prefix} {n}" + (f" ({k + 1}/{len(pieces)})" if len(pieces) > 1 else "")
            chunks.append(dict(
                clause_ref=ref, heading_path=[label, ref], part=label, page_start=n, page_end=n, content=content,
                content_type="clause", token_count=tokens(content),
                content_hash=hashlib.sha256(f"{ref}\n{content}".encode()).hexdigest(),
            ))
    stats = dict(orphan_rows=0, unmatched_headings=[], dropped_tables=[], ligature_fixes={}, unresolved_tokens={}, skipped_pages=[], empty_pages=empty)
    return chunks, stats
