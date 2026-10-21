# Delhi-wide registered crime (Delhi UT totals as printed)

**Production.** Delhi UT totals exactly as NCRB prints them, independent of district boundaries. Start with [manifest.json](manifest.json).

- [delhi_ut_crime.csv](delhi_ut_crime.csv) / [JSON](delhi_ut_crime.json): one row per year, 2011 to 2024.
- 2011-2015 come from the printed Delhi UT summaries; 2021-2024 from the printed "Total Districts" row of NCRB's district-wise tables, which equals the sum of the printed unit rows for every figure (2021 also equals the State/UT tables of Crime in India 2021).
- **2016-2020 are `printed_totals_only`:** IPC, SLL and crimes-against-women totals from NCRB's State/UT-wise tables, with every edition that prints a year compared (they agree exactly). Theft, robbery and burglary for those years are blank, not zero: the head-wise state tables have not been extracted. Nothing is summed from districts.
- 2015 crimes against women is 17,104 in the original-year table and 17,222 in the later IPC+SLL table, so 2015 to 2016 is a caution for that measure. Burglary jumps from 2,637 (2021) to 6,189 (2022) with the same heading and the cause is unknown, so that change is a caution too.
- Burglary is three separate columns because the definition changed. 2013 to 2014 is not comparable and 2023 to 2024 is a caution; see [data/continuity.json](../../continuity.json).
- Sources and hashes: [data/raw/ncrb_wayback/](../../raw/ncrb_wayback/manifest.json). They were recovered from Internet Archive captures of NCRB's own files, because the live ncrb.gov.in certificate fails the Windows revocation check.

Regenerate with `python tools/delhi_ut_series/extract.py`, `python tools/delhi_ut_series/extract_state_tables.py`, then `node scripts/build_delhi_ut_series.js` (also part of `npm run build:releases`).
