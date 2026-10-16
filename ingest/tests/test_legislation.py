from collections import Counter

import pymupdf

from ingest import legislation as L
from ingest import ligatures


def test_repairs_dropped_ligatures_only_when_unambiguous():
    fixes, unresolved = Counter(), Counter()
    out = ligatures.repair("The foors and fxtures of the offce, in fnal form.", fixes, unresolved)
    assert "floors" in out and "fixtures" in out
    assert "final" in out
    assert not unresolved or "offce" in unresolved or "office" in out


def test_leaves_valid_words_and_abbreviations_alone():
    fixes, unresolved = Counter(), Counter()
    text = "The DIFC officer shall file a report for the first floor."
    assert ligatures.repair(text, fixes, unresolved) == text
    assert not fixes


def test_capitalised_word_keeps_case():
    fixes, unresolved = Counter(), Counter()
    assert ligatures.repair("Fxtures are listed.", fixes, unresolved).startswith("Fixtures")


def make_pdf(path, pages, toc):
    doc = pymupdf.open()
    for text in pages:
        page = doc.new_page()
        page.insert_text((50, 60), text, fontsize=9)
    doc.set_toc(toc)
    doc.save(path)


ARTICLE_PAGE = (
    "Law No. (5) of 2020\nConcerning Walls\nWe, the Ruler, do issue this Law.\n"
    "Chapter One\nArticle (1)\nThis Law may be cited as the Walls Law.\n"
    "Article (2)\n1.\nOwners may not alter structural walls.\n2.\nInternal walls may be altered with consent.\n"
    "(c) 2014 The Government of Dubai Legal Affairs Department\n(1) Every effort has been made to translate."
)


def test_law_ranges_reads_number_year_and_pages(tmp_path):
    pdf = tmp_path / "x.pdf"
    make_pdf(pdf, ["divider", ARTICLE_PAGE, "Decree page text " * 20], [[1, "Law No. (5) of 2020", 1], [1, "Concerning Walls", 1], [1, "Decree No. (9) of 2021", 3]])
    laws = L.law_ranges(str(pdf))
    assert [(x["slug"], x["first"], x["last"], x["edition"]) for x in laws] == [("law-5-2020", 1, 2, "2020"), ("decree-9-2021", 3, 3, "2021")]
    assert laws[0]["title"] == "Law No. (5) of 2020 Concerning Walls"


def test_one_chunk_per_article_with_preamble_and_no_footer(tmp_path):
    pdf = tmp_path / "x.pdf"
    ARTICLE_PAGE_C = ARTICLE_PAGE.replace("(c)", "©")
    make_pdf(pdf, ["Law divider", ARTICLE_PAGE_C], [[1, "Law No. (5) of 2020", 1], [1, "Concerning Walls", 1]])
    law = L.law_ranges(str(pdf))[0]
    chunks, stats = L.chunk_law(str(pdf), law, repair_ligatures=False)
    assert [c["clause_ref"] for c in chunks] == ["Preamble", "Article 1", "Article 2"]
    assert all(c["page_start"] == 2 for c in chunks)
    assert stats["skipped_pages"] == [1]
    art2 = chunks[2]["content"]
    assert "structural walls" in art2 and "Internal walls" in art2
    assert "Every effort" not in " ".join(c["content"] for c in chunks)
    assert chunks[2]["heading_path"][-1] == "Article 2" and "Chapter One" in chunks[2]["heading_path"]
    assert all(c["content_hash"] and c["token_count"] > 0 for c in chunks)


def test_long_article_splits_on_numbered_items(tmp_path):
    pdf = tmp_path / "x.pdf"
    body = "\n".join(["alpha beta gamma delta epsilon zeta eta theta iota kappa"] * 60)
    pages = ["divider", "Article (1)\n1.\n" + body] + [f"{i}.\n{body}" for i in range(2, 5)]
    make_pdf(pdf, pages, [[1, "Law No. (5) of 2020", 1]])
    law = L.law_ranges(str(pdf))[0]
    chunks, _ = L.chunk_law(str(pdf), law, repair_ligatures=False)
    refs = [c["clause_ref"] for c in chunks]
    assert len(chunks) == 4 and all(r.startswith("Article 1 (") for r in refs)
    assert all(c["token_count"] < 1200 for c in chunks)
    assert chunks[-1]["page_start"] == 2 and chunks[-1]["page_end"] == 5


def test_prefers_exact_words_and_accepts_british_spelling():
    fixes, unresolved = Counter(), Counter()
    assert ligatures.repair("ffty days to fnalise", fixes, unresolved) == "fifty days to finalise"
