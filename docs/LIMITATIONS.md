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
- **2024 crime may not be like-for-like with 2023.** The hurt head is named "Hurt" in the 2023 NCRB table and "Hurt or Grievous Hurt" in 2024. Press reports of the NCRB 2024 report give a national fall in hurt cases (about 6.36 to 4.41 lakh, 30.58%, rounded and not checked against the NCRB report) and attribute it to the BNS, but the mechanism is not confirmed: simple hurt was already non-cognisable under IPC section 323 and is under BNS section 115(2). Delhi's hurt head fell from 6,045 to 2,028, about 8% of the 48,855 fall in Delhi-wide registered cases; theft is about 97% of it, which the hurt change does not cover. Whether the fall is real cannot be told from this data ([derivation](../data/derived/bns_hurt_2023_2024.json)).
- District boundaries changed in 2016/2017 and 2019. Historical districts are original reporting units and are not re-allocated to the current 15.
- Traffic Police districts (11, then 12) are not the 15 police districts; the 2022 report prints 15 under the police-district names but boundary identity is not verified.
- iRAD (revenue districts, partial 2025 and 2026 coverage) must not be set beside Traffic Police figures.
- 2025 and 2026 have no official district crime or full crash report yet. Partial years are never compared with full years.

## Geography

- **Ward figures from the zone list are ranges.** Zone positions are hand-placed with a stated accuracy of 150 m to 5 km. Moving each of the 93 zones at random within its stated accuracy (2,000 seeded simulations) shows that only 24 of 93 zones keep their ward in at least 95% of the placements; 47 are uncertain and 22 stay in it less than half the time. Of the 10 wards at the top of the fatal-crash ranking, 4 stay in the top 10 in at least 90% of the placements, and 28 of the 66 wards holding a zone have a different total in more than half of them. This tests the stated accuracy only; the real error may be larger ([results](../data/profiles/location_sensitivity_2024.json)).
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

Not extracted (source exists): Delhi-wide theft, robbery and burglary 2016 to 2020. Not printed in the source: the 2016 roads table, the 2021 zone-table road column, the 2013 and 2014 roads summary. Source not found: named zones for 2011 and 2012. Not matched: road names for 50 of the 117 zones in 2022 that later reports do not supply. Also: coordinates for any zone before 2023; the 250-ward layer; constituency overlays (no openly licensed boundaries); change-over-time views for pairs that are not comparable.
