from __future__ import annotations

from datetime import date

from ..extraction.irad import INTEGER_FIELDS
from ..models import ValidationIssue
from .common import validate_rows


def validate_road_crashes(rows: list[dict], strict: bool = False) -> list[ValidationIssue]:
    issues = validate_rows(rows, "irad_edar", INTEGER_FIELDS)
    for row in rows:
        if not row.get("police_station_raw"):
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="missing_station",
                    message="Police-station name is missing",
                    record=row,
                )
            )
        for field in ("period_start", "period_end"):
            if row.get(field):
                try:
                    if date.fromisoformat(str(row[field])).year != 2025:
                        issues.append(
                            ValidationIssue(
                                severity="error",
                                code="period_outside_2025",
                                message=f"{field} outside 2025",
                                record=row,
                            )
                        )
                except ValueError:
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            code="invalid_date",
                            message=f"Invalid {field}",
                            record=row,
                        )
                    )
        if not row.get("police_district"):
            issues.append(
                ValidationIssue(
                    severity="error" if strict else "warning",
                    code="unresolved_station",
                    message="Station has no reviewed police-district mapping",
                    record=row,
                )
            )
        components = [
            row.get(k) for k in ("fatal_accidents", "simple_accidents", "non_injury_accidents")
        ]
        if (
            row.get("total_accidents") is not None
            and all(v is not None for v in components)
            and sum(components) != row["total_accidents"]
        ):
            issues.append(
                ValidationIssue(
                    severity="warning",
                    code="component_mismatch",
                    message="Components do not reconcile with total; values were not changed",
                    record=row,
                )
            )
    return issues
