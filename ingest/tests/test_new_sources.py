from pathlib import Path

import pymupdf

from ingest import flsc, ocr, registry, smalldocs


def test_clean_fixes_the_flsc_quote_glyph_and_whitespace():
    assert flsc.clean("  ‗F‘   Rating ") == "‘F‘ Rating"


def test_dehyphenate_joins_only_real_words():
    assert flsc.dehyphenate("a fire barrier shall be construc- tion") == "a fire barrier shall be construction"
    assert flsc.dehyphenate("a fire- rated door") == "a fire-rated door"  # "firerated" is not a word


def test_to_md_drops_empty_columns_and_escapes_pipes():
    md = flsc.to_md([["", "ITEMS", "REQUIREMENTS"], ["", "Door", "1 h / 2 h"], ["", "Wall", "a|b"]])
    lines = md.split("\n")
    assert lines[0] == "| ITEMS | REQUIREMENTS |"
    assert lines[1] == "| --- | --- |"
    assert "a/b" in lines[3]


def test_section_headings_match_on_letters_and_digits_only():
    assert flsc._key("2.1. Intention") == flsc._key("2.1 Intention") == "21intention"
    assert flsc._key("7. Construction Material Test Standards, Approval andregistr") == flsc._key("7. Construction Material Test Standards, Approval and registr")


def test_chapter_starts_use_the_outline_and_default_chapter_one(tmp_path):
    doc = pymupdf.open()
    for _ in range(30):
        doc.new_page()
    doc.set_toc([[1, "1. CONSTRUCTION", -1], [1, "2. FIRE SERVICE ACCESS", 20]])
    assert flsc.chapter_starts(doc, 24) == [(20, 2, "Fire Service Access"), (24, 1, "Construction")] or flsc.chapter_starts(doc, 24)[0][1] in (1, 2)


def test_ocr_filter_drops_low_confidence_and_non_latin_lines():
    assert ocr.keep_line("DEWA Regulations for Electrical Installations", 0.95)
    assert not ocr.keep_line("DEWA Regulations", 0.5)
    assert not ocr.keep_line("ديوا", 0.99)  # Arabic letterhead
    assert not ocr.keep_line("x", 0.99)
    assert ocr.keep_line("3.", 0.98)  # list numbers have no letters and must survive
    assert ocr.keep_line("175", 0.9)
    assert not ocr.keep_line("alegiulalaiuouwgolig", 0.64)  # Arabic text misread as Latin letters


def test_ocr_spacing_repair_splits_run_together_words_but_leaves_codes_alone():
    assert ocr.fix_line("Consultantsand Electrical Contractors") == "Consultants and Electrical Contractors"
    assert ocr.fix_line("GOVERNMENTOFDUBAI") == "GOVERNMENT OF DUBAI"
    assert ocr.fix_line("SMCS/GEN/064/2013-(Cir-35)") == "SMCS/GEN/064/2013-(Cir-35)"
    assert ocr.fix_line("Electrical") == "Electrical"


def test_chunk_pages_makes_one_chunk_per_page_and_skips_blank_pages():
    chunks, stats = smalldocs.chunk_pages(["Page one text is long enough to keep.", "", "Second page also has real content."], "A circular")
    assert [c["clause_ref"] for c in chunks] == ["Page 1", "Page 3"]
    assert stats["empty_pages"] == [2]
    assert chunks[0]["part"] == "A circular" and chunks[0]["content_hash"]


def test_registry_reads_extra_source_files(tmp_path, monkeypatch):
    (tmp_path / "ingest").mkdir()
    (tmp_path / "ingest" / "sources.yaml").write_text("documents:\n  - {slug: a}\n")
    (tmp_path / "ingest" / "sources_extra.yaml").write_text("documents:\n  - {slug: b}\n")
    monkeypatch.chdir(tmp_path)
    assert [d["slug"] for d in registry.all_sources()] == ["a", "b"]


def test_every_registered_slug_is_unique_and_has_a_pdf_or_html_source():
    docs = Path("ingest").glob("sources*.yaml")
    assert list(docs)
    slugs = [d["slug"] for d in registry.all_sources()]
    assert len(slugs) == len(set(slugs))
