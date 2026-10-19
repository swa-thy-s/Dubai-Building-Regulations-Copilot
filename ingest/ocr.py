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
_engine2 = None


def _ocr2():
    """More sensitive second pass; only used to recover body lines the first pass missed."""
    global _engine2
    if _engine2 is None:
        from rapidocr_onnxruntime import RapidOCR

        _engine2 = RapidOCR(det_limit_side_len=2400, det_box_thresh=0.3, det_unclip_ratio=1.8, text_score=0.4)
    return _engine2


def _squash(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", s.lower())


def recover_lines(res2, lines: list[dict]) -> list[dict]:
    """Lines only the sensitive pass found. Needs real words (3+ spaced words), which excludes letterhead noise."""
    import difflib

    prim = [_squash(l["text"]) for l in lines]
    blob = "".join(prim)
    out = []
    for box, text, conf in res2 or []:
        t = text.strip()
        s = _squash(t)
        if len(s) < 14 or len(t.split()) < 3 or not keep_line(t, float(conf)) or s in blob:
            continue
        if max((difflib.SequenceMatcher(None, s, p).ratio() for p in prim), default=0) >= 0.75:
            continue
        out.append(dict(y=min(p[1] for p in box), x=min(p[0] for p in box), text=t, conf=round(float(conf), 3)))
    return out


def _ocr():
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR

        # The default detection size shrinks a full page so far that whole lines of body text are missed.
        _engine = RapidOCR(det_limit_side_len=1600)
    return _engine


def latin_ratio(text: str) -> float:
    letters = [c for c in text if c.isalpha()]
    return sum(1 for c in letters if c.isascii()) / len(letters) if letters else 0.0


def keep_line(text: str, conf: float) -> bool:
    """Keep real text, drop logos and Arabic letterheads. Lines with no letters (list numbers, figures) are kept."""
    t = text.strip()
    if not t:
        return False
    if not any(c.isalpha() for c in t):
        return conf >= 0.6
    return conf >= MIN_CONF and len(t) >= 2 and latin_ratio(t) >= 0.9


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
    pages, dropped = [], []
    for i in range(len(doc)):
        png = doc[i].get_pixmap(dpi=DPI).tobytes("png")
        res, _ = _ocr()(png)
        lines = []
        for box, text, conf in res or []:
            if keep_line(text, float(conf)):
                lines.append(dict(y=min(p[1] for p in box), x=min(p[0] for p in box), text=text.strip(), conf=round(float(conf), 3)))
            else:
                dropped.append(dict(page=i + 1, text=text.strip(), conf=round(float(conf), 3)))
        lines += recover_lines(_ocr2()(png)[0], lines)
        lines.sort(key=lambda l: (round(l["y"] / 12), l["x"]))  # reading order: rows of ~12 px, left to right
        pages.append([l["text"] for l in lines])
    data = dict(file=path.name, pages=pages, dropped_lines=len(dropped), dropped=dropped)
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
