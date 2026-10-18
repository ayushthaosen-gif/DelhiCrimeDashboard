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
| `unstaged_published_reports.csv` | 113 further accident reports that the district pages publish but this staging does not contain (URL, SHA-256, size, period) |
| `issues.json` | arithmetic failures (none), disagreeing duplicates (none), files listed under the wrong district, station sums that differ from the printed TOTAL (none), reports naming an unknown district (none) |

## Coverage found (2026-10)

| District | Month-wise table | Police-station tables |
|---|---|---|
| Central | Jan to 10 Dec 2025 (12 months: 226 accidents, 49 fatal, 51 killed) | cumulative 2022 to 8 Apr 2025 |
| South East | Jan 2022 to Dec 2024 (36 months) | 21 periods, monthly 2025 and 2026 to July, and yearly |
| West | Jan 2022 to Apr 2025 (40 months) | 8 monthly periods (May to Dec 2025) and one yearly 2025 period |
| New Delhi | Jan 2022 to Dec 2025 (from scans, transcribed) and Jan to May 2026 | none readable |
| East | none staged (4 published) | cumulative 2022 to 2024 staged; 33 monthly station reports published, not staged |
| North East | none staged (38 published) | cumulative 2022 to Mar 2025 staged; 8 monthly 2026 station reports published, not staged |
| North West | none | one file (North West Delhi) with Year 2025 but no dates in its header |
| Rohini | none | one file (`North_West__2025041579.pdf`, listed on the North West page; its header says ROHINI) with Year 2025 but no dates |
| North | none | nothing linked on its page |
| South | none staged | 15 published, not staged (12 monthly 2025 reports and station tables for 2022, 2023, 2024) |
| South West and Dwarka | none staged | 12 published, not staged |
| Shahdara | site not reached | none. The old address does not resolve; the iRAD page on its successor site (Central North) has headings but no downloads |

## Published but not staged (found by the second independent check, 18 Oct 2026)
The district pages publish **113 accident reports that this staging does not hold**: East 37, North East 46, South 15, South West and Dwarka 12, New Delhi 3 (station tables). They are listed with URL, size, SHA-256 and period in `unstaged_published_reports.csv`. All are under the 1.5 MB size limit, so the limit is not why they are missing: the collector only read each district's main page, not its month-wise sub-pages, and some older East tables use fewer columns than the current schema. They have **not been cell-checked or loaded**; treat the inventory as a to-do list, not as data. So the totals in this folder describe what was staged, not everything published.

## Things to know
- **District comes from each report's header, not the website that links it.** North West's page links seven South East reports; they are staged once, under South East, and flagged.
- **Scanned PDFs (transcribed, not machine-read).** Four New Delhi files (2022, 2023, 2024, 2025 month-wise tables) are images with no text layer, and no OCR engine is installed here. Claude read the
  values from the rendered page images (`transcribed_image_tables.json`). Each transcription must pass the report arithmetic on all 12 months and the 12 months must add up to the
  TOTAL row printed in the PDF (all four do), and rows carry `extraction_method = image_transcription`. A person should still spot-check them against the PDFs. The fifth image-only file
  (Central, 05-03-2025) is a road-safety committee meeting notice, not data. Overview slide decks (about 3 MB) and two 6 MB North West files were skipped by a size limit (`MAX_BYTES`).
- **FIR counts.** The FIR column is printed `count(percentage)` in most reports but `percentage(count)` in the 2026 South East reports; the header says which ("FIR Filed (%)" or "FIR Filed % (count)") and the script reads it. An independent audit on 18 Oct 2026 found 56 wrong values from this and 10 rows labelled North West that are Rohini; both are fixed and covered by tests.
- **Reporting basis.** Some reports date accidents by reporting date and time, others by accident date and time. The `date_basis` column records which, and the two should not be treated as the same series.
- **Checks.** Every row must satisfy fatal + non-fatal = total accidents, the four injury classes = non-fatal, and killed + injured classes = persons total. All 141 month rows and 589
  station rows pass, FIR filed never exceeds accidents, and each report's stations add up to its printed TOTAL. Central 2025 was also checked by hand against the monthly PDFs.
- **Source reports that disagree.** South East's 2025 annual station table has 485 accidents, 118 fatal, 123 killed; its twelve monthly tables add up to 486, 119, 124 for the same reporting-date window, with larger gaps in pending and completed cases. Each file matches its own PDF, so this is a disagreement inside the sources. West's annual 2025 table (461 accidents) cannot be reconciled with its monthly tables because January to April are not published. Station lists change: West lists 23 labels against 12 territorial stations in the Delhi Police directory, and South East's 2022 to 2024 table includes four stations (Ambedkar Nagar, Chitranjan Park, Greater Kailash, Sangam Vihar) that are absent from its later tables.
- **Exact dates.** The New Delhi 2025 scan prints Year 2025 and twelve month rows but no From/To dates, so its full-year bounds are inferred (`period_inferred` in the manifest). All four scans print Accident Date & Time. North West, Rohini, South, South West and Dwarka station reports print a year or nothing, not exact dates.
- **Public links.** `source_links.json` proves the same bytes are published at those URLs now; it does not prove they are where the original collection downloaded them.
- **Late entries.** Monthly files were generated on different dates (Central: January to March on 8 April, April on 5 May, May to June on 4 July, July to December on 10 December).
  Early months may be undercounts. When two files cover the same district and period, the later-generated one is kept and a difference in any numeric column goes to `issues.json`.
- **Not comparable to the Delhi Traffic Police Road Crash Report.** iRAD figures come from records with "minimal critical information" and the reports warn later tables may differ. A district's
  iRAD total is a different series from the traffic police zones and fatalities used on the dashboard.
- Revenue districts are administrative areas; the 15 police districts used by the dashboard need the police-station crosswalk in `tools/pipeline_2025/config/` before any comparison.

Re-run: `python scripts/collect_irad_monthly.py` (add `--offline` to use only the PDFs already in `scratch/irad_monthly_pdfs`, which is not committed).
