"""Usage: python -m ingest.main <slug> [--part "Part B"] [--dry-run]"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import pymupdf
import yaml

from dotenv import load_dotenv

from ingest import chunk, embed, legislation, numbered, parse, qa, upsert


def load_source(slug: str) -> dict:
    cfg = yaml.safe_load(Path("ingest/sources.yaml").read_text())
    for d in cfg["documents"]:
        if d["slug"] == slug:
            return d
    raise SystemExit(f"Unknown slug {slug!r}")


def run_parse(slug: str, part: str | None) -> dict:
    src = load_source(slug)
    if src.get("kind") == "numbered":
        cfg = src["numbered"]
        chunks, stats = numbered.chunk_numbered(src["pdf_path"], cfg, src["title"], src.get("repair_ligatures", False))
        n_pages = len(pymupdf.open(src["pdf_path"]))
        data = dict(slug=slug, part=src["title"], pages=[cfg.get("first_page", 1), cfg.get("last_page", n_pages)], stats=stats, chunks=chunks)
        path = qa.cache_path(slug, part)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
        return data
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


def run_legislation(src: dict, only: str | None, dry_run: bool) -> None:
    """One PDF bundling several laws: one `documents` row per law, article-level chunks."""
    laws = legislation.law_ranges(src["pdf_path"])
    if only:
        laws = [x for x in laws if x["slug"] == only]
        if not laws:
            raise SystemExit(f"No law {only!r} in {src['pdf_path']}")
    parsed = []
    for law in laws:
        chunks, stats = legislation.chunk_law(src["pdf_path"], law, src.get("repair_ligatures", True))
        data = dict(slug=law["slug"], part=law["title"], pages=[law["first"], law["last"]], stats=stats, chunks=chunks)
        path = qa.cache_path(law["slug"], None)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1))
        fixes = sum(stats["ligature_fixes"].values())
        print(f"{law['slug']:16} pages {law['first']}-{law['last']}  chunks {len(chunks):3}  ligature fixes {fixes:3}  unresolved {len(stats['unresolved_tokens'])}  empty pages {stats['empty_pages']}")
        parsed.append((law, data))
    if dry_run:
        raise SystemExit("dry run: nothing embedded or uploaded")
    texts, owners = [], []
    for law, data in parsed:
        meta = dict(title=law["title"], edition=law["edition"])
        for c in data["chunks"]:
            texts.append(embed.embed_text(meta["title"], meta["edition"], c))
            owners.append(law["slug"])
    vectors = embed.embed_chunks(texts)
    sb = upsert.client()
    pos = 0
    for law, data in parsed:
        n = len(data["chunks"])
        doc_id = upsert.upsert_document(sb, dict(slug=law["slug"], title=law["title"], authority=src["authority"], edition=law["edition"], status=src.get("status", "current"), source_url=src.get("source_url")))
        upsert.upsert_chunks(sb, doc_id, data["chunks"], vectors[pos : pos + n])
        pos += n
    upsert.record_embedding_model(sb)
    print("done")


def main_cli() -> None:
    try:
        _main()
    except embed.QuotaExhausted as e:
        print(f"STOPPED: {e}. Cached embeddings are kept; rerun this command after the quota resets.")
        raise SystemExit(75)


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("slug")
    ap.add_argument("--part")
    ap.add_argument("--law", help="legislation sources only: ingest just this law slug")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    load_dotenv(".env.local")
    if load_source(a.slug).get("kind") == "legislation":
        run_legislation(load_source(a.slug), a.law, a.dry_run)
        raise SystemExit(0)
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


if __name__ == "__main__":
    main_cli()
