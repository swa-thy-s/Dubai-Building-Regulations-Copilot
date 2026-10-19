"""All document definitions: ingest/sources.yaml plus any ingest/sources_*.yaml (kept separate so parallel work does not collide)."""
from __future__ import annotations

from pathlib import Path

import yaml


def all_sources() -> list[dict]:
    docs: list[dict] = []
    for f in [Path("ingest/sources.yaml"), *sorted(Path("ingest").glob("sources_*.yaml"))]:
        docs.extend(yaml.safe_load(f.read_text()).get("documents", []))
    return docs
