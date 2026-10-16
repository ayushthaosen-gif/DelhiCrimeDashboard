# Delhi Road Crash Report 2024: extracts

`delhi_crash_road_summary_2024.csv` is the road-level crash-prone-zone summary (report Table 6.33, PDF page 119) from a structured extract of the
Delhi Road Crash Report 2024 supplied by the project owner. The rest of that extract (the 93 named zones with null geometry, the report metrics and the
CCTV candidates) is identical to what is already in `data/` (`delhi_crash_prone_zones_2024_all_named_approx.geojson` and
`delhi_crash_report_relevant_metrics_2024.json`, checked property by property).

The report itself is not stored here. Two facts verified against the PDF (report section 6.8, page 94; section 1, page 14):
- A crash-prone zone is "three or more fatal crashes within the diameter of 500 meters or ten or more total accidents in the same region"
  (so the zone is a 500 m diameter, a 250 m radius). 111 zones were identified; the ten with the most fatal crashes are "black spots".
- "All crash spots are geo-tagged and marked on GIS map", but coordinates are not published. Map 6.1 (report page 99, PDF page 116) draws all 111 zones as
  dots on the Delhi outline; see `scripts/georeference_report_map.py` and `docs/CRASH_ZONE_COORDINATES.md`.
