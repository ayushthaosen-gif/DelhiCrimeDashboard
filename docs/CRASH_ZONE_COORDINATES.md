# Crash-zone coordinates: audit and four-layer refinement (2024)

The Delhi Road Crash Report 2024 names 93 crash-prone locations but publishes **no coordinates**. The points in
`data/delhi_crash_prone_zones_2024_all_named_approx.geojson` were placed by hand at landmark centres. There is no
ground truth for where the crashes happened, so nothing here can prove a point is "correct". These scripts measure how
well the stored points agree with independent evidence and test whether more layers of evidence can improve them.

**Nothing in the production file was changed.** All outputs are separate review files in `data/audits/crash_zones_2024/`.

## 1. Audit (`scripts/audit_crash_zone_coordinates.js`)

Ward containment, distance to a same-named OSM road, Nominatim agreement, near-duplicates. Result: 23 ok, 60 review,
10 suspect of 93. 44 of 93 points have no major OSM road within 250 m.

## 2. Four layers (`scripts/refine_crash_zone_coordinates.js`)

| Layer | Evidence | Source |
|---|---|---|
| 1 | Street network: candidate points every ~40 m on major roads, junctions, flyovers, road-name match | OpenStreetMap (local snapshot) |
| 2 | Traffic-exposure **proxy**: road class, lanes, speed limit, signals, bus stops. Not measured traffic | OpenStreetMap-derived |
| 3 | Crash-type compatibility: pedestrian-prone zones near crossings and footbridges, heavy-vehicle zones in industrial/commercial land use, night-prone zones vs street lamps | Report attributes + local OSM data |
| 4 | Independent coordinates of the named place: OSM geocoders (Nominatim, Photon), GeoNames, Wikidata, the 2023 report placements. Each is weighted by how much it disagrees with the others | `scripts/fetch_crash_zone_independent_sources.js` |

A conditional logit over each zone's road candidates learns the layer 1-3 weights on 19 anchor zones; the stored point and the
layer 4 sources enter as Gaussian evidence with data-estimated spreads.

## 3. Validation and the honest result

Leave-one-source-out cross-validation (101 tests): hide one independent source, estimate the position from the stored point,
the layers and the other sources, and measure the distance to the hidden source.

| | median distance to the hidden source |
|---|---|
| Stored point | 602 m |
| Layers 1-2 | 578 m (better in 50 of 101) |
| Layers 1-3 | 578 m (crash-type features added nothing) |
| Layers 1-4 | 602 m (the extra sources are too noisy to help) |

**No layer set meaningfully beats the stored point**, so the script recommends no automatic move (`use_refined` is only
possible when validation shows a real gain of at least 15 m and 20%). An earlier two-layer run looked better (198 m to 133 m on
19 anchors), but that test only used zones where an OSM geocode already sat close to the stored point; the wider test above
replaces it. The independent sources themselves disagree by about 500-1000 m, which is the practical accuracy limit of
anything derived from place names and OpenStreetMap.

## 4. What is useful: how much to trust each position

Each zone gets `evidence_agreement`: `consistent` (stored point and all independent sources within 300 m of each other),
`partial`, `conflicting` (more than 1 km), or `stored_point_only`. Counts: 12 consistent, 20 partial, 28 conflicting,
29 stored point only, 4 with no road candidates. The 3D tour shows this for each stop.

Re-run: `node scripts/audit_crash_zone_coordinates.js`, `node scripts/fetch_crash_zone_independent_sources.js`, then
`node scripts/refine_crash_zone_coordinates.js` (geocode results are cached in the audit folder).

## What would make it accurate

Only real crash geotags. The report says its spots were geotagged internally, so a Right to Information request to Delhi Traffic
Police for the 111 zone coordinates would replace all of this.

## 5. What the report itself says (checked against the PDF, 2026-10)

- **Zone definition.** Section 6.8 (report page 94): a crash-prone zone is *three or more fatal crashes within the diameter of 500 meters or ten or more total
  accidents in the same region*. So a zone is a **500 m diameter (250 m radius)**; the 250 m ring in the 3D tour is correct. (News coverage that described a
  "500 m radius" was wrong.) 111 zones; the ten with the most fatal crashes are black spots (Table 6.41).
- **Geotags.** "All crash spots are geo-tagged and marked on GIS map." The report publishes no coordinates and no police-station, chainage or other per-zone
  location text beyond the zone name and road, so there is nothing more to extract from the tables. The supplied structured extract is identical to the data
  already in this repo (93 named zones, null geometry); only the road summary (Table 6.33) was new and is in `data/source/crash_report_2024/`.
- **88 of 111 zones are named.** Table 6.29 names 88 (plus 5 more from the other category tables = 93); 18 zones are unnamed in any table. Their positions exist only
  as dots on Map 6.1.

### The report's own map (Map 6.1, page 99)

Map 6.1 draws all 111 zones as dots over the Delhi outline. `scripts/georeference_report_map.py` registers that raster to the Delhi outline and reads the dots
back as coordinates (`crash_zone_report_map_dots_2024.json`); `scripts/check_zones_against_report_map.js` compares the stored points with them.

**It is too coarse to place a zone.** The page is a 96 ppi raster: about 150 m per pixel, dots about 1 km wide, and the printed outline differs from the
real boundary by roughly 1 km, so dot positions are good to about a kilometre. 72 of the 111 dots could be separated; the rest sit inside clusters in the centre.
- Stored points sit a median **0.97 km** from the nearest dot (90th percentile 2.9 km); ward centroids, as a stand-in for arbitrary points, sit 1.6 km
  (3.6 km). So the map confirms the stored points are in the right neighbourhoods, but only weakly.
- 69 of 93 points are within 1.5 km of a dot, 8 are 1.5-2.5 km away, and **16 have no dot within 2.5 km** (for example Near Yashobhoomi Convention Centre Dwarka,
  Singhu Border, Ghewra More, Goyla Village, Raja Harishchander Hospital). That is a list of points to look at first, not proof they are wrong (their dots may be
  hidden in clusters).
- Result: the map is a **kilometre-scale sanity check** and is shown in the tour as "Report map dot". It cannot decide between sources that differ by 500-1000 m.
