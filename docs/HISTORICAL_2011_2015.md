# Delhi 2011–2015: citywide road extension and staged NCRB panel

The user approved extending the **citywide road trend** to 2011. The NCRB historical crime panel remains **staged and off the dashboard**. Crime selectors, district metrics and maps continue to use the existing 2016–2024 production series.

The request for historical district shapes now has a separate [2014 reference map preview](../data/staged/police_geography_history/preview.html) and [geography research record](../data/staged/police_geography_history/README.md). It groups archived station polygons into 11 historical territorial districts, with airport jurisdiction separate, and joins original 2014 NCRB counts. The station memberships, dated source limitations and geometry overlaps are recorded; no other year or production map uses these shapes. Dwarka's 2017 notification names South-West and Outer as its parent districts, so merging today's entire Dwarka polygon into South-East would be incorrect.

## Citywide road trend

The [production release](../data/releases/citywide_road_trend/README.md) contains 2011–2024 total accidents, fatal accidents and persons killed. The new rows are:

| Reference year | Total accidents | Fatal accidents | Persons killed |
|---|---:|---:|---:|
| 2011 | 7,280 | 2,047 | 2,110 |
| 2012 | 6,937 | 1,822 | 1,866 |
| 2013 | 7,566 | 1,778 | 1,820 |

These three measures agree across the archived 2014/2015 official statistics pages and the later [Traffic Police statistics](https://traffic.delhipolice.gov.in/statistics). The existing 2014–2024 rows and 2019–2024 victim-by-mode rows are unchanged. Injuries and injury/non-injury categories are excluded from the extension because source editions differ. The complete original 2011–2014 annual reports were not located, and a standardized early 30-day fatality follow-up definition was not established.

The chart shows **counts, not rates**. Lines index each count series to 2011=100, which is relative change, not population- or travel-adjusted risk. Actual counts appear in an accessible table and CSV. Fatal accidents and deaths are different measures. Citywide counts are never allocated among districts. Source URLs, archived editions, checksums and reuse caveats are in the release manifest.

## Staged NCRB release

Start with the [historical release README](../data/releases/historical_2011_2015/README.md) and [manifest](../data/releases/historical_2011_2015/manifest.json). Delhi UT totals are the **official printed summaries**, not reconstructed sums of selected territorial districts and not NCRB's separate mega-city geography.

| Reference year | Original reporting-unit rows per table | Sources and limits |
|---|---:|---|
| 2011 | 17 | IPC Table 1.14; SLL and comparable women aggregate absent from this selected table stay null |
| 2012 | 17 | IPC Table 1.14; preserve original 354/509 wording; same aggregate gaps |
| 2013 | 18 | Metro Rail appears separately; legal-definition and rate-denominator changes prevent unqualified comparisons |
| 2014 | 19 | Revised IPC, SLL and women workbooks; new proformae/heads and expanded women basket |
| 2015 | 19 | Revised workbooks; retain source edition, corrigendum and distinct women measures |

`citywide_crime.csv`/JSON provide five selected-measure summary rows and explicit null reasons. `citywide_totals_as_printed.json` preserves all summary cells. The offence-level CSVs retain original labels, source column numbers, row/page evidence and source SHA-256. Nine `as_printed/` JSONs preserve the extracted Delhi tables, including auxiliary workbook cells and printed summaries. CSV empty cells are null; numeric zero stays zero.

Do not add overlapping offence subheads or add women totals to IPC/SLL. Old Burglary and revised Criminal Trespass/Burglary are separate measures. No present-day district IDs, boundaries, allocations or implied continuity are supplied. Publication dates that could not be established remain null; foreword dates, portal paths, PDF metadata and archive capture dates remain separate evidence. The [full investigation](../data/staged/history_2011_2015/AVAILABILITY_AND_COMPARABILITY.md) retains source mismatches and traffic-table issues.

## Reproduce

```text
python tools/history_2011_2015/build.py
python tools/history_2011_2015/build.py --check
npm run build:releases
npm run build
```

The normal release build consumes verified staged extracts offline. The historical panel is indexed separately from the nine production crime years. Direct-source public redistribution terms remain unresolved; local staging does not grant a new licence or authorize publication of the archived originals.
