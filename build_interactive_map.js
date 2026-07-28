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
#topbar { display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
#topbar h1 { font-size: 16px; margin: 0; font-weight: 800; margin-right: auto; }
#topbar a.back { font-size: 13px; color: var(--text); text-decoration: none; border: 1px solid var(--border); padding: 6px 12px; border-radius: 6px; background: var(--bg); }
#topbar a.back:hover { border-color: var(--amber); }
#topbar select { font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
#topbar label { font-size: 12.5px; display: flex; align-items: center; gap: 5px; white-space: nowrap; }
#map { position: absolute; top: 52px; left: 0; right: 0; bottom: 0; }
.leaflet-popup-content-wrapper { background: var(--surface); color: var(--text); }
.leaflet-popup-tip { background: var(--surface); }
.leg { position: absolute; bottom: 20px; left: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 220px; }
.leg b { color: var(--text); display: block; margin-bottom: 4px; font-size: 12px; }
.leg-scale { display: flex; height: 10px; border-radius: 3px; overflow: hidden; margin: 4px 0; }
.leg-scale span { flex: 1; }
</style>
</head>
<body>
<div id="topbar">
  <h1>Delhi District Safety Index — Interactive Map</h1>
  <label>Metric: <select id="metricSelect"></select></label>
  <label><input type="checkbox" id="chkPolice"> Police stations</label>
  <label><input type="checkbox" id="chkPosts"> Chowkis/posts</label>
  <label><input type="checkbox" id="chkZones"> Crash zones</label>
  <label><input type="checkbox" id="chkBus"> Bus stops</label>
  <label><input type="checkbox" id="chkAtm"> ATMs</label>
  <label><input type="checkbox" id="chkAlcohol"> Liquor shops</label>
  <label><input type="checkbox" id="chkSurveillance"> CCTV/guards</label>
  <a class="back" href="delhi_safety_dashboard.html">← Back to dashboard</a>
</div>
<div id="map"></div>
<div class="leg" id="legend"></div>

<script>
const BOUNDARIES = ${JSON.stringify(boundaries)};
const POLICE = ${JSON.stringify(policeMarkers)};
const POI = ${JSON.stringify(poiMarkers)};
const ZONES = ${JSON.stringify(crashZones)};

const METRICS = [
  { key: 'totalIPC', label: 'Total IPC Crime (2023)' },
  { key: 'theft', label: 'Theft (2023)' },
  { key: 'robbery', label: 'Robbery (2023)' },
  { key: 'burglary', label: 'Burglary (2023)' },
  { key: 'crimeAgainstWomen', label: 'Crime Against Women (2023)' },
  { key: 'totalSLL', label: 'SLL Crimes (2023)' },
  { key: 'fatalCrashes2023', label: 'Fatal Crashes (2023)' },
  { key: 'totalCrashes2023', label: 'Total Crashes (2023)' },
  { key: 'busStopDensity', label: 'Bus Stop Density (per km²)' },
  { key: 'atmDensity', label: 'ATM Density (per km²)' },
  { key: 'alcoholShopDensity', label: 'Liquor Shop Density (per km²)' },
  { key: 'surveillanceDensity', label: 'CCTV/Guard Density (per km²)' },
];

const metricSelect = document.getElementById('metricSelect');
metricSelect.innerHTML = METRICS.map(m => '<option value="' + m.key + '">' + m.label + '</option>').join('');

function fmtNum(n) { return n == null ? '—' : n.toLocaleString('en-IN'); }

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

const map = L.map('map', { zoomControl: true }).setView([28.62, 77.21], 11);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

let geoLayer = null;
function renderChoropleth() {
  const key = metricSelect.value;
  const vals = BOUNDARIES.features.map(f => f.properties[key]).filter(v => v != null);
  const scale = percentileScale(vals);
  const lo = Math.min(...vals), hi = Math.max(...vals);

  if (geoLayer) map.removeLayer(geoLayer);
  geoLayer = L.geoJSON(BOUNDARIES, {
    style: f => {
      const v = f.properties[key];
      return {
        fillColor: v == null ? '#999' : rustScale(scale(v)),
        fillOpacity: 0.65,
        color: '#fff',
        weight: 1.5,
      };
    },
    onEachFeature: (f, layer) => {
      const v = f.properties[key];
      const m = METRICS.find(x => x.key === key);
      layer.bindPopup('<b>' + f.properties.district + '</b><br>' + m.label + ': ' + fmtNum(v));
      layer.on('mouseover', () => layer.setStyle({ weight: 3, color: '#1c2331' }));
      layer.on('mouseout', () => layer.setStyle({ weight: 1.5, color: '#fff' }));
    },
  }).addTo(map);

  document.getElementById('legend').innerHTML =
    '<b>' + METRICS.find(x=>x.key===key).label + '</b>' +
    '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
    '<div style="display:flex;justify-content:space-between;">' +
      '<span>' + fmtNum(lo) + '</span><span>' + fmtNum(hi) + '</span>' +
    '</div>' +
    '<div style="margin-top:4px;font-style:italic;">ranked, not linear</div>';
}
metricSelect.addEventListener('change', renderChoropleth);
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
  }).bindPopup('<b>' + z.name + '</b> (' + z.road + ')<br>' + z.fatal + ' fatal, ' + z.total + ' total crashes, 2023').addTo(zonesGroup);
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
