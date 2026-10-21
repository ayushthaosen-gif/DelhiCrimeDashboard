# Named zones and roads, 2016 to 2021

The named accident-prone zones (one row per zone, with the crash counts the report prints, and the road where the table has a road column) and the road-wise zone summaries from the Delhi Traffic Police annual reports for 2016 to 2021. [Zones: JSON](named_zones_2016_2021.json), [CSV](named_zones_2016_2021.csv). [Roads: JSON](roads_selected_zones_2017_2021.json), [CSV](roads_selected_zones_2017_2021.csv). [Sources, checks and caveats](manifest.json).

| Year | Named zones | Road column in zone table | Road-wise table |
|---|---:|---|---|
| 2016 | 108 (alphabetical list) | yes | none printed |
| 2017 | 145 | yes (and circle) | 45 roads |
| 2018 | 110 | yes | 33 roads |
| 2019 | 119 | yes | 32 roads |
| 2020 | 77 | yes | 24 roads |
| 2021 | 87 | no | 29 roads |

Every year's rows add up to the report's printed zone totals (zones, simple, fatal, total crashes), and every row satisfies simple + fatal = total. Printed subtotal rows inside the road tables are not rows here; they are listed in the manifest. These are crashes within each year's selected zones, not all crashes on a road or in a district, and the zone lists change every year. No coordinates are given. Read the manifest for the source spellings kept and the one discrepancy in the 2019 narrative.

Status: staged; the 2016–2021 named-zone and road tables are not wired into the page yet. Manual transcription inputs for 2016–2020 are preserved in transcriptions/. Run node data/releases/road_zones_roads_2016_2021/validate.cjs to verify row arithmetic and annual totals. Source PDFs are identified by URL and SHA-256 in the manifest; page references are retained per row.
