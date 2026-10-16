from ingest import chunk
from ingest.parse import Row


def row(text, page=1, y=100.0, col=0, kind="text", font="Dubai-Regular", size=10.5, **extra):
    r = Row(page, kind, text, 57, y, 300, y + 12, size, font, extra={"col": col, **extra})
    if kind == "table":
        r.cols = 2
    return r


def toc(*items):
    return [chunk.TocEntry(lvl, ref, title, page) for lvl, ref, title, page in items]


TABLE = "| Use | Width (m) |\n| --- | --- |\n| Retail | 1.8 |\n| Office | 1.5 |"


def test_one_chunk_per_clause_with_heading_path_and_page():
    rows = [
        row("B.1\tGeneral", y=80),
        row("B.1.1\tCorridors", y=100),
        row("Corridors shall be at least 1.2 m wide.", y=120),
        row("B.1.2\tStairs", y=150),
        row("Stairs shall have handrails.", y=170, page=2),
    ]
    t = toc((2, "B.1", "General", 1), (3, "B.1.1", "Corridors", 1), (3, "B.1.2", "Stairs", 1))
    t[2].page = 2
    rows[3].page = 2
    chunks, stats = chunk.chunk_rows(rows, t, "Part B")
    refs = {c["clause_ref"]: c for c in chunks}
    assert set(refs) == {"B.1.1", "B.1.2"}
    assert refs["B.1.1"]["content"] == "Corridors shall be at least 1.2 m wide."
    assert refs["B.1.1"]["heading_path"] == ["B.1 General", "B.1.1 Corridors"]
    assert refs["B.1.2"]["page_start"] == 2
    assert stats["unmatched_headings"] == []


def test_table_stays_whole_with_caption_and_own_chunk():
    rows = [
        row("B.2\tWidths", y=80),
        row("Widths are in Table B.9.", y=100),
        row(TABLE, y=130, kind="table", caption="Table B.9 Corridor widths"),
    ]
    chunks, _ = chunk.chunk_rows(rows, toc((2, "B.2", "Widths", 1)), "Part B")
    tables = [c for c in chunks if c["content_type"] == "table"]
    assert len(tables) == 1
    assert tables[0]["clause_ref"] == "Table B.9"
    assert TABLE in tables[0]["content"]
    assert tables[0]["content"].startswith("Table B.9 Corridor widths")
    assert [c["content"] for c in chunks if c["content_type"] == "clause"] == ["Widths are in Table B.9."]


def test_large_table_splits_by_row_groups_with_header_repeated():
    body = "\n".join(f"| Row {i} | {'word ' * 30}|" for i in range(60))
    md = "| A | B |\n| --- | --- |\n" + body
    pieces = chunk._table_chunks(md, "Table B.1 Big", 400)
    assert len(pieces) > 1
    for p in pieces:
        assert "| A | B |" in p and "| --- | --- |" in p
    assert sum(p.count("| Row ") for p in pieces) == 60


def test_definitions_become_their_own_chunks():
    rows = [
        row("B.2\tDefinitions", y=80),
        row("B.2.1\tTerms", y=100),
        row("Arcade: Roofed corridor that leads to any building.", y=120, font="Dubai-Medium"),
        row("Atrium: Large open space.", y=150, font="Dubai-Medium"),
        row("spanning several floors.", y=163),
    ]
    t = toc((2, "B.2", "Definitions", 1), (3, "B.2.1", "Terms", 1))
    chunks, _ = chunk.chunk_rows(rows, t, "Part B")
    defs = {c["clause_ref"]: c for c in chunks if c["content_type"] == "definition"}
    assert set(defs) == {"Definition: Arcade", "Definition: Atrium"}
    assert defs["Definition: Atrium"]["content"] == "Atrium: Large open space. spanning several floors."


def test_long_clause_splits_at_paragraphs_and_keeps_clause_number():
    rows = [row("B.3\tLong", y=80)]
    for i in range(30):
        rows.append(row(f"a{i}) " + "word " * 60, y=100 + i * 40))
    chunks, _ = chunk.chunk_rows(rows, toc((2, "B.3", "Long", 1)), "Part B")
    assert len(chunks) > 1
    assert all(c["clause_ref"].startswith("B.3 (") for c in chunks)
    assert all(c["token_count"] <= chunk.MAX_CLAUSE_TOKENS + 120 for c in chunks)


def test_heading_must_be_on_its_outline_page():
    rows = [row("B.5\tSpace", page=3, y=80), row("See B.5 above.", page=3, y=100)]
    t = toc((2, "B.5", "Space", 4))
    chunks, stats = chunk.chunk_rows(rows, t, "Part B")
    assert chunks == []
    assert stats["unmatched_headings"] == ["B.5 Space"]
