# Delhi crime and road data, 2001 to 2010 (staged)

**Shown on the site in two places only:** the district counts (murder, rape, kidnapping and, from 2002, theft, robbery, burglary and total IPC, by each year's own units) on the [Historical crime page](../../../historical_crime.html), built into [counts_2001_2010.json](../../historical_reporting/counts_2001_2010.json), and the 2004 to 2010 deaths-by-mode table on the Road safety page. Not in the coverage matrix or the Explore map. All crime figures are from the NCRB *Crime in India* tables of each year; units are the ones NCRB printed that year and are not allocated to today's districts.

| File | What it holds |
|---|---|
| [delhi_ut_total_ipc_2001_2010.json](delhi_ut_total_ipc_2001_2010.json) | Delhi UT total cognizable IPC crimes: incidence, population, printed rate, rank, with source URL and SHA-256 |
| [delhi_city_total_ipc_2001_2010.json](delhi_city_total_ipc_2001_2010.json) | The Delhi (City) row of the same tables. NCRB's mega-city series, a different geography from the UT row. Its population is the same 127.91 lakh in every year |
| [delhi_district_ipc_2001_2010.json](delhi_district_ipc_2001_2010.json) / [CSV](delhi_district_ipc_2001_2010.csv) | District-wise IPC crime: each year's reporting units by 30 offence heads (10 for 2001), with the printed TOTAL row |
| [delhi_ut_crime_heads_2001_2010.csv](delhi_ut_crime_heads_2001_2010.csv) | Delhi UT crime-head counts per year (the printed TOTAL rows) |
| [reporting_units_by_year.json](reporting_units_by_year.json) | Which units existed in each year, split into territorial districts and specialised units |
| [road_citywide_2008_2010.json](road_citywide_2008_2010.json) | Citywide accidents, killed and injured for 2008 to 2010 from the Traffic Police statistics page (archived) |

## How the units map to their time

- Nine territorial districts (Central, East, New Delhi, North, North-East, North-West, South, South-West, West) in 2001 to 2006; Outer appears in 2007 and South-East in 2008, giving eleven by 2010, which is what the MHA annual reports state for 2010-11 onward. "First printed" is when NCRB's table first shows the unit, not a creation date.
- Specialised units (railway police, airport, STF, special cell, crime branch, EOW, CAW) are part of the Delhi total but are not districts. 2005 prints "DRP" and "Spl Cell"; the table does not expand them.
- Nothing is distributed across the 15 districts of today. The 2011 to 2015 panel works the same way (original units, no allocation).

## Checks and how the numbers were read

- Every year, every column: unit rows add to the printed TOTAL row. Total IPC equals the Delhi UT total. Rape, kidnapping and theft sub-columns add up inside every unit (`node --test test/delhi_ut_2001_2010.test.js`).
- The PDF text layer is misaligned for some rows. The UT and City totals, all of 2001, and the 2008 and 2009 cells for CAW, Crime Branch, EOW and STF were read from page images; the rest by word position. Scripts in [tools/ncrb_2001_2010](../../../tools/ncrb_2001_2010/README.md).
- 2005 and 2007 UT incidence are both printed as 56,065 (checked on the images; populations and rates differ).

## Limits

- **2001** has only the first ten offence columns (murder to dacoity): that is all the file NCRB serves for that year contains.
- **City crime heads** (Table 1.8) and the Delhi (City) district split were not transcribed. NCRB's 2007 link for Table 1.8 returns an error.
- **Road**: accident counts exist here only for 2008 to 2010. 2001 to 2007 accident counts were not found; 2001 to 2003 mode-of-travel rows are printed but do not add up. The 2008 injured figure is 7,343 on the web page and 7,342 in Table 3.1.
- Counting rules, population estimates and offence heads changed over the period; compare with 2011 onward (production series) with care. See [limitations](../../../docs/LIMITATIONS.md).
