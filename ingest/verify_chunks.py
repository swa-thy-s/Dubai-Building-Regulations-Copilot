"""Independent check of parsed chunks against the source PDF.

For each chunk, what share of its words appears on its source pages (bag of words)? Low coverage means text was
lost or garbled in parsing. It cannot catch reordering. Usage: python -m ingest.verify_chunks [slug-or-cache-dir ...]
"""
from __future__ import annotations

import glob
import json
import re
import sys
from collections import Counter
from pathlib import Path

import pymupdf
import yaml

WORD = re.compile(r"[a-z0-9]+")
# fi/fl ligature repairs change spelling on purpose, so compare with those letters collapsed on both sides.
def norm_word(w: str) -> str:
    return re.sub(r"f[il]", "f", re.sub(r"ff[il]?", "f", w))


def words(text: str) -> Counter:
    return Counter(norm_word(w) for w in WORD.findall(text.lower()))


def drop_scrambled_tables(doc: pymupdf.Document, chunks: list[dict], min_cov: float = 0.70) -> tuple[list[dict], list[str]]:
    """Remove table chunks whose words mostly do not appear on their pages (a chart read as a table)."""
    page_words: dict[int, Counter] = {}
    keep, dropped = [], []
    for c in chunks:
        if c["content_type"] == "table":
            have: Counter = Counter()
            for p in range(c["page_start"], c["page_end"] + 1):
                if p not in page_words:
                    page_words[p] = words(doc[p - 1].get_text())
                have += page_words[p]
            mine = words(c["content"])
            total = sum(mine.values())
            cov = sum(min(n, have[w]) for w, n in mine.items()) / total if total else 1.0
            if cov < min_cov:
                dropped.append(f"{c['clause_ref']} p{c['page_start']} ({cov:.0%} of words on the page)")
                continue
        keep.append(c)
    return keep, dropped


def pdf_for(slug: str, sources: list[dict]) -> str | None:
    for s in sources:
        if s["slug"] == slug:
            return s["pdf_path"]
    return None


def check_cache(path: Path, pdf_path: str, threshold: float) -> tuple[int, list[tuple[float, str, int]]]:
    data = json.loads(path.read_text())
    doc = pymupdf.open(pdf_path)
    page_words: dict[int, Counter] = {}
    bad = []
    for c in data["chunks"]:
        pages = range(c["page_start"], c["page_end"] + 1)
        have: Counter = Counter()
        for p in pages:
            if p not in page_words:
                page_words[p] = words(doc[p - 1].get_text())
            have += page_words[p]
        mine = words(c["content"])
        total = sum(mine.values())
        if not total:
            continue
        found = sum(min(n, have[w]) for w, n in mine.items())
        cov = found / total
        if cov < threshold:
            bad.append((cov, c["clause_ref"], c["page_start"]))
    return len(data["chunks"]), sorted(bad)


if __name__ == "__main__":
    cfg = yaml.safe_load(Path("ingest/sources.yaml").read_text())["documents"]
    threshold = 0.95
    law_pdf = next(s["pdf_path"] for s in cfg if s.get("kind") == "legislation")
    total = flagged = 0
    for f in sorted(glob.glob("data/cache/*/chunks_*.json")):
        p = Path(f)
        slug = p.parent.name
        pdf = law_pdf if re.match(r"(law|decree|ecr|regulation|bylaw)-\d", slug) else pdf_for(slug, cfg)
        if not pdf:
            continue
        n, bad = check_cache(p, pdf, threshold)
        total += n
        flagged += len(bad)
        print(f"{slug:18} {p.name:22} chunks {n:4}  below {threshold:.0%}: {len(bad)}")
        for cov, ref, page in bad[:5]:
            print(f"      {cov:.0%}  {ref}  p{page}")
    print(f"\nTOTAL chunks {total}, flagged {flagged} ({flagged / max(total, 1):.1%})")
