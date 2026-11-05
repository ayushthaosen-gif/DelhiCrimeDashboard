# Delhi road accident trends 1986 to 2015 (Traffic Police Table 2.4)

`road_accident_trends_1986_2015.json` holds Table 2.4, "Road Accident Trends", of the Delhi Traffic Police report *Road Accidents in Delhi 2015* (chapter 2, printed page 11): for each year 1986 to 2015, the population, motor vehicles on the register, fatal accidents, total accidents of all types and road deaths, with the report's own printed rates. The source URL, size and SHA-256 are in the file. The PDF is not in the repository.

## What the site uses

- 2001 to 2007: total accidents (the Road safety trend's "all crashes"), fatal accidents (its "fatal crashes") and road deaths (its "persons killed"). The Road safety trend now starts in 2001.
- 1986 to 2000 and the population and vehicle columns are staged but not shown.
- 2008 to 2015 are not used from this file: they were already on the site, and they equal Table 2.4 exactly (a test confirms it). That agreement is the evidence that Table 2.4 and the site's series count the same thing.

## How it was read, and what is not reliable

The table is a page image with no text layer. Every row was read from the page rendered at 300 dpi, and the rows below were read a second time at higher zoom. Each row was checked against the report's own printed columns (deaths per lakh population, per 10,000 vehicles, per 100 accidents).

- In 1990, 1991, 1996, 1997, 1998 and 2002 one or two of the printed rate columns cannot be reproduced from the report's own counts. The counts agree with the chart on page 13 of the same chapter and were read twice, so the difference is in the report's derived columns. They are listed in `rates_not_reproduced`, kept as printed, and not used.
- 2004 is a conflict inside the report. Table 2.4 prints 1,832 deaths but 1,929 fatal accidents, which cannot be (every fatal accident has at least one death). Table 3.1 of the same report prints 1,977 killed, with categories that add to it. The site uses 1,977 for 2004 (`site_choice`); 1,832 is kept in the file.
- 2001 to 2003: the killed totals (1,842, 1,696, 1,801) agree with the printed totals of Table 3.1. Table 3.1's categories for those years do not add to its totals, which is why no mode-of-travel split is published for them; only the totals are kept (`table_3_1_totals_2001_2003`), with the injured totals.

## Not covered

Injured counts come only from Table 3.1 (2001 to 2018); Table 2.4 has none. The Traffic Police editions disagree about injuries in some years, which is why the Road safety trend does not chart them.
