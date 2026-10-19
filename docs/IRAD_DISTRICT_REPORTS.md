# District iRAD reports: what is published and what is staged

Delhi's district administrations post the Integrated Road Accident Database (iRAD/eDAR) reports on their own sites. `scripts/collect_irad_monthly.py` finds them, stages
them with checksums and reads two table types cell by cell (needs `pip install pdfplumber`). Output is in `data/derived/irad_monthly/`; **nothing is wired into the
dashboard** (the 2025 pipeline's rule stands: integration is a separate, human-approved proposal).

| File | Content |
|---|---|
| `irad_monthly_by_district.csv` | "Accidents Classified According to Month-wise": one row per district and month, with the report's own columns |
| `irad_station_by_period.csv` | "Accidents Classified by Stations": one row per police station and reporting period |
| `manifest.json` | each PDF: public URL, page, link text, SHA-256, report district, period, generation date, date basis |
| `source_links.json` | public links recovered on 2026-10-18 by matching each file's SHA-256 to the currently published official PDF |
| `unstaged_published_reports.csv` | published accident reports that are not loaded, with the reason (empty now: all 113 found by the second discovery are loaded) |
| `issues.json` | arithmetic failures (none), disagreeing duplicates (one: East January 2023, with the columns and both values recorded), files listed under the wrong district, station or month sums that differ from the printed TOTAL (none), reports naming an unknown district (none) |

## Coverage staged (after loading the second discovery, 18 Oct 2026)

"Month-wise" is the district table by month; "stations" is the police-station table. Some reports print only a year, so their dates are not stated (marked `period_inferred`).

| District | Month-wise table | Police-station tables |
|---|---|---|
| Central | Jan to 10 Dec 2025 (12 months: 226 accidents, 49 fatal, 51 killed) | cumulative 2022 to 8 Apr 2025 |
| East | 2022 (year inferred from a 26 Dec 2022 generation date, so December is a partial snapshot), Jan to Feb 2023 and Mar 2023 (older 11-column layouts; March from a scan) | cumulative 2022 to 2024, plus monthly Apr 2023 to Dec 2025 (34 periods, older layouts for 2023) |
| New Delhi | Jan 2022 to Dec 2025 (from scans, transcribed) and Jan to May 2026 | cumulative 2022 to 2024, Year 2025 (no dates, FIR-registered accidents only), Jan to May 2026 |
| North East | 48 month labels, Jan 2022 to Dec 2025 (2023 and 2024 are the in-range months of reporting-date reports, see below) | cumulative 2022 to Mar 2025 and monthly Jan to Aug 2026 |
| North West | none | one file with Year 2025 but no dates |
| Rohini | none | one file (`North_West__2025041579.pdf`, listed on the North West page; its header says ROHINI), Year 2025, no dates |
| North | no accident series found (its page links a PDF that is not an accident table) | none found |
| South | Jan to Dec 2025 (12 monthly reports) | Year 2022, 2023 and 2024, no dates |
| South East | Jan 2022 to Dec 2024 (36 months) | 21 periods, monthly 2025 and 2026 to July, and yearly |
| South West | Jan 2022 to Apr 2025 (40 month labels; year-only reports generated 17 Apr 2025, so the exact cutoff is unknown; FIR-registered accidents only) | one undated report, and 1 May to 31 Dec 2025 |
| Dwarka | Jan 2022 to Apr 2025 (40 month labels, same year-only caveat; its headings do not say FIR-only), listed on the South West page | one undated report, and 1 May to 31 Dec 2025 |
| West | Jan 2022 to Apr 2025 (40 months) | 8 monthly periods (May to Dec 2025) and one yearly 2025 period |
| Shahdara | none | none. The old site address does not resolve; the iRAD page on its successor site (Central North) was reached in the second check and has headings but no downloads |

## Loaded from the second discovery
A second independent check (Codex, online) found 113 accident reports on the district pages that the first collection missed: East 37, North East 46, South 15, South West and Dwarka 12, New Delhi 3. All were downloaded, matched to the published SHA-256 and loaded. 112 are text PDFs; East's March 2023 table (`East__2023040532.pdf`) is an image-only scan, read visually by two readers (Codex and Claude) who agree, and staged as `image_transcription` with its arithmetic checked. A third independent check (round 3) then compared every new row (154 monthly rows, 2,100 numbers; 686 station rows, 12,878 numbers) with its PDF and found **no mismatch**.

Things the loading had to handle:
- **Different layouts.** Older East reports print fewer columns. Month-wise: 11 columns (one combined "injured" figure; no person classes or animals). Station tables: 21 columns (the current layout without the MACT column, so vehicles and animals are present) and 17 columns (no MACT, no person no-injury, no vehicles, no animals). The collector reads each by its own column map; columns a layout does not print are empty in the CSV (`schema` says which layout), never 0.
- **Stray months.** Reporting-date reports (North East's 2023 and 2024 files) print a few accidents in months outside the report's stated period: 38 month rows with 71 accidents in 23 reports. These rows **are inside each report's printed TOTAL**. The CSV keeps only the months inside the stated period, so for those 23 reports **the CSV months do not add up to the report's own total**. The full printed TOTAL and the dropped months (with their values) are kept in `manifest.json` (`printed_total`, `out_of_range_months`). Use the CSV as "accidents in the report's own stated months", not as the report's full reporting-period count. The collector checks all printed months against the TOTAL before filtering.
- **Year-only and undated reports.** Some month-wise reports print a year but no dates (South West, Dwarka, South; East 2022 prints neither). The year is taken from the header (East 2022: the 26 Dec 2022 generation date) and rows are marked `period_inferred`. Zero-accident months are not written to the CSV; in the source, months after the generation date print zeros (South West and Dwarka May to Dec 2025 were future months on 17 Apr 2025), which do not mean "no accidents". A missing CSV row is neither a zero nor proof the month was observed. Some station reports print no year or dates at all (North West, Rohini, two South West or Dwarka tables) and stay undated.
- **Scope.** The six South West and New Delhi tables whose heading says "FIR registered Accidents only" carry `scope = fir_registered_only`. Dwarka's month-wise headings do not say so and do not inherit it. Reports without that label are not shown to include non-FIR accidents.
- **Snapshots.** East's January 2023 appears in two snapshots (7 Feb and 3 Mar 2023) that differ only in persons injured (22 vs 21) and persons total (27 vs 26); the later one is kept and both values are in `issues.json`. North East's twelve 2025 monthly reports are identical to its annual report for every month, so rows name the annual file; those monthly files have no rows of their own. Annual or cumulative station tables overlap monthly ones and must not be added together.

## Things to know
- **District comes from each report's header, not the website that links it.** North West's page links seven South East reports; they are staged once, under South East, and flagged.
- **Scanned PDFs (transcribed, not machine-read).** Four New Delhi files (2022, 2023, 2024, 2025 month-wise tables) are images with no text layer, and no OCR engine is installed here. Claude read the
  values from the rendered page images (`transcribed_image_tables.json`). Each transcription must pass the report arithmetic on all 12 months and the 12 months must add up to the
  TOTAL row printed in the PDF (all four do), and rows carry `extraction_method = image_transcription`. A person should still spot-check them against the PDFs. The other image-only files are East's March 2023 scan (staged separately, see above) and
  Central 05-03-2025, which is a road-safety committee meeting notice, not data. Overview slide decks (about 3 MB) and two 6 MB North West files were skipped by a size limit (`MAX_BYTES`).
- **FIR counts.** The FIR column is printed `count(percentage)` in most reports but `percentage(count)` in the 2026 South East reports; the header says which ("FIR Filed (%)" or "FIR Filed % (count)") and the script reads it. An independent audit on 18 Oct 2026 found 56 wrong values from this and 10 rows labelled North West that are Rohini; both are fixed and covered by tests.
- **Reporting basis.** Some reports date accidents by reporting date and time, others by accident date and time. The `date_basis` column records which, and the two should not be treated as the same series.
- **Checks.** Every row must satisfy fatal + non-fatal = total accidents, the four injury classes = non-fatal, and killed + injured classes = persons total. All 296 month rows and 1,275
  station rows pass, FIR filed never exceeds accidents, and each report's months and stations add up to its printed TOTAL (checked on the full printed table, before the range filter and deduplication). That establishes internal consistency, not completeness. Central 2025 was also checked by hand against the monthly PDFs.
- **Source reports that disagree.** South East's 2025 annual station table has 485 accidents, 118 fatal, 123 killed; its twelve monthly tables add up to 486, 119, 124 for the same reporting-date window, with larger gaps in pending and completed cases. Each file matches its own PDF, so this is a disagreement inside the sources. West's annual 2025 table (461 accidents) cannot be reconciled with its monthly tables because January to April are not published. Station lists change: West lists 23 labels against 12 territorial stations in the Delhi Police directory, and South East's 2022 to 2024 table includes four stations (Ambedkar Nagar, Chitranjan Park, Greater Kailash, Sangam Vihar) that are absent from its later tables.
- **Exact dates.** The New Delhi 2025 scan prints Year 2025 and twelve month rows but no From/To dates, so its full-year bounds are inferred (`period_inferred` in the manifest). All four scans print Accident Date & Time. North West, Rohini, South, South West and Dwarka station reports print a year or nothing, not exact dates.
- **Public links.** `source_links.json` proves the same bytes are published at those URLs now; it does not prove they are where the original collection downloaded them.
- **Late entries.** Monthly files were generated on different dates (Central: January to March on 8 April, April on 5 May, May to June on 4 July, July to December on 10 December).
  Early months may be undercounts. When two files cover the same district and period, the later-generated one is kept and a difference in any numeric column goes to `issues.json`.
- **Not comparable to the Delhi Traffic Police Road Crash Report.** iRAD figures come from records with "minimal critical information" and the reports warn later tables may differ. A district's
  iRAD total is a different series from the traffic police zones and fatalities used on the dashboard.
- Revenue districts are administrative areas; the 15 police districts used by the dashboard need the police-station crosswalk in `tools/pipeline_2025/config/` before any comparison.

Re-run: `python scripts/collect_irad_monthly.py` (add `--offline` to use only the PDFs already in `scratch/irad_monthly_pdfs`, which is not committed).

## Phase 1 staged releases (2026-10-19; hand-maintained documentation)

The derived collection remains unchanged. `data/releases/2025/irad/manifest.json` is authoritative for staged 2025 iRAD; `data/releases/2026/irad/manifest.json` is provisional, year-to-date, and must never be compared with a full year. Both preserve input columns, values, duplicates and source order. `data/releases/irad_dispositions.json` accounts for every input row once, including historical, multi-year and undated exclusions. Counts and coverage are generated, not maintained in this prose.

Coverage matrices distinguish dated monthly observations, partial endpoints, gaps, year-only periods and overlapping annual/cumulative station windows. Blank scope is unspecified. Central December is a partial endpoint. Missing rows are not zeros. Source links prove that identical bytes were published on the verification date, not the original download location. PDF generation time, link-verification date and release metadata date are distinct.

`data/reference/police_station_crosswalk.csv` covers all distinct collection reporting-district/station-label pairs. Its evidence CSV is an author-created draft pending human verification. The owner clarified that repeated printed occurrences for the same normalized name and police district represent one identity, while all occurrences remain evidence; names identifying different districts remain ambiguous. The territorial roster and contextual repeated name occurrences are recorded separately in evidence notes. The extract includes the territorial roster and other station lists on printed pages 13-25, supporting MACT branch entries, and contextual repeated occurrences; it does not claim an exhaustive transcription of every address or specialised branch throughout the Manual. The post-period Manual cannot prove historical jurisdictions. The four required unresolved labels remain unresolved. No police-district aggregation is implemented.

The legacy pipeline config is unchanged. Compatibility joins its raw label to every normalized matching source label without inventing a reporting district, preserving its canonical display name, police district and page. See generated crosswalk coverage for those joins and mapped source-table row shares with denominators. These rows include overlapping annual and monthly windows, not unique stations, incidents or geographic completeness.

Both release commands invoke `scripts/build_all_releases.js`: production years, staged iRAD, crosswalk, shared inventory, then the index last. The release metadata date is a human-maintained constant; new manifests set generatedAt to null. Rebuild and fail on differences.
