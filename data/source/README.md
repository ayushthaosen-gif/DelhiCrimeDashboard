# Reproducibility source inputs

`delhi_wards_boundaries.geojson` is the checked-in ward geometry used by `scripts/build_ward_infra.js`.

The one-off crash-report preparation scripts expect these optional directories when their source extracts are available:

- `data/source/crash_report_2023/`
- `data/source/crash_report_2024/`

They can instead be supplied through `CRASH_REPORT_2023_SOURCE` and `CRASH_REPORT_2024_SOURCE`. Ward geometry can be overridden with `DELHI_WARDS_GEOJSON`.

Do not add private, access-controlled, or unlicensed files here.

## Pedestrian overbridge snapshot

`osm_pedestrian_overpasses_delhi_raw.json` is the raw OpenStreetMap/Overpass snapshot used by `scripts/build_pedestrian_overpasses.js`. The reproducible query selects `highway=footway|path|steps` ways tagged `bridge=yes|footbridge`; connected segments are grouped, nearby components merged within 45 metres, converted to centroids, and filtered to the dashboard district polygons. This is a mapped-feature inventory, not an official completeness register.

## Traffic signals, pedestrian crossings, hospitals, and footway/sidewalk snapshots (2026-08-06)

`osm_traffic_signals_crossings_delhi_raw.json`, `osm_hospitals_delhi_raw.json`, and `osm_footways_delhi_raw.json` are raw OpenStreetMap/Overpass snapshots fetched by `scripts/fetch_osm_infra_snapshots.js` and processed by `scripts/build_infra_extras.js`. Queries (bounding box `28.35,76.80,28.95,77.40`, matching the dashboard's own district-boundary extent):

- Traffic signals/crossings: `node[highway=traffic_signals]`, `node[highway=crossing]`.
- Hospitals: `node|way|relation[amenity=hospital]` (way/relation centroid via Overpass `out center`).
- Footways: `way[highway=footway]`, `way[highway=pedestrian]`, `way[footway=sidewalk]`, fetched in four geographic quadrants (Overpass's public instance times out on the full bbox in one request) and deduplicated by way ID before use.

All three are filtered to the dashboard's 15 district polygons (points/way-midpoints outside every polygon are dropped, same convention as the pedestrian-overbridge snapshot). Footway data is *not* shipped to the browser as line geometry — `build_infra_extras.js` computes total length (km) and density (km per km²) per district at build time instead, written to `data/delhi_footway_coverage.json`. This is a mapped-feature inventory, not an official completeness register; re-fetch with `node scripts/fetch_osm_infra_snapshots.js` then `node scripts/build_infra_extras.js`.
