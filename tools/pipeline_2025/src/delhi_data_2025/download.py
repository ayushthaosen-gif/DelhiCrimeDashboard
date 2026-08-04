from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

from .models import Candidate, DownloadRecord, SourceConfig


def safe_name(url: str, fallback: str) -> str:
    name = Path(urlparse(url).path).name or fallback
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in name)


def download_candidate(
    source: SourceConfig, candidate: Candidate, client, raw_root: Path
) -> DownloadRecord:
    source_dir = raw_root / source.source_id
    name = safe_name(str(candidate.url), f"{source.source_id}.bin")
    incoming = source_dir / ".incoming" / name
    response, digest, _ = client.download(str(candidate.url), source.allowed_domains, incoming)
    original = Path(name)
    destination = source_dir / f"{original.stem}-{digest[:12]}{original.suffix}"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        incoming.unlink(missing_ok=True)
    else:
        os.replace(incoming, destination)
    return DownloadRecord(
        source_id=source.source_id,
        agency=source.agency,
        dataset=source.dataset,
        year=source.year,
        landing_page_url=str(source.page_url or source.endpoint),
        download_url=str(candidate.url),
        resolved_url=str(response.url),
        retrieved_at_utc=datetime.now(UTC),
        http_status=response.status_code,
        content_type=response.headers.get("content-type"),
        content_length=destination.stat().st_size,
        sha256=digest,
        etag=response.headers.get("etag"),
        last_modified=response.headers.get("last-modified"),
        local_path=str(destination),
        snapshot_date=source.snapshot_time.isoformat() if source.snapshot_time else None,
    )
