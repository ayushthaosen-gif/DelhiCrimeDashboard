# Delhi 2025 Data-Collection Pipeline

This package discovers, stages and validates the best publicly accessible 2025 sources without modifying the production dashboard. Collection outputs remain under `tools/pipeline_2025/output/`; integration requires the separate `prepare-dashboard-patch` command and human approval.

## What it can collect

- Official district-administration iRAD/eDAR pages and linked HTML/PDF tables.
- A Delhi Traffic Police Road Crash Report 2025 if an unambiguous official release appears.
- Dated Delhi Excise preferred-vend documents and official corporation vend pages, with temporal warnings.
- Historical OpenStreetMap infrastructure at exactly `2025-12-31T23:59:59Z` through ohsome.
- User-supplied official crime files placed under `output/raw/user_supplied/crime/` for later reviewed ingestion.

## What it does not invent

NCRB Crime in India 2025 is monitored. Until an official release is found, the status is `not_published` and the dashboard's latest independently verified crime year remains 2024. No field named `totalIPC2025` is created because 2025 is BNS-era. Streetlights and underpasses remain `retained_legacy_year` until an authoritative replacement is supplied. RTI/private/CAPTCHA sources and external geocoding are not automated.

## Setup and commands

```powershell
cd tools/pipeline_2025
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\python -m delhi_data_2025 collect --year 2025
```

Stages are `discover`, `download`, `extract`, `normalize`, `validate`, `report`, and `collect`. Narrow a run with `--source irad_new_delhi`; use `--offline` to read only existing raw files/manifests. `validate --strict` fails on unresolved deterministic checks. The source registry is `config/sources.yml`; add only confirmed official GNCTD/NIC pages and explicit domain allowlists.

## Provenance and review

Every processed record must retain agency, source title/URL/file/page/year, retrieval date, extraction method/confidence, transformation version and review status. Raw files are immutable after download and identified by SHA-256. PDFs with insufficient text are placed in `output/review_queue/pdf_extraction_review_2025.csv`; OCR is never automatic.

Unknown police stations go to `unmapped_police_stations_2025.csv`. The pipeline does not fuzzy-assign them. Revenue districts are administrative areas and cannot be aggregated directly into the dashboard's 15 police districts; only reviewed rows in `config/police_station_crosswalk.csv` authorize that transformation.

Liquor preferred-vend circulars are not complete inventories. Undated/current corporation pages use `temporal_status: unclear`; addresses remain ungeocoded until a user explicitly configures a provider. Coordinate confidence and approximate-coordinate flags are never dropped.

## Historical OSM snapshot

The ohsome request uses the exact UTC timestamp above and configurable filters in `config/osm_filters.yml`. Outputs preserve OSM IDs, versions, changesets, edit/snapshot timestamps and the attribution `OpenStreetMap contributors, ODbL`. OSM layers are historical mapped coverage, not complete infrastructure inventories.

## Dashboard integration

```powershell
.venv\Scripts\python -m delhi_data_2025 prepare-dashboard-patch --year 2025
```

This writes only to `output/proposed_dashboard_patch/`: candidate mappings, schema differences, unresolved-record status and a deterministic `SAFE_TO_INTEGRATE` flag. It never edits `data/`, `exports/`, `build.js` or generated HTML. The flag remains false if crime is unavailable for a requested full-2025 dashboard, station mappings are unresolved, totals fail reconciliation, coordinate warnings are missing, extraction confidence is low, or official/model-generated terminology is blurred.

## Testing

`pytest` runs entirely from local fixtures and skips the `live` marker. Run `pytest -m live` manually for small reachability-only checks; it does not download reports. GitHub Actions runs the offline suite on pull requests and weekly discovery-only monitoring with minimal permissions.

## Reproducible outputs and raw files

Committed reports and manifests under `output/` contain no machine-specific data: raw files are recorded as `raw/<source_id>/<file>` (never an absolute path), and missing-file messages do not quote a local path. `output/raw/` itself is not committed, but the exact official files are kept in `data/releases/2025/raw_sources/`; `python -m delhi_data_2025.raw_restore` copies each one back to `output/raw/` when its SHA-256 equals the one in the download manifest (a file whose checksum differs is never substituted). CI runs `raw_restore`, then `collect --offline`, and fails if the regenerated reports or manifests differ from the committed ones. Known gap: the checked-in copy of the Excise landing page is 37,997 bytes and its checksum differs from the manifest's (38,006 bytes), so it is not restored and its review row says the file is not present.

## Weekly source monitor

`.github/workflows/pipeline-2025-monitor.yml` runs discovery every Monday and compares it with the committed baseline, `data/releases/2025/audit/source_manifest_2025.json`, using `delhi_data_2025.source_diff`. It opens (or comments on) one issue, "Source monitor: new or changed official sources", and downloads or integrates nothing. The note leaves out images, media and low-scoring pages, links to reports already collected (`data/derived/irad_monthly/source_links.json`), timeouts, and the "gone" links of a source that could not be reached; a note identical to the last one on the issue is not posted again (its `monitor-digest`). **The baseline is a reviewed reference:** after you have reviewed what the monitor reported and decided nothing needs action, refresh it by replacing that file with the `source_manifest_2025.json` from the run's `source-discovery-2025` artifact, in a pull request that says what was reviewed.
