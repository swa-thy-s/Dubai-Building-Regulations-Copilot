"""QA report for a parsed document. Usage: python -m ingest.qa <slug> [--part NAME]"""
from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path


def cache_path(slug: str, part: str | None) -> Path:
    name = (part or "all").lower().replace(" ", "_")
    return Path("data/cache") / slug / f"chunks_{name}.json"


def report(data: dict, sample: int = 20) -> str:
    chunks = data["chunks"]
    out = []
    out.append(f"Document: {data['slug']}  part: {data.get('part')}  pages {data['pages'][0]}-{data['pages'][1]}")
    out.append(f"Chunks: {len(chunks)}  by type: {dict(Counter(c['content_type'] for c in chunks))}")
    short = [c for c in chunks if c["token_count"] < 20]
    long_ = [c for c in chunks if c["token_count"] > 1200]
    out.append(f"Under 20 tokens: {len(short)}   Over 1,200 tokens: {len(long_)}")
    for c in long_:
        out.append(f"  LONG  {c['clause_ref']} p{c['page_start']} ({c['token_count']} tok)")
    covered = set()
    for c in chunks:
        covered.update(range(c["page_start"], c["page_end"] + 1))
    first, last = data["pages"]
    empty = [p for p in range(first, last + 1) if p not in covered]
    out.append(f"Pages with no chunks ({len(empty)}): {empty}")
    bad = [c for c in chunks if not c["clause_ref"] or not c["page_start"]]
    out.append(f"Chunks missing clause_ref or page: {len(bad)}")
    st = data["stats"]
    out.append(f"Orphan rows before first heading: {st['orphan_rows']}")
    out.append(f"Outline headings not found in text ({len(st['unmatched_headings'])}): {st['unmatched_headings'][:30]}")
    out.append(f"Tables dropped as diagrams ({len(st['dropped_tables'])}): {st['dropped_tables']}")
    out.append("")
    out.append(f"--- {min(sample, len(chunks))} random chunks (compare with PDF page numbers) ---")
    rnd = random.Random(7)
    for c in rnd.sample(chunks, min(sample, len(chunks))):
        txt = c["content"].replace("\n", " ")
        out.append(f"[{c['content_type']}] {c['clause_ref']}  pdf p{c['page_start']}-{c['page_end']}  {c['heading_path'][-1] if c['heading_path'] else ''}")
        out.append(f"    {txt[:300]}{'...' if len(txt) > 300 else ''}")
    tables = [c for c in chunks if c["content_type"] == "table"]
    out.append("")
    out.append(f"--- tables ({len(tables)}): ref, page ---")
    out.append(", ".join(f"{c['clause_ref']} p{c['page_start']}" for c in tables))
    return "\n".join(out)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--part")
    a = ap.parse_args()
    print(report(json.loads(cache_path(a.slug, a.part).read_text())))
