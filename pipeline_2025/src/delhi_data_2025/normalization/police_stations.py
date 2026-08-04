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
    unmapped = []
    for row in rows:
        if row.get("police_district"):
            row["police_station_normalized"] = row.get("police_station_raw")
            row["review_status"] = "source_report_district"
            continue
        match = crosswalk.get(canonical(row.get("police_station_raw")))
        if match:
            row["police_station_normalized"] = match["police_station_normalized"]
            row["police_district"] = match["police_district_2025"]
            row["review_status"] = (
                "reviewed" if match.get("reviewed", "").lower() == "true" else "pending"
            )
        else:
            row["review_status"] = "unmapped"
            unmapped.append(row)
    return rows, unmapped
