# Delhi data collected for 2025

This folder is a staged research release. It does not replace the dashboard's production datasets automatically.

## Crosswalked crash data (partial)

- `validated/road_crashes_by_police_station_2025.csv`: 50 station rows from official annual iRAD/eDAR PDFs published by the West, South-East and North-West district administrations. 46 rows have an exact, reviewed mapping to a Delhi Police district; four remain unresolved and have a null `police_district`.
- `validated/road_crashes_by_police_district_2025.csv`: a partial aggregation for six police districts reached through those mapped rows. It is not a Delhi-wide total and must not be ranked against all 15 dashboard districts.
- `validated/CROSSWALK_COVERAGE_2025.md`: scope, unresolved labels, Manual evidence and temporal caveats.
- `needs_review/unmapped_police_stations_2025.csv`: the four unresolved labels, retained for follow-up rather than guessed.

The crosswalk comes from *Delhi Police RTI Manual 1*, updated 22 May 2026, master station list, pages 13-22. It is a post-period structural reference for 2025 source rows. Each mapped row keeps the reporting administrative area, Manual evidence page, mapping source and temporal basis.

## Data requiring review

- `needs_review/liquor_vends_snapshot_date_unclear.csv`: 201 named DSCSC vends. The official page does not establish that the list represents calendar year 2025, so it must not be labelled a verified 2025 inventory.
- `needs_review/pdf_extraction_review_2025.csv`: New Delhi's official Jan-Dec 2025 iRAD PDF is image-only. It was preserved, but no OCR-derived figures were published automatically.

## Unavailable data

- No unambiguous official NCRB *Crime in India 2025* release was found. Verified crime data remains at 2024.
- No qualifying Delhi Traffic Police annual Road Crash Report 2025 was found.
- The ohsome historical OSM endpoint returned HTTP 403. No OSM records were represented as collected or as zero.
- No authoritative 2025 replacements were found for the existing streetlight and underpass surveys.

## Audit material

The `audit/` directory contains source discovery, download URLs, SHA-256 checksums, retrieval metadata, the crosswalk and validation reports. `raw_sources/` contains the exact downloaded official files referenced by those audit records.

## Integration guidance

Do not integrate these 2025 crash files into the dashboard. They cover only three publishing administrative areas, map only 46 of 50 station rows, use a post-period Manual reference, and do not contain 2025 NCRB crime data. Keep nulls as null; do not infer districts, assign ambiguous station labels, or create `totalIPC2025`.