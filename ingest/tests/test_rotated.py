from ingest import rotated


def test_reverses_a_backwards_cell():
    assert rotated.fix_cell(" sertaeht dna sameniC ").strip() == "Cinemas and theatres"


def test_leaves_normal_text_numbers_and_short_cells_alone():
    for cell in (" Cinemas and theatres ", " 1,500 ", " mm ", " ", " Width (mm) "):
        assert rotated.fix_cell(cell) == cell


def test_fix_table_touches_cells_not_the_separator_row():
    table = "Table J.2 CCTV\n| sertaeht dna sameniC | Width |\n| --- | --- |\n| 4 | 12 |"
    out, n = rotated.fix_table(table)
    assert n == 1
    assert "Cinemas and theatres" in out and "| --- | --- |" in out and "| 4 | 12 |" in out


def test_repair_chunks_updates_hash_and_tokens_only_for_changed_tables():
    t = {"clause_ref": "Table X", "content_type": "table", "content": "| sertaeht dna sameniC | 4 |", "token_count": 1, "content_hash": "old"}
    c = {"clause_ref": "B.1", "content_type": "clause", "content": "sertaeht dna sameniC", "token_count": 1, "content_hash": "keep"}
    assert rotated.repair_chunks([t, c]) == 1
    assert "Cinemas" in t["content"] and t["content_hash"] != "old"
    assert c["content_hash"] == "keep" and c["content"] == "sertaeht dna sameniC"
