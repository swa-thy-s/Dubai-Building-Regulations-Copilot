"""Ordered rows + PDF outline -> clause-level chunks."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field

import pymupdf

from ingest.parse import Row

MAX_CLAUSE_TOKENS = 800
MAX_TABLE_TOKENS = 1000
REF_RE = re.compile(r"^([A-Z](?:\.\d+)+)\s*$")
LIST_RE = re.compile(r"^(?:\(?[a-zA-Z0-9]{1,4}[\)\.]|[•\-–])(?:\s|$)")
CAPTION_RE = re.compile(r"^Table\s+([A-Z]\.\d+(?:\.\d+)*)\b")
DEF_RE = re.compile(r"^([^:]{1,80}):\s")
SPACE_RE = re.compile(r"\s+")


@dataclass
class TocEntry:
    level: int
    ref: str | None
    title: str
    page: int
    matched: bool = False

    @property
    def label(self) -> str:
        return f"{self.ref} {self.title}".strip() if self.ref else self.title


def tokens(text: str) -> int:
    return int(len(text.split()) * 1.35)


def norm(s: str) -> str:
    return SPACE_RE.sub(" ", s).strip()


def load_toc(pdf_path: str, first: int, last: int) -> tuple[list[TocEntry], str]:
    doc = pymupdf.open(pdf_path)
    entries: list[TocEntry] = []
    part = ""
    for level, title, page in doc.get_toc():
        if level == 1 and first <= page <= last:
            part = norm(title)
        if not (first <= page <= last) or level == 1:
            continue
        ref, _, rest = title.partition("\t")
        if REF_RE.match(ref.strip()):
            entries.append(TocEntry(level, ref.strip(), norm(rest), page))
        else:
            entries.append(TocEntry(level, None, norm(title), page))
    return entries, part


def part_page_range(pdf_path: str, part_name: str) -> tuple[int, int]:
    doc = pymupdf.open(pdf_path)
    tops = [(t[1], t[2]) for t in doc.get_toc() if t[0] == 1]
    for i, (title, page) in enumerate(tops):
        if part_name.lower() in norm(title).lower():
            end = tops[i + 1][1] - 1 if i + 1 < len(tops) else len(doc)
            return page, end
    raise SystemExit(f"Part {part_name!r} not found. Available: {[t for t, _ in tops]}")


def _is_heading(row: Row, entry: TocEntry) -> int:
    """Return how many rows the heading spans (0 if row is not this heading)."""
    if row.kind != "text" or not entry.ref or row.page != entry.page:
        return 0
    text = norm(row.text)
    want = norm(f"{entry.ref} {entry.title}")
    if not text.startswith(entry.ref):
        return 0
    if want.startswith(text) or text.startswith(want) or entry.title[:15] in text:
        return 1
    return 0


def _paragraphs(rows: list[Row]) -> list[tuple[str, int, int]]:
    """Text rows -> (paragraph text, first page, last page)."""
    paras: list[dict] = []
    prev: Row | None = None
    for r in rows:
        text = norm(r.text)
        if not text:
            continue
        new = True
        if prev is not None and not LIST_RE.match(text):
            same_flow = prev.page == r.page and prev.extra.get("col") == r.extra.get("col")
            tight = same_flow and 0 <= r.y0 - prev.y0 <= prev.size * 1.45
            carried = (not same_flow) and not re.search(r"[.:;]\s*$", paras[-1]["text"])
            new = not (tight or carried)
        if new:
            paras.append(dict(text=text, p0=r.page, p1=r.page))
        else:
            t = paras[-1]["text"]
            joiner = "" if (t.endswith("-") and text[:1].islower()) else " "
            paras[-1]["text"] = t + joiner + text
            paras[-1]["p1"] = r.page
        prev = r
    return [(p["text"], p["p0"], p["p1"]) for p in paras]


@dataclass
class _Open:
    ref: str
    path: list[str]
    part: str
    page: int
    rows: list[Row] = field(default_factory=list)
    in_defs: bool = False


def _mk(ref, path, part, p0, p1, content, ctype) -> dict:
    content = content.strip()
    return dict(
        clause_ref=ref,
        heading_path=path,
        part=part,
        page_start=p0,
        page_end=p1,
        content=content,
        content_type=ctype,
        token_count=tokens(content),
        content_hash=hashlib.sha256(f"{ref}\n{content}".encode()).hexdigest(),
    )


def _split_paras(paras: list[tuple[str, int, int]], limit: int) -> list[list[tuple[str, int, int]]]:
    groups: list[list[tuple[str, int, int]]] = [[]]
    size = 0
    for p in paras:
        t = tokens(p[0])
        if groups[-1] and size + t > limit:
            groups.append([])
            size = 0
        groups[-1].append(p)
        size += t
    return groups


def _table_chunks(md: str, caption: str | None, limit: int) -> list[str]:
    lines = md.split("\n")
    head, body = lines[:2], lines[2:]
    pieces, cur = [], []
    for ln in body:
        if cur and tokens("\n".join(head + cur + [ln]) + (caption or "")) > limit:
            pieces.append(cur)
            cur = []
        cur.append(ln)
    pieces.append(cur)
    out = []
    for pc in pieces:
        text = "\n".join(head + pc)
        out.append(f"{caption}\n{text}" if caption else text)
    return out


def chunk_rows(rows: list[Row], toc: list[TocEntry], part: str) -> tuple[list[dict], dict]:
    chunks: list[dict] = []
    seen_refs: dict[tuple[str, int], int] = {}
    stack: list[TocEntry] = []
    cur: _Open | None = None
    ti = 0
    stats = {"orphan_rows": 0, "unmatched_headings": [], "dropped_tables": []}

    def unique(ref: str, page: int) -> str:
        k = (ref, page)
        seen_refs[k] = seen_refs.get(k, 0) + 1
        return ref if seen_refs[k] == 1 else f"{ref} #{seen_refs[k]}"

    def flush():
        nonlocal cur
        if not cur or not cur.rows:
            cur = None
            return
        tcount = 0

        def emit_text(buf_rows: list[Row]):
            if not buf_rows:
                return
            paras = _paragraphs(buf_rows)
            if cur.in_defs:
                defs: list[dict] = []
                for r in buf_rows:
                    t = norm(r.text)
                    m = DEF_RE.match(t)
                    if "Medium" in r.first_font and m and r.size < 11:
                        defs.append(dict(term=m.group(1).strip(), rows=[r], p0=r.page))
                    elif defs:
                        defs[-1]["rows"].append(r)
                if defs:
                    for d in defs:
                        ps = _paragraphs(d["rows"])
                        content = "\n".join(p[0] for p in ps)
                        ref = unique(f"Definition: {d['term']}", d["p0"])
                        chunks.append(_mk(ref, cur.path, cur.part, d["p0"], ps[-1][2], content, "definition"))
                    return
            groups = _split_paras(paras, MAX_CLAUSE_TOKENS)
            for gi, g in enumerate(groups):
                content = "\n".join(p[0] for p in g)
                ref = cur.ref if len(groups) == 1 else f"{cur.ref} ({gi + 1}/{len(groups)})"
                chunks.append(_mk(unique(ref, g[0][1]), cur.path, cur.part, g[0][1], g[-1][2], content, "clause"))

        blocks: list[dict] = []
        for r in cur.rows:
            if r.kind == "table":
                blocks.append(dict(t="table", md=r.text, page=r.page, caption=r.extra.get("caption"), cols=r.cols))
            elif blocks and blocks[-1]["t"] == "text":
                blocks[-1]["rows"].append(r)
            else:
                blocks.append(dict(t="text", rows=[r]))

        def cap_of(rows: list[Row], end: bool):
            ps = _paragraphs(rows)
            if not ps:
                return None, rows
            para = ps[-1][0] if end else ps[0][0]
            if not CAPTION_RE.match(para):
                return None, rows
            for k in range(1, len(rows) + 1):
                part = rows[-k:] if end else rows[:k]
                if norm(" ".join(x.text for x in part)) == para:
                    return para, (rows[:-k] if end else rows[k:])
            return None, rows

        # merge a table split across columns/pages (same header row), with an optional caption between
        merged: list[dict] = []
        for b in blocks:
            if b["t"] == "table" and merged:
                prev = merged[-1]
                mid = None
                if prev["t"] == "text" and len(merged) >= 2 and merged[-2]["t"] == "table":
                    mid, prev = prev, merged[-2]
                if (
                    prev["t"] == "table"
                    and prev["cols"] == b["cols"]
                    and prev["md"].split("\n")[0] == b["md"].split("\n")[0]
                    and not b["caption"]
                    and mid is None
                ):
                    if mid is not None:
                        prev["caption"], _ = cap_of(mid["rows"], True)
                        merged.pop()
                    prev["md"] += "\n" + "\n".join(b["md"].split("\n")[2:])
                    prev["page_end"] = b["page"]
                    continue
            merged.append(b)
        blocks = merged

        for i, b in enumerate(blocks):
            if b["t"] != "table" or b["caption"]:
                continue
            if i > 0 and blocks[i - 1]["t"] == "text":
                b["caption"], blocks[i - 1]["rows"] = cap_of(blocks[i - 1]["rows"], True)
            if not b["caption"] and i + 1 < len(blocks) and blocks[i + 1]["t"] == "text":
                b["caption"], blocks[i + 1]["rows"] = cap_of(blocks[i + 1]["rows"], False)

        tcount = 0
        emit_text([r for b in blocks if b["t"] == "text" for r in b["rows"]])
        for b in blocks:
            if b["t"] == "text":
                continue
            body = [ln for ln in b["md"].split("\n")[2:]]
            cells = [c for ln in b["md"].split("\n") for c in ln.strip("|").split("|")]
            filled = sum(1 for c in cells if c.strip() and c.strip() != "---") / max(1, len(cells))
            if not b["caption"] and (len(body) < 2 or filled < 0.5 or len(b["md"]) < 80):
                stats["dropped_tables"].append(f"{cur.ref} p{b['page']}")
                continue
            tcount += 1
            m = CAPTION_RE.match(b["caption"]) if b["caption"] else None
            ref = f"Table {m.group(1)}" if m else f"{cur.ref} table {tcount}"
            for pi, content in enumerate(_table_chunks(b["md"], b["caption"], MAX_TABLE_TOKENS)):
                rr = ref if pi == 0 else f"{ref} (rows part {pi + 1})"
                chunks.append(_mk(unique(rr, b["page"]), cur.path, cur.part, b["page"], b.get("page_end", b["page"]), content, "table"))
        cur = None

    i = 0
    while i < len(rows):
        r = rows[i]
        hit = False
        for j in range(ti, min(ti + 4, len(toc))):
            if _is_heading(r, toc[j]):
                for k in range(ti, j):
                    stats["unmatched_headings"].append(toc[k].label)
                e = toc[j]
                e.matched = True
                ti = j + 1
                flush()
                while stack and stack[-1].level >= e.level:
                    stack.pop()
                stack.append(e)
                path = [s.label for s in stack]
                # a heading wrapped onto following rows
                want = norm(f"{e.ref} {e.title}")
                have = norm(r.text)
                while len(have) < len(want) - 1 and i + 1 < len(rows):
                    ext = norm(have + " " + rows[i + 1].text)
                    if rows[i + 1].kind != "text" or not want.startswith(ext):
                        break
                    i += 1
                    have = ext
                in_defs = any(re.search(r"definitions|^terms$", s.title, re.I) for s in stack)
                cur = _Open(e.ref or e.title, path, part, r.page, in_defs=in_defs)
                hit = True
                break
        if not hit:
            if cur is None:
                stats["orphan_rows"] += 1
            else:
                cur.rows.append(r)
        i += 1
    flush()
    for e in toc[ti:]:
        if e.ref:
            stats["unmatched_headings"].append(e.label)
    return chunks, stats
