# Can building footprints tell us what built-up land is used for? A trial (negative result)

**Question.** The satellite comparison for the Master Plan (`data/derived/mpd2047_worldcover_comparison.json`) sees that land is built-up, not what it
is used for. OpenStreetMap land-use tags split built-up land by use, but only for 30-50% of it. Could building footprint shapes and sizes infer the use of
the untagged 50-70%?

**Setup** (`scripts/experiments/trial_building_footprint_use.py`). Overture Maps buildings (release 2026-09-23.1; footprints from OpenStreetMap, Google
Open Buildings and Microsoft ML) for a 10 km x 10 km test area in west Delhi (lon 77.10-77.20, lat 28.60-28.69): 104,389 buildings. 100 m cells with
footprint features (count, coverage, size percentiles, compactness, rectangularity, spacing, heights where present) plus WorldCover context. Labels are the
OSM land-use tag at the cell centre (residential / commercial / industrial / public) on built cells (1,719 labelled cells). Random forest, evaluated with
**1 km spatial block cross-validation** so neighbouring cells never sit in both train and test.

**Result.** Footprints do not generalise to untagged areas.

| | accuracy | macro-F1 |
|---|---|---|
| Always guess residential (baseline) | 0.631 | - |
| All features, incl. OSM-source share | 0.651 | 0.47 |
| Without source share | 0.635 | 0.46 |
| Footprint shape and size only | 0.595 | 0.41 |

Per class (without source share), F1: residential 0.78, public 0.55, industrial 0.40, commercial 0.12.

The decisive check is a confound. In cells where most buildings come from OpenStreetMap (508 cells) accuracy is 0.86, but in cells dominated by machine-learned footprints
(880 cells) it is **0.51, below the 0.63 baseline**. OSM-mapped neighbourhoods are the same places where volunteers also tagged land use, so the model learns
"well-mapped area" rather than "use". The untagged areas, where inference would be applied, look like the second group, where it fails.

**Conclusion.** Inferring use from footprints is not reliable enough to publish; it would add confident-looking numbers that are mostly noise (commercial and
industrial especially). The Master Plan page keeps showing untagged built-up land as **unknown**. The full Delhi run was not done.

**What could do better** (needs different data, not more modelling): an authoritative existing-land-use or property-use source, for example the DDA existing
land-use survey behind the master plan, or MCD property-tax records by ward and use category.
