// Aggregates the existing infrastructure point layers (bus stops, ATMs, liquor shops, CCTV),
// the official liquor-vend dataset, and the 2024 crash zones into per-ward counts/densities using
// Delhi's ward boundaries, for a finer-grained ward-level bivariate mode on the interactive map.
// Crime data itself does NOT exist at ward level (NCRB publishes only at the 15 Delhi-Police-
// district level, a different administrative geography from MCD/NDMC wards) -- to still offer an
// infra x crime pairing at ward granularity, each ward's parent district is found by point-in-
// polygon (ward centroid vs. district boundaries) and that district's crime figures are copied
// down onto every ward inside it. Those inherited fields are district-resolution, not ward-
// resolution, and are flagged as such (`wardMetricBasis: 'district-inherited'`) everywhere they
// appear downstream.
//
// Ward source: DataMeet Municipal_Spatial_Data (CC-BY-SA 2.5 India), scraped from an ArcGIS Online
// map. 290 features (273 named MCD wards + 9 NDMC charges + 8 Delhi Cantonment charges) -- the
// count (273, not 250) and naming style indicate this is most likely the pre-2022-unification
// ward delimitation, not the current 250-ward structure. Used here only as a finer spatial grid
// for aggregating point density, not for anything requiring official/current ward boundaries.
//
// The liquor-vend and 2024 crash-zone source coordinates are themselves approximate (locality/
// sector centroids, landmark/intersection centres -- see each file's own coordinate_confidence),
// so every ward count derived from them is flagged `wardAssignmentBasis: 'exploratory'`.
//
//   node build_ward_infra.js

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SCRATCH_WARDS = 'C:/Users/ayush/AppData/Local/Temp/claude/C--Users-ayush/2c91efc8-fa16-49c9-baec-ebb26c6c5bd0/scratchpad/wards/Delhi_Wards.geojson';

const wards = JSON.parse(fs.readFileSync(SCRATCH_WARDS, 'utf8'));
const poi = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers_latlng.json'), 'utf8'));
const liquorVends = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
const crashZones2024 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8'));
const districtBoundaries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), 'utf8'));
const dashboardFinal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));

// Equirectangular-projected shoelace area -- adequate at Delhi's scale (~50km across); avoids
// pulling in a full geodesic library for a one-off area calc.
const R = 6371000;
const LAT0 = 28.6; // Delhi's approximate central latitude, used for the cos(lat) correction
function ringAreaKm2(ring) {
  const toXY = ([lng, lat]) => [
    (lng * Math.PI / 180) * R * Math.cos(LAT0 * Math.PI / 180),
    (lat * Math.PI / 180) * R,
  ];
  const pts = ring.map(toXY);
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2) / 1e6; // m^2 -> km^2
}
function polygonAreaKm2(geometry) {
  if (geometry.type === 'Polygon') {
    // Outer ring minus holes
    const [outer, ...holes] = geometry.coordinates;
    return ringAreaKm2(outer) - holes.reduce((a, h) => a + ringAreaKm2(h), 0);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.reduce((a, poly) => {
      const [outer, ...holes] = poly;
      return a + ringAreaKm2(outer) - holes.reduce((b, h) => b + ringAreaKm2(h), 0);
    }, 0);
  }
  return 0;
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function pointInGeometry(lng, lat, geometry) {
  if (geometry.type === 'Polygon') return pointInRing(lng, lat, geometry.coordinates[0]);
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some(poly => pointInRing(lng, lat, poly[0]));
  return false;
}

// Precompute each ward's bounding box for a cheap reject test before the full point-in-ring scan
// (290 wards x ~5,400 points would otherwise be ~1.6M point-in-ring tests; bbox rejection cuts
// this dramatically since most wards are geographically tiny relative to the full city extent).
wards.features.forEach(f => {
  const coords = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  coords.forEach(poly => poly[0].forEach(([lng, lat]) => {
    minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }));
  f.properties._bbox = [minLng, minLat, maxLng, maxLat];
  f.properties.areaSqKm = Math.round(polygonAreaKm2(f.geometry) * 100) / 100;
});

const LAYERS = { busStops: 'busStops', atms: 'atms', alcoholShops: 'alcoholShops', surveillance: 'surveillance' };

for (const [layerKey] of Object.entries(LAYERS)) {
  wards.features.forEach(f => { f.properties[layerKey] = 0; });
}

let totalAssigned = { busStops: 0, atms: 0, alcoholShops: 0, surveillance: 0 };
let totalOutside = { busStops: 0, atms: 0, alcoholShops: 0, surveillance: 0 };

for (const layerKey of Object.keys(LAYERS)) {
  for (const [lat, lng] of poi[layerKey]) {
    let assigned = false;
    for (const f of wards.features) {
      const [minLng, minLat, maxLng, maxLat] = f.properties._bbox;
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
      if (pointInGeometry(lng, lat, f.geometry)) {
        f.properties[layerKey]++;
        assigned = true;
        break;
      }
    }
    if (assigned) totalAssigned[layerKey]++;
    else totalOutside[layerKey]++;
  }
}

// ── Official liquor vends (374 of the 387 features; the 13 OSM-only records are excluded here
// since they're already covered by the `alcoholShops` OSM layer above) and the 93 named 2024
// crash zones — both approximately-coordinated (locality/landmark centroids, not verified
// geotags), so every count derived from them carries `wardAssignmentBasis: 'exploratory'`.
const officialVendFeatures = liquorVends.features.filter(f => f.properties.record_source !== 'OpenStreetMap');
wards.features.forEach(f => {
  f.properties.officialLiquorVends = 0;
  f.properties.crashZones2024 = 0;
  f.properties.crashZones2024FatalSum = 0;
});
let vendsAssigned = 0, vendsOutside = 0;
for (const feat of officialVendFeatures) {
  const [lng, lat] = feat.geometry.coordinates;
  let assigned = false;
  for (const f of wards.features) {
    const [minLng, minLat, maxLng, maxLat] = f.properties._bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (pointInGeometry(lng, lat, f.geometry)) { f.properties.officialLiquorVends++; assigned = true; break; }
  }
  if (assigned) vendsAssigned++; else vendsOutside++;
}
let zonesAssigned = 0, zonesOutside = 0;
for (const feat of crashZones2024.features) {
  const [lng, lat] = feat.geometry.coordinates;
  const fatal = feat.properties.all_fatal_crashes || 0;
  let assigned = false;
  for (const f of wards.features) {
    const [minLng, minLat, maxLng, maxLat] = f.properties._bbox;
    if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;
    if (pointInGeometry(lng, lat, f.geometry)) {
      f.properties.crashZones2024++;
      f.properties.crashZones2024FatalSum += fatal;
      assigned = true;
      break;
    }
  }
  if (assigned) zonesAssigned++; else zonesOutside++;
}
totalAssigned.officialLiquorVends = vendsAssigned; totalOutside.officialLiquorVends = vendsOutside;
totalAssigned.crashZones2024 = zonesAssigned; totalOutside.crashZones2024 = zonesOutside;

// ── High-Injury Network (Vision Zero terminology): the smallest set of wards that together
// account for half of all 2024 fatal crashes captured in the ward-assigned crash-zone data.
// Ranked by crashZones2024FatalSum descending; a ward is flagged `highInjuryNetwork: true` once
// the running cumulative total first reaches 50% of the sum across every ward with at least one
// fatal crash. This is a real, computed cutoff, not an arbitrary top-N -- it will include more or
// fewer wards depending on how concentrated fatalities actually are in a given year's data.
wards.features.forEach(f => { f.properties.highInjuryNetwork = false; f.properties.highInjuryNetworkRank = null; });
const wardsWithFatal = wards.features.filter(f => f.properties.crashZones2024FatalSum > 0)
  .sort((a, b) => b.properties.crashZones2024FatalSum - a.properties.crashZones2024FatalSum);
const totalFatalAcrossWards = wardsWithFatal.reduce((a, f) => a + f.properties.crashZones2024FatalSum, 0);
let hinCum = 0, hinCount = 0;
for (const f of wardsWithFatal) {
  hinCum += f.properties.crashZones2024FatalSum;
  hinCount++;
  f.properties.highInjuryNetwork = true;
  f.properties.highInjuryNetworkRank = hinCount;
  if (hinCum >= totalFatalAcrossWards * 0.5) break;
}
console.log('High-Injury Network:', hinCount, 'of', wardsWithFatal.length, 'fatal-crash wards (' + (hinCount / wards.features.length * 100).toFixed(1) + '% of all 290) account for 50% of', totalFatalAcrossWards, 'ward-assigned fatal crashes');

// ── District-inherited crime metrics: crime data doesn't exist below the 15-district level, so
// each ward's parent district is found via point-in-polygon against the district boundaries
// (using the ward's bbox-center as a representative point -- an approximation, not a true
// centroid, but adequate for assigning a ward to its enclosing district at this city scale) and
// that district's crime density is copied onto the ward. Flagged `wardMetricBasis:
// 'district-inherited'` since it is district-resolution, not ward-resolution, data.
const districtByName = {};
dashboardFinal.districts.forEach(d => { districtByName[d.district] = d; });
let districtAssigned = 0, districtUnassigned = 0;
wards.features.forEach(f => {
  const [minLng, minLat, maxLng, maxLat] = f.properties._bbox;
  const cLng = (minLng + maxLng) / 2, cLat = (minLat + maxLat) / 2;
  const match = districtBoundaries.features.find(df => pointInGeometry(cLng, cLat, df.geometry));
  if (match) {
    districtAssigned++;
    const d = districtByName[match.properties.district];
    f.properties.assignedDistrict = match.properties.district;
    f.properties.totalIPCDensity2024Inherited = d && d.totalIPC2024 != null && d.areaSqKm ? Math.round((d.totalIPC2024 / d.areaSqKm) * 100) / 100 : null;
    f.properties.crimeAgainstWomenDensity2024Inherited = d && d.crimeAgainstWomen2024 != null && d.areaSqKm ? Math.round((d.crimeAgainstWomen2024 / d.areaSqKm) * 100) / 100 : null;
  } else {
    districtUnassigned++;
    f.properties.assignedDistrict = null;
    f.properties.totalIPCDensity2024Inherited = null;
    f.properties.crimeAgainstWomenDensity2024Inherited = null;
  }
});

wards.features.forEach(f => {
  delete f.properties._bbox;
  for (const layerKey of [...Object.keys(LAYERS), 'officialLiquorVends', 'crashZones2024']) {
    const count = f.properties[layerKey];
    f.properties[layerKey + 'Density'] = f.properties.areaSqKm > 0 ? Math.round((count / f.properties.areaSqKm) * 100) / 100 : null;
  }
});

console.log('assigned:', totalAssigned);
console.log('outside every ward:', totalOutside);
console.log('district assignment: matched', districtAssigned, 'unmatched', districtUnassigned);
console.log('sample ward (Chandni Chowk):', JSON.stringify(wards.features.find(f => f.properties.Ward_Name === 'CHANDNI CHOWK')?.properties));

const out = {
  type: 'FeatureCollection',
  metadata: {
    source: 'DataMeet Municipal_Spatial_Data (CC-BY-SA 2.5 India), scraped from ArcGIS Online',
    sourceUrl: 'https://github.com/datameet/Municipal_Spatial_Data/tree/master/Delhi',
    vintageNote: '290 features (273 named wards + 9 NDMC + 8 Cantonment charges) — ward count does not match the current 250-ward post-2022-unification structure, so this is most likely the pre-2022 delimitation. Used here as a finer spatial grid for point-density aggregation only, not as an official/current administrative boundary.',
    infraLayers: 'busStops, atms, alcoholShops, surveillance, officialLiquorVends — aggregated by point-in-polygon from the same OSM-derived/official point data used elsewhere in this project.',
    crashLayers: 'crashZones2024, crashZones2024FatalSum — 2024 crash-prone zones aggregated by point-in-polygon. Both the liquor-vend and 2024 crash-zone source coordinates are approximate (locality/landmark centroids, not verified geotags); every ward count derived from them carries wardAssignmentBasis: exploratory.',
    highInjuryNetwork: 'highInjuryNetwork (bool), highInjuryNetworkRank (int|null) — Vision Zero terminology for the smallest set of wards that together account for half of all ward-assigned 2024 fatal crashes, ranked by crashZones2024FatalSum descending. A computed cutoff (recomputed on every rebuild), not an arbitrary top-N. Same exploratory basis as crashZones2024.',
    inheritedCrimeLayers: "totalIPCDensity2024Inherited, crimeAgainstWomenDensity2024Inherited — no crime data is published below the 15-district level; these fields copy the enclosing district's 2024 crime density onto every ward inside it via point-in-polygon (ward bbox-center vs. district boundary). District-resolution, not ward-resolution — flagged wardMetricBasis: district-inherited.",
    wardAssignmentBasis: 'exploratory',
    wardMetricBasis: 'district-inherited (for totalIPCDensity2024Inherited, crimeAgainstWomenDensity2024Inherited only)',
  },
  features: wards.features,
};
fs.writeFileSync(path.join(ROOT, 'data/delhi_wards_infra.geojson'), JSON.stringify(out));
console.log('Wrote data/delhi_wards_infra.geojson —', out.features.length, 'wards,', (JSON.stringify(out).length / 1024).toFixed(1), 'KB');
