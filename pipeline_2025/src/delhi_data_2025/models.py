from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, HttpUrl


class DatasetStatus(StrEnum):
    COLLECTED_VALIDATED = "collected_validated"
    COLLECTED_NEEDS_REVIEW = "collected_needs_review"
    NOT_PUBLISHED = "not_published"
    NOT_AVAILABLE = "not_available"
    RETAINED_LEGACY_YEAR = "retained_legacy_year"
    USER_INPUT_REQUIRED = "user_input_required"
    FAILED = "failed"


class SourceMode(StrEnum):
    MONITOR = "monitor"
    COLLECT = "collect"
    COLLECT_WITH_DATE_WARNING = "collect_with_date_warning"


class SourceConfig(BaseModel):
    source_id: str
    agency: str
    dataset: str
    year: int
    mode: SourceMode
    allowed_domains: list[str]
    page_url: HttpUrl | None = None
    police_station_page_url: HttpUrl | None = None
    endpoint: HttpUrl | None = None
    snapshot_time: datetime | None = None


class Candidate(BaseModel):
    source_id: str
    title: str
    url: HttpUrl
    score: int
    reasons: list[str] = Field(default_factory=list)
    selected: bool = False


class DownloadRecord(BaseModel):
    source_id: str
    agency: str
    dataset: str
    year: int
    landing_page_url: str
    download_url: str
    resolved_url: str
    retrieved_at_utc: datetime
    http_status: int
    content_type: str | None = None
    content_length: int
    sha256: str
    etag: str | None = None
    last_modified: str | None = None
    local_path: str
    licence_or_terms: str | None = None
    snapshot_date: str | None = None


class ProvenanceRecord(BaseModel):
    source_id: str
    agency: str
    source_title: str
    source_url: str
    landing_page_url: str
    source_file: str | None = None
    source_page: int | None = None
    source_year: int
    publication_date: str | None = None
    retrieval_date: str | None = None
    extraction_method: str
    extraction_confidence: float = Field(ge=0, le=1)
    transformation_version: str = "0.1.0"
    review_status: str
    notes: str | None = None


class DatasetResult(BaseModel):
    source_id: str
    dataset: str
    requested_year: int
    collected_year: int | None = None
    status: DatasetStatus
    coverage: str
    source: str
    blocking_issues: list[str] = Field(default_factory=list)


class ValidationIssue(BaseModel):
    severity: str
    code: str
    message: str
    source_id: str | None = None
    record: dict[str, Any] | None = None


class PipelinePaths(BaseModel):
    root: Path
    raw: Path
    manifests: Path
    extracted: Path
    processed: Path
    review_queue: Path
    reports: Path
    proposed_patch: Path
