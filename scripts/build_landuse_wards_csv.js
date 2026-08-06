// Aggregates OSM landuse=* polygons onto the 290 ward boundaries as per-ward area (km²) and
// share-of-ward-area (%) by land-use category. Output only, per explicit instruction -- no map
// layer, no dashboard UI change.
//
// Deliberately scoped to `way`-tagged landuse features only (9,908 of 11,366 total landuse
// features in the fetch snapshot; the remaining 1,458 are `relation`-tagged multipolygons, which
// need outer/inner ring assembly this script doesn't attempt -- excluded rather than approximated
// with a rough centroid, which would silently bias area sums). This is a REAL, KNOWN GAP, not
// hidden: see the mapped_pct column, which will never reach 100% even for a ward with complete
// OSM landuse coverage, and the note in data/source/README.md.
//
// A ward-wise official Delhi land-use dataset was searched for and deliberately NOT used here:
// DDA's only machine-readable land-use layers found are community-extracted from the PDF map of
// the DRAFT (not adopted) Master Plan 2041, with no explicit license and author-disclosed data
// loss/geometric distortion. Given the choice between that and OSM's current, ODbL-licensed,
// if sparser, `landuse=*` tagging, this uses OSM -- see the chat/commit history for the full
// reasoning if that tradeoff needs revisiting later.
//
//   node scripts/build_landuse_wards_csv.js

const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'source');

const wards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/source/delhi_wards_boundaries.geojson'), 'utf8'));
const landuseRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_landuse_delhi_raw.json'), 'utf8'));

// Standard OSM landuse values grouped into a handful of readable categories; anything not listed
// (including free-text garbage some individual OSM edits contain, e.g. a hotel name typed into the
// landuse tag) falls into "other" rather than being guessed at.
const CATEGORY_MAP = {
  residential: 'residential', apartments: 'residential',
  commercial: 'commercial', retail: 'commercial',
  industrial: 'industrial', railway: 'industrial', depot: 'industrial', garages: 'industrial', quarry: 'industrial', landfill: 'industrial', brownfield: 'industrial', greenfield: 'industrial', construction: 'industrial',
  education: 'institutional', college: 'institutional', school: 'institutional', institutional: 'institutional', religious: 'institutional', place_of_worship: 'institutional', civic: 'institutional', government: 'institutional', courthouse: 'institutional', hospital: 'institutional', fire_station: 'institutional', police: 'institutional', museum: 'institutional', cultural_centre: 'institutional',
  forest: 'green_open', grass: 'green_open', meadow: 'green_open', recreation_ground: 'green_open', cemetery: 'green_open', allotments: 'green_open', farmland: 'green_open', farmyard: 'green_open', orchard: 'green_open', plantation: 'green_open', plant_nursery: 'green_open', greenhouse_horticulture: 'green_open', village_green: 'green_open', park: 'green_open', shrubs: 'green_open', flowerbed: 'green_open',
};
function categoryOf(landuseTag) { return CATEGORY_MAP[landuseTag] || 'other'; }

// ── Build valid landuse polygon features from the raw way snapshot ──
const seenIds = new Set();
const landuseFeatures = [];
let skippedInvalid = 0, skippedDupe = 0;
landuseRaw.elements.forEach(w => {
  if (seenIds.has(w.id)) { skippedDupe++; return; }
  seenIds.add(w.id);
  if (!Array.isArray(w.geometry) || w.geometry.length < 4) { skippedInvalid++; return; }
  const coords = w.geometry.map(p => [p.lon, p.lat]);
  const first = coords[0], last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first); // force-close an open ring
  let feature;
  try { feature = turf.polygon([coords], { landuse: (w.tags && w.tags.landuse) || 'unknown' }); }
  catch (e) { skippedInvalid++; return; } // self-intersecting/degenerate rings some OSM ways have
  feature.bbox = turf.bbox(feature);
  landuseFeatures.push(feature);
});
console.log('Landuse polygons:', landuseFeatures.length, '(', skippedDupe, 'quadrant-overlap duplicates,', skippedInvalid, 'invalid/degenerate rings skipped ).');

function bboxOverlap(a, b) { return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]); }

// ── Aggregate onto each ward ──
const CATEGORIES = ['residential', 'commercial', 'industrial', 'institutional', 'green_open', 'other'];
const rows = [];
let processed = 0;
wards.features.forEach(ward => {
  const wardBbox = turf.bbox(ward);
  const wardAreaKm2 = turf.area(ward) / 1e6;
  const areaByCategory = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  landuseFeatures.forEach(lf => {
    if (!bboxOverlap(wardBbox, lf.bbox)) return;
    let intersection;
    try { intersection = turf.intersect(turf.featureCollection([ward, lf])); }
    catch (e) { return; } // topology errors between two real-world polygons happen; skip that pair rather than crash the whole build
    if (!intersection) return;
    const areaKm2 = turf.area(intersection) / 1e6;
    areaByCategory[categoryOf(lf.properties.landuse)] += areaKm2;
  });
  const mappedKm2 = CATEGORIES.reduce((a, c) => a + areaByCategory[c], 0);
  const row = {
    ward: ward.properties.Ward_Name,
    ward_no: ward.properties.Ward_No,
    area_sq_km: Math.round(wardAreaKm2 * 1000) / 1000,
    mapped_pct: wardAreaKm2 > 0 ? Math.round((mappedKm2 / wardAreaKm2) * 1000) / 10 : null,
  };
  CATEGORIES.forEach(c => {
    row[c + '_km2'] = Math.round(areaByCategory[c] * 1000) / 1000;
    row[c + '_pct'] = wardAreaKm2 > 0 ? Math.round((areaByCategory[c] / wardAreaKm2) * 1000) / 10 : null;
  });
  rows.push(row);
  processed++;
  if (processed % 50 === 0) console.log('  ', processed, '/', wards.features.length, 'wards processed');
});

function csvEscape(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function toCsv(headers, dataRows) { return [headers.join(',')].concat(dataRows.map(r => headers.map(h => csvEscape(r[h])).join(','))).join('\r\n') + '\r\n'; }
const headers = ['ward', 'ward_no', 'area_sq_km', 'mapped_pct', ...CATEGORIES.flatMap(c => [c + '_km2', c + '_pct'])];
fs.writeFileSync(path.join(ROOT, 'data/landuse_by_ward.csv'), toCsv(headers, rows));

const avgMapped = rows.filter(r => r.mapped_pct != null).reduce((a, r) => a + r.mapped_pct, 0) / rows.length;
console.log('Wrote data/landuse_by_ward.csv —', rows.length, 'wards. Average OSM landuse-tag coverage:', avgMapped.toFixed(1) + '% of ward area (the rest is unmapped/untagged land in OSM, not necessarily undeveloped -- see caveats in data/source/README.md).');
