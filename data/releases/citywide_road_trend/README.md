# Citywide road trend: 2011–2024

Annual police-reported **counts, not rates** for Delhi as a whole. [CSV](citywide_road_trend.csv), [JSON](citywide_road_trend.json), [provenance and caveats](manifest.json). Fatal crashes and persons killed are distinct. No district allocation is implied.

Only the agreeing 2011–2013 total crashes, fatal crashes and deaths are added; existing 2014–2024 rows and 2019–2024 victim-by-mode data are unchanged. Injuries and simple/non-injury categories are excluded from the extension because source editions differ. The dashboard indexes the count series to 2011=100; that is relative change, not a population/exposure-adjusted risk rate.

Regenerate with `node scripts/build_citywide_road_release.js` or `npm run build:releases`.
