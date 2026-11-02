# Data coverage

What exists for which years. Gaps are named by cause, because they mean different things:

- **Not printed**: the source document does not print the figure (for example, the 2016 report has no road-wise zone table). Nothing to extract.
- **Not extracted**: the source exists and is known, but the figure has not been entered yet (for example, a published table that exists but has not been entered). Can be filled.
- **Source not found**: we could not locate the document (for example, the 2011 and 2012 zone lists). Not proof it was never published.
- **Not matched**: the figure exists but could not be tied to the item safely (for example, a road for a 2022 zone that no later report assigns).

A blank is never a zero. The machine-readable record is [`data/series_status.json`](../data/series_status.json); the comparison rules are in [`data/continuity.json`](../data/continuity.json). "Blank" means the source printed nothing or nothing was collected; it is never shown as zero.

The tables below are a summary. The full year-by-year matrix (2011 to 2026, every series, with the cause and evidence for every gap) is generated from the data: [`data/coverage_matrix.csv`](../data/coverage_matrix.csv) and [`.json`](../data/coverage_matrix.json), also shown on the Data & methods page. The causes are authored in [`data/coverage_gaps.json`](../data/coverage_gaps.json); the build refuses a gap with no cause or a gap over data that is present.

## Crime

| Series | Years | Unit | Notes |
|---|---|---|---|
| NCRB district crime | 2016 to 2024 | District (as reported that year) | 2016 has theft and robbery only; other aggregates blank. |
| Historical district counts | 2011 to 2018 | Original reporting districts | Counts only; no SLL or crimes against women for 2011 to 2013. |
| Delhi UT printed totals | 2011 to 2024 | Delhi as a whole | Theft, robbery, burglary for 2016 to 2020 read from Table 1A.4 page images (sums checked and independently re-read); 2016 uses different headings than 2017 on. |
| NCRB 2025 | none | | Not published; monitored weekly. |

## Road safety

| Series | Years | Unit | Notes |
|---|---|---|---|
| Citywide road trend | 2011 to 2024 | Delhi | Counts, not rates. |
| District crashes and selected-zone counts | 2016 to 2024 | Traffic Police districts as printed | Counts within crash-prone zones only. |
| Named zones | 2013 to 2024 | 128, 137, 176, 108, 145, 110, 119, 77, 87, 117, 107, 93 zones | 2013 and 2014 are from a PWD compilation, not an annual report, and print no grand total. The 2015 and 2016 lists are alphabetical (position is not a rank). |
| Roads tables | 2017 to 2024 (printed); 2014 and 2015 (calculated) | Roads | 2016 prints none (not printed); 2013 none (not printed in the compilation); the 2014 and 2015 groups are calculated by exact printed label, not a printed table. The 2021 zone table prints no road. |
| Highway and ring-road stretches | 2011, 2012 and 2014 | 13 printed stretches a year | From a retrospective table in the 2015 report; not zone sums; zone lists for 2011 and 2012: source not found. |
| Zone positions on the map | 2023, 2024 | Points | Hand-placed, 150 m to 5 km. |
| Deaths by mode of travel | 2011 to 2024 | Delhi | Persons, not crashes. 2011 to 2018 are the older annual reports' Table 3.1 (the release also holds 2004 to 2010); 2019 to 2024 are the later series. Compare 2018 with 2019 with caution. 2001 to 2003 are printed but do not add up, so are not included. |
| Enforcement | 2019 to 2024 | Delhi | Not split by district. |
| iRAD district reports | 2022 to 2026 (monthly district rows; varies by district and month) | Revenue districts, stations | Staged or provisional. |
| Traffic Police 2025 report | none | | Not published; monitored weekly. |

## Infrastructure and context

| Series | Date | Unit | Notes |
|---|---|---|---|
| OpenStreetMap infrastructure | Snapshot 2026-08 | Points and lines assigned to districts and wards | Lower bounds. |
| Footways, crossings and signals near 2024 zones | 2026-10 | 250 m and 500 m around each zone | Staged. |
| PAPL streetlights and underpasses | Survey period | 9 of 15 districts | Not re-measured. |
| Liquor vends | List date not established | 374 records | Positions mostly approximate. |
| Land use (OpenStreetMap) | 2026-08 | 290 wards | About a quarter of ward area is tagged. |
| Master Plan 2047 against satellite | Plan 2026 draft, land cover 2021 | 290 wards | Staged. |

## Geography

| Layer | Status |
|---|---|
| 15 police districts | In use. |
| Legacy 290 wards | In use (pre-2022 delimitation). |
| Current 250 MCD wards | Not implemented. |
| Constituencies | Not built. |

## Profile bundle

[`data/profiles/`](../data/profiles/README.md) holds ward and district profiles (2024 zones, OpenStreetMap 2026-08) and the recurring-location, audit-area and corridor files. Each column's year, source and uncertainty class are in its `schema.json`.
