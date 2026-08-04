from __future__ import annotations

import re

INTEGER_FIELDS = [
    "fatal_accidents",
    "serious_injury_accidents",
    "minor_injury_accidents",
    "non_injury_accidents",
    "simple_accidents",
    "total_accidents",
    "persons_killed",
    "persons_injured",
]


def _number(value):
    if value in (None, "", "-", "NA", "N/A"):
        return None
    try:
        return int(str(value).replace(",", "").strip())
    except ValueError:
        return None


def normalize_row(row: dict, source_id: str, method: str, confidence: float) -> dict:
    lower = {str(k).strip().lower().replace(" ", "_"): v for k, v in row.items()}
    station = lower.get("police_station") or lower.get("police_station_name") or lower.get("ps")
    result = {
        "source_id": source_id,
        "police_station_raw": station,
        "police_station_normalized": None,
        "police_district": None,
        "period_start": lower.get("period_start"),
        "period_end": lower.get("period_end"),
        "extraction_method": method,
        "extraction_confidence": confidence,
        "review_status": "pending",
        "notes": None,
    }
    aliases = {
        "fatal_accidents": ["fatal_accidents", "fatal"],
        "serious_injury_accidents": ["serious_injury_accidents", "serious"],
        "minor_injury_accidents": ["minor_injury_accidents", "minor"],
        "non_injury_accidents": ["non_injury_accidents", "non_injury"],
        "simple_accidents": ["simple_accidents", "simple"],
        "total_accidents": ["total_accidents", "total"],
        "persons_killed": ["persons_killed", "killed"],
        "persons_injured": ["persons_injured", "injured"],
    }
    for target, names in aliases.items():
        result[target] = next((_number(lower[n]) for n in names if n in lower), None)
    return result


def parse_text_rows(text: str, source_id: str) -> list[dict]:
    rows = []
    pattern = re.compile(
        r"^\s*(?P<station>[A-Za-z][A-Za-z .&/-]+?)\s+"
        r"(?P<fatal>\d+)\s+(?P<simple>\d+)\s+(?P<total>\d+)\s*$"
    )
    for line in text.splitlines():
        match = pattern.match(line)
        if match:
            rows.append(
                normalize_row(
                    {
                        "police_station": match["station"],
                        "fatal": match["fatal"],
                        "simple": match["simple"],
                        "total": match["total"],
                    },
                    source_id,
                    "pdf_row_pattern",
                    0.82,
                )
            )
    return rows


def extract_irad(
    html_tables: list[list[dict]], pdf_text: str | None, source_id: str
) -> tuple[list[dict], str]:
    rows = [
        normalize_row(row, source_id, "html_table", 0.95) for table in html_tables for row in table
    ]
    if rows:
        return rows, "extracted"
    if pdf_text:
        rows = parse_text_rows(pdf_text, source_id)
        if rows:
            return rows, "extracted"
    return [], "needs_manual_review"
