from pathlib import Path

from delhi_data_2025.extraction.irad import extract_irad

FIX = Path(__file__).parent / "fixtures"


def test_two_pdf_text_layouts():
    for name in ("irad_layout_a.txt", "irad_layout_b.txt"):
        rows, status = extract_irad([], (FIX / name).read_text(), "irad_test")
        assert (
            status == "extracted"
            and len(rows) == 2
            and all(r["total_accidents"] is not None for r in rows)
        )


def test_manual_review_fallback():
    rows, status = extract_irad([], "image only", "irad_test")
    assert rows == [] and status == "needs_manual_review"


def test_missing_values_remain_null():
    rows, _ = extract_irad([], "Test Station 1 2 3", "irad_test")
    assert rows[0]["persons_killed"] is None
