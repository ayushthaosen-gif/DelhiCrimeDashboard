# Liquor vends and crash-prone zones

A spatial exploration, moved out of the README.

## Liquor vends × crash-prone zones spatial exploration

Both datasets — 374 official liquor vends and the 93 named 2024 crash-prone
zones — live directly in `interactive_map.html` as two independent,
toggleable point layers, and as a ward-level bivariate pairing option
("Liquor Vends (official)" × "Crash Zones (2024)", under the ward bivariate
mode's Infrastructure/Crime dropdown groups). This is the only place the
main dashboard links to for this data — the earlier standalone page
(`liquor_crash_analysis.html`) is no longer linked from the dashboard header,
though its build script and the deeper proximity-band analysis/exports it
produces still exist in the repo if needed directly. **Every coordinate is
approximate** — locality/sector centroids for vends, landmark/intersection
centres for crash zones, neither a verified vend entrance nor an official
Delhi Traffic Police geotag. Both treat proximity/co-location as broad
spatial association only, never causation, and say so persistently.

To refresh this analysis (e.g. if updated source extracts become available):

1. Replace the source files in `data/`: `delhi_liquor_vends_all_coordinates_approx.geojson`,
   `delhi_crash_prone_zones_2024_all_named_approx.geojson`,
   `delhi_crash_prone_zones_2024_250m_buffers_approx.geojson`,
   `delhi_crash_report_relevant_metrics_2024.json` — keep the exact filenames.
2. `npm install` once, if `node_modules/` isn't present (installs `@turf/turf`
   for the spatial math; `scripts/build_liquor_crash_proximity.js` falls back to a
   hand-rolled haversine/point-in-polygon implementation if `@turf/turf` isn't
   installed, so this step is optional but recommended).
3. `npm run build:liquor-crash` — runs `scripts/build_liquor_crash_proximity.js`
   (produces the three derived files: `liquor_vend_crash_proximity_2024.geojson`,
   `crash_zone_liquor_proximity_2024.geojson`, `liquor_crash_proximity_summary_2024.json`)
   then `scripts/build_liquor_crash_analysis.js` (produces `liquor_crash_analysis.html`).
4. `npm test` — runs the automated validation suite
   (`test/liquor_crash_proximity.test.js`, Node's built-in test runner) covering
   coordinate order/validity, official-vs-OSM record counts, monotonic
   distance-band counts, no negative values, and a check that no built page
   text uses causal language about liquor vends and crashes.
