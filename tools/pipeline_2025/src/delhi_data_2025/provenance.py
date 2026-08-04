from __future__ import annotations

import csv
from pathlib import Path

from .models import ProvenanceRecord

REQUIRED = set(ProvenanceRecord.model_fields)


def append_jsonl(path: Path, records: list[ProvenanceRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(record.model_dump_json() + "\n")


def write_audit_csv(path: Path, records: list[ProvenanceRecord]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(ProvenanceRecord.model_fields))
        writer.writeheader()
        for record in records:
            writer.writerow(record.model_dump(mode="json"))


def provenance_complete(record: dict) -> bool:
    return REQUIRED.issubset(record) and all(
        record.get(k) is not None
        for k in REQUIRED
        - {"source_file", "source_page", "publication_date", "retrieval_date", "notes"}
    )
