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
