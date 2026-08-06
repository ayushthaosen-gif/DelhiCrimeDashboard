// Processes the three raw OSM/Overpass snapshots from fetch_osm_infra_snapshots.js into
// dashboard-ready point layers (traffic signals, pedestrian crossings, hospitals) and a
// district-level footpath/sidewalk coverage metric.
//
// Footway/sidewalk coverage is intentionally NOT shipped to the browser as raw line geometry --
// Delhi has 11k+ footway/sidewalk ways in OSM (~5MB of geometry), which would bloat the page and
// be slow to render for a metric that's more useful as a density figure anyway. Instead this
// computes total length (km) and density (km per km²) per district here at build time, the same
// count+density shape every other INFRA[] entry already uses, so it plugs straight into the
// existing choropleth/bivariate/correlation-matrix machinery without any new UI code.
//
//   node scripts/build_infra_extras.js

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'source');

const boundaries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), 'utf8'));
const dashboardFinal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));
const areaByDistrict = {};
dashboardFinal.districts.forEach(d => { areaByDistrict[d.district] = d.areaSqKm; });

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

// ── Traffic signals + pedestrian crossings ──
const signalsRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_traffic_signals_crossings_delhi_raw.json'), 'utf8'));
const trafficSignals = [], pedestrianCrossings = [];
let signalsOutside = 0;
signalsRaw.elements.forEach(e => {
  if (e.type !== 'node') return;
  const d = districtOf(e.lon, e.lat);
  if (!d) { signalsOutside++; return; }
  const name = (e.tags && e.tags.name) || (e.tags.highway === 'traffic_signals' ? 'Traffic signal' : 'Pedestrian crossing');
  (e.tags.highway === 'traffic_signals' ? trafficSignals : pedestrianCrossings).push([e.lat, e.lon, name]);
});
console.log('Traffic signals:', trafficSignals.length, '— Pedestrian crossings:', pedestrianCrossings.length, '(', signalsOutside, 'outside district polygons, dropped)');

// ── Hospitals ──
const hospitalsRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_hospitals_delhi_raw.json'), 'utf8'));
const seenHospitalIds = new Set();
const hospitals = [];
let hospitalsOutside = 0, hospitalsDuped = 0;
hospitalsRaw.elements.forEach(e => {
  const key = e.type + e.id;
  if (seenHospitalIds.has(key)) { hospitalsDuped++; return; }
  seenHospitalIds.add(key);
  const lat = e.type === 'node' ? e.lat : (e.center && e.center.lat);
  const lon = e.type === 'node' ? e.lon : (e.center && e.center.lon);
  if (lat == null || lon == null) return;
  const d = districtOf(lon, lat);
  if (!d) { hospitalsOutside++; return; }
  const name = (e.tags && (e.tags.name || e.tags['name:en'])) || 'Hospital (unnamed in OSM)';
  hospitals.push([lat, lon, name]);
});
console.log('Hospitals:', hospitals.length, '(', hospitalsOutside, 'outside district polygons,', hospitalsDuped, 'duplicate elements skipped )');

fs.writeFileSync(path.join(ROOT, 'data/poi_markers_infra_extras.json'), JSON.stringify({ trafficSignals, pedestrianCrossings, hospitals }, null, 2));
console.log('Wrote data/poi_markers_infra_extras.json');

// ── Footway/sidewalk coverage ──
const footwaysRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_footways_delhi_raw.json'), 'utf8'));
const seenWayIds = new Set();
const lengthByDistrict = {}, segmentsByDistrict = {};
let footwaysOutside = 0, footwaysDuped = 0;
footwaysRaw.elements.forEach(w => {
  if (seenWayIds.has(w.id)) { footwaysDuped++; return; } // quadrant-boundary queries can return the same way twice
  seenWayIds.add(w.id);
  if (!Array.isArray(w.geometry) || w.geometry.length < 2) return;
  let lengthM = 0;
  for (let i = 1; i < w.geometry.length; i++) lengthM += haversineMeters(w.geometry[i - 1], w.geometry[i]);
  const mid = w.geometry[Math.floor(w.geometry.length / 2)];
  const d = districtOf(mid.lon, mid.lat);
  if (!d) { footwaysOutside++; return; }
  lengthByDistrict[d] = (lengthByDistrict[d] || 0) + lengthM;
  segmentsByDistrict[d] = (segmentsByDistrict[d] || 0) + 1;
});
const footwayCoverage = Object.keys(areaByDistrict).map(district => {
  const lengthKm = Math.round((lengthByDistrict[district] || 0) / 100) / 10; // 1 decimal place
  const area = areaByDistrict[district];
  return {
    district,
    footwayLengthKm: lengthKm,
    footwayDensityKmPerKm2: area ? Math.round((lengthKm / area) * 1000) / 1000 : null,
    footwaySegmentCount: segmentsByDistrict[district] || 0,
  };
});
console.log('Footway coverage:', footwayCoverage.reduce((a, r) => a + r.footwayLengthKm, 0).toFixed(1), 'km total across', Object.keys(lengthByDistrict).length, 'districts (', footwaysOutside, 'ways outside district polygons,', footwaysDuped, 'quadrant-overlap duplicates removed )');

fs.writeFileSync(path.join(ROOT, 'data/delhi_footway_coverage.json'), JSON.stringify(footwayCoverage, null, 2));
console.log('Wrote data/delhi_footway_coverage.json');
