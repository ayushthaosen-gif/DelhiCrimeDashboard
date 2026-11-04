# NCRB road tables for Delhi (UT), 2014 to 2022

`delhi_ut_road_time_class_place_2014_2022.json` holds the DELHI (UT) row of four tables of the National Crime Records Bureau's *Accidental Deaths and Suicides in India* (ADSI), Chapter 1A, for each year 2014 to 2022:

| Table | What it holds | Used for |
|---|---|---|
| 1A.2 | Road accidents, persons injured and persons died | Cross-check of the totals |
| 1A.6 | Road accidents by three-hour band of the day | Time of day |
| 1A.7 | Road accidents, injured and died, by class of road | National highway, state highway, expressway, other roads |
| 1A.11 | Persons died by place of occurrence, rural and urban, by sex | Place |

Every file's URL, byte size and SHA-256 is recorded per year in the JSON (`years.<year>.sources`). The PDFs are not in the repository; fetch each from its URL and compare the hash. NCRB lists the tables for each year at `https://www.ncrb.gov.in/accidental-deaths-suicides-in-india-table-content.html?year=<year>&category=TRAFFIC+ACCIDENTS`.

## How the rows were read

The text layer of these PDFs is partly scrambled (the 2019 Delhi row, for example, comes out of a plain text extraction in the wrong order), so a plain extraction was not trusted. Time of day and road classification were read from the rendered page images and also taken from the PDF text by position on the row; the two agree for all nine years. Place of occurrence was taken by position and checked by the sums below, with the 2022 row also read from the image.

## Checks that hold for every year (and that `test/ncrb_adsi_delhi_road.test.js` repeats)

- The eight time bands add to the printed total.
- National highways, state highways, expressways and other roads add to the printed total for cases, injured and died.
- The road-classification case total equals the time-of-day total and the Table 1A.2 road figures (cases, injured, died).
- Place categories add to the printed rural and urban subtotals, which add to the grand total; male, female and transgender add to each total.
- The place-of-occurrence grand total equals the road-classification deaths.

## What the NCRB figures are, and are not

- They are counts of what was returned to the Bureau, not the Delhi Traffic Police statistics. Persons killed equal the Traffic Police figure in 2015, 2016, 2020, 2021 and 2022 and differ in 2014 (NCRB 1,630, Traffic Police 1,671), 2017 (1,638 against 1,584), 2018 (1,734 against 1,690) and 2019 (1,508 against 1,463). Crash counts differ slightly in several years. The page shows the gap for the year in view and does not choose between the two.
- The row is Delhi (UT). The Delhi (City) row is not read, and the railway and railway-crossing columns are not read.
- "Place of occurrence" is where the crash happened (near a school, a religious place, and so on). It says nothing about who was killed. Delhi reports almost all deaths as urban.

## Mode of transport (Table 1A.4) is deliberately not staged

Table 1A.4 splits deaths by mode of transport into "offenders" and "victims". Its 2014 title reads "Culpability vis-a-vis Fatality", so it classifies by who was at fault and by the offending vehicle. For Delhi 2020 it shows 57 pedestrian deaths against several hundred in the Traffic Police series, and that is a difference of definition, not of count. It is therefore not used as the dead person's mode of travel. That comes from Table 3.1 of the Traffic Police reports (see `data/releases/road_victims_by_mode_2004_2018/` and the 2019 to 2024 series).

## Years not covered

2014 to 2022 only. NCRB's table listing returned these tables for 2014 to 2022 and nothing for earlier years or for 2023 and 2024 when checked on 2026-11-04. If NCRB posts them later, extend the file with the same checks.
