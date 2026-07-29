// Generates liquor_crash_analysis.html — a standalone page (same pattern as
// interactive_map.html: Leaflet + CARTO Voyager tiles via CDN, kept separate from the main
// dashboard because it needs external network requests at view-time) exploring spatial
// proximity between Delhi's official liquor vends and the 2024 named crash-prone zones.
//
// IMPORTANT: every coordinate on this page is approximate (locality/sector centroids for
// vends, landmark/intersection centres for crash zones, not verified addresses or official
// Delhi Traffic Police geotags). Proximity shown here means broad spatial association only —
// never causation. See build_liquor_crash_proximity.js for the preprocessing this page embeds.
//
//   node build_liquor_crash_proximity.js   (run first, produces the derived files below)
//   node build_liquor_crash_analysis.js

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const vendProximity = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/liquor_vend_crash_proximity_2024.geojson'), 'utf8'));
const zoneProximity = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zone_liquor_proximity_2024.geojson'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/liquor_crash_proximity_summary_2024.json'), 'utf8'));
const buffers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_250m_buffers_approx.geojson'), 'utf8'));
const allVendsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
const osmOnlyVends = allVendsRaw.features.filter(f => f.properties.record_source === 'OpenStreetMap').map(f => ({
  id: f.id, name: f.properties.name, longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1],
  estimatedAccuracyM: f.properties.estimated_accuracy_m, osmUrl: f.properties.source_url,
}));
const roadExtra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/road_safety_extra_2023_2024.json'), 'utf8'));

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delhi Liquor Vends × Crash-Prone Zones (2024) — Spatial Exploration</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<style>
:root {
  --night: #1c2331; --paper: #edeae2; --paper-raised: #f6f4ee;
  --amber: #e3a13b; --rust: #b14a34; --slate: #626b78; --bone: #e8e4da;
  --bg: var(--paper); --surface: var(--paper-raised); --border: #d8d3c6;
  --text: var(--night); --text-dim: var(--slate); --good: #3f7d52;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #14181f; --surface: #1c2331; --border: #303a4c; --text: var(--bone); --text-dim: #9aa3b2; }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
body { display: flex; flex-direction: column; }
a { color: inherit; }
#topbar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; row-gap: 6px; flex: 0 0 auto; }
#topbar h1 { font-size: 14px; margin: 0; font-weight: 800; margin-right: 6px; }
#topbar a.back { font-size: 13px; text-decoration: none; border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; background: var(--bg); margin-left: auto; }
#topbar select, #topbar input[type=text] { font: inherit; font-size: 12.5px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
.seg { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { font: inherit; font-size: 12px; padding: 6px 10px; border: none; background: var(--bg); color: var(--text-dim); cursor: pointer; border-right: 1px solid var(--border); }
.seg button:last-child { border-right: none; }
.seg button.active { background: var(--rust); color: #fff; }
#banner { flex: 0 0 auto; background: rgba(227,161,59,0.14); border-bottom: 1px solid var(--border); padding: 8px 16px; font-size: 11.5px; color: var(--text-dim); line-height: 1.5; }
#banner b { color: var(--text); }
#banner .toggle-link { cursor: pointer; text-decoration: underline; color: var(--text); }
#bannerFull { display: none; margin-top: 6px; }
#bannerFull.show { display: block; }
#filterBar { flex: 0 0 auto; display: flex; gap: 10px; align-items: center; padding: 8px 16px; background: var(--bg); border-bottom: 1px solid var(--border); flex-wrap: wrap; font-size: 12px; }
#filterBar label { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
#layersBar { flex: 0 0 auto; display: flex; gap: 10px; align-items: center; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; font-size: 12px; }
#layersBar label { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
#mapRegion { position: relative; flex: 1 1 auto; min-height: 420px; }
#map { position: absolute; inset: 0; }
.leaflet-popup-content-wrapper { background: var(--surface); color: var(--text); }
.leaflet-popup-tip { background: var(--surface); }
.popup-title { font-weight: 800; font-size: 13px; margin-bottom: 2px; }
.popup-warn { font-size: 10.5px; color: var(--text-dim); margin-top: 6px; border-top: 1px solid var(--border); padding-top: 4px; font-style: italic; }
.shape-icon { display: block; }
.shape-icon.sq { border-radius: 2px; }
.shape-icon.tri { width: 0; height: 0; background: none !important; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom-width: 10px; border-bottom-style: solid; }
.shape-icon.dia { transform: rotate(45deg); border-radius: 2px; }
.shape-icon.dot { border-radius: 50%; }
.shape-icon.ring { border-radius: 50%; box-shadow: inset 0 0 0 2px #fff; }
.shape-icon.star { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
#content { flex: 0 0 auto; padding: 16px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 20px; }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
.card h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--text-dim); }
.card .row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
.card .row b { font-weight: 700; }
table.data-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 20px; }
table.data-table th { text-align: left; padding: 7px 10px; color: var(--text-dim); border-bottom: 1px solid var(--border); cursor: pointer; white-space: nowrap; }
table.data-table th:hover { color: var(--text); }
table.data-table td { padding: 6px 10px; border-bottom: 1px solid var(--border); }
.section-title { font-size: 16px; font-weight: 800; margin: 20px 0 10px; }
.dl-btn { font: inherit; font-size: 12px; padding: 7px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; margin-right: 8px; }
.priority-config { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; }
.priority-config label { margin-right: 12px; }
.priority-config input { width: 50px; }
</style>
</head>
<body>
<div id="topbar">
  <h1>Delhi Liquor Vends × Crash-Prone Zones (2024)</h1>
  <label>Distance band: <div class="seg" id="bandToggle"><button data-band="500">500m</button><button class="active" data-band="1000">1km</button><button data-band="2000">2km</button></div></label>
  <a class="back" href="delhi_safety_dashboard.html">← Back to dashboard</a>
</div>
<div id="banner">
  <b>Exploratory tool — spatial association only, not causation.</b> Most liquor-vend coordinates are approximate locality/sector centres; all crash-zone coordinates are approximate landmark/intersection centres, not official Delhi Traffic Police geotags.
  <span class="toggle-link" id="bannerToggle">Read full methodology ▾</span>
  <div id="bannerFull">
    <p>${summary.methodologyWarning}</p>
    <p><b>Coverage note:</b> ${summary.coverageWarning}</p>
  </div>
</div>
<div id="filterBar">
  <label>Operator: <select id="fOperator"><option value="">All official operators</option></select></label>
  <label>Vend confidence: <select id="fVendConfidence"><option value="">Any</option></select></label>
  <label>Zone confidence: <select id="fZoneConfidence"><option value="">Any</option></select></label>
  <label>Road: <select id="fRoad"><option value="">All roads</option></select></label>
</div>
<div id="layersBar">
  <label><input type="checkbox" id="lyVends" checked> Official vends <span id="cntVends"></span></label>
  <label><input type="checkbox" id="lyOsm"> OSM-only shops <span id="cntOsm"></span></label>
  <label><input type="checkbox" id="lyZones" checked> Crash zones <span id="cntZones"></span></label>
  <label><input type="checkbox" id="lyBuffers"> 250m buffers</label>
  <label><input type="checkbox" id="lyBlackspot"> Black spots <span id="cntBlackspot"></span></label>
  <label><input type="checkbox" id="lyNight"> Night-risk <span id="cntNight"></span></label>
  <label><input type="checkbox" id="lyHitRun"> Hit-and-run <span id="cntHitRun"></span></label>
  <label><input type="checkbox" id="lyPed"> Pedestrian-risk <span id="cntPed"></span></label>
  <label><input type="checkbox" id="lyTwoWheeler"> Two-wheeler-risk <span id="cntTwoWheeler"></span></label>
  <label><input type="checkbox" id="lyHtv"> HTV-risk <span id="cntHtv"></span></label>
  <label><input type="checkbox" id="lyCctv"> CCTV-priority <span id="cntCctv"></span></label>
</div>
<div id="mapRegion"><div id="map"></div></div>
<div id="content">
  <div class="section-title">Insight cards (report-level totals, 2024)</div>
  <div class="cards" id="insightCards"></div>

  <div class="section-title">Vend-centric table</div>
  <button class="dl-btn" id="dlVendsCsv">⬇ CSV</button><button class="dl-btn" id="dlVendsGeo">⬇ GeoJSON</button>
  <div style="overflow-x:auto;"><table class="data-table" id="vendTable"></table></div>

  <div class="section-title">Crash-zone-centric table</div>
  <button class="dl-btn" id="dlZonesCsv">⬇ CSV</button><button class="dl-btn" id="dlZonesGeo">⬇ GeoJSON</button>
  <div style="overflow-x:auto;"><table class="data-table" id="zoneTable"></table></div>

  <div class="section-title">Corridor summary (named zones only — see insight card 3 for official Table 6.33 road totals)</div>
  <div style="overflow-x:auto;"><table class="data-table" id="corridorTable"></table></div>

  <div class="section-title">Operator summary</div>
  <p style="font-size:12px;color:var(--text-dim);max-width:70ch;">Operator differences are not adjusted for where each operator's vends happen to be located across Delhi and should not be interpreted as an operator effect.</p>
  <div style="overflow-x:auto;"><table class="data-table" id="operatorTable"></table></div>

  <div class="section-title">Exploratory priority index (optional, non-official)</div>
  <p style="font-size:12px;color:var(--text-dim);max-width:70ch;">Not a probability or causal-risk score. A configurable weighted sum to help sort zones for exploration only — raw values are always shown alongside.</p>
  <div class="priority-config" id="priorityConfig"></div>
  <div style="overflow-x:auto;"><table class="data-table" id="priorityTable"></table></div>
</div>

<script>
const VENDS = ${JSON.stringify(vendProximity.features.map(f => ({ ...f.properties, longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1] })))};
const OSM_VENDS = ${JSON.stringify(osmOnlyVends)};
const ZONES = ${JSON.stringify(zoneProximity.features.map(f => ({ ...f.properties, longitude: f.geometry.coordinates[0], latitude: f.geometry.coordinates[1] })))};
const BUFFERS = ${JSON.stringify(buffers)};
const SUMMARY = ${JSON.stringify(summary)};
const ROAD_2024 = ${JSON.stringify(roadExtra.roadSummary['2024'])};
const REPORT = SUMMARY.reportMetrics;

let distanceBand = 1000; // meters — default per methodology, since most coordinates are approximate
const filters = { operator: '', vendConfidence: '', zoneConfidence: '', road: '' };

function fmtNum(n) { return n == null ? '—' : n.toLocaleString('en-IN'); }
function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function bandKey(suffix) { return distanceBand === 500 ? '500m' + suffix : distanceBand === 1000 ? '1km' + suffix : '2km' + suffix; }
function bandField(prefix) { return prefix + (distanceBand === 500 ? '500m' : distanceBand === 1000 ? '1km' : '2km'); }

// ── Populate filter dropdowns from the actual data (no hardcoded option lists to go stale) ──
function uniqueSorted(arr) { return [...new Set(arr.filter(Boolean))].sort(); }
document.getElementById('fOperator').innerHTML += uniqueSorted(VENDS.map(v=>v.operator)).map(o => '<option value="'+esc(o)+'">'+esc(o)+'</option>').join('');
document.getElementById('fVendConfidence').innerHTML += uniqueSorted(VENDS.map(v=>v.coordinateConfidence)).map(c => '<option value="'+c+'">'+c+'</option>').join('');
document.getElementById('fZoneConfidence').innerHTML += uniqueSorted(ZONES.map(z=>z.coordinateConfidence)).map(c => '<option value="'+c+'">'+c+'</option>').join('');
document.getElementById('fRoad').innerHTML += uniqueSorted(ZONES.map(z=>z.roadName)).map(r => '<option value="'+esc(r)+'">'+esc(r)+'</option>').join('');

function filteredVends() {
  return VENDS.filter(v =>
    (!filters.operator || v.operator === filters.operator) &&
    (!filters.vendConfidence || v.coordinateConfidence === filters.vendConfidence)
  );
}
function filteredZones() {
  return ZONES.filter(z =>
    (!filters.zoneConfidence || z.coordinateConfidence === filters.zoneConfidence) &&
    (!filters.road || z.roadName === filters.road) &&
    (!document.getElementById('lyBlackspot').checked || z.blackspot) &&
    (!document.getElementById('lyNight').checked || z.nightRisk) &&
    (!document.getElementById('lyHitRun').checked || z.hitAndRunRisk) &&
    (!document.getElementById('lyPed').checked || z.pedestrianRisk) &&
    (!document.getElementById('lyTwoWheeler').checked || z.twoWheelerRisk) &&
    (!document.getElementById('lyHtv').checked || z.htvRisk) &&
    (!document.getElementById('lyCctv').checked || z.cctvPriorityCandidate)
  );
}

const map = L.map('map', { zoomControl: true }).setView([28.62, 77.21], 11);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19, subdomains: 'abcd',
}).addTo(map);

function shapeIcon(color, shape, size) {
  const s = size || 12;
  const cls = { square: 'sq', triangle: 'tri', diamond: 'dia', dot: 'dot', ring: 'ring', star: 'star' }[shape] || 'dot';
  const style = shape === 'triangle'
    ? 'border-bottom-color:' + color + ';'
    : 'width:' + s + 'px;height:' + s + 'px;background:' + color + ';border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)' + (shape==='ring' ? ',inset 0 0 0 2px #fff' : '') + ';';
  return L.divIcon({ className: 'shape-icon ' + cls, html: '<div class="shape-icon ' + cls + '" style="' + style + '"></div>', iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -s/2] });
}

function vendPopup(v) {
  return '<div class="popup-title">' + esc(v.name) + '</div>' +
    '<div>' + esc(v.operator || 'Unknown operator') + (v.vendCategory ? ' · ' + esc(v.vendCategory) : '') + '</div>' +
    '<div>' + (v.coordinateIsApproximate ? 'Approximate coordinate' : 'Exact coordinate') + (v.matchedArea ? ' (' + esc(v.matchedArea) + ')' : '') + ' — ±' + fmtNum(v.estimatedAccuracyM) + 'm</div>' +
    '<div>Nearest crash zone: <b>' + esc(v.nearestCrashZone || 'none mapped') + '</b>' + (v.nearestCrashZoneDistanceM != null ? ' (~' + fmtNum(v.nearestCrashZoneDistanceM) + 'm, proximity confidence: ' + v.proximityConfidence + ')' : '') + '</div>' +
    '<div>Within ' + (distanceBand/1000) + 'km: ' + v[bandField('zonesWithin')] + ' zones, ' + v[bandField('fatalCrashesWithin')] + ' fatal crashes, ' + v[bandField('totalCrashesWithin')] + ' total crashes</div>' +
    '<div class="popup-warn">' + esc(v.analysisWarning) + '</div>';
}
function zonePopup(z) {
  return '<div class="popup-title">' + esc(z.name) + '</div>' +
    '<div>' + esc(z.roadName || '') + ' · ' + fmtNum(z.simpleCrashes) + ' simple / ' + fmtNum(z.fatalCrashes) + ' fatal / ' + fmtNum(z.totalCrashes) + ' total crashes</div>' +
    '<div>' + (z.blackspot ? 'Black spot (rank ' + z.blackspotRank + ') · ' : '') + [z.pedestrianRisk&&'pedestrian', z.twoWheelerRisk&&'two-wheeler', z.htvRisk&&'HTV', z.nightRisk&&'night', z.hitAndRunRisk&&'hit-and-run', z.cctvPriorityCandidate&&'CCTV-priority'].filter(Boolean).join(', ') + '</div>' +
    '<div>Official vends within ' + (distanceBand/1000) + 'km: <b>' + z[bandField('officialVendsWithin')] + '</b> (OSM-only: ' + z[bandField('osmOnlyShopsWithin')] + ')</div>' +
    '<div>Coordinate confidence: ' + esc(z.coordinateConfidence) + ' (±' + fmtNum(z.estimatedAccuracyM) + 'm) — not a Delhi Traffic Police geotag</div>' +
    '<div class="popup-warn">' + esc(z.analysisWarning) + '</div>';
}

const vendLayer = L.layerGroup(), osmLayer = L.layerGroup(), zoneLayer = L.layerGroup(), bufferLayer = L.layerGroup();
const blackspotLayer = L.layerGroup(), nightLayer = L.layerGroup(), hitRunLayer = L.layerGroup(), pedLayer = L.layerGroup(), twLayer = L.layerGroup(), htvLayer = L.layerGroup(), cctvLayer = L.layerGroup();

function renderMapLayers() {
  [vendLayer, osmLayer, zoneLayer, bufferLayer, blackspotLayer, nightLayer, hitRunLayer, pedLayer, twLayer, htvLayer, cctvLayer].forEach(l => l.clearLayers());

  const vends = filteredVends();
  vends.forEach(v => {
    L.marker([v.latitude, v.longitude], { icon: shapeIcon('#8b2f5e', 'diamond', v.coordinateIsApproximate ? 10 : 13) })
      .bindPopup(vendPopup(v)).addTo(vendLayer);
  });
  document.getElementById('cntVends').textContent = '(' + vends.length + ')';

  OSM_VENDS.forEach(v => {
    L.marker([v.latitude, v.longitude], { icon: shapeIcon('#0f766e', 'dot', 11) })
      .bindPopup('<div class="popup-title">' + esc(v.name) + '</div><div>OSM-only liquor shop (exact coordinate, ±' + v.estimatedAccuracyM + 'm)</div><div><a href="' + v.osmUrl + '" target="_blank" rel="noopener">View on OpenStreetMap</a></div>')
      .addTo(osmLayer);
  });
  document.getElementById('cntOsm').textContent = '(' + OSM_VENDS.length + ')';

  const zones = filteredZones();
  zones.forEach(z => {
    const t = Math.max(0, Math.min(1, ((z.fatalCrashes||0) - 1) / 10));
    L.circleMarker([z.latitude, z.longitude], { radius: 5 + t*5, color: '#fff', weight: 1, fillColor: '#b14a34', fillOpacity: 0.55 + t*0.4 })
      .bindPopup(zonePopup(z)).addTo(zoneLayer);
    if (z.blackspot) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#e3a13b', 'star', 14) }).bindPopup(zonePopup(z)).addTo(blackspotLayer);
    if (z.nightRisk) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#1c2331', 'ring', 10) }).bindPopup(zonePopup(z)).addTo(nightLayer);
    if (z.hitAndRunRisk) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#0891b2', 'triangle', 11) }).bindPopup(zonePopup(z)).addTo(hitRunLayer);
    if (z.pedestrianRisk) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#3f7d52', 'square', 10) }).bindPopup(zonePopup(z)).addTo(pedLayer);
    if (z.twoWheelerRisk) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#d4af37', 'square', 10) }).bindPopup(zonePopup(z)).addTo(twLayer);
    if (z.htvRisk) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#7c3aed', 'triangle', 11) }).bindPopup(zonePopup(z)).addTo(htvLayer);
    if (z.cctvPriorityCandidate) L.marker([z.latitude, z.longitude], { icon: shapeIcon('#0891b2', 'ring', 13) }).bindPopup(zonePopup(z)).addTo(cctvLayer);
  });
  document.getElementById('cntZones').textContent = '(' + zones.length + ')';
  document.getElementById('cntBlackspot').textContent = '(' + zones.filter(z=>z.blackspot).length + ')';
  document.getElementById('cntNight').textContent = '(' + zones.filter(z=>z.nightRisk).length + ')';
  document.getElementById('cntHitRun').textContent = '(' + zones.filter(z=>z.hitAndRunRisk).length + ')';
  document.getElementById('cntPed').textContent = '(' + zones.filter(z=>z.pedestrianRisk).length + ')';
  document.getElementById('cntTwoWheeler').textContent = '(' + zones.filter(z=>z.twoWheelerRisk).length + ')';
  document.getElementById('cntHtv').textContent = '(' + zones.filter(z=>z.htvRisk).length + ')';
  document.getElementById('cntCctv').textContent = '(' + zones.filter(z=>z.cctvPriorityCandidate).length + ')';

  BUFFERS.features.forEach(f => {
    L.geoJSON(f, { style: { color: '#b14a34', weight: 1, fillOpacity: 0.06, dashArray: '4 3' } })
      .bindTooltip(f.properties.location_name + ' — approx. 250m crash-zone radius', { sticky: true })
      .addTo(bufferLayer);
  });
}

const LAYER_TOGGLES = [
  ['lyVends', vendLayer, true], ['lyOsm', osmLayer, false], ['lyZones', zoneLayer, true], ['lyBuffers', bufferLayer, false],
  ['lyBlackspot', blackspotLayer, false], ['lyNight', nightLayer, false], ['lyHitRun', hitRunLayer, false],
  ['lyPed', pedLayer, false], ['lyTwoWheeler', twLayer, false], ['lyHtv', htvLayer, false], ['lyCctv', cctvLayer, false],
];
LAYER_TOGGLES.forEach(([id, layer, defaultOn]) => {
  if (defaultOn) layer.addTo(map);
  document.getElementById(id).addEventListener('change', (e) => {
    if (e.target.checked) layer.addTo(map); else map.removeLayer(layer);
  });
});

document.getElementById('bandToggle').querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    distanceBand = Number(btn.dataset.band);
    document.getElementById('bandToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.band) === distanceBand));
    renderAll();
  });
});
const FILTER_ELEMENT_TO_KEY = { fOperator: 'operator', fVendConfidence: 'vendConfidence', fZoneConfidence: 'zoneConfidence', fRoad: 'road' };
Object.keys(FILTER_ELEMENT_TO_KEY).forEach(id => {
  document.getElementById(id).addEventListener('change', (e) => {
    filters[FILTER_ELEMENT_TO_KEY[id]] = e.target.value;
    renderAll();
  });
});
document.getElementById('bannerToggle').addEventListener('click', () => {
  const el = document.getElementById('bannerFull');
  el.classList.toggle('show');
  document.getElementById('bannerToggle').textContent = el.classList.contains('show') ? 'Hide full methodology ▴' : 'Read full methodology ▾';
});
['lyBlackspot','lyNight','lyHitRun','lyPed','lyTwoWheeler','lyHtv','lyCctv'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderAll);
});

// ── Insight cards (report-level totals, per the brief -- not recalculated from the incomplete
// 93-point inventory, since the report's own totals cover all 111 zones / all crashes citywide) ──
function renderInsightCards() {
  const nightCount = ZONES.filter(z=>z.nightRisk).length, dayCount = ZONES.filter(z=>z.dayRisk).length;
  const pedCount = ZONES.filter(z=>z.pedestrianRisk).length, twCount = ZONES.filter(z=>z.twoWheelerRisk).length, htvCount = ZONES.filter(z=>z.htvRisk).length;
  const hitRunCount = ZONES.filter(z=>z.hitAndRunRisk).length;
  const blackspots = ZONES.filter(z=>z.blackspot);
  const top3Roads = [...ROAD_2024].sort((a,b)=>b.fatal-a.fatal).slice(0,3);
  const cards = [
    { title: 'Overall severity (2024)', rows: [['Road crashes', fmtNum(REPORT.total_road_crashes)], ['Fatal crashes', fmtNum(REPORT.fatal_crashes)], ['Persons killed', fmtNum(REPORT.persons_killed)], ['Persons injured', fmtNum(REPORT.persons_injured)]] },
    { title: 'Concentration in crash-prone zones', rows: [['Zones reported', fmtNum(REPORT.crash_prone_zones_reported)], ['Crashes at those zones', fmtNum(REPORT.crashes_at_crash_prone_zones)], ['Fatal crashes there', fmtNum(REPORT.fatal_crashes_at_crash_prone_zones)], ['Share of all fatal crashes', Math.round(REPORT.fatal_crashes_at_crash_prone_zones/REPORT.fatal_crashes*10000)/100 + '%']] },
    { title: 'Corridor concentration', rows: top3Roads.map(r => [r.road, r.fatal + ' fatal, ' + r.zones + ' zones']) },
    { title: 'Time of day', rows: [['Night-time crash-prone zones', nightCount], ['Day-time crash-prone zones', dayCount]] },
    { title: 'Road-user vulnerability', rows: [['Pedestrian-risk zones', pedCount], ['Two-wheeler-risk zones', twCount], ['HTV-risk zones', htvCount]] },
    { title: 'Hit-and-run / CCTV priority', rows: [['Hit-and-run crash-prone zones', hitRunCount], ['Hit-and-run fatal crashes (citywide)', fmtNum(REPORT.hit_and_run_fatal_crashes)], ['Share of fatal crashes', REPORT.hit_and_run_share_of_fatal_crashes_percent + '%']] },
    { title: 'Black spots', rows: [['Black spots', blackspots.length], ['Total crashes', blackspots.reduce((a,z)=>a+(z.totalCrashes||0),0)], ['Deaths', blackspots.reduce((a,z)=>a+(z.personsKilled||0),0)], ['Injuries', blackspots.reduce((a,z)=>a+(z.personsInjured||0),0)]] },
    { title: 'Data completeness', rows: [['Zones reported (Delhi Traffic Police)', REPORT.crash_prone_zones_reported], ['Unique named locations mapped', ZONES.length], ['Zones not individually mappable', REPORT.crash_prone_zones_reported - ZONES.length]] },
  ];
  document.getElementById('insightCards').innerHTML = cards.map(c =>
    '<div class="card"><h3>' + esc(c.title) + '</h3>' + c.rows.map(r => '<div class="row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>').join('') + '</div>'
  ).join('');
}

// ── Sortable tables ──
let vendSort = { key: 'fatalCrashesWithin1km', dir: -1 }, zoneSort = { key: 'fatalCrashes', dir: -1 };
function sortRows(rows, sort) {
  return [...rows].sort((a,b) => {
    const av = a[sort.key], bv = b[sort.key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; if (bv == null) return -1;
    return av < bv ? -1*sort.dir : av > bv ? 1*sort.dir : 0;
  });
}
function makeSortableTh(label, key, sortState) {
  return '<th data-key="' + key + '">' + esc(label) + (sortState.key===key ? (sortState.dir===1?' ▲':' ▼') : '') + '</th>';
}

function renderVendTable() {
  const cols = [['Vend', 'name'], ['Operator', 'operator'], ['Confidence', 'coordinateConfidence'], ['Nearest zone', 'nearestCrashZone'], ['Distance (m)', 'nearestCrashZoneDistanceM'], ['Fatal within 1km', 'fatalCrashesWithin1km'], ['Total within 1km', 'totalCrashesWithin1km'], ['Blackspots within 1km', 'blackspotsWithin1km'], ['Night-risk within 1km', 'nightRiskZonesWithin1km'], ['Hit-run within 1km', 'hitAndRunZonesWithin1km']];
  const rows = sortRows(filteredVends(), vendSort);
  const el = document.getElementById('vendTable');
  el.innerHTML = '<thead><tr>' + cols.map(([l,k]) => makeSortableTh(l,k,vendSort)).join('') + '</tr></thead>' +
    '<tbody>' + rows.slice(0,200).map(v => '<tr>' + cols.map(([,k]) => '<td>' + esc(fmtNum(v[k])) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  el.querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.key;
    vendSort = { key: k, dir: vendSort.key===k ? -vendSort.dir : -1 };
    renderVendTable();
  }));
}
function renderZoneTable() {
  const cols = [['Zone', 'name'], ['Road', 'roadName'], ['Fatal', 'fatalCrashes'], ['Total', 'totalCrashes'], ['Blackspot', 'blackspot'], ['Night risk', 'nightRisk'], ['Hit-run risk', 'hitAndRunRisk'], ['Official vends within 1km', 'officialVendsWithin1km'], ['Nearest vend (m)', 'nearestOfficialVendDistanceM'], ['Confidence', 'coordinateConfidence']];
  const rows = sortRows(filteredZones(), zoneSort);
  const el = document.getElementById('zoneTable');
  el.innerHTML = '<thead><tr>' + cols.map(([l,k]) => makeSortableTh(l,k,zoneSort)).join('') + '</tr></thead>' +
    '<tbody>' + rows.map(z => '<tr>' + cols.map(([,k]) => '<td>' + (typeof z[k]==='boolean' ? (z[k]?'Yes':'') : esc(fmtNum(z[k]))) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  el.querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.key;
    zoneSort = { key: k, dir: zoneSort.key===k ? -zoneSort.dir : -1 };
    renderZoneTable();
  }));
}
function renderCorridorTable() {
  const cols = ['Road','Named zones','Fatal crashes','Total crashes','Blackspots','Night-risk','Hit-run','Official vends within 1km'];
  const keys = ['roadName','namedZoneCount','totalFatalCrashes','totalCrashes','blackspotCount','nightRiskZoneCount','hitAndRunZoneCount','officialVendsWithin1kmOfAnyZone'];
  const el = document.getElementById('corridorTable');
  el.innerHTML = '<thead><tr>' + cols.map(c=>'<th>'+esc(c)+'</th>').join('') + '</tr></thead>' +
    '<tbody>' + SUMMARY.corridorSummary.map(r => '<tr>' + keys.map(k=>'<td>'+esc(fmtNum(r[k]))+'</td>').join('') + '</tr>').join('') + '</tbody>';
}
function renderOperatorTable() {
  const el = document.getElementById('operatorTable');
  const cols = ['Operator','Vend count','Within 500m','Within 1km','Within 2km','Within 1km of blackspot','Within 1km of night-risk','Within 1km of hit-run'];
  el.innerHTML = '<thead><tr>' + cols.map(c=>'<th>'+esc(c)+'</th>').join('') + '</tr></thead>' +
    '<tbody>' + SUMMARY.operatorSummary.map(r => '<tr><td>' + esc(r.operator) + '</td><td>' + r.vendCount + '</td>' +
      '<td>' + r.shareWithin500m.count + ' (' + r.shareWithin500m.sharePercent + '%)</td>' +
      '<td>' + r.shareWithin1km.count + ' (' + r.shareWithin1km.sharePercent + '%)</td>' +
      '<td>' + r.shareWithin2km.count + ' (' + r.shareWithin2km.sharePercent + '%)</td>' +
      '<td>' + r.shareWithin1kmOfBlackspot.count + ' (' + r.shareWithin1kmOfBlackspot.sharePercent + '%)</td>' +
      '<td>' + r.shareWithin1kmOfNightRiskZone.count + ' (' + r.shareWithin1kmOfNightRiskZone.sharePercent + '%)</td>' +
      '<td>' + r.shareWithin1kmOfHitAndRunZone.count + ' (' + r.shareWithin1kmOfHitAndRunZone.sharePercent + '%)</td></tr>'
    ).join('') + '</tbody>';
}

// ── Exploratory priority index (explicitly non-official; configurable weights, raw values
// always shown) ──
const weights = { fatalCrash: 5, totalCrash: 1, blackspot: 10, hitAndRun: 6, night: 4, pedestrian: 3 };
function priorityIndex(z) {
  return (z.fatalCrashes||0)*weights.fatalCrash + (z.totalCrashes||0)*weights.totalCrash +
    (z.blackspot?weights.blackspot:0) + (z.hitAndRunRisk?weights.hitAndRun:0) +
    (z.nightRisk?weights.night:0) + (z.pedestrianRisk?weights.pedestrian:0);
}
function renderPriorityConfig() {
  document.getElementById('priorityConfig').innerHTML = Object.entries(weights).map(([k,v]) =>
    '<label>' + k + ': <input type="number" data-weight="' + k + '" value="' + v + '"></label>'
  ).join('');
  document.querySelectorAll('[data-weight]').forEach(inp => inp.addEventListener('change', (e) => {
    weights[e.target.dataset.weight] = Number(e.target.value) || 0;
    renderPriorityTable();
  }));
}
function renderPriorityTable() {
  const rows = filteredZones().map(z => ({ ...z, _priority: priorityIndex(z) })).sort((a,b) => b._priority - a._priority).slice(0, 30);
  const el = document.getElementById('priorityTable');
  el.innerHTML = '<thead><tr><th>Zone</th><th>Exploratory priority index</th><th>Fatal</th><th>Total</th><th>Blackspot</th><th>Hit-run</th><th>Night</th><th>Pedestrian</th></tr></thead>' +
    '<tbody>' + rows.map(z => '<tr><td>' + esc(z.name) + '</td><td><b>' + Math.round(z._priority) + '</b></td><td>' + fmtNum(z.fatalCrashes) + '</td><td>' + fmtNum(z.totalCrashes) + '</td><td>' + (z.blackspot?'Yes':'') + '</td><td>' + (z.hitAndRunRisk?'Yes':'') + '</td><td>' + (z.nightRisk?'Yes':'') + '</td><td>' + (z.pedestrianRisk?'Yes':'') + '</td></tr>').join('') + '</tbody>';
}

// ── CSV / GeoJSON export of whatever's currently filtered ──
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function toCSV(headers, rows) {
  // Object/array-valued cells (e.g. the original-properties passthrough) are JSON-encoded
  // rather than left as the default "[object Object]" string coercion, so the CSV export still
  // preserves them per the brief's "exported datasets preserve source identifiers and original
  // properties" requirement -- just as a JSON blob in one cell rather than flattened columns.
  const esc2 = v => {
    const s = (v != null && typeof v === 'object') ? JSON.stringify(v) : String(v==null?'':v);
    return /[",\\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  return [headers.map(esc2).join(','), ...rows.map(r => r.map(esc2).join(','))].join('\\n');
}
document.getElementById('dlVendsCsv').addEventListener('click', () => {
  const rows = filteredVends();
  const headers = Object.keys(rows[0] || {});
  downloadBlob(toCSV(headers, rows.map(r => headers.map(h=>r[h]))), 'liquor_vends_filtered.csv', 'text/csv');
});
document.getElementById('dlVendsGeo').addEventListener('click', () => {
  const rows = filteredVends();
  downloadBlob(JSON.stringify({ type:'FeatureCollection', features: rows.map(r => ({ type:'Feature', geometry:{type:'Point',coordinates:[r.longitude,r.latitude]}, properties: r })) }, null, 1), 'liquor_vends_filtered.geojson', 'application/geo+json');
});
document.getElementById('dlZonesCsv').addEventListener('click', () => {
  const rows = filteredZones();
  const headers = Object.keys(rows[0] || {});
  downloadBlob(toCSV(headers, rows.map(r => headers.map(h=>r[h]))), 'crash_zones_filtered.csv', 'text/csv');
});
document.getElementById('dlZonesGeo').addEventListener('click', () => {
  const rows = filteredZones();
  downloadBlob(JSON.stringify({ type:'FeatureCollection', features: rows.map(r => ({ type:'Feature', geometry:{type:'Point',coordinates:[r.longitude,r.latitude]}, properties: r })) }, null, 1), 'crash_zones_filtered.geojson', 'application/geo+json');
});

function renderAll() {
  renderMapLayers();
  renderInsightCards();
  renderVendTable();
  renderZoneTable();
  renderCorridorTable();
  renderOperatorTable();
  renderPriorityTable();
}
renderPriorityConfig();
renderAll();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'liquor_crash_analysis.html'), html);
console.log('Written liquor_crash_analysis.html. Size:', (html.length/1024).toFixed(1), 'KB');
