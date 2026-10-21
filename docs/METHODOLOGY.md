# Methodology

How the numbers on the site are produced and what rules they follow. Rules live in code and data files, not in prose: where this page names a file, the file is the authority.

## 1. From a source to a figure

1. **Collect.** An official file (an NCRB table, a Delhi Traffic Police report, a district iRAD page) is saved with its original URL, retrieval date and SHA-256 checksum. Raw files are never edited.
2. **Transcribe or extract.** Spreadsheets are read directly. Reports that are PDFs are read from their text layer; where a table is an image (the 2016 to 2020 crash-zone tables) it was transcribed from the rendered page. OCR is never automatic.
3. **Validate.** Rows are checked against the totals the report prints and against simple arithmetic (simple plus fatal equals total; district rows add to the citywide total; the road column of a zone table reproduces the report's road table). Discrepancies in the source are recorded, not corrected.
4. **Release.** Each year or series gets a folder under `data/releases/` or `data/staged/` with the data, a `manifest.json` (source URL, page, file hash, extraction method, review status) and a README stating what a blank means.
5. **Register.** `data/series_status.json` gives every series one status (production, staged, provisional, not published, not implemented, retained legacy year). The README table must list every series with its status; a test enforces it.
6. **Generate the site.** `scripts/build_site.js` and the other build scripts read these files and write the pages. CI rebuilds everything and fails if a committed output differs, so the site cannot drift from the data.

## 2. Rules that apply everywhere

- **A blank is never a zero.** If a source prints no figure, or a district was not surveyed, the value stays empty and the page says why.
- **Counts are what the source counted.** Nothing is estimated, interpolated or modelled. No rate is calculated unless a denominator is itself published for the same unit and year.
- **Each year keeps its own definitions.** A year-to-year change is shown only where `data/continuity.json` says the two years can be compared (see [CONTINUITY.md](CONTINUITY.md)). Otherwise both values are shown with no change figure.
- **Official and derived stay apart.** Counts printed by an agency are labelled official; anything a script computed from them or from OpenStreetMap is labelled derived or mapped.
- **Provenance travels with the figure.** Every figure can be traced to a report, a page and a file hash through the release manifest.

## 3. Crime

District crime comes from NCRB *Crime in India* district tables (2022 to 2024 directly; 2016 to 2021 from the NCRB tables as distributed through India Data Portal; 2011 to 2018 historical counts under the original reporting districts). The 2023 and 2024 figures follow the switch from IPC to BNS; the continuity file marks that break. Delhi-wide printed totals are a separate series. Crime is available by district only: ward profiles carry the district's crime density as an inherited value, and say so.

## 4. Road safety

- **Citywide trend** (2011 to 2024): counts from Delhi Traffic Police annual data; not rates.
- **District and crash-prone-zone counts** (2016 to 2024): from the annual Road Crash Reports. These are counts *within the crash-prone zones the report selected that year*, not all crashes in the district. The zone list changes every year, so totals are comparable only with caution.
- **Named zones and roads** (2013 to 2024): the printed zone names and, where printed, the road they are on. 2013 and 2014 come from an official Delhi PWD compilation (no grand total; sums are of the rows); 2015 road groups are calculated by exact printed label and shown as calculated. 2011 and 2012 appear only as 13 retrospective highway and ring-road stretches. 2022 shows 67 road labels supplied by later reports, marked as such.
- **Enforcement** (2019 to 2024): hit-and-run fatal crashes, drink-driving prosecutions and over-speeding notices, citywide.
- **Zone positions.** Only 2023 and 2024 zones are mapped. Their coordinates were placed by hand from public sources and carry a stated accuracy of 150 m to 5 km. They are not police geotags ([audit](CRASH_ZONE_COORDINATES.md)).
- **iRAD** district reports are a different series, collected by revenue district, and are never combined with Traffic Police figures.

## 5. Infrastructure

OpenStreetMap snapshots (August 2026) provide bus stops, signals, crossings, footways, overbridges, hospitals, street lamps, surveillance points and police facilities, assigned to districts and wards by location. They are lower bounds: a low count may mean little has been mapped. Metro entrances and the PAPL streetlight and underpass survey are published by district only (the survey covers 9 of 15). Land use is the share of ward area tagged in OpenStreetMap, with a coverage figure beside it.

## 6. Geography

Districts are the 15 Delhi Police districts. Wards are the **legacy 290-ward geography** (DataMeet, before the 2022 delimitation), not the current 250 MCD wards. The 250-ward layer is not built because no openly licensed boundary file has been verified.

## 7. Profiles and the planning views

`scripts/lib/profile_schema.js` is the contract: every ward and district column has a unit, source, data year, an uncertainty class and the meaning of a blank. `scripts/build_profiles.js` refuses an undescribed column. The "Why this place?" panel and the evidence pack are built from the same contract.

The intervention views (`scripts/build_interventions.js`) are rules, not scores:

- **Recurrence**: how many of the nine annual zone lists (2016 to 2024) name a place. 7 or more is persistent, 5 or 6 frequent, 3 or 4 repeated. Names are matched after ignoring case and punctuation, plus 12 reviewed spelling pairs; look-alike names that were not confirmed are left separate. A repeated name is not a proven identical footprint.
- **Audit evidence tier** (2024 zones): tier 1 is pedestrian-prone in 2024 and named in 5 or more reports; tier 2 is 5 or more reports, or pedestrian-prone and 3 or more; tier 3 is pedestrian-prone or 3 or more; tier 4 is the rest. A tier says how much crash evidence there is, not how dangerous a place is or what to build.
- **Pedestrian corridors**: roads printed against two or more pedestrian-prone 2024 zones. A printed road name, not a measured stretch.
- **Sparsely mapped surroundings** is shown for context only and not used to rank, because 80 of 93 zones have no mapped crossing within 250 m.

## 8. Monitoring newer data

A weekly job (`.github/workflows/pipeline-2025-monitor.yml`) looks for new NCRB, Delhi Traffic Police, iRAD and Excise releases and opens or updates one issue. It downloads and integrates nothing; a person reviews, collects, validates and opens a pull request ([pipeline README](../tools/pipeline_2025/README.md)).
