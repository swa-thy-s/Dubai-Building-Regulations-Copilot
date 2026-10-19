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


def _key(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9]", "", text).lower()


def outline_headings(doc: pymupdf.Document, first: int) -> dict[int, list[tuple[str, str, str]]]:
    """page -> [(key, ref, title)] for numbered section headings (outline levels 2 and 3); levels 4+ are table rows and figures."""
    out: dict[int, list[tuple[str, str, str]]] = {}
    for lvl, title, page in doc.get_toc():
        if lvl not in (2, 3) or page < first or re.match(r"^\s*(Table|Figure)", title):
            continue
        m = re.match(r"^(\d+(?:\.\d+)*)\.*\s+(\S.*)$", clean(title))
        if m:
            out.setdefault(page, []).append((_key(m.group(1) + m.group(2)), m.group(1), clean(m.group(2))))
    return out


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
        cells, prev = [], None
        t_area = pymupdf.Rect(table.bbox).get_area()
        for c in row.cells:
            # skip the table's outer frame (a "cell" covering most of the table) and read a spanning cell once
            frame = c is not None and table.row_count > 1 and pymupdf.Rect(c).get_area() > 0.5 * t_area
            cells.append(_cell_text(page, c) if c and not frame and tuple(c) != prev else "")
            prev = tuple(c) if c else prev
        rows.append(cells)
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
    keep = [i for i in range(width) if any(r[i] for r in pad)]  # drop columns that are empty throughout
    pad = [[r[i] for i in keep] for r in pad]
    width = len(keep)
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
    heads = outline_headings(doc, first)
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
        skip_lines = 0
        for li_idx, it in enumerate(items):
            if it["kind"] == "line":
                # a heading is an outline heading of this page, possibly wrapped over up to three lines
                hit = None
                if pno in heads:
                    acc = ""
                    for look in range(3):
                        li = li_idx + look
                        if li >= len(items) or items[li]["kind"] != "line":
                            break
                        acc += items[li]["text"]
                        k = _key(acc)
                        match = [h for h in heads[pno] if h[0] == k]
                        if match:
                            hit = (match[0], look)
                            break
                        if not any(h[0].startswith(k) for h in heads[pno]):
                            break
                if skip_lines:
                    skip_lines -= 1
                    continue
                if hit:
                    (hk, href, htitle), extra = hit
                    skip_lines = extra
                    flush_table()
                    flush()
                    last_key = hk
                    cur = dict(ref=f"Ch. {num} §{href}", path=[label, part, f"{href} {htitle}"], part=part, page=pno, last=pno, lines=[f"{href}. {htitle}"])
                    continue
                if last_key and cur and _key(it["text"]) in (last_key, last_key + "continued"):
                    cur["last"] = pno  # running heading repeated on a continuation page
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
