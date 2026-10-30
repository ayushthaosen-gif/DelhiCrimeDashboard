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

The 2023 to 2024 step crosses the IPC-to-BNS change; see the hurt note in [LIMITATIONS.md](LIMITATIONS.md).

District crime comes from NCRB *Crime in India* district tables (2022 to 2024 directly; 2016 to 2021 from the NCRB tables as distributed through India Data Portal; 2011 to 2018 historical counts under the original reporting districts). The 2023 and 2024 figures follow the switch from IPC to BNS; the continuity file marks that break. Delhi-wide printed totals are a separate series. Crime is available by district only: ward profiles carry the district's crime density as an inherited value, and say so.

## 4. Road safety

- **Citywide trend** (2011 to 2024): counts from Delhi Traffic Police annual data; not rates.
- **District and crash-prone-zone counts** (2016 to 2024): from the annual Road Crash Reports. These are counts *within the crash-prone zones the report selected that year*, not all crashes in the district. The zone list changes every year, so totals are comparable only with caution.
- **Named zones and roads** (2013 to 2024): the printed zone names and, where printed, the road they are on. 2013 and 2014 come from an official Delhi PWD compilation (no grand total; sums are of the rows); 2015 road groups are calculated by exact printed label and shown as calculated. 2011 and 2012 appear only as 13 retrospective highway and ring-road stretches. 2022 shows 67 road labels supplied by later reports, marked as such.
- **Deaths by mode of travel** (2011 to 2024): persons killed by the victim's category of road user, Delhi as a whole. 2011 to 2018 come from Table 3.1 of the annual reports (`data/releases/road_victims_by_mode_2004_2018/`); every year's categories add up to the printed total and the killed totals equal the citywide trend. 2019 to 2024 come from the later series, whose category labels differ a little, so the page marks 2018 to 2019 as compare-with-caution.
- **Enforcement** (2019 to 2024): hit-and-run fatal crashes, drink-driving prosecutions and over-speeding notices, citywide.
- **Zone positions.** Only 2023 and 2024 zones are mapped. Their coordinates were placed by hand from public sources and carry a stated accuracy of 150 m to 5 km. They are not police geotags ([audit](CRASH_ZONE_COORDINATES.md)).
- **iRAD** district reports are a different series, collected by revenue district, and are never combined with Traffic Police figures.

## 5. Infrastructure

Metro gates are the exception to "mapped lower bound": they come from the official DMRC gate list on the Delhi Transport Stack (last updated by the publisher 2024-12-02), counted by `scripts/build_metro_gates_official.js` (a gate is one distinct station code, gate name and position; exact duplicate rows are not counted twice; gates are assigned to wards by point-in-polygon, and distances to the 2024 crash-prone zones are measured from each zone's placed point). The licence allows derivatives but not redistributing the gate file on its own, so only the derived counts and distances are committed and the raw file is read locally. The build needs the raw file, so it is not run in CI; a test checks the committed result.

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

## 8. Trends and patterns

**Correlation matrix (dashboard).** Each cell is a Pearson r or Spearman rho (Pearson on average ranks, so ties are handled) between a district-level metric and an infrastructure density, over the districts that have both. Spearman p-values are permutation p-values: the district ranks are reshuffled 100,000 times with a fixed seed and the p-value is the share of shuffles with |rho| at least as large (the observed ordering counted once), accurate to about 0.001; the Student t value is not exact for Spearman and is not used for it. Pearson p-values are the two-tailed Student t value with n minus 2 degrees of freedom (`scripts/lib/stats.js`, tested against published critical values), which assumes roughly normal data. Rates are calculated from full-precision counts, denominators unrounded; rounding is for display only. All cells of the matrix are adjusted together with the Benjamini-Hochberg false-discovery procedure and a star means q below 0.05; a dagger means p below 0.05 before adjustment only. Cells share districts and metrics, so they are not independent tests. A first-order partial correlation controlling for residents per km² is shown in the tooltip, indicative only. With 15 districts, |r| under about 0.51 cannot be told apart from chance. Associations, not causes.

`scripts/lib/patterns.js` computes every figure on the Trends and patterns page and the planner brief from committed files. Crime over time uses the Delhi-wide printed totals; each step between years takes its state (comparable, caution, not comparable, no figure) from `data/continuity.json`, and the chart leaves a gap where a step is not comparable or a figure is missing. District crime is registered IPC/BNS cases per 1 lakh residents (approximate resident population, which excludes visitors). Mapped densities are compared with it by Spearman rank correlation over the 15 districts; with 15 districts a value between about -0.5 and +0.5 cannot be told apart from chance, and the page says so. Places and roads come from the recurrence rules in section 7. The page describes patterns; it makes no causal claim, and its "what tends to help" list is labelled general practice, not a finding from this data.

## 9. Location uncertainty

`scripts/build_location_sensitivity.js` tests how far the hand-placed 2024 zone positions change a zone's ward and the ward ranking. Each zone is moved to a point drawn uniformly from the disc of its stated accuracy (150 m to 5 km) around its placed point, re-assigned to a legacy ward by point-in-polygon, and the fatal crashes counted in zones, ward totals and competition ranks are recomputed, 2,000 times with a fixed seed so the result reproduces exactly. Outputs: [`data/profiles/location_sensitivity_2024.json`](../data/profiles/location_sensitivity_2024.json) and two CSVs. It tests sensitivity to the *stated* accuracy only: that accuracy is an estimate, the real error may be larger and need not be uniform, and the ward boundaries have their own error. The Planning page shows the ranges (a Location uncertainty tab, a tilde on unstable ranks, a section in each ward's panel and evidence pack).

## 10. Coverage matrix, comparison notes and bundles

`scripts/lib/coverage.js` builds [`data/coverage_matrix.json`](../data/coverage_matrix.json) and `.csv`: every series by year 2011 to 2026, available or not, computed from the files in the repository. Every other cell takes its cause from `data/coverage_gaps.json` (not printed, not extracted, source not found, not collected, not published, staged); the build fails on a gap with no cause or one that hides data that is present. The same file lists the documented breaks between years (from `data/continuity.json`).

Three versioned bundles (crime, road, profiles) are defined in `data/bundles/bundles.json`; `data/bundles/manifest.json` records each file's path, size and SHA-256 and a version that changes when any file changes. The Data & methods page zips a bundle in the browser with a generated README (geography, definitions, coverage and gaps, provenance), `COVERAGE.csv`, `COMPARABILITY.md` and a `BUNDLE_MANIFEST.json` with each file's expected and fetched checksum.

## 11. Monitoring newer data

A weekly job (`.github/workflows/pipeline-2025-monitor.yml`) looks for new NCRB, Delhi Traffic Police, iRAD and Excise releases and opens or updates one issue. It downloads and integrates nothing; a person reviews, collects, validates and opens a pull request ([pipeline README](../tools/pipeline_2025/README.md)).
