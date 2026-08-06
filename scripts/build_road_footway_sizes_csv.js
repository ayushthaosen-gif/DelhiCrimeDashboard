// Exports per-segment road and footway "size" data to CSV: classification tier (highway=*, always
// present), lane count (OSM lanes= tag, ~39% of major roads), and explicit width (OSM width= tag,
// under 1% of segments). No dedicated official Delhi dataset with actual measured road/footpath
// widths was found -- data.gov.in's "surfaced length of PWD roads by width" is a state-level
// aggregate behind an API key, not per-segment Delhi geometry, and wasn't pursued further. Rather
// than estimate widths from classification, this reports exactly what's tagged and leaves
// everything else blank -- this project's standing null policy: never invent a number to fill a gap.
//
//   node scripts/build_road_footway_sizes_csv.js

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'source');
const boundaries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), 'utf8'));

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    const hit = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (hit) inside = !inside;
  }
  return inside;
}
function pointInGeometry(lon, lat, g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.some(p => pointInRing(lon, lat, p[0]) && !p.slice(1).some(r => pointInRing(lon, lat, r)));
}
function districtOf(lon, lat) {
  const f = boundaries.features.find(f => pointInGeometry(lon, lat, f.geometry));
  return f ? f.properties.district : null;
}
function haversineMeters(a, b) {
  const R = 6371000, p = Math.PI / 180;
  const dLat = (b.lat - a.lat) * p, dLon = (b.lon - a.lon) * p;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(q));
}
function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCsv(headers, rows) {
  return [headers.join(',')].concat(rows.map(r => headers.map(h => csvEscape(r[h])).join(','))).join('\r\n') + '\r\n';
}

// ── Roads (data/source/osm_major_roads_delhi_raw.json -- motorway/trunk/primary/secondary + links,
// fetched with `out geom`, so geometry is embedded inline per way, same shape as the footways file) ──
const roadsRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_major_roads_delhi_raw.json'), 'utf8'));
const roadRows = [];
let roadsNoGeometry = 0, roadsOutside = 0;
roadsRaw.elements.filter(e => e.type === 'way').forEach(w => {
  if (!Array.isArray(w.geometry) || w.geometry.length < 2) { roadsNoGeometry++; return; }
  let lengthM = 0;
  for (let i = 1; i < w.geometry.length; i++) lengthM += haversineMeters(w.geometry[i - 1], w.geometry[i]);
  const mid = w.geometry[Math.floor(w.geometry.length / 2)];
  const district = districtOf(mid.lon, mid.lat);
  if (!district) { roadsOutside++; return; }
  const t = w.tags || {};
  roadRows.push({
    osm_way_id: w.id,
    name: t.name || '',
    highway_class: t.highway || '',
    lanes: t.lanes || '',
    width_m: t.width || '',
    surface: t.surface || '',
    district,
    length_m: Math.round(lengthM),
  });
});
const roadHeaders = ['osm_way_id', 'name', 'highway_class', 'lanes', 'width_m', 'surface', 'district', 'length_m'];
fs.writeFileSync(path.join(ROOT, 'data/road_sizes.csv'), toCsv(roadHeaders, roadRows));
const roadsWithLanes = roadRows.filter(r => r.lanes !== '').length;
const roadsWithWidth = roadRows.filter(r => r.width_m !== '').length;
console.log('Wrote data/road_sizes.csv —', roadRows.length, 'road segments (', roadsOutside, 'outside district polygons,', roadsNoGeometry, 'without usable geometry, dropped ).');
console.log('  lanes tagged:', roadsWithLanes, '(' + (100 * roadsWithLanes / roadRows.length).toFixed(1) + '%) — width tagged:', roadsWithWidth, '(' + (100 * roadsWithWidth / roadRows.length).toFixed(1) + '%)');

// ── Footways (data/source/osm_footways_delhi_raw.json) ──
const footwaysRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_footways_delhi_raw.json'), 'utf8'));
const seenWayIds = new Set();
const footwayRows = [];
let footwaysOutside = 0, footwaysDuped = 0;
footwaysRaw.elements.forEach(w => {
  if (seenWayIds.has(w.id)) { footwaysDuped++; return; } // quadrant-boundary queries can return the same way twice
  seenWayIds.add(w.id);
  if (!Array.isArray(w.geometry) || w.geometry.length < 2) return;
  let lengthM = 0;
  for (let i = 1; i < w.geometry.length; i++) lengthM += haversineMeters(w.geometry[i - 1], w.geometry[i]);
  const mid = w.geometry[Math.floor(w.geometry.length / 2)];
  const district = districtOf(mid.lon, mid.lat);
  if (!district) { footwaysOutside++; return; }
  const t = w.tags || {};
  footwayRows.push({
    osm_way_id: w.id,
    name: t.name || '',
    highway_class: t.highway || '',
    footway_tag: t.footway || '',
    width_m: t.width || '',
    surface: t.surface || '',
    district,
    length_m: Math.round(lengthM),
  });
});
const footwayHeaders = ['osm_way_id', 'name', 'highway_class', 'footway_tag', 'width_m', 'surface', 'district', 'length_m'];
fs.writeFileSync(path.join(ROOT, 'data/footway_sizes.csv'), toCsv(footwayHeaders, footwayRows));
const footwaysWithWidth = footwayRows.filter(r => r.width_m !== '').length;
console.log('Wrote data/footway_sizes.csv —', footwayRows.length, 'footway/sidewalk segments (', footwaysOutside, 'outside district polygons,', footwaysDuped, 'quadrant-overlap duplicates removed ).');
console.log('  width tagged:', footwaysWithWidth, '(' + (100 * footwaysWithWidth / footwayRows.length).toFixed(1) + '%)');
