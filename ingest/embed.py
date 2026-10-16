"""Contextual header + Gemini embeddings (768 dims) with a content-hash cache and backoff."""
from __future__ import annotations

import hashlib
import json
import os
import random
import time
import urllib.error
import urllib.request
from pathlib import Path

DIMS = 768
BATCH = 50
CACHE = Path("data/cache/embeddings.jsonl")


def embed_text(doc_title: str, edition: str, chunk: dict) -> str:
    heading = chunk["heading_path"][-1] if chunk["heading_path"] else ""
    return f"[{doc_title} {edition} | {chunk.get('part') or ''} > {heading} | {chunk['clause_ref']}]\n{chunk['content']}"


def _key(model: str, text: str) -> str:
    return hashlib.sha256(f"{model}|{DIMS}|{text}".encode()).hexdigest()


def _load_cache() -> dict[str, list[float]]:
    if not CACHE.exists():
        return {}
    out = {}
    for line in CACHE.read_text().splitlines():
        k, v = json.loads(line)
        out[k] = v
    return out


def _call(model: str, texts: list[str], task: str, api_key: str) -> list[list[float]]:
    body = {
        "requests": [
            {
                "model": f"models/{model}",
                "content": {"parts": [{"text": t}]},
                "taskType": task,
                "outputDimensionality": DIMS,
            }
            for t in texts
        ]
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:batchEmbedContents"
    req = urllib.request.Request(
        url, json.dumps(body).encode(), {"Content-Type": "application/json", "x-goog-api-key": api_key}
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return [e["values"] for e in json.load(r)["embeddings"]]
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 7:
                wait = min(90, 2**attempt * 2) + random.random() * 2
                print(f"  embed HTTP {e.code}, retrying in {wait:.0f}s")
                time.sleep(wait)
                continue
            raise RuntimeError(f"Gemini embed failed: HTTP {e.code} {e.read()[:300]!r}") from None
    raise RuntimeError("unreachable")


def embed_chunks(texts: list[str]) -> list[list[float]]:
    model = os.environ["GEMINI_EMBED_MODEL"]
    api_key = os.environ["GEMINI_API_KEY"]
    cache = _load_cache()
    todo = [(i, t) for i, t in enumerate(texts) if _key(model, t) not in cache]
    print(f"embedding {len(todo)} of {len(texts)} chunks ({len(texts) - len(todo)} cached)")
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    with CACHE.open("a") as f:
        for s in range(0, len(todo), BATCH):
            part = todo[s : s + BATCH]
            vecs = _call(model, [t for _, t in part], "RETRIEVAL_DOCUMENT", api_key)
            for (_, t), v in zip(part, vecs):
                k = _key(model, t)
                cache[k] = v
                f.write(json.dumps([k, v]) + "\n")
            f.flush()
            print(f"  {min(s + BATCH, len(todo))}/{len(todo)}")
    return [cache[_key(model, t)] for t in texts]
