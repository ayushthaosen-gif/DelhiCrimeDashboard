from __future__ import annotations

from ..models import ValidationIssue


def validate_rows(
    rows: list[dict], source_id: str, integer_fields: list[str]
) -> list[ValidationIssue]:
    issues = []
    seen = set()
    for index, row in enumerate(rows):
        signature = tuple(sorted((k, str(v)) for k, v in row.items()))
        if signature in seen:
            issues.append(
                ValidationIssue(
                    severity="error",
                    code="duplicate_row",
                    message=f"Duplicate row {index}",
                    source_id=source_id,
                    record=row,
                )
            )
        seen.add(signature)
        for field in integer_fields:
            value = row.get(field)
            if value is None:
                continue
            if not isinstance(value, int):
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="non_integer",
                        message=f"{field} is not an integer",
                        source_id=source_id,
                        record=row,
                    )
                )
            elif value < 0:
                issues.append(
                    ValidationIssue(
                        severity="error",
                        code="negative_value",
                        message=f"{field} is negative",
                        source_id=source_id,
                        record=row,
                    )
                )
    return issues
