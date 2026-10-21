# Data coverage

What exists for which years. The machine-readable record is [`data/series_status.json`](../data/series_status.json); the comparison rules are in [`data/continuity.json`](../data/continuity.json). "Blank" means the source printed nothing or nothing was collected; it is never shown as zero.

## Crime

| Series | Years | Unit | Notes |
|---|---|---|---|
| NCRB district crime | 2016 to 2024 | District (as reported that year) | 2016 has theft and robbery only; other aggregates blank. |
| Historical district counts | 2011 to 2018 | Original reporting districts | Counts only; no SLL or crimes against women for 2011 to 2013. |
| Delhi UT printed totals | 2011 to 2024 | Delhi as a whole | Theft, robbery, burglary for 2016 to 2020 not yet extracted. |
| NCRB 2025 | none | | Not published; monitored weekly. |

## Road safety

| Series | Years | Unit | Notes |
|---|---|---|---|
| Citywide road trend | 2011 to 2024 | Delhi | Counts, not rates. |
| District crashes and selected-zone counts | 2016 to 2024 | Traffic Police districts as printed | Counts within crash-prone zones only. |
| Named zones | 2013 to 2024 | 128, 137, 176, 108, 145, 110, 119, 77, 87, 117, 107, 93 zones | 2013 and 2014 are from a PWD compilation, not an annual report, and print no grand total. The 2015 and 2016 lists are alphabetical (position is not a rank). |
| Roads tables | 2017 to 2024 (printed); 2014 and 2015 (calculated) | Roads | 2016 prints none; 2013 none; the 2014 and 2015 groups are calculated by exact printed label, not a printed table. The 2021 zone table prints no road. |
| Highway and ring-road stretches | 2011, 2012 and 2014 | 13 printed stretches a year | From a retrospective table in the 2015 report; not zone sums; no zone lists recovered for these years. |
| Zone positions on the map | 2023, 2024 | Points | Hand-placed, 150 m to 5 km. |
| Enforcement | 2019 to 2024 | Delhi | Not split by district. |
| iRAD district reports | 2025 and 2026 (varies by district) | Revenue districts, stations | Staged or provisional. |
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
