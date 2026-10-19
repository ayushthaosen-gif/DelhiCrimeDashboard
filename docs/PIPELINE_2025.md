# The 2025 collection pipeline and the evidence archive

Moved out of the README so the landing page stays short. The text is unchanged except for link paths.

## Automated 2025 staging pipeline

`tools/pipeline_2025/` contains the separate, auditable Python 3.12 collection pipeline for official 2025 sources. It stages raw downloads, checksums, provenance, review queues and validation reports without modifying production dashboard data. See [`tools/pipeline_2025/README.md`](../tools/pipeline_2025/README.md). Dashboard integration is always a separate human-approved proposal.

## Official evidence archive

[`data/raw/source_archive/`](../data/raw/source_archive/) is a separate, machine-readable archive of the original official pages and PDFs used to assess newer data. Its [`manifest.json`](../data/raw/source_archive/manifest.json) records each source URL, retrieval time, publication date (where supplied by the agency), issuer, reference period, SHA-256 checksum, MIME type, filename and scope note. Refresh it with `node scripts/archive_official_sources.mjs`; use `--offline` to verify retained file checksums without downloading.

This archive is evidence, not automatic dashboard input. The 2025 iRAD/eDAR reports are published for only some administrative areas, and their police-station rows must be reconciled to the 15 police districts using a reviewed crosswalk before a citywide comparison is allowed. The source manifest makes that boundary inspectable rather than hiding it behind a map layer.

A self-contained, single-file dashboard analyzing crime and road-safety data
across Delhi's 15 police districts (2022-2024) against real public
infrastructure coverage — PAPL survey-cell and OpenStreetMap street-lamp layers, pedestrian underpasses, mapped pedestrian overbridges, metro station
gates, and police infrastructure.

Open [`delhi_safety_dashboard.html`](../delhi_safety_dashboard.html) directly in
a browser — no server or build step required to view it.

Code is [MIT-licensed](../LICENSE); third-party data keeps its own source
license (see "Data & sourcing" below). See [`CITATION.cff`](../CITATION.cff)
for how to cite this repository.
