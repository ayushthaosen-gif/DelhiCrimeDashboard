from __future__ import annotations

from ..models import ValidationIssue
from ..provenance import provenance_complete


def validate_provenance(records: list[dict]) -> list[ValidationIssue]:
    return [
        ValidationIssue(
            severity="error",
            code="provenance_incomplete",
            message="Processed record lacks required provenance",
            record=r,
        )
        for r in records
        if not provenance_complete(r)
    ]
