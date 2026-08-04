from __future__ import annotations

import re
from pathlib import Path

import pdfplumber

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


def extract_irad_pdf_tables(path: Path, source_id: str) -> list[dict]:
    """Extract fixed-position iRAD station tables without shifting blank cells."""
    rows = []
    source_districts = {
        "irad_new_delhi": "New Delhi",
        "irad_west": "West",
        "irad_south_east": "South East",
        "irad_north_west": "North West",
    }
    source_district = source_districts.get(source_id)
    with pdfplumber.open(path) as document:
        for page_number, page in enumerate(document.pages, start=1):
            for table in page.extract_tables():
                for cells in table:
                    if len(cells) < 22 or not str(cells[0] or "").strip().isdigit():
                        continue
                    station = " ".join(str(cells[2] or "").split()) or None
                    minor_hospitalised = _number(cells[5])
                    minor_non_hospitalised = _number(cells[6])
                    minor_total = (
                        minor_hospitalised + minor_non_hospitalised
                        if minor_hospitalised is not None and minor_non_hospitalised is not None
                        else None
                    )
                    injured_grievous = _number(cells[15])
                    injured_minor = _number(cells[16])
                    persons_injured = (
                        injured_grievous + injured_minor
                        if injured_grievous is not None and injured_minor is not None
                        else None
                    )
                    rows.append(
                        {
                            "source_id": source_id,
                            "source_file": str(path),
                            "source_page": page_number,
                            "revenue_district": None,
                            "police_station_raw": station,
                            "police_station_normalized": None,
                            "police_district": source_district,
                            "period_start": "2025-01-01",
                            "period_end": "2025-12-31",
                            "fatal_accidents": _number(cells[3]),
                            "serious_injury_accidents": _number(cells[4]),
                            "minor_injury_accidents": minor_total,
                            "non_injury_accidents": _number(cells[7]),
                            "simple_accidents": None,
                            "total_accidents": _number(cells[9]),
                            "persons_killed": _number(cells[14]),
                            "persons_injured": persons_injured,
                            "extraction_method": "pdf_geometry_table",
                            "extraction_confidence": 0.98,
                            "review_status": "source_report_district",
                            "notes": (
                                "Blank source cells remain null; minor injury combines the two "
                                "published minor-injury columns only when both are populated."
                            ),
                        }
                    )
    return rows
