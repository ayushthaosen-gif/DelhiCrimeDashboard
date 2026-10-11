# Crash-zone coordinates: audit and refinement (2024)

The Delhi Road Crash Report 2024 names 93 crash-prone locations but publishes **no coordinates**. The points in
`data/delhi_crash_prone_zones_2024_all_named_approx.geojson` were placed by hand at landmark centres. There is no
ground truth for where the crashes happened, so nothing here can prove a point is "correct". These scripts measure
how well the stored points agree with independent evidence and propose better positions where that evidence is strong.

**Nothing in the production file was changed.** Both outputs are separate review files.

## 1. Audit (`scripts/audit_crash_zone_coordinates.js`)

Cross-checks each stored point against: Delhi ward polygons, the local OpenStreetMap major-road snapshot (is there a road
with the report's name nearby?), OSM Nominatim geocodes of the zone name, and near-duplicate zones.
Output: `data/audits/crash_zones_2024/crash_zone_coordinate_audit_2024_review.{csv,json}`. Result: 23 ok, 60 review, 10 suspect of 93.
44 of the 93 points have no major OSM road within 250 m.

## 2. Refinement (`scripts/refine_crash_zone_coordinates.js`)

- **Layer 1, street network (OpenStreetMap):** candidate positions every ~40 m on major roads near the stored point,
  near the geocode, and on roads named like the report's road, plus junction positions.
- **Layer 2, traffic-exposure proxy (OpenStreetMap-derived):** road class, lanes, speed limit, traffic signals within 150 m,
  distance to a junction, flyover/bridge tags, bus stops. **This is a proxy for how busy a place is, not measured traffic.**
  No live traffic source was used (live feeds show current conditions, not 2024, and their terms generally forbid keeping the data).
- **Regression:** a conditional logit over each zone's candidates. Weights are learned on 19 "anchor" zones whose Nominatim/Photon
  geocode lies within 250 m of a road candidate, using only the layer 1 and 2 features. The stored point and the geocode then
  enter as fixed Gaussian evidence terms, so the model cannot simply copy its training label.
- **Validation (leave-one-out on the anchors):** median distance to the independent geocode fell from 198 m (stored point) to
  133 m (refined), better in 13 of 19. The caveat is that geocodes of place names are themselves approximate. This shows
  that the layers help recover landmark positions; it does not show that the refined point is where crashes occurred.
- **Recommendations in the output:** `use_refined` only when the refined point is on a major road, within 300 m of an independent
  geocode, and moves less than 1.5 km. Everything else that moves 150 m or more is `review`; small moves are `keep_original`.
  `uncertainty_m` adds the validated landmark error to the model spread, and any conflict with the geocode forces `low` confidence.

Re-run: `node scripts/audit_crash_zone_coordinates.js` then `node scripts/refine_crash_zone_coordinates.js` (add `--offline` to
use the cached geocodes in `data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json`; otherwise missing queries are fetched at 1 request/second).

## What would make it accurate

Only real crash geotags would. The report says its spots were geotagged internally, so an RTI request to Delhi Traffic Police
for the 111 zone coordinates would replace all of this.
