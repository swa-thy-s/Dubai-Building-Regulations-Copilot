import pymupdf

from ingest import verify_chunks as V


def make_doc():
    doc = pymupdf.open()
    page = doc.new_page()
    page.insert_text((50, 60), "Corridors shall be at least 1.2 m wide in every office building.", fontsize=9)
    return doc


def chunk(ref, ctype, content):
    return dict(clause_ref=ref, content_type=ctype, content=content, page_start=1, page_end=1)


def test_drops_a_table_whose_words_are_not_on_the_page_and_keeps_the_rest():
    doc = make_doc()
    good = chunk("Table 1", "table", "| Corridors shall be at least | 1.2 m wide |")
    bad = chunk("Table 2", "table", "| sertaeht dna sameniC | skrap noitaerceR | gnitoohs segnar |")
    clause = chunk("B.1", "clause", "completely unrelated words that are not on the page at all")
    keep, dropped = V.drop_scrambled_tables(doc, [good, bad, clause])
    assert [c["clause_ref"] for c in keep] == ["Table 1", "B.1"]
    assert len(dropped) == 1 and "Table 2" in dropped[0]


def test_coverage_ignores_ligature_spelling_differences():
    assert V.words("floors office") == V.words("foors ofce")
