"""Usage: python -m ingest.main <slug> [--part "Part B"] [--dry-run]"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pymupdf
import yaml

from dotenv import load_dotenv

from ingest import chunk, embed, parse, qa, upsert


def load_source(slug: str) -> dict:
    cfg = yaml.safe_load(Path("ingest/sources.yaml").read_text())
    for d in cfg["documents"]:
        if d["slug"] == slug:
            return d
    raise SystemExit(f"Unknown slug {slug!r}")


def run_parse(slug: str, part: str | None) -> dict:
    src = load_source(slug)
    pdf = src["pdf_path"]
    doc = pymupdf.open(pdf)
    first, last = chunk.part_page_range(pdf, part) if part else (1, len(doc))
    pages = list(range(first, last + 1))
    scanned = parse.find_scanned_pages(doc, pages)
    if scanned:
        raise SystemExit(f"Pages with almost no text (scanned?), stopping: {scanned}")
    toc, part_name = chunk.load_toc(pdf, first, last)
    rows = parse.extract_rows(pdf, pages)
    chunks, stats = chunk.chunk_rows(rows, toc, part_name)
    data = dict(slug=slug, part=part_name or part, pages=[first, last], stats=stats, chunks=chunks)
    path = qa.cache_path(slug, part)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    return data


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--part")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    load_dotenv(".env.local")
    data = run_parse(a.slug, a.part)
    print(qa.report(data, sample=5))
    if a.dry_run:
        raise SystemExit("dry run: nothing embedded or uploaded")
    src = load_source(a.slug)
    texts = [embed.embed_text(src["title"], str(src["edition"]), c) for c in data["chunks"]]
    vectors = embed.embed_chunks(texts)
    sb = upsert.client()
    doc_id = upsert.upsert_document(sb, src)
    upsert.upsert_chunks(sb, doc_id, data["chunks"], vectors)
    upsert.record_embedding_model(sb)
    upsert.upload_pdf(sb, doc_id, src)
    print("done")
