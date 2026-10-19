# Delhi NCRB historical panel: 2011 to 2015

**Production, as a separate historical panel shown on [historical_crime.html](../../../historical_crime.html); not merged into the 2016-2024 district series.** Original geography and offence definitions are retained. Start with [manifest.json](manifest.json).

- [citywide_crime.csv](citywide_crime.csv) / [JSON](citywide_crime.json): five Delhi UT rows, selected original measures, explicit null reasons and source/publication evidence. Delhi UT is not a mega-city table.
- [citywide_totals_as_printed.json](citywide_totals_as_printed.json) and [all offence counts](citywide_offence_counts_as_printed.csv): all original summary columns, stored separately from district rows.
- [district_offence_counts_as_printed.csv](district_offence_counts_as_printed.csv): original units, offence heads and source positions. Never sum overlapping categories.
- `as_printed/`: nine source-faithful Delhi table extracts, including printed summaries and auxiliary workbook cells.
- [availability_comparability.json](availability_comparability.json): year-specific geography, definitions and gaps.

District geography is 17, 17, 18, 19 and 19 reporting units for 2011–2015, including specialised units. No current 15-district allocation is supplied. The 2013 legal-definition changes and 2014 revised reporting format/women basket break comparisons; early SLL/women aggregates remain null. Burglary and revised Criminal Trespass/Burglary are separate columns. Counts are registered cases, not rates or prevalence. See [the research report](../../staged/history_2011_2015/AVAILABILITY_AND_COMPARABILITY.md) for source quality findings and exact publication-date gaps.

Regenerate offline with `node scripts/build_historical_crime_release.js`, after rebuilding/checking extraction with `python tools/history_2011_2015/build.py --check`. The normal `npm run build:releases` also regenerates this staged panel without adding it to the production year list. Review original-source reuse terms before public redistribution.
