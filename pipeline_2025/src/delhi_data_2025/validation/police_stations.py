from __future__ import annotations

from ..models import ValidationIssue

DISTRICTS = {
    "Central",
    "Dwarka",
    "East",
    "New Delhi",
    "North",
    "North-East",
    "North-West",
    "Outer",
    "Outer North",
    "Rohini",
    "Shahdara",
    "South",
    "South-East",
    "South-West",
    "West",
}


def validate_station_mapping(rows: list[dict]) -> list[ValidationIssue]:
    issues = []
    unresolved = [r for r in rows if not r.get("police_district")]
    if unresolved:
        issues.append(
            ValidationIssue(
                severity="error",
                code="unresolved_station_mappings",
                message=f"{len(unresolved)} police stations remain unresolved",
            )
        )
    else:
        found = {r["police_district"] for r in rows}
        if found != DISTRICTS:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="partial_district_coverage",
                    message=(
                        f"Resolved data covers {len(found)} police districts, expected exactly 15"
                    ),
                )
            )
    return issues
