from pathlib import Path

from delhi_data_2025.normalization.police_stations import apply_crosswalk, load_crosswalk

CROSSWALK = Path(__file__).parents[1] / "config" / "police_station_crosswalk.csv"


def test_manual_crosswalk_replaces_report_area_not_jurisdiction():
    rows = [
        {
            "police_station_raw": "ANAND PARBAT",
            "police_district": "West",
            "review_status": "source_report_district",
        },
        {
            "police_station_raw": "PASCHIM VIHAR",
            "police_district": "West",
            "review_status": "source_report_district",
        },
    ]
    mapped, unresolved = apply_crosswalk(rows, load_crosswalk(CROSSWALK))

    assert mapped[0]["reporting_administrative_area"] == "West"
    assert mapped[0]["police_district"] == "Central"
    assert mapped[0]["mapping_evidence_page"] == "21"
    assert mapped[0]["mapping_temporal_basis"] == "post-period structural reference"
    assert mapped[0]["review_status"] == "reviewed_manual_crosswalk"

    assert unresolved == [mapped[1]]
    assert mapped[1]["police_district"] is None
    assert mapped[1]["review_status"] == "unmapped"


def test_crosswalk_has_evidence_for_every_reviewed_row():
    crosswalk = load_crosswalk(CROSSWALK)
    assert len(crosswalk) == 46
    assert all(
        row["source"] and row["evidence_page"] and row["temporal_basis"]
        for row in crosswalk.values()
    )
