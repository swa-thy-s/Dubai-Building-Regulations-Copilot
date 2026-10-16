"""Repair 'fi'/'fl'/'ff' ligatures that some PDFs drop from the text layer ("foors" -> "floors").

Only words that are not valid English are touched, and only when exactly one candidate is a real word.
Every repair is counted so the QA report can show them for a human spot check.
"""
from __future__ import annotations

import glob
import json
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path

DICT = Path("/usr/share/dict/words")
CLEAN_CACHE = "data/cache/dbc-2021/chunks_*.json"  # parsed DBC text: British spellings and domain words
TOKEN_RE = re.compile(r"[A-Za-z]+")
SUFFIXES = ["", "s", "es", "ed", "d", "ing", "ly", "er", "ers", "ment", "ments", "ion", "ions", "al", "ness", "ity"]
REPLACEMENTS = ["fi", "fl", "ff", "ffi", "ffl"]


@lru_cache(maxsize=1)
def _vocab() -> frozenset[str]:
    words: set[str] = set()
    if not DICT.exists():
        raise RuntimeError(f"{DICT} not found. Install a word list (apt: wamerican) before repairing ligatures.")
    words.update(w.strip().lower() for w in DICT.read_text(errors="ignore").splitlines() if w.strip())
    for f in glob.glob(CLEAN_CACHE):
        for c in json.loads(Path(f).read_text())["chunks"]:
            words.update(w.lower() for w in TOKEN_RE.findall(c["content"]))
    return frozenset(words)


def exact(word: str) -> bool:
    w = word.lower()
    v = _vocab()
    return w in v or re.sub(r"is(e|ed|es|ing|ation|ations)$", r"iz\1", w) in v


def known(word: str) -> bool:
    if exact(word):
        return True
    w = word.lower()
    v = _vocab()
    for suf in SUFFIXES[1:]:
        if w.endswith(suf) and len(w) > len(suf) + 2:
            base = w[: -len(suf)]
            if exact(base) or exact(base + "e") or (base.endswith("i") and exact(base[:-1] + "y")):
                return True
    return False


def _candidates(core: str) -> set[str]:
    out: set[str] = set()
    idx = [i for i, c in enumerate(core) if c in "fF"]
    for i in idx:
        for rep in REPLACEMENTS:
            r = rep.capitalize() if core[i] == "F" else rep
            out.add(core[:i] + r + core[i + 1 :])
    for a in range(len(idx)):
        for b in range(a + 1, len(idx)):
            for ra in ("fi", "fl"):
                for rb in ("fi", "fl"):
                    s = list(core)
                    s[idx[b]] = rb
                    s[idx[a]] = ra
                    out.add("".join(s))
    return out


def repair_token(tok: str, stats: Counter, unresolved: Counter) -> str:
    if "f" not in tok.lower() or tok.isupper() or known(tok):
        return tok
    cands = _candidates(tok)
    valid = {c for c in cands if exact(c)} or {c for c in cands if known(c)}
    if len(valid) == 1:
        fixed = valid.pop()
        stats[f"{tok}>{fixed}"] += 1
        return fixed
    unresolved[tok] += 1
    return tok


def repair(text: str, stats: Counter, unresolved: Counter) -> str:
    return TOKEN_RE.sub(lambda m: repair_token(m.group(0), stats, unresolved), text)
