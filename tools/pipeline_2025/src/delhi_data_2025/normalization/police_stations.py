from __future__ import annotations

import csv
from pathlib import Path


def canonical(value: str | None) -> str | None:
    return " ".join((value or "").lower().replace("p.s.", "").replace("ps ", "").split()) or None


def load_crosswalk(path: Path) -> dict[str, dict]:
    with path.open(encoding="utf-8-sig") as handle:
        return {
            canonical(row["police_station_raw"]): row
            for row in csv.DictReader(handle)
            if canonical(row.get("police_station_raw"))
        }


def apply_crosswalk(rows: list[dict], crosswalk: dict[str, dict]) -> tuple[list[dict], list[dict]]:
    """Map iRAD station labels to police districts without treating report area as jurisdiction."""
    unmapped = []
    for row in rows:
        existing_district = row.get("police_district")
        existing_status = row.get("review_status")
        # Legacy extracts placed the publishing administrative area in police_district.
        # Preserve it separately, then require an explicit station crosswalk for jurisdiction.
        if existing_district and existing_status in {
            "source_report_district",
            "source_report_area",
        }:
            row.setdefault("reporting_administrative_area", existing_district)
            row["police_district"] = None
        match = crosswalk.get(canonical(row.get("police_station_raw")))
        if match:
            row["police_station_normalized"] = match["police_station_normalized"]
            row["police_district"] = match["police_district_2025"]
            row["mapping_source"] = match.get("source") or None
            row["mapping_evidence_page"] = match.get("evidence_page") or None
            row["mapping_temporal_basis"] = match.get("temporal_basis") or None
            row["review_status"] = (
                "reviewed_manual_crosswalk"
                if match.get("reviewed", "").lower() == "true"
                else "pending_crosswalk_review"
            )
        elif row.get("police_district") and existing_status == "reviewed":
            row["review_status"] = "reviewed"
        else:
            row["police_district"] = None
            row["review_status"] = "unmapped"
            unmapped.append(row)
    return rows, unmapped
