"""OCR for scanned English PDFs (RapidOCR, runs locally). Results are cached per file in data/cache/ocr/.

OCR can misread characters, so documents read this way must say so in their edition (see sources.yaml) and each
page is kept for a person to spot-check. Lines with low confidence or mostly non-Latin characters (logos, Arabic
letterheads) are dropped and counted.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pymupdf

CACHE = Path("data/cache/ocr")
MIN_CONF = 0.80
DPI = 200
_engine = None


def _ocr():
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR

        _engine = RapidOCR()
    return _engine


def latin_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    return sum(1 for c in letters if c.isascii()) / len(letters) if letters else 0.0


def keep_line(text: str, conf: float) -> bool:
    return conf >= MIN_CONF and len(text.strip()) >= 2 and latin_ratio(text) >= 0.9


def is_scanned(path: str | Path, min_chars: int = 40) -> bool:
    doc = pymupdf.open(path)
    return all(len(doc[i].get_text().strip()) < min_chars for i in range(len(doc)))


def ocr_pdf(path: str | Path) -> dict:
    path = Path(path)
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / (path.name + ".json")
    if out.exists():
        return json.loads(out.read_text())
    doc = pymupdf.open(path)
    pages, dropped = [], 0
    for i in range(len(doc)):
        png = doc[i].get_pixmap(dpi=DPI).tobytes("png")
        res, _ = _ocr()(png)
        lines = []
        for box, text, conf in res or []:
            if keep_line(text, float(conf)):
                lines.append(dict(y=min(p[1] for p in box), x=min(p[0] for p in box), text=text.strip(), conf=round(float(conf), 3)))
            else:
                dropped += 1
        lines.sort(key=lambda l: (round(l["y"] / 12), l["x"]))  # reading order: rows of ~12 px, left to right
        pages.append([l["text"] for l in lines])
    data = dict(file=path.name, pages=pages, dropped_lines=dropped)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    return data


def page_text(lines: list[str]) -> str:
    return re.sub(r"\s+", " ", " ".join(lines)).strip()


# ---- spacing repair: RapidOCR sometimes returns whole phrases with the spaces dropped ----
_TOKEN = re.compile(r"([A-Za-z][A-Za-z']*[A-Za-z]|[A-Za-z])")


def _split_token(tok: str) -> str:
    from ingest import ligatures

    if len(tok) < 9 or ligatures.known(tok) or not tok.isalpha() and "'" not in tok:
        return tok
    import wordninja

    parts = wordninja.split(tok)
    if len(parts) < 2 or "".join(p.lower() for p in parts) != tok.replace("'", "").lower():
        return tok
    if any(len(p) < 2 and p.lower() not in ("a", "i") for p in parts):
        return tok
    out, pos = [], 0
    for p in parts:  # keep the original capitalisation
        out.append(tok[pos : pos + len(p)])
        pos += len(p)
    return " ".join(out)


def fix_line(line: str) -> str:
    return _TOKEN.sub(lambda m: _split_token(m.group(0)), line)


def load_pages(path: str | Path) -> list[list[str]]:
    """OCR lines per page with spacing repaired."""
    return [[fix_line(l) for l in page] for page in ocr_pdf(path)["pages"]]
