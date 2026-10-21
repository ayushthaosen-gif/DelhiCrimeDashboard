# 2016–2020 road data: digitized, reconciled, staged

Completed 20 October 2026. This is an aggregate historical research release. Production data, dashboard code and the current map were not changed.

## Available data

| Reference year | Whole-district rows | All crashes | Fatal crashes | Selected zones | Crashes within those zones | Fatal crashes within those zones | Zone district rows |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2016 | 11 | 7,375 | 1,548 | 108 | 1,296 | 389 | Not supplied by the transcribed citywide summary |
| 2017 | 11 | 6,673 | 1,565 | 145 | 1,505 | 503 | 11 |
| 2018 | 12 | 6,515 | 1,657 | 110 | 1,246 | 429 | 12 |
| 2019 | 12 | 5,610 | 1,433 | 119 | 1,192 | 437 | 11 |
| 2020 | 12 | 4,178 | 1,163 | 77 | 824 | 287 | 12 |

These are counts, not rates. Fatal crashes count events, not people killed. Selected-zone counts cover only each year's identified zones, not all roads in a district.

The staged annual files include fatal, injury, non-injury and total accidents. The selected-zone files include number of zones, simple, fatal and total accidents. People killed and injured remain null in the district dataset because the transcribed district table does not report them. Original unit labels, source URLs, report years, reference years, table numbers, PDF and printed page numbers, SHA-256 hashes and comparison notes accompany the rows.

## Files

- [Original annual district rows: CSV](generated/traffic_districts_2016_2020_as_reported.csv), [JSON](generated/traffic_districts_2016_2020_as_reported.json): 58 rows. No Dwarka row is added to 2016/2017.
- [Separate printed whole-city totals: CSV](generated/traffic_district_totals_2016_2020.csv).
- [District aggregates within selected zones: CSV](generated/zone_districts_2017_2020_as_reported.csv), [JSON](generated/zone_districts_2017_2020_as_reported.json): 46 rows, 2017–2020.
- [Citywide selected-zone totals: CSV](generated/zone_citywide_totals_2016_2020.csv): all five years.
- [Explicit missing district-zone values: CSV](generated/zone_district_gaps_2016_2020.csv): nulls for the 2016 district breakdown and the omitted New Delhi selected-zone row in 2019. Never interpret omission as zero.
- [2020 retrospective table: CSV](generated/traffic_districts_2020_retrospective_2016_2020.csv): all 60 printed district/reference-year rows, retained separately from original annual vintages.
- [Overlapping report reconciliation: CSV](generated/report_vintage_reconciliation_2016_2020.csv): 328 cell checks, all agree. Original 2016–2019 annual values agree with the 2020 retrospective table; 2019/2020 originals also agree with the already staged 2021 retrospective table. This checks the selected overlaps, not every table in every report.
- [Existing citywide trend reconciliation: CSV](generated/citywide_baseline_reconciliation_2016_2020.csv): all ten total/fatal-crash values agree with the existing release. The snapshot is retained in `inputs/`.
- [Validation results](validation_2016_2020.json), [visual transcriptions](transcriptions_2016_2020.json), [source and file manifest](manifest.json).

Individual named spot lists, circle-by-circle analyses and geographic coordinates are preserved in the original PDFs but are not digitized in this aggregate release. No district is assigned from a place name or later map.

## Continuity and geography

| Years / transition | Judgement | Reason |
|---|---|---|
| 2016–2017 | Compare with caution within a separate Traffic Police series | Both original tables print 11 districts. Matching labels and later repeated values do not prove unchanged station/circle boundaries. |
| 2017 to 2018 | Do not calculate district changes across this break | Dwarka appears as a separate Traffic Police reporting row in 2018. Historical units must not be reconstructed from today's 15 police districts, and affected traffic-boundary membership has not been established. |
| 2018–2020 | Compare with caution within the 12-unit Traffic Police series | Same printed district set, but exact annual boundaries are not verified. The 2020 pandemic period also changes interpretation of raw counts. |
| Selected-zone series, every year | Compare annual selections with caution; not a fixed-location trend | The selected zones change. The 2016 report, for example, says 96 of the 176 zones selected in 2015 did not meet the criteria for its 2016 list and were removed (chapter 10, PDF page 8 / printed page 110). A falling selected-zone count is not evidence of an equal fall in risk. |
| 2016–2020 citywide fatal/total crashes | Supports the existing citywide count series | All ten values agree with the existing release. It adds primary annual-report evidence, not new years. Retain the release's definition and counts-not-rates caveats. |
| Historical district series to current 2023–2024 district maps | Separate series required | 11/12 Traffic Police units are not today's 15 police districts. Same labels are not a boundary crosswalk. |

The 2020 retrospective table prints zeros for Dwarka before 2018. Those literal source zeros are retained with an explicit warning in the retrospective evidence. They do not create separate Dwarka observations in the original 2016/2017 annual tables.

Terminology is also preserved. Table 6.1 separates injury and non-injury accidents; selected-zone summaries use the broader label "simple accidents". In the inspected 2016 whole-city summary, simple accidents (5,827) equal injury (5,698) plus non-injury (129), so "simple" must not be relabelled as injury crashes or people injured. No generic conversion is applied to other source tables.

## Source issues and gaps

- The 2018 zone table's Western range margin says `(05)`, while its two district rows and the adjacent range summary give 23 zones. The district values are retained; the inconsistent margin is documented, not silently repaired.
- The 2019 selected-zone district table omits New Delhi, although it has a whole-district row. Its selected-zone values remain null.
- The 2020 narrative's 245 fatal accidents refer to the subset of 64 zones in 20 circles. The full 77-zone table gives 287 fatal accidents. These are different scopes, not a contradiction.
- No 2016 district-zone allocation is invented from the citywide 108-zone summary. The original named-spot list and circle analysis remain available in the source chapters.
- Exact original publication dates remain null unless independently verified. Retrieval timestamps and server modification headers remain separate. No open reuse licence was verified; public access does not establish an open licence.

## Verification and reproduction

Ten main source pages were visually transcribed: original annual district pages for 2016–2020, selected-zone district pages for 2017–2020, and the 2016 citywide zone summary. Adjacent range, circle and explanatory pages were inspected for cross-checks. The page renders are in `review_2016_2020/`.

All annual rows sum across crash types; all annual district columns sum to their separate printed totals. All selected-zone district columns reconcile to the report's separate summary. The 60 retrospective rows also reconcile. Every consumed source PDF is checked against its acquisition hash. All missing person values and missing district-zone values remain null.

Review status is **author checked, not independently reviewed**. Arithmetic agreement is not proof of unchanged geography or eligibility for production integration.

Run `python build.py` offline to rebuild both the earlier staging and this addition, or `python build_2016_2020.py` after the earlier generated files exist. Standard library only. `pdftotext` is required only for acquisition, and `pdftoppm` plus Pillow are needed to reproduce review images. Keep source PDFs, acquisition manifest, transcriptions and the baseline snapshot together.
