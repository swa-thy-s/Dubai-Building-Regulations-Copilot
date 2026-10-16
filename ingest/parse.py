"""PDF -> ordered rows (text lines and tables) per page.

Layout facts for the DBC 2021 PDF: landscape pages, two text columns, running
header/footer bands, tables detectable by pdfplumber. Reading order is rebuilt
here because PDF block order is not reliable.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

import pdfplumber
import pymupdf

BAND = 45  # points from the top/bottom edge where running headers/footers live
SAME_ROW_DY = 2.5
FULL_WIDTH_MARGIN = 15
REPEAT_SHARE = 0.3
CAPTION_RE = re.compile(r"^Table\s+[A-Z]\.\d+(?:\.\d+)*\b")
CAPTION_REACH = 60  # max vertical distance (pt) between a table and its caption line
SPLIT_GAP = 14  # horizontal gap (pt) that splits one PDF line into separate pieces
GAP_MIN = 8  # minimum empty width (pt) that separates two text columns


@dataclass
class Row:
    page: int  # 1-based physical PDF page
    kind: str  # 'text' | 'table'
    text: str
    x0: float
    y0: float
    x1: float
    y1: float
    size: float = 0.0
    first_font: str = ""
    cols: int = 0  # table only: number of columns
    extra: dict = field(default_factory=dict)


def _norm_repeat(text: str) -> str:
    return re.sub(r"\d+", "#", re.sub(r"\s+", " ", text.strip()))


def _raw_lines(page: pymupdf.Page):
    """Text pieces. A PDF line is split where spans are far apart, because the
    extractor joins same-baseline text from different columns into one line."""
    out = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] != 0:
            continue
        for ln in b["lines"]:
            spans = [s for s in ln["spans"] if s["text"].strip()]
            if not spans:
                continue
            groups: list[list[dict]] = [[spans[0]]]
            for prev, s in zip(spans, spans[1:]):
                if s["bbox"][0] - prev["bbox"][2] > SPLIT_GAP:
                    groups.append([])
                groups[-1].append(s)
            for g in groups:
                x0 = min(s["bbox"][0] for s in g)
                y0 = min(s["bbox"][1] for s in g)
                x1 = max(s["bbox"][2] for s in g)
                y1 = max(s["bbox"][3] for s in g)
                out.append(
                    dict(
                        text="".join(s["text"] for s in g),
                        bbox=(x0, y0, x1, y1),
                        size=g[0]["size"],
                        font=g[0]["font"],
                    )
                )
    return out


FIGURE_MIN_W, FIGURE_MIN_H = 60, 40
FIGURE_LABEL_MAX_CHARS = 40


def _figure_regions(page: pymupdf.Page, table_boxes: list[tuple]) -> list[pymupdf.Rect]:
    """Areas holding diagrams/photos (not tables), whose short text labels are noise in clause text."""
    regs: list[pymupdf.Rect] = []
    for b in page.get_text("dict")["blocks"]:
        if b["type"] == 1:
            regs.append(pymupdf.Rect(b["bbox"]))
    try:
        regs.extend(pymupdf.Rect(r) for r in page.cluster_drawings())
    except Exception:
        pass
    out = []
    for r in regs:
        if r.width < FIGURE_MIN_W or r.height < FIGURE_MIN_H:
            continue
        area = r.width * r.height
        in_table = any(
            max(0, min(r.x1, t[2]) - max(r.x0, t[0])) * max(0, min(r.y1, t[3]) - max(r.y0, t[1])) > 0.5 * area
            for t in table_boxes
        )
        if not in_table:
            out.append(r)
    return out


def find_scanned_pages(doc: pymupdf.Document, pages: list[int], min_chars: int = 40) -> list[int]:
    return [p for p in pages if len(doc[p - 1].get_text().strip()) < min_chars]


def detect_running_text(doc: pymupdf.Document, pages: list[int]) -> set[str]:
    counts: Counter[str] = Counter()
    for p in pages:
        page = doc[p - 1]
        h = page.rect.height
        seen = set()
        for ln in _raw_lines(page):
            y0, y1 = ln["bbox"][1], ln["bbox"][3]
            if y1 < BAND or y0 > h - BAND:
                seen.add(_norm_repeat(ln["text"]))
        counts.update(seen)
    need = max(2, int(len(pages) * REPEAT_SHARE))
    return {t for t, c in counts.items() if c >= need}


def _merge_same_row(rows: list[Row]) -> list[Row]:
    """Join text pieces that sit on one baseline (e.g. '3.2.1' + heading title)."""
    merged: list[Row] = []
    for r in rows:
        prev = merged[-1] if merged else None
        if (
            prev
            and prev.kind == "text"
            and r.kind == "text"
            and abs(prev.y0 - r.y0) < SAME_ROW_DY
            and r.x0 >= prev.x1 - 1
            and prev.extra.get("col") == r.extra.get("col")
        ):
            prev.text = prev.text.rstrip() + "\t" + r.text.lstrip()
            prev.x1 = max(prev.x1, r.x1)
            prev.y1 = max(prev.y1, r.y1)
            continue
        merged.append(r)
    return merged


def _column_separators(rows: list[Row]) -> tuple[list[float], float]:
    """Find vertical whitespace gaps between text columns. Returns (separators, narrow_limit)."""
    if not rows:
        return [], 0.0
    lo, hi = min(r.x0 for r in rows), max(r.x1 for r in rows)
    limit = 0.55 * (hi - lo)
    narrow = [r for r in rows if r.x1 - r.x0 <= limit]
    if not narrow:
        return [], limit
    n = int(hi - lo) + 2
    cover = [0] * n
    for r in narrow:
        for x in range(int(r.x0 - lo), min(n, int(r.x1 - lo) + 1)):
            cover[x] += 1
    tol = max(2, int(0.04 * len(narrow)))  # figure labels may cross the gutter
    seps, run = [], None
    for x in range(n):
        if cover[x] <= tol:
            run = x if run is None else run
        else:
            if run is not None and x - run >= GAP_MIN and run > 0:
                seps.append(lo + (run + x) / 2)
            run = None
    return seps, limit


def _order(rows: list[Row], page_width: float) -> list[Row]:
    seps, limit = _column_separators(rows)
    crosses = lambda r: any(r.x0 < s - 2 and r.x1 > s + 2 for s in seps)
    full = [r for r in rows if crosses(r) or (not seps and r.x1 - r.x0 > limit)]
    full_ids = {id(r) for r in full}
    full.sort(key=lambda r: r.y0)
    rest = [r for r in rows if id(r) not in full_ids]

    def col(r: Row) -> int:
        return sum(1 for s in seps if s < r.x0 + 1)

    ordered: list[Row] = []
    bounds = [f.y0 for f in full] + [float("inf")]
    seg_start = -1.0
    for i, upper in enumerate(bounds):
        seg = [r for r in rest if seg_start <= r.y0 < upper]
        for c in range(len(seps) + 1):
            cs = sorted((r for r in seg if col(r) == c), key=lambda r: (round(r.y0), r.x0))
            for r in cs:
                r.extra["col"] = c
            ordered.extend(_merge_same_row(cs))
        if i < len(full):
            full[i].extra["col"] = -1
            ordered.append(full[i])
        seg_start = upper
    return ordered


NUMBER_ONLY_RE = re.compile(r"^[A-Z](?:\.\d+)+\s*$")


def _attach_heading_titles(ordered: list[Row]) -> list[Row]:
    """A clause number and its title can land in different reading-order slots
    (large titles span the column gap). Rejoin them by position on the page."""
    for r in list(ordered):
        if r.kind != "text" or not NUMBER_ONLY_RE.match(r.text.strip()):
            continue
        cands = [
            s for s in ordered
            if s is not r and s.kind == "text" and s.page == r.page
            and abs(s.y0 - r.y0) < SAME_ROW_DY and s.x0 >= r.x1 - 1
        ]
        if cands:
            s = min(cands, key=lambda c: c.x0)
            r.text = r.text.rstrip() + "\t" + s.text.lstrip()
            r.x1, r.y1 = max(r.x1, s.x1), max(r.y1, s.y1)
            r.size = max(r.size, s.size)
            ordered.remove(s)
    return ordered


def _table_markdown(data: list[list[str | None]]) -> tuple[str, int]:
    rows = [[(c or "").replace("\n", " ").strip() for c in r] for r in data if any((c or "").strip() for c in r)]
    if not rows:
        return "", 0
    n = max(len(r) for r in rows)
    rows = [r + [""] * (n - len(r)) for r in rows]
    esc = lambda s: s.replace("|", "\\|")
    lines = ["| " + " | ".join(esc(c) for c in rows[0]) + " |", "|" + " --- |" * n]
    lines += ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows[1:]]
    return "\n".join(lines), n


def norm_space(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def _find_caption(t: Row, rows: list[Row]) -> Row | None:
    best, best_d = None, CAPTION_REACH + 1
    for r in rows:
        if r.kind != "text" or not CAPTION_RE.match(norm_space(r.text)):
            continue
        if r.x0 > t.x1 or r.x0 < t.x0 - 40:
            continue
        d = r.y0 - t.y1 if r.y0 >= t.y1 - 5 else (t.y0 - r.y1 if r.y1 <= t.y0 + 5 else None)
        if d is not None and -5 <= d < best_d:
            best, best_d = r, d
    return best


def _merge_split_tables(ordered: list[Row]) -> list[Row]:
    """A table that wraps into a second column repeats its header row: join the pieces.
    Only pieces in different columns merge; stacked tables with the same header stay apart."""
    out: list[Row] = []
    for r in ordered:
        if r.kind == "table":
            head = r.text.split("\n")[0]
            for o in out:
                if (
                    o.kind == "table"
                    and o.page == r.page
                    and o.cols == r.cols
                    and o.text.split("\n")[0] == head
                    and (o.x1 < r.x0 or r.x1 < o.x0)
                    and not (o.extra.get("caption") and r.extra.get("caption"))
                ):
                    o.text += "\n" + "\n".join(r.text.split("\n")[2:])
                    o.extra.setdefault("caption", r.extra.get("caption"))
                    break
            else:
                out.append(r)
            continue
        out.append(r)
    return out


def extract_rows(pdf_path: str, pages: list[int]) -> list[Row]:
    """Rows for the given 1-based pages, in reading order, running text removed."""
    doc = pymupdf.open(pdf_path)
    running = detect_running_text(doc, pages)
    out: list[Row] = []
    with pdfplumber.open(pdf_path) as pl:
        for p in pages:
            page = doc[p - 1]
            w, h = page.rect.width, page.rect.height
            tables = []
            for t in pl.pages[p - 1].find_tables():
                md, n = _table_markdown(t.extract())
                if md and n >= 2:
                    tables.append((t.bbox, md, n))
            figs = _figure_regions(page, [t[0] for t in tables])
            rows: list[Row] = []
            for ln in _raw_lines(page):
                x0, y0, x1, y1 = ln["bbox"]
                if (y1 < BAND or y0 > h - BAND) and _norm_repeat(ln["text"]) in running:
                    continue
                cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
                if any(b[0] - 2 <= cx <= b[2] + 2 and b[1] - 2 <= cy <= b[3] + 2 for b, _, _ in tables):
                    continue
                label = len(ln["text"].strip()) <= FIGURE_LABEL_MAX_CHARS and not ln["text"].lstrip().startswith(("Figure", "Table"))
                if label and any(f.x0 <= cx <= f.x1 and f.y0 <= cy <= f.y1 for f in figs):
                    continue
                rows.append(Row(p, "text", ln["text"], x0, y0, x1, y1, ln["size"], ln["font"]))
            for bbox, md, n in tables:
                rows.append(Row(p, "table", md, *bbox, cols=n))
            ordered = _attach_heading_titles(_order(rows, w))
            for t in [r for r in ordered if r.kind == "table"]:
                cap = _find_caption(t, ordered)
                if cap is not None:
                    ordered.remove(cap)
                    t.extra["caption"] = norm_space(cap.text)
            out.extend(_merge_split_tables(ordered))
    return out
