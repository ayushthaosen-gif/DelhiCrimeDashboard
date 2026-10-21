# 2022 road data for DelhiCrimeDashboard

Status: extracted, validated and staged; not installed on the live dashboard.

Use `dashboard_2022.json` as the source-specific import. Separate CSV and JSON tables are provided for researchers and import pipelines.

| Dataset | Rows | Source printed pages | Meaning |
|---|---:|---|---|
| district_crashes | 15 | 86, Table 6.2 | Whole Traffic Police district crash counts |
| district_selected_zones | 15 | 143, Table 6.43 | Counts within selected zones in each reporting district |
| crash_prone_zones | 117 | 138–140, Table 6.41 | Named locations with simple, fatal and total crashes |
| roads_selected_zones | 32 | 148, Table 6.45 | Selected-zone counts grouped by road, not whole-road crashes |

Printed totals are separate objects in the combined JSON, never an extra district or map feature. Full-district counts sum to 5,652 (1,428 fatal, 4,132 injury, 92 non-injury). Selected-zone counts sum to 1,209 (782 simple, 427 fatal) in 117 zones. All four source tables reconcile internally and the three zone tables reconcile with each other.

## Import guidance for the current dashboard

The road page currently renders a 2023 named-zone list and 2023/2024 road summaries in `assets/page-road.js`. These 2022 rows can support an additional year in those tables after an explicit source-aware adapter is added. Preserve names as printed, including spelling differences. Do not insert 2022 rows into fields named `zones2023` or `fatalCrashes2023`.

The 2022 location table supplies no road assignment or coordinates: those fields are null. The road aggregation is a separate table and does not establish a location-to-road join. A searchable 2022 table is possible now; map points require separately evidenced coordinates. The 15 reporting-district names alone do not establish boundary equivalence with the dashboard's police-district polygons.

Comparison labels must remain attached to the data:

- Whole districts, 2021→2022: not comparable without geography review (12→15 reporting units).
- Whole districts, 2022→2023: boundary continuity has not been verified; suppress percentage changes pending review.
- Selected zones: compare annual published counts with caution; changing zone membership prevents interpreting changes as a fixed-location risk trend.
- Keep the separate 2022 Transport Department fatalities compilation under its existing source identity. Fatal crashes count events, not people killed.
- Simple crashes are retained as the printed category, not relabelled as injury crashes. Missing values stay null in JSON and blank in CSV.

The citywide road trend already spans 2011–2024; this package adds district and location detail rather than another citywide observation.

## Evidence and reproduction

The original PDF, its layout text, archive index, source record, and rendered source tables are in the parent `archive_2022` directory. Source-record paths beginning `archive_2022/` are relative to `previous_road_data`, not this bundle. The source URL and SHA-256 are repeated in each table. Publication date is unknown; the archive capture date is 15 January 2024. No open reuse licence was verified.

Run `python ../build_dashboard_bundle.py` from this folder. It verifies the source PDF digest against the saved Internet Archive index, rebuilds the two district extracts, extracts the zone and road lists, and checks serial numbers, row arithmetic and totals. `manifest.json` records output hashes; `validation.json` records checks. Three wrapped zone names (40, 92, 106) are explicitly reconstructed from their source cells; no spelling corrections or geographic inference are applied.

All source table pages were visually inspected by the extracting agent. An independent second review has not been performed. Production data and dashboard code were not changed.
