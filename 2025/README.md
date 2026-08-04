# Delhi data collected for 2025

This folder is a staged research release assembled from official source pages on 4 August 2026. It does not replace the dashboard's production datasets automatically.

## Validated data

- `validated/road_crashes_by_police_station_2025.csv`: 50 station records from official annual iRAD PDFs for West, South East, and North West police districts. Table cells were extracted geometrically so blank cells did not shift into adjacent columns.
- `validated/road_crashes_by_police_district_2025.csv`: aggregates for those three covered police districts only. This is partial coverage, not a Delhi-wide total.

The crash files passed structural validation. Police-district assignment comes directly from each official district report, not fuzzy matching. Blank source cells remain blank. In particular, a blank count is not converted to zero.

## Data requiring review

- `needs_review/liquor_vends_snapshot_date_unclear.csv`: 201 named DSCSC vends. The official page does not establish that the list represents calendar year 2025, so it must not be labelled a verified 2025 inventory.
- `needs_review/pdf_extraction_review_2025.csv`: New Delhi's official Jan-Dec 2025 iRAD PDF is image-only. It was preserved, but no OCR-derived figures were published automatically.

## Unavailable data

- No unambiguous official NCRB *Crime in India 2025* release was found. Verified crime data remains at 2024.
- No qualifying Delhi Traffic Police annual Road Crash Report 2025 was found.
- The ohsome historical OSM endpoint returned HTTP 403. No OSM records were represented as collected or as zero.
- No authoritative 2025 replacements were found for the existing streetlight and underpass surveys.

## Audit material

The `audit/` directory contains source discovery, download URLs, SHA-256 checksums, retrieval metadata, provenance, coverage and validation reports. `raw_sources/` contains the exact downloaded official files referenced by those audit records.

## Integration guidance

Use the two crash CSVs only with a visible `partial coverage: 3 of 15 police districts` label. Keep the liquor-vend file in a current/undated snapshot layer unless its effective date is independently confirmed. Do not create `totalIPC2025`, infer missing districts, or substitute blank cells with zero.
