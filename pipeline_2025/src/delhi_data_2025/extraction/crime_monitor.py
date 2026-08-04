from __future__ import annotations

from ..models import Candidate, DatasetResult, DatasetStatus, SourceConfig


def monitor_crime(
    source: SourceConfig, candidates: list[Candidate], latest_verified_year: int = 2024
) -> DatasetResult:
    exact = [c for c in candidates if "crime in india 2025" in c.title.lower() and c.selected]
    if exact:
        return DatasetResult(
            source_id=source.source_id,
            dataset="crime",
            requested_year=2025,
            collected_year=2025,
            status=DatasetStatus.COLLECTED_NEEDS_REVIEW,
            coverage="official release candidate discovered; not yet ingested",
            source=str(exact[0].url),
            blocking_issues=["BNS-era field concordance requires human review"],
        )
    return DatasetResult(
        source_id=source.source_id,
        dataset="crime",
        requested_year=2025,
        collected_year=latest_verified_year,
        status=DatasetStatus.NOT_PUBLISHED,
        coverage="No unambiguous official Crime in India 2025 release found",
        source=str(source.page_url),
        blocking_issues=["Retain latest verified crime year separately; never create totalIPC2025"],
    )
