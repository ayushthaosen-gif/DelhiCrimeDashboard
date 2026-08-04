from pathlib import Path

from delhi_data_2025.extraction.html_tables import extract_tables
from delhi_data_2025.extraction.liquor_vends import extract_vends


def test_current_page_not_complete_snapshot():
    html = (Path(__file__).parent / "fixtures" / "liquor.html").read_text()
    rows = extract_vends(extract_tables(html), "dscsc", "DSCSC", False)
    assert len(rows) == 1 and rows[0]["temporal_status"] == "unclear"
    assert rows[0]["latitude"] is None and rows[0]["geocode_review_status"] == "user_input_required"
