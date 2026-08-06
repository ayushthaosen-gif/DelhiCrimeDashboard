// Processes raw OSM/Overpass snapshots into dashboard-ready point layers (traffic signals,
// pedestrian crossings, hospitals, street lamps) and a district-level footpath/sidewalk coverage
// metric.
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

// ── Street lamps (OSM highway=street_lamp) — point layer stays independent of the existing PAPL
// Open Transit Survey streetlight data (data/streetlight_grid.json / the "Streetlights" INFRA
// metric): OSM only gives point locations, PAPL only gives district-level counts, so there's no
// point-for-point reconciliation to do. See the district-level COMBINED metric below for the
// actual PAPL+OSM merge.
const streetLampsRaw = JSON.parse(fs.readFileSync(path.join(SRC, 'osm_street_lamps_delhi_raw.json'), 'utf8'));
const streetLamps = [];
const streetLampCountByDistrict = {};
let streetLampsOutside = 0;
streetLampsRaw.elements.forEach(e => {
  if (e.type !== 'node') return;
  const d = districtOf(e.lon, e.lat);
  if (!d) { streetLampsOutside++; return; }
  const t = e.tags || {};
  const label = 'Street lamp' + (t.lamp_type ? ' (' + t.lamp_type + ')' : '');
  streetLamps.push([e.lat, e.lon, label]);
  streetLampCountByDistrict[d] = (streetLampCountByDistrict[d] || 0) + 1;
});
console.log('Street lamps:', streetLamps.length, '(', streetLampsOutside, 'outside district polygons, dropped)');

// ── Combined PAPL + OSM streetlight metric, per district ──
// PAPL (data/dashboard_final.json's surveyPoints/totalLights) is a real government-commissioned
// physical survey, but only covers 9 of 15 districts (surveyPoints >= 10 -- the same SURVEYED
// gate used everywhere else in this project). OSM's street_lamp tagging covers all 15 districts
// but far more sparsely (1,457 citywide vs. PAPL's much denser per-district counts where it does
// cover). Combined here: use PAPL's number where it's actually trustworthy (surveyed, >=10 points)
// and fall back to the OSM count only where PAPL has nothing at all -- so a district never goes
// from "no data" to a number just because OSM happened to tag a handful of lamps there, but also
// never stays blank when a real, if sparser, count exists. `combined_source` on every row says
// exactly which one was used -- never silently blended into one number.
const SURVEYED = new Set(['Central', 'East', 'New Delhi', 'North', 'Shahdara', 'South', 'South-East', 'South-West', 'West']);
const combinedStreetlights = dashboardFinal.districts.map(d => {
  const paplSurveyed = SURVEYED.has(d.district) && (d.surveyPoints || 0) >= 10;
  const osmCount = streetLampCountByDistrict[d.district] || 0;
  const combinedCount = paplSurveyed ? d.totalLights : osmCount;
  const combinedSource = paplSurveyed ? 'PAPL survey' : (osmCount > 0 ? 'OSM (PAPL not surveyed)' : 'no data');
  return {
    district: d.district,
    papl_survey_points: d.surveyPoints || 0,
    papl_total_lights: paplSurveyed ? d.totalLights : null,
    papl_density_per_km2: paplSurveyed ? d.lightDensityPerKm2 : null,
    osm_street_lamp_count: osmCount,
    osm_density_per_km2: d.areaSqKm ? Math.round((osmCount / d.areaSqKm) * 1000) / 1000 : null,
    combined_count: combinedCount || null,
    combined_density_per_km2: (combinedCount && d.areaSqKm) ? Math.round((combinedCount / d.areaSqKm) * 1000) / 1000 : null,
    combined_source: combinedSource,
  };
});
function csvEscapeStreetlights(v) { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
const slHeaders = Object.keys(combinedStreetlights[0]);
const slCsv = [slHeaders.join(',')].concat(combinedStreetlights.map(r => slHeaders.map(h => csvEscapeStreetlights(r[h])).join(','))).join('\r\n') + '\r\n';
fs.writeFileSync(path.join(ROOT, 'data/streetlights_combined_by_district.csv'), slCsv);
fs.writeFileSync(path.join(ROOT, 'data/streetlights_combined_by_district.json'), JSON.stringify(combinedStreetlights, null, 2));
const paplCount = combinedStreetlights.filter(r => r.combined_source === 'PAPL survey').length;
const osmFallbackCount = combinedStreetlights.filter(r => r.combined_source === 'OSM (PAPL not surveyed)').length;
console.log('Combined streetlights: ' + paplCount + ' districts from PAPL survey, ' + osmFallbackCount + ' districts falling back to OSM (PAPL not surveyed there). Wrote data/streetlights_combined_by_district.csv/.json');

fs.writeFileSync(path.join(ROOT, 'data/poi_markers_infra_extras.json'), JSON.stringify({ trafficSignals, pedestrianCrossings, hospitals, streetLamps }, null, 2));
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
