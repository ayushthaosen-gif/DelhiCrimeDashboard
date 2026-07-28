// Aggregates the existing infrastructure point layers (bus stops, ATMs, liquor shops, CCTV)
// into per-ward counts/densities using Delhi's ward boundaries, for a finer-grained ward-level
// bivariate mode on the interactive map. Crime data does NOT exist at ward level (NCRB publishes
// only at the 15 Delhi-Police-district level, a different administrative geography from MCD/NDMC
// wards), so this produces an infra-vs-infra pairing, not crime-vs-infra.
//
// Ward source: DataMeet Municipal_Spatial_Data (CC-BY-SA 2.5 India), scraped from an ArcGIS Online
// map. 290 features (273 named MCD wards + 9 NDMC charges + 8 Delhi Cantonment charges) -- the
// count (273, not 250) and naming style indicate this is most likely the pre-2022-unification
// ward delimitation, not the current 250-ward structure. Used here only as a finer spatial grid
// for aggregating point density, not for anything requiring official/current ward boundaries.
//
//   node build_ward_infra.js

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const SCRATCH_WARDS = 'C:/Users/ayush/AppData/Local/Temp/claude/C--Users-ayush/2c91efc8-fa16-49c9-baec-ebb26c6c5bd0/scratchpad/wards/Delhi_Wards.geojson';

const wards = JSON.parse(fs.readFileSync(SCRATCH_WARDS, 'utf8'));
const poi = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers_latlng.json'), 'utf8'));

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

wards.features.forEach(f => {
  delete f.properties._bbox;
  for (const layerKey of Object.keys(LAYERS)) {
    const count = f.properties[layerKey];
    f.properties[layerKey + 'Density'] = f.properties.areaSqKm > 0 ? Math.round((count / f.properties.areaSqKm) * 100) / 100 : null;
  }
});

console.log('assigned:', totalAssigned);
console.log('outside every ward:', totalOutside);
console.log('sample ward (Chandni Chowk):', JSON.stringify(wards.features.find(f => f.properties.Ward_Name === 'CHANDNI CHOWK')?.properties));

const out = {
  type: 'FeatureCollection',
  metadata: {
    source: 'DataMeet Municipal_Spatial_Data (CC-BY-SA 2.5 India), scraped from ArcGIS Online',
    sourceUrl: 'https://github.com/datameet/Municipal_Spatial_Data/tree/master/Delhi',
    vintageNote: '290 features (273 named wards + 9 NDMC + 8 Cantonment charges) — ward count does not match the current 250-ward post-2022-unification structure, so this is most likely the pre-2022 delimitation. Used here as a finer spatial grid for point-density aggregation only, not as an official/current administrative boundary.',
    infraLayers: 'busStops, atms, alcoholShops, surveillance — aggregated by point-in-polygon from the same OSM-derived point data already used for the 15-district metrics elsewhere in this project. No crime data exists at ward level.',
  },
  features: wards.features,
};
fs.writeFileSync(path.join(ROOT, 'data/delhi_wards_infra.geojson'), JSON.stringify(out));
console.log('Wrote data/delhi_wards_infra.geojson —', out.features.length, 'wards,', (JSON.stringify(out).length / 1024).toFixed(1), 'KB');
