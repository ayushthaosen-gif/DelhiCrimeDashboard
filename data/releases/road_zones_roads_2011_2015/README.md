# Named zones 2013 to 2015 and early road stretches 2011 to 2012

Accident-prone zones named in the Delhi Traffic Police data for 2013, 2014 and 2015, and the highway and ring-road stretches printed for 2011 and 2012. [Zones: JSON](named_zones_2013_2015.json), [CSV](named_zones_2013_2015.csv). [2015 road groups (derived): JSON](roads_2015_derived_exact_labels.json), [CSV](roads_2015_derived_exact_labels.csv). [2011 and 2012 stretches: JSON](roads_2011_2012_retrospective.json), [CSV](roads_2011_2012_retrospective.csv). [Sources, checks and caveats](manifest.json).

| Year | Named zones | Road | Source |
|---|---:|---|---|
| 2013 | 128 | printed in 126 rows (2 blank) | Delhi PWD compilation, archived PDF, pages 133-141 |
| 2014 | 137 | printed in 136 rows (1 blank) | same compilation, pages 142-150 |
| 2015 | 176 | printed in every row | Road Accidents in Delhi 2015, Table 10.1 |
| 2011, 2012 | not recovered | 13 stretches each year | Road Accidents in Delhi 2015, Table 6.5 (retrospective) |

- **2013 and 2014** come from an official compilation, not a recovered annual report. Printed district and circle names are kept (2014 gives circle codes only and no district). No grand total is printed; the totals in the manifest are sums of the rows (2013: 1,094 simple + 544 fatal = 1,638; 2014: 1,616 + 505 = 2,121).
- **2014** has one source. An older name-only list for 2014 (null counts, different order and spellings) is not used, and rows are never joined by serial.
- **2015**: 1,572 simple + 552 fatal = 2,124. The report's narrative confirms 176 zones and 552 fatal crashes; the other sums are derived. The 45 road groups are calculated here by exact printed label, so they are not a printed road table and not necessarily 45 different roads (spelling variants stay separate).
- **2011 and 2012** are stretch statistics (six national highways, four Ring Road stretches, three Outer Ring Road stretches), not selected-zone sums. Simple and non-injury are separate columns in this source.

Counts within each year's selected zones, not all crashes; the zone lists differ every year. No coordinates. Status: staged on the site's Road safety page.

Rebuild from the recovery packages with `node scripts/build_road_history_2011_2015.js <package folder>` (not run in CI); verify with `node data/releases/road_zones_roads_2011_2015/validate.cjs`.
