from __future__ import annotations


def normalize_vend(row: dict, source_id: str, agency: str, temporal_status: str) -> dict:
    low = {str(k).strip().lower().replace(" ", "_"): v for k, v in row.items()}
    return {
        "source_id": source_id,
        "agency": agency,
        "corporation": low.get("corporation"),
        "vend_name": low.get("vend_name") or low.get("name"),
        "address": low.get("address"),
        "licence_number": low.get("licence_number") or low.get("license_number"),
        "licence_type": low.get("licence_type"),
        "status": low.get("status"),
        "valid_from": None,
        "valid_to": None,
        "snapshot_date": low.get("snapshot_date"),
        "temporal_status": temporal_status,
        "latitude": None,
        "longitude": None,
        "coordinate_source": None,
        "coordinate_confidence": None,
        "coordinate_is_approximate": None,
        "geocode_review_status": "user_input_required",
        "source_file": None,
        "source_page": None,
    }


def extract_vends(tables: list[list[dict]], source_id: str, agency: str, dated: bool) -> list[dict]:
    temporal = "dated_2025_source" if dated else "unclear"
    return [normalize_vend(row, source_id, agency, temporal) for table in tables for row in table]
