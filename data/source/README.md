# Reproducibility source inputs

`delhi_wards_boundaries.geojson` is the checked-in ward geometry used by `scripts/build_ward_infra.js`.

The one-off crash-report preparation scripts expect these optional directories when their source extracts are available:

- `data/source/crash_report_2023/`
- `data/source/crash_report_2024/`

They can instead be supplied through `CRASH_REPORT_2023_SOURCE` and `CRASH_REPORT_2024_SOURCE`. Ward geometry can be overridden with `DELHI_WARDS_GEOJSON`.

Do not add private, access-controlled, or unlicensed files here.

## Pedestrian overbridge snapshot

`osm_pedestrian_overpasses_delhi_raw.json` is the raw OpenStreetMap/Overpass snapshot used by `scripts/build_pedestrian_overpasses.js`. The reproducible query selects `highway=footway|path|steps` ways tagged `bridge=yes|footbridge`; connected segments are grouped, nearby components merged within 45 metres, converted to centroids, and filtered to the dashboard district polygons. This is a mapped-feature inventory, not an official completeness register.
