from delhi_data_2025.models import ProvenanceRecord
from delhi_data_2025.provenance import provenance_complete
from delhi_data_2025.validation.road_crashes import validate_road_crashes
from delhi_data_2025.validation.terminology import validate_terminology


def test_validation_never_repairs_values():
    row = {
        "police_station_raw": "Test",
        "police_district": None,
        "fatal_accidents": 2,
        "simple_accidents": 3,
        "non_injury_accidents": 1,
        "total_accidents": 99,
    }
    issues = validate_road_crashes([row])
    assert any(i.code == "component_mismatch" for i in issues)
    assert row["total_accidents"] == 99


def test_provenance_complete():
    record = ProvenanceRecord(
        source_id="x",
        agency="Agency",
        source_title="Title",
        source_url="https://official.test/file",
        landing_page_url="https://official.test",
        source_year=2025,
        extraction_method="fixture",
        extraction_confidence=1,
        review_status="reviewed",
    )
    assert provenance_complete(record.model_dump())


def test_unsafe_terminology_rejected():
    assert validate_terminology("create totalIPC2025")
