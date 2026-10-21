# Limitations

Read this before citing a figure or acting on a view.

## What the data cannot establish

- **Where exactly a crash happened.** Reports name zones, not coordinates. Mapped positions are hand-placed and 150 m to 5 km off.
- **Why a place has crashes, who is responsible, or what should be built.** Nothing here measures traffic volume, speed, signal timing, enforcement, visibility or informal crossings. A field visit and the agency's own data come first.
- **How safe a place is.** There are no exposure figures (traffic, pedestrians, population by ward), so counts cannot be turned into risk.
- **Whether a missing item does not exist.** OpenStreetMap is incomplete; a zero or low count can mean unmapped. A survey zero can mean not surveyed.

## Comparisons

- Each crash report selects its own crash-prone zones; counts within zones are not citywide crashes and the zone list differs every year.
- The 2013/2014 NCRB format change, the 2016 compilation, the 2021/2022 source change and the 2023/2024 IPC-to-BNS switch break crime series. See [CONTINUITY.md](CONTINUITY.md).
- District boundaries changed in 2016/2017 and 2019. Historical districts are original reporting units and are not re-allocated to the current 15.
- Traffic Police districts (11, then 12) are not the 15 police districts; the 2022 report prints 15 under the police-district names but boundary identity is not verified.
- iRAD (revenue districts, partial 2025 and 2026 coverage) must not be set beside Traffic Police figures.
- 2025 and 2026 have no official district crime or full crash report yet. Partial years are never compared with full years.

## Geography

- Wards are the legacy 290, not the current 250 (no verified open boundary file).
- Crime is district-level only; the ward value is the district's, copied.
- Metro entrances and the streetlight survey are district-only; the survey covers 9 of 15 districts.

## Provenance and review

- This repository is a compilation, not a primary source: cite the agency report.
- 2016 to 2020 crash-zone tables are image tables transcribed by reading the rendered page, checked against printed totals but not independently reviewed. One source discrepancy is recorded (2019 narrative 376 vs table 398).
- Liquor vend positions are mostly approximate and the list date is not established.
- Historical "years" for maps are not historical street maps.
- Reuse terms differ by source; a public URL is not an open licence ([DATA_SOURCES.md](DATA_SOURCES.md)).

## Known gaps

Named zones for 2011 and 2012 (only 13 highway and ring-road stretches were recovered); 2013 and 2014 come from an official compilation, not the annual reports, and print no grand total.

Delhi-wide theft, robbery and burglary 2016 to 2020; the 2016 roads table (none printed); road names for 50 of the 117 zones in 2022 that later reports do not supply; coordinates for any zone before 2023; the 250-ward layer; constituency overlays (no openly licensed boundaries); change-over-time views for pairs that are not comparable.
