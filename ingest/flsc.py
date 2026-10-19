"""Chunker for the UAE Fire and Life Safety Code of Practice.

Layout: 20 chapters and 2 annexures, portrait single column. Section headings are 14 to 18 pt bold lines such as
"2.1. Intention"; numbered paragraphs ("2.2.1.") are bold body text. Numbering restarts in every chapter, so every
reference carries the chapter ("Ch. 3 2.6"), which is also how the Dubai Building Code cites this code.

Tables are located with PyMuPDF's table finder, but each cell's text is read from the page itself, because the
finder's own text drops letters ("fre" for "fire").
"""
from __future__ import annotations

import hashlib
import re
from collections import Counter

import pymupdf

from ingest import ligatures
from ingest.chunk import _table_chunks, tokens
from ingest.legislation import hard_split

MAX_TOKENS = 700
MAX_TABLE_TOKENS = 1000
HEADING_MIN_SIZE = 13.5
NOISE = [re.compile(r"CDGH-OP-25"), re.compile(r"^Page \d+ of \d+$")]
SECTION_RE = re.compile(r"^(\d+(?:\.\d+)*)\.?\s+(\S.*)$")
PARA_RE = re.compile(r"^\d+(?:\.\d+){2,}\.?(\s|$)")
CAPTION_RE = re.compile(r"^Table\s+(\d+\.\d+[a-z]?)\b", re.I)
SPACE = re.compile(r"\s+")


def clean(text: str) -> str:
    text = text.replace("‗", "‘")  # the PDF encodes the opening quote as a double low line
    return SPACE.sub(" ", text).strip()


def dehyphenate(text: str) -> str:
    """Join words broken at a line end ("construc- tion") only when the joined word is real English."""
    def fix(m: re.Match) -> str:
        joined = m.group(1) + m.group(2)
        return joined if ligatures.known(joined) else f"{m.group(1)}-{m.group(2)}"
    return re.sub(r"([A-Za-z]{2,})- ([a-z]{2,})", fix, text)


def _mk(ref, path, part, p0, p1, content, ctype="clause") -> dict:
    content = content.strip()
    return dict(
        clause_ref=ref, heading_path=path, part=part, page_start=p0, page_end=p1, content=content,
        content_type=ctype, token_count=tokens(content),
        content_hash=hashlib.sha256(f"{ref}\n{content}".encode()).hexdigest(),
    )


def chapter_starts(doc: pymupdf.Document, first: int) -> list[tuple[int, int, str]]:
    """(start page, chapter number, title) from the outline; chapter 1 has no page in the outline."""
    out = []
    for lvl, title, page in doc.get_toc():
        m = re.match(r"^(\d+)\.\s+(.+)$", title.strip())
        if lvl == 1 and m:
            out.append((page if page > 0 else first, int(m.group(1)), clean(m.group(2)).title()))
    return sorted(out)


def _norm_cap(c: str | None) -> str:
    return re.sub(r"\(?continued\)?|[\s.:]+", "", (c or ""), flags=re.I).lower()


def _cell_text(page: pymupdf.Page, bbox) -> str:
    r = pymupdf.Rect(bbox)
    r = pymupdf.Rect(r.x0 + 1, r.y0 + 1, r.x1 - 1, r.y1 - 1)
    return clean(page.get_text("text", clip=r))


def table_markdown(page: pymupdf.Page, table) -> tuple[str | None, list[list[str]], float]:
    """Return (caption, rows, top). Cell text is read from the page. The table finder sometimes includes the
    paragraph above a table in its box; rows before the caption row are dropped and `top` marks where the real
    table starts so that text can stay in the text flow."""
    rows: list[list[str]] = []
    tops: list[float] = []
    for row in table.rows:
        rows.append([(_cell_text(page, c) if c else "") for c in row.cells])
        tops.append(row.bbox[1])
    caption, start = None, 0
    for k in range(min(3, len(rows))):
        non_empty = [c for c in rows[k] if c]
        if non_empty and CAPTION_RE.match(non_empty[0]) and len(set(non_empty)) == 1:
            caption, start = non_empty[0], k
            break
    rows, tops = rows[start + (1 if caption else 0):], tops[start:]
    keep = [(r, t) for r, t in zip(rows, tops[1 if caption else 0:]) if any(r)] if caption else [(r, t) for r, t in zip(rows, tops[start:]) if any(r)]
    top = tops[0] if tops else table.bbox[1]
    return caption, [r for r, _ in keep], top


def to_md(rows: list[list[str]]) -> str:
    width = max(len(r) for r in rows)
    pad = [r + [""] * (width - len(r)) for r in rows]
    esc = lambda c: c.replace("|", "/")
    lines = ["| " + " | ".join(esc(c) for c in pad[0]) + " |", "| " + " | ".join("---" for _ in range(width)) + " |"]
    lines += ["| " + " | ".join(esc(c) for c in r) + " |" for r in pad[1:]]
    return "\n".join(lines)


def page_items(page: pymupdf.Page, tables) -> tuple[list[dict], list[tuple]]:
    """Text lines (outside tables) and tables, in reading order. Returns (items, parsed_tables)."""
    parsed = []
    for t in tables:
        caption, rows, top = table_markdown(page, t)
        parsed.append((t, caption, rows, top))
    rects = [pymupdf.Rect(t.bbox[0], top, t.bbox[2], t.bbox[3]) for t, _, _, top in parsed]
    items: list[dict] = []
    for b in page.get_text("dict")["blocks"]:
        for ln in b.get("lines", []):
            spans = [s for s in ln["spans"] if s["text"].strip()]
            if not spans:
                continue
            lr = pymupdf.Rect(ln["bbox"])
            if lr.get_area() > 0 and any((lr & r).get_area() > 0.5 * lr.get_area() for r in rects):
                continue
            text = clean("".join(s["text"] for s in spans))
            if not text or any(p.search(text) for p in NOISE) or re.fullmatch(r"\d{1,4}", text):
                continue
            items.append(dict(kind="line", y=lr.y0, x=lr.x0, size=max(s["size"] for s in spans),
                              bold=any("Bold" in s["font"] for s in spans), text=text))
    for (t, caption, rows, top) in parsed:
        items.append(dict(kind="table", y=top, caption=caption, rows=rows, bottom=t.bbox[3]))
    items.sort(key=lambda i: (i["y"], i.get("x", 0)))
    return items, parsed


def chunk_flsc(pdf_path: str, cfg: dict, label: str) -> tuple[list[dict], dict]:
    doc = pymupdf.open(pdf_path)
    first, last = cfg.get("first_page", 24), cfg.get("last_page", len(doc))
    starts = chapter_starts(doc, first)
    seen: Counter = Counter()
    chunks: list[dict] = []
    stats: dict = dict(orphan_rows=0, unmatched_headings=[], dropped_tables=[], ligature_fixes={}, unresolved_tokens={}, skipped_pages=[], empty_pages=[])

    def chapter_at(page: int) -> tuple[int, str]:
        cur = (0, "Preface")
        for start, num, title in starts:
            if start <= page:
                cur = (num, title)
        return cur

    cur: dict | None = None  # open section
    last_table: dict | None = None

    def uniq(ref: str, page: int) -> str:
        seen[ref] += 1
        if seen[ref] == 1:
            return ref
        with_page = f"{ref} (p.{page})"
        seen[with_page] += 1
        return with_page if seen[with_page] == 1 else f"{with_page} #{seen[with_page]}"

    carry: list[str] = []
    last_key: tuple | None = None

    def flush():
        nonlocal cur
        if not cur or not cur["lines"]:
            cur = None
            return
        if len(cur["lines"]) == 1:  # a heading with no body of its own joins the next section
            carry.extend(cur["lines"])
            cur = None
            return
        cur["lines"] = carry + cur["lines"]
        carry.clear()
        paras: list[list[str]] = [[]]
        for ln in cur["lines"]:
            if PARA_RE.match(ln) and paras[-1]:
                paras.append([])
            paras[-1].append(ln)
        pieces, buf = [], []
        for p in paras:
            if buf and tokens(" ".join(buf + p)) > MAX_TOKENS:
                pieces.append(buf)
                buf = list(p)
            else:
                buf = buf + p
        if buf:
            pieces.append(buf)
        pieces = [q for pc in pieces for q in hard_split(pc)]
        for k, pc in enumerate(pieces):
            ref = cur["ref"] if len(pieces) == 1 else f"{cur['ref']} ({k + 1}/{len(pieces)})"
            chunks.append(_mk(uniq(ref, cur["page"]), cur["path"], cur["part"], cur["page"], cur["last"], dehyphenate(" ".join(pc))))
        cur = None

    def emit_table(caption: str | None, rows: list[list[str]], page: int, page_end: int, ctx: dict):
        md = to_md(rows)
        m = CAPTION_RE.match(caption) if caption else None
        ref = f"Table {m.group(1)}" if m else f"{ctx['ref']} table"
        for i, content in enumerate(_table_chunks(md, caption, MAX_TABLE_TOKENS)):
            r = ref if i == 0 else f"{ref} (rows part {i + 1})"
            chunks.append(_mk(uniq(r, page), ctx["path"], ctx["part"], page, page_end, content, "table"))

    pending_table: dict | None = None

    def flush_table():
        nonlocal pending_table
        if pending_table:
            emit_table(pending_table["caption"], pending_table["rows"], pending_table["page"], pending_table["page_end"], pending_table["ctx"])
            pending_table = None

    for pno in range(first, last + 1):
        page = doc[pno - 1]
        try:
            tabs = [t for t in page.find_tables().tables if t.row_count >= 2 and t.col_count >= 2]
        except Exception:
            tabs = []
        num, ctitle = chapter_at(pno)
        part = f"Chapter {num} {ctitle}"
        items, _parsed = page_items(page, tabs)
        for it in items:
            if it["kind"] == "line":
                m = SECTION_RE.match(it["text"])
                if it["size"] >= HEADING_MIN_SIZE and it["bold"] and m and not PARA_RE.match(it["text"]):
                    key = (num, m.group(1), re.sub(r"\(?continued\)?|\.+$", "", m.group(2), flags=re.I).strip().lower())
                    if key == last_key:  # running heading repeated at the top of a continuation page
                        if cur:
                            cur["last"] = pno
                        continue
                    last_key = key
                    flush_table()
                    flush()
                    ref = f"Ch. {num} §{m.group(1)}"
                    path = [label, part, f"{m.group(1)} {clean(m.group(2))}"]
                    cur = dict(ref=ref, path=path, part=part, page=pno, last=pno, lines=[it["text"]])
                    continue
                if cur is None:
                    stats["orphan_rows"] += 1
                    flush_table()
                    continue
                flush_table()  # body text after a table means the table is over
                cur["lines"].append(it["text"])
                cur["last"] = pno
            else:
                caption, rows = it["caption"], it["rows"]
                if not rows:
                    continue
                ctx = cur or dict(ref=f"Ch. {num}", path=[label, part], part=part)
                width = max(len(r) for r in rows)
                # continuation of a table from the previous page: same width, no caption of its own
                if (pending_table and (caption is None or _norm_cap(caption) == _norm_cap(pending_table["caption"]))
                        and pending_table["width"] == width and pending_table["page_end"] == pno - 1):
                    body = rows[1:] if rows and rows[0] == pending_table["rows"][0] else rows
                    pending_table["rows"] += body
                    pending_table["page_end"] = pno
                    continue
                flush_table()
                if len(rows) < 2 and not caption:
                    stats["dropped_tables"].append(f"{ctx['ref']} p{pno}")
                    continue
                pending_table = dict(caption=caption, rows=rows, page=pno, page_end=pno, width=width, ctx=ctx)
    flush_table()
    flush()

    covered = set()
    for c in chunks:
        covered.update(range(c["page_start"], c["page_end"] + 1))
    stats["empty_pages"] = [p for p in range(first, last + 1) if p not in covered]
    chunks.sort(key=lambda c: (c["page_start"], c["clause_ref"]))
    return chunks, stats
