# Delhi Road Crash Report 2022: district and zone tables

Extracted by Codex from the Internet Archive capture (15 January 2024) of the Delhi Traffic Police Road Crash Report 2022; the PDF's SHA-256 and the archive URL are in [manifest.json](manifest.json). The report has the same structure as the 2023 and 2024 reports.

| File | Rows | Source table | Used on the site |
|---|---:|---|---|
| `district_selected_zones.*` | 15 | 6.43 | Explore: crashes, fatal crashes and crash-prone zones by district, 2022 |
| `crash_prone_zones.*` | 117 | 6.41 | Road safety: zone table, 2022 (no road, no coordinates in the source) |
| `roads_selected_zones.*` | 32 | 6.45 | Road safety: roads with most zones, 2022 (top 12 shown) |
| `district_crashes.*` | 15 | 6.2 | Not shown: whole-district crashes for one year only, with no 2023 or 2024 counterpart |
| `dashboard_2022.json` | all | all | Combined import with printed totals and rules |

Counts are **within the identified crash-prone zones**, not all crashes in a district, exactly as for 2023 and 2024. Zone membership changes every year, so 2022 beside 2023 carries a caution (see `roadDistrict` in `data/continuity.json`). People killed by district is not in the 2022 tables and stays blank, never zero. `fatalRoadCrashes2022` in the older dashboard is a different compilation and is not merged with these tables.

Review: every source page was visually inspected by the extracting agent; no independent second review. Arithmetic checked here: district totals sum to the citywide 5,652 crashes and 1,428 fatal crashes; zones sum to 1,209 crashes and 427 fatal and agree with Table 6.43. `BUNDLE_NOTES.md` is the extractor's own README; paths in it that begin `archive_2022/` point at the source PDF and renders, which are not in the repository. No open reuse licence was verified.
