from __future__ import annotations

import csv
import json
from pathlib import Path

from .models import DatasetResult, ValidationIssue


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, indent=2, ensure_ascii=False, default=str) + "\n", encoding="utf-8"
    )


def coverage_markdown(results: list[DatasetResult]) -> str:
    lines = [
        "# 2025 Coverage Report",
        "",
        "Dataset | Requested year | Collected year | Status | Coverage | Source | Blocking issues",
        "---|---:|---:|---|---|---|---",
    ]
    for r in results:
        issues = "; ".join(r.blocking_issues) or "None"
        values = (
            r.dataset,
            r.requested_year,
            r.collected_year or "?",
            r.status.value,
            r.coverage,
            r.source,
            issues,
        )
        lines.append(" | ".join(map(str, values)))
    crime = next((r for r in results if r.dataset == "crime"), None)
    if crime and crime.status.value == "not_published":
        lines += [
            "",
            "**Crime remains at the latest independently verified dashboard year "
            "(currently 2024); no 2025 crime values were substituted.**",
        ]
    return "\n".join(lines) + "\n"


def validation_markdown(issues: list[ValidationIssue]) -> str:
    lines = ["# 2025 Validation Report", "", f"Issues: {len(issues)}", ""]
    lines += [f"- **{i.severity} / {i.code}**: {i.message}" for i in issues] or [
        "No validation issues."
    ]
    return "\n".join(lines) + "\n"


def write_review_csv(path: Path, headers: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)
