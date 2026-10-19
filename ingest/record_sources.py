"""Write official source links and verification dates from ingest/sources.yaml into the database.

documents.source_url gets the official link; app_config key `source_verification` gets { slug: date } for every source
whose `verified_on` is set (the date a person or tool confirmed the file or page against the publisher's own copy).
Usage: python -m ingest.record_sources
"""
from __future__ import annotations

import json
from pathlib import Path

import yaml
from dotenv import load_dotenv

from ingest import upsert

KEY = "source_verification"


def plan(sources: list[dict], existing: dict[str, str]) -> tuple[dict[str, str], dict[str, str]]:
    urls = {s["slug"]: s["source_url"] for s in sources if s.get("source_url")}
    verification = dict(existing)
    for s in sources:
        if s.get("verified_on"):
            verification[s["slug"]] = str(s["verified_on"])
    return urls, verification


if __name__ == "__main__":
    load_dotenv(".env.local")
    sources = yaml.safe_load(Path("ingest/sources.yaml").read_text())["documents"]
    sb = upsert.client()
    row = sb.table("app_config").select("value").eq("key", KEY).execute().data
    existing = json.loads(row[0]["value"]) if row else {}
    urls, verification = plan(sources, existing)
    live = {d["slug"] for d in sb.table("documents").select("slug").execute().data}
    for slug, url in urls.items():
        if slug in live:
            sb.table("documents").update({"source_url": url}).eq("slug", slug).execute()
            print(f"source_url set: {slug}")
    sb.table("app_config").upsert({"key": KEY, "value": json.dumps(verification)}, on_conflict="key").execute()
    print(f"verification dates recorded for {len(verification)} sources")
