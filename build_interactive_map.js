// Generates interactive_map.html — a separate page from the main dashboard, using Leaflet.js
// + CARTO's free keyless basemap tiles for a real, zoomable/pannable street map. Kept as its
// own page rather than folded into delhi_safety_dashboard.html because it needs external
// network requests (tiles, the Leaflet CDN bundle) at view-time, which would break the main
// dashboard's "works from file://, no external requests" design. Run:
//
//   node build_interactive_map.js

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const boundaries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), 'utf8'));
const dashboardFinal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));
const policeMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/police_markers_latlng.json'), 'utf8'));
const poiMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers_latlng.json'), 'utf8'));
const crashZones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_geocoded.json'), 'utf8'));

// Join crime/infra stats onto the boundary features by district name.
const statsByDistrict = {};
dashboardFinal.districts.forEach(d => { statsByDistrict[d.district] = d; });
boundaries.features.forEach(f => {
  Object.assign(f.properties, statsByDistrict[f.properties.district] || {});
});

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delhi District Safety Index — Interactive Map</title>
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
#topbar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; row-gap: 6px; }
#topbar h1 { font-size: 15px; margin: 0; font-weight: 800; margin-right: 6px; white-space: nowrap; }
#topbar a.back { font-size: 13px; color: var(--text); text-decoration: none; border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; background: var(--bg); margin-left: auto; }
#topbar a.back:hover { border-color: var(--amber); }
#topbar select { font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
#topbar label { font-size: 12.5px; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
.seg { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { font: inherit; font-size: 12px; padding: 6px 10px; border: none; background: var(--bg); color: var(--text-dim); cursor: pointer; border-right: 1px solid var(--border); }
.seg button:last-child { border-right: none; }
.seg button.active { background: var(--rust); color: #fff; }
.seg button:hover:not(.active) { background: var(--paper-raised); color: var(--text); }
#map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
#mapWrap { position: absolute; top: 78px; left: 0; right: 0; bottom: 0; }
.leaflet-popup-content-wrapper { background: var(--surface); color: var(--text); }
.leaflet-popup-tip { background: var(--surface); }
.leaflet-popup-content { font-size: 12.5px; line-height: 1.5; }
.popup-title { font-weight: 800; font-size: 13.5px; margin-bottom: 2px; }
.popup-rank { color: var(--text-dim); font-size: 11.5px; }
.popup-src { color: var(--text-dim); font-size: 10.5px; margin-top: 6px; border-top: 1px solid var(--border); padding-top: 4px; }
.yoy { font-weight: 700; }
.yoy.up { color: var(--rust); }
.yoy.down { color: var(--good); }
.leg { position: absolute; bottom: 20px; left: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 240px; }
.leg b { color: var(--text); display: block; margin-bottom: 4px; font-size: 12px; }
.leg-scale { display: flex; height: 10px; border-radius: 3px; overflow: hidden; margin: 4px 0; }
.leg-scale span { flex: 1; }
.leg-biv-grid { display: grid; grid-template-columns: repeat(3, 16px); grid-template-rows: repeat(3, 16px); gap: 2px; margin: 6px 0; }
.leg-biv-grid div { border-radius: 2px; }
.leg-biv-axes { display: flex; justify-content: space-between; font-size: 10px; }
</style>
</head>
<body>
<div id="topbar">
  <h1>Delhi District Safety Index — Interactive Map</h1>
  <label>Metric: <select id="metricSelect"></select></label>
  <div class="seg" id="yearToggle"></div>
  <div class="seg" id="rateToggle"></div>
  <label><input type="checkbox" id="chkBivariate"> Bivariate mode</label>
  <label id="bivInfraWrap" style="display:none">vs. <select id="bivInfraSelect"></select></label>
  <a class="back" href="delhi_safety_dashboard.html">← Back to dashboard</a>
  <div style="flex-basis:100%; display:flex; gap:10px; flex-wrap:wrap;">
    <label><input type="checkbox" id="chkPolice"> Police stations</label>
    <label><input type="checkbox" id="chkPosts"> Chowkis/posts</label>
    <label><input type="checkbox" id="chkZones"> Crash zones</label>
    <label><input type="checkbox" id="chkBus"> Bus stops</label>
    <label><input type="checkbox" id="chkAtm"> ATMs</label>
    <label><input type="checkbox" id="chkAlcohol"> Liquor shops</label>
    <label><input type="checkbox" id="chkSurveillance"> CCTV/guards</label>
  </div>
</div>
<div id="mapWrap"><div id="map"></div></div>
<div class="leg" id="legend"></div>

<script>
const BOUNDARIES = ${JSON.stringify(boundaries)};
const POLICE = ${JSON.stringify(policeMarkers)};
const POI = ${JSON.stringify(poiMarkers)};
const ZONES = ${JSON.stringify(crashZones)};

// Crime/road-safety metrics -- mirrors build.js's METRICS[] (year-aware fields, sources) so
// this page's popups/colors carry the same year semantics as the main dashboard instead of
// silently showing a different basis.
const METRICS = [
  { key: 'theft', label: 'Theft', full: 'Theft (Sec. 379 IPC)', prevKey: 'theft2022', key2024: 'theft2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'robbery', label: 'Robbery', full: 'Robbery (Sec. 392/394/397 IPC)', prevKey: 'robbery2022', key2024: 'robbery2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'burglary', label: 'Burglary', full: 'Burglary (Sec. 454-460 IPC)', prevKey: 'burglary2022', key2024: 'burglary2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'totalIPC', label: 'Total IPC', full: 'Total Cognizable IPC Crimes', prevKey: 'totalIPC2022', key2024: 'totalIPC2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'crimeAgainstWomen', label: 'Vs. Women', full: 'Total Crime Against Women', prevKey: 'crimeAgainstWomen2022', key2024: 'crimeAgainstWomen2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'totalSLL', label: 'SLL Crimes', full: 'Total Cognizable SLL Crimes', prevKey: 'totalSLL2022', key2024: 'totalSLL2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'fatalRoadCrashes2022', label: 'Road Deaths (2022)', full: 'Fatal Road Crashes, 2022', fixedYear: '2022', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'hitAndRunCrashes2022', label: 'Hit & Run (2022)', full: 'Hit-and-Run Fatal Crashes, 2022', fixedYear: '2022', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'crashProneZones2023', label: 'Crash Zones (2023)', full: 'Crash-Prone Zones, 2023', fixedYear: '2023', source: 'Delhi Road Crash Report 2023' },
  { key: 'fatalCrashes2023', label: 'Fatal Crashes (2023)', full: 'Fatal Crashes, 2023', fixedYear: '2023', source: 'Delhi Road Crash Report 2023' },
  { key: 'totalCrashes2023', label: 'Total Crashes (2023)', full: 'Total Road Crashes, 2023', fixedYear: '2023', source: 'Delhi Road Crash Report 2023' },
];

const INFRA = [
  { key: 'streetlight', densityKey: 'lightDensityPerKm2', countKey: 'totalLights', label: 'Streetlights', source: 'PAPL Open Transit Survey' },
  { key: 'underpass', densityKey: 'underpassDensity', countKey: 'underpasses', label: 'Underpasses', source: 'PAPL Open Transit Survey' },
  { key: 'metroGate', densityKey: 'metroGateDensity', countKey: 'metroGates', label: 'Metro gates', source: 'OpenStreetMap' },
  { key: 'policeInfra', densityKey: 'policeInfraDensity', countKey: 'policeInfraCount', label: 'Police Infra', source: 'Delhi Police GSDL + OpenStreetMap' },
  { key: 'busStop', densityKey: 'busStopDensity', countKey: 'busStops', label: 'Bus Stops', source: 'OpenStreetMap' },
  { key: 'atm', densityKey: 'atmDensity', countKey: 'atms', label: 'ATMs', source: 'OpenStreetMap (Overpass API)' },
  { key: 'alcoholShop', densityKey: 'alcoholShopDensity', countKey: 'alcoholShops', label: 'Liquor Shops', source: 'OpenStreetMap (Overpass API)' },
  { key: 'surveillance', densityKey: 'surveillanceDensity', countKey: 'surveillanceCameras', label: 'CCTV & Guards', source: 'OpenStreetMap (Overpass API)' },
];

let activeYear = '2023';
let rateMode = 'density'; // 'density' (per km²) or 'perCapita' (per 100k residents)
let bivariateMode = false;
let bivariateInfra = 'policeInfra';

const metricSelect = document.getElementById('metricSelect');
metricSelect.innerHTML = METRICS.map(m => '<option value="' + m.key + '">' + m.label + '</option>').join('');
const bivInfraSelect = document.getElementById('bivInfraSelect');
bivInfraSelect.innerHTML = INFRA.map(i => '<option value="' + i.key + '">' + i.label + '</option>').join('');
bivInfraSelect.value = bivariateInfra;

function fmtNum(n) { return n == null ? '—' : n.toLocaleString('en-IN'); }
function currentMetric() { return METRICS.find(m => m.key === metricSelect.value); }
function currentInfra() { return INFRA.find(i => i.key === bivInfraSelect.value); }

function yearFieldKey(m, year) {
  if (!m.prevKey) return m.key;
  if (year === '2022') return m.prevKey;
  if (year === '2024') return m.key2024;
  return m.key;
}
function prevYearOf(year) { return year === '2024' ? '2023' : year === '2023' ? '2022' : null; }
function effectiveYear(m) { return m.fixedYear || activeYear; }

function getRateVal(rawCount, d) {
  if (rawCount == null) return null;
  if (rateMode === 'perCapita') return Math.round((rawCount / d.population) * 100000 * 10) / 10;
  return Math.round((rawCount / d.areaSqKm) * 10) / 10;
}
function metricValue(d, m) {
  const val = d[yearFieldKey(m, activeYear)];
  return getRateVal(val, d);
}
function getInfraVal(d, inf) {
  const count = d[inf.countKey];
  if (count == null) return null;
  if (rateMode === 'perCapita') return Math.round((count / d.population) * 100000 * 10) / 10;
  return d[inf.densityKey];
}
function rankOf(propsList, key) {
  const vals = propsList.map(p => p[key]).filter(v => v != null).sort((a,b) => b - a);
  return (d) => vals.indexOf(d[key]) + 1;
}
function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function yoyBadge(cur, prev) {
  if (cur == null || prev == null || prev === 0) return '';
  const pct = ((cur - prev) / prev) * 100;
  const cls = pct >= 0 ? 'up' : 'down';
  const arrow = pct >= 0 ? '▲' : '▼';
  return '<span class="yoy ' + cls + '">' + arrow + ' ' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% vs ' + prevYearOf(activeYear) + '</span>';
}

// Percentile-rank color scale — same rationale as the main dashboard: an outlier district
// shouldn't wash out the color range for everyone else.
function percentileScale(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  const n = sorted.length;
  return v => {
    if (n <= 1) return 0.5;
    const first = sorted.indexOf(v);
    const last = sorted.length - 1 - [...sorted].reverse().indexOf(v);
    return ((first+last)/2) / (n-1);
  };
}
function rustScale(t) {
  const c1 = [230,214,179], c2 = [177,74,52];
  const r = Math.round(c1[0]+(c2[0]-c1[0])*t), g = Math.round(c1[1]+(c2[1]-c1[1])*t), b = Math.round(c1[2]+(c2[2]-c1[2])*t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// 3x3 bivariate color matrix — rows = infra density (low→high), columns = crime (low→high).
// Same palette/logic as build.js's BIVARIATE_MATRIX/getTertileIndex/getBivariateColor.
const BIVARIATE_MATRIX = [
  ['#e8e8e8', '#e4acac', '#c85a5a'],
  ['#a0c7c7', '#ad9ea5', '#985356'],
  ['#5b9e9e', '#5d757d', '#574249'],
];
function getTertileIndex(val, sortedArr) {
  if (val == null || sortedArr.length === 0) return 0;
  const q33 = sortedArr[Math.floor(sortedArr.length * 0.33)];
  const q66 = sortedArr[Math.floor(sortedArr.length * 0.66)];
  if (val <= q33) return 0;
  if (val <= q66) return 1;
  return 2;
}
function getBivariateColor(feats, d, m, inf) {
  const validDists = feats.map(f=>f.properties).filter(x => getInfraVal(x, inf) != null && metricValue(x, m) != null);
  if (!validDists.length) return '#999';
  const crimeValues = validDists.map(x => metricValue(x, m)).sort((a,b)=>a-b);
  const infraValues = validDists.map(x => getInfraVal(x, inf)).sort((a,b)=>a-b);
  const currentCrime = metricValue(d, m), currentInfra = getInfraVal(d, inf);
  if (currentCrime == null || currentInfra == null) return '#999';
  const xIndex = getTertileIndex(currentCrime, crimeValues);
  const yIndex = getTertileIndex(currentInfra, infraValues);
  return BIVARIATE_MATRIX[yIndex][xIndex];
}

const map = L.map('map', { zoomControl: true }).setView([28.62, 77.21], 11);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

function buildYearToggle() {
  const el = document.getElementById('yearToggle');
  const m = currentMetric();
  if (!m.prevKey) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = ['2022','2023','2024'].map(y => '<button class="' + (activeYear===y?'active':'') + '" data-y="' + y + '">' + y + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { activeYear = btn.dataset.y; buildYearToggle(); renderChoropleth(); });
  });
}
function buildRateToggle() {
  const el = document.getElementById('rateToggle');
  el.innerHTML = [['density','Per km²'],['perCapita','Per 100k']].map(([val,label]) =>
    '<button class="' + (rateMode===val?'active':'') + '" data-v="' + val + '">' + label + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { rateMode = btn.dataset.v; buildRateToggle(); renderChoropleth(); });
  });
}

let geoLayer = null;
function renderChoropleth() {
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const vals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null);
  const scale = percentileScale(vals);
  const lo = Math.min(...vals), hi = Math.max(...vals);

  if (geoLayer) map.removeLayer(geoLayer);
  geoLayer = L.geoJSON(BOUNDARIES, {
    style: f => {
      let fillColor;
      if (bivariateMode) {
        fillColor = getBivariateColor(feats, f.properties, m, inf);
      } else {
        const v = metricValue(f.properties, m);
        fillColor = v == null ? '#999' : rustScale(scale(v));
      }
      return { fillColor, fillOpacity: 0.65, color: '#fff', weight: 1.5 };
    },
    onEachFeature: (f, layer) => {
      const d = f.properties;
      const v = metricValue(d, m);
      const year = effectiveYear(m);
      const prevYear = prevYearOf(activeYear);
      const prevRaw = m.prevKey && prevYear ? d[yearFieldKey(m, prevYear)] : null;
      const prevRate = prevRaw != null ? getRateVal(prevRaw, d) : null;

      let body = '<div class="popup-title">' + d.district + '</div>';
      body += '<div class="popup-rank">' + m.full + ', ' + year + ' — rank ' + ordinal(rank(d)) + ' of 15</div>';
      body += '<div><b>' + fmtNum(v) + '</b> ' + (rateMode === 'perCapita' ? 'per 100k residents' : 'per km²') + '</div>';
      if (prevRate != null) body += '<div>' + yoyBadge(v, prevRate) + '</div>';
      if (bivariateMode) {
        body += '<div style="margin-top:4px;">' + inf.label + ': <b>' + fmtNum(getInfraVal(d, inf)) + '</b> ' + (rateMode === 'perCapita' ? '/100k' : '/km²') + '</div>';
      }
      body += '<div class="popup-src">Source: ' + m.source + (bivariateMode ? ' · ' + inf.source : '') + '</div>';

      layer.bindPopup(body);
      layer.on('mouseover', () => layer.setStyle({ weight: 3, color: '#1c2331' }));
      layer.on('mouseout', () => layer.setStyle({ weight: 1.5, color: '#fff' }));
    },
  }).addTo(map);

  renderLegend(m, inf, lo, hi);
}

function renderLegend(m, inf, lo, hi) {
  const el = document.getElementById('legend');
  if (bivariateMode) {
    const cells = [];
    for (let row = 2; row >= 0; row--) {
      for (let col = 0; col < 3; col++) cells.push('<div style="background:' + BIVARIATE_MATRIX[row][col] + '"></div>');
    }
    el.innerHTML = '<b>' + m.label + ' × ' + inf.label + '</b>' +
      '<div class="leg-biv-grid">' + cells.join('') + '</div>' +
      '<div class="leg-biv-axes"><span>↑ ' + inf.label + '</span></div>' +
      '<div class="leg-biv-axes"><span>Low crime →</span><span>High crime</span></div>' +
      '<div style="margin-top:4px;font-style:italic;">tertiles, computed live · ' + (rateMode==='perCapita'?'per 100k':'per km²') + '</div>';
  } else {
    el.innerHTML = '<b>' + m.label + ' (' + effectiveYear(m) + ')</b>' +
      '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
      '<div style="display:flex;justify-content:space-between;">' +
        '<span>' + fmtNum(lo) + '</span><span>' + fmtNum(hi) + '</span>' +
      '</div>' +
      '<div style="margin-top:4px;font-style:italic;">ranked, not linear · ' + (rateMode==='perCapita'?'per 100k':'per km²') + '</div>';
  }
}

metricSelect.addEventListener('change', () => { buildYearToggle(); renderChoropleth(); });
document.getElementById('chkBivariate').addEventListener('change', (e) => {
  bivariateMode = e.target.checked;
  document.getElementById('bivInfraWrap').style.display = bivariateMode ? '' : 'none';
  renderChoropleth();
});
bivInfraSelect.addEventListener('change', () => { bivariateInfra = bivInfraSelect.value; renderChoropleth(); });

buildYearToggle();
buildRateToggle();
renderChoropleth();

// ── Point layers, all off by default so the map opens uncluttered ──
function makeLayer(points, opts) {
  const group = L.layerGroup();
  points.forEach(([lat, lng, name]) => {
    L.circleMarker([lat, lng], opts).bindPopup(name).addTo(group);
  });
  return group;
}
const policeStationLayer = makeLayer(POLICE.stations, { radius: 5, color: '#fff', weight: 1, fillColor: '#3d5a99', fillOpacity: .9 });
const policePostLayer = makeLayer(POLICE.posts, { radius: 4, color: '#fff', weight: 1, fillColor: '#7c3aed', fillOpacity: .9 });
const busStopLayer = makeLayer(POI.busStops, { radius: 2, color: '#fff', weight: 0.5, fillColor: '#3f7d52', fillOpacity: .5 });
const atmLayer = makeLayer(POI.atms, { radius: 3, color: '#fff', weight: 1, fillColor: '#d4af37', fillOpacity: .85 });
const alcoholLayer = makeLayer(POI.alcoholShops, { radius: 4, color: '#fff', weight: 1, fillColor: '#8b2f5e', fillOpacity: .9 });
const surveillanceLayer = makeLayer(POI.surveillance, { radius: 3, color: '#fff', weight: 1, fillColor: '#0891b2', fillOpacity: .85 });

const zonesGroup = L.layerGroup();
ZONES.filter(z => z.lat != null && z.lng != null).forEach(z => {
  const t = Math.max(0, Math.min(1, (z.fatal - 1) / 6));
  L.circleMarker([z.lat, z.lng], {
    radius: 4 + t * 4, color: '#fff', weight: 1, fillColor: '#b14a34', fillOpacity: 0.55 + t * 0.4,
  }).bindPopup('<b>' + z.name + '</b> (' + z.road + ')<br>' + z.fatal + ' fatal, ' + z.total + ' total crashes, 2023<div class="popup-src">Source: Delhi Road Crash Report 2023</div>').addTo(zonesGroup);
});

const toggles = [
  ['chkPolice', policeStationLayer], ['chkPosts', policePostLayer], ['chkZones', zonesGroup],
  ['chkBus', busStopLayer], ['chkAtm', atmLayer], ['chkAlcohol', alcoholLayer], ['chkSurveillance', surveillanceLayer],
];
toggles.forEach(([id, layer]) => {
  document.getElementById(id).addEventListener('change', (e) => {
    if (e.target.checked) layer.addTo(map); else map.removeLayer(layer);
  });
});
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'interactive_map.html'), html);
console.log('Written interactive_map.html. Size:', (html.length/1024).toFixed(1), 'KB');
