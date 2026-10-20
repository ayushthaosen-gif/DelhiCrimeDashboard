# Delhi-wide registered crime (Delhi UT totals as printed)

**Production.** Delhi UT totals exactly as NCRB prints them, independent of district boundaries. Start with [manifest.json](manifest.json).

- [delhi_ut_crime.csv](delhi_ut_crime.csv) / [JSON](delhi_ut_crime.json): one row per year, 2011 to 2024.
- 2011-2015 come from the printed Delhi UT summaries; 2022-2024 from the printed "Total Districts" row of NCRB's district-wise tables, which equals the sum of the printed unit rows for every figure.
- **2016-2021 are rows with status `not_collected`.** They are gaps, not zeros, and are never filled by summing districts.
- Burglary is three separate columns because the definition changed. 2013 to 2014 is not comparable and 2023 to 2024 is a caution; see [data/continuity.json](../../continuity.json).

Regenerate with `python tools/delhi_ut_series/extract.py` then `node scripts/build_delhi_ut_series.js` (also part of `npm run build:releases`).
