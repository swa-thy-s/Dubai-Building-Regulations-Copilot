"""Idempotent upload of documents, chunks and the source PDF to Supabase."""
from __future__ import annotations

import os
from pathlib import Path

from supabase import create_client

BUCKET = "source-pdfs"


def client():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


def upsert_document(sb, src: dict) -> str:
    row = dict(
        slug=src["slug"], title=src["title"], authority=src["authority"], edition=str(src["edition"]),
        status=src.get("status", "current"), source_url=src.get("source_url"),
    )
    res = sb.table("documents").upsert(row, on_conflict="slug").execute()
    return res.data[0]["id"]


def upload_pdf(sb, doc_id: str, src: dict) -> None:
    path = Path(src["pdf_path"])
    try:
        names = [b.name for b in sb.storage.list_buckets()]
        if BUCKET not in names:
            sb.storage.create_bucket(BUCKET, options={"public": False})
        key = f"{src['slug']}.pdf"
        with path.open("rb") as f:
            sb.storage.from_(BUCKET).upload(key, f.read(), {"content-type": "application/pdf", "upsert": "true"})
        sb.table("documents").update({"storage_path": f"{BUCKET}/{key}"}).eq("id", doc_id).execute()
    except Exception as e:  # PDF archiving must not block ingestion
        print(f"  PDF upload skipped: {e}")


def upsert_chunks(sb, doc_id: str, chunks: list[dict], vectors: list[list[float]]) -> None:
    rows = [
        dict(
            document_id=doc_id, clause_ref=c["clause_ref"], heading_path=c["heading_path"], part=c["part"],
            page_start=c["page_start"], page_end=c["page_end"], content=c["content"],
            content_type=c["content_type"], token_count=c["token_count"], content_hash=c["content_hash"],
            embedding=v,
        )
        for c, v in zip(chunks, vectors)
    ]
    for i in range(0, len(rows), 100):
        sb.table("chunks").upsert(rows[i : i + 100], on_conflict="document_id,clause_ref,page_start").execute()
        print(f"  upserted {min(i + 100, len(rows))}/{len(rows)}")


def record_embedding_model(sb) -> None:
    sb.table("app_config").upsert(
        {"key": "embedding_model", "value": f"{os.environ['GEMINI_EMBED_MODEL']}:768"}, on_conflict="key"
    ).execute()
