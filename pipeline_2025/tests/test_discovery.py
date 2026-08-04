from pathlib import Path

from delhi_data_2025.discovery import discover_html, score_candidate
from delhi_data_2025.models import SourceConfig


def source():
    return SourceConfig(
        source_id="irad",
        agency="District Administration",
        dataset="irad_edar",
        year=2025,
        page_url="https://dmnewdelhi.delhi.gov.in/page",
        allowed_domains=["dmnewdelhi.delhi.gov.in"],
        mode="collect",
    )


def test_scoring_prefers_annual():
    monthly = score_candidate(
        "January 2025 iRAD", "https://dmnewdelhi.delhi.gov.in/jan.pdf", 2025, "irad_edar"
    )[0]
    annual = score_candidate(
        "01 Jan 2025 to 31 Dec 2025 iRAD",
        "https://dmnewdelhi.delhi.gov.in/annual.pdf",
        2025,
        "irad_edar",
    )[0]
    assert annual > monthly


def test_allowlist_relative_and_reject_external():
    html = (Path(__file__).parent / "fixtures" / "discovery.html").read_text()
    found = discover_html(source(), html)
    assert len(found) == 2 and sum(c.selected for c in found) == 1
    assert all(str(c.url).startswith("https://dmnewdelhi.delhi.gov.in/") for c in found)
