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
const crashZones2024 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2024_geocoded.json'), 'utf8'));
const wardsInfra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_wards_infra.geojson'), 'utf8'));
const liquorVendsApprox = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
const crashZones2024Approx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8'));

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
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
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
#topbar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; row-gap: 6px; flex: 0 0 auto; }
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
#analysisBar { flex: 0 0 auto; }
#mapRegion { position: relative; flex: 1 1 auto; min-height: 0; }
#mapWrap { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
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
#districtSearch { font: inherit; font-size: 13px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); width: 160px; }
#searchResults { position: absolute; z-index: 1200; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.2); max-height: 220px; overflow-y: auto; display: none; min-width: 180px; }
#searchResults div { padding: 6px 12px; font-size: 13px; cursor: pointer; }
#searchResults div:hover, #searchResults div.active-hl { background: var(--rust); color: #fff; }
#drawer { position: absolute; top: 0; right: 0; bottom: 0; width: 340px; max-width: 92vw; background: var(--surface); border-left: 1px solid var(--border); box-shadow: -4px 0 16px rgba(0,0,0,.12); transform: translateX(100%); transition: transform .2s ease; z-index: 1100; overflow-y: auto; padding: 16px; }
#drawer.open { transform: translateX(0); }
#drawer .drawer-close { position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 20px; color: var(--text-dim); cursor: pointer; line-height: 1; }
#drawer h2 { margin: 0 4px 2px; font-size: 19px; font-weight: 800; }
#drawer .drawer-sub { margin: 0 4px 14px; font-size: 12px; color: var(--text-dim); }
#drawer .drawer-section { margin-bottom: 16px; }
#drawer .drawer-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--text-dim); margin: 0 0 8px; font-weight: 700; }
#drawer .stat-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
#drawer .stat-row .v { font-weight: 700; }
#drawer .infra-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 12.5px; }
#drawer .infra-row .badge { font-size: 10px; padding: 1px 6px; border-radius: 8px; }
#drawer .badge.covered { background: rgba(63,125,82,0.18); color: var(--good); }
#drawer .badge.gap { background: rgba(177,74,52,0.18); color: var(--rust); }
#drawer .corr-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; font-family: monospace; }
.shape-icon { display: block; }
.shape-icon.sq { border-radius: 2px; }
.shape-icon.tri { width: 0; height: 0; background: none !important; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom-width: 10px; border-bottom-style: solid; }
.shape-icon.dia { transform: rotate(45deg); border-radius: 2px; }
.shape-icon.dot { border-radius: 50%; }
.shape-icon.ring { border-radius: 50%; box-shadow: inset 0 0 0 2px #fff; }
#resetMapBtn, #shareUrlBtn, #downloadCsvBtn, #downloadGeoJsonBtn, #mobileFilterToggle { font: inherit; font-size: 12px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; }
#resetMapBtn:hover, #shareUrlBtn:hover, #downloadCsvBtn:hover, #downloadGeoJsonBtn:hover, #mobileFilterToggle:hover { border-color: var(--amber); }
.mobile-only { display: none; }
.point-toggles-row { flex-basis: 100%; display: flex; gap: 10px; flex-wrap: wrap; }
@media (max-width: 720px) {
  .mobile-only { display: inline-block; }
  #topbar > label, #topbar > .seg, #topbar > div:not(#pointLayerToggles), #analysisBar > label, #analysisBar > .seg, #analysisBar > span, #pointLayerToggles { display: none; }
  body.mobile-filters-open #topbar > label, body.mobile-filters-open #topbar > .seg, body.mobile-filters-open #topbar > div:not(#pointLayerToggles), body.mobile-filters-open #analysisBar > label, body.mobile-filters-open #analysisBar > .seg, body.mobile-filters-open #analysisBar > span, body.mobile-filters-open #pointLayerToggles { display: flex; }
  body.mobile-filters-open #topbar, body.mobile-filters-open #analysisBar { position: fixed; left: 0; right: 0; bottom: 0; top: auto; z-index: 1500; max-height: 70vh; overflow-y: auto; flex-direction: column; align-items: stretch; border-top: 1px solid var(--border); box-shadow: 0 -4px 16px rgba(0,0,0,.2); }
  body.mobile-filters-open #analysisBar { bottom: 0; }
  #drawer { top: auto; left: 0; right: 0; width: auto; max-width: none; height: 70vh; bottom: 0; transform: translateY(100%); border-left: none; border-top: 1px solid var(--border); border-radius: 12px 12px 0 0; }
  #drawer.open { transform: translateY(0); }
  .point-legend { right: 10px !important; }
}
.layer-count { color: var(--text-dim); font-size: 10.5px; }
.point-legend { position: absolute; bottom: 20px; right: 356px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 11px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); display: none; }
.point-legend.show { display: block; }
.point-legend .row { display: flex; align-items: center; gap: 7px; padding: 2px 0; }
#wardLegend { position: absolute; bottom: 20px; left: 240px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 240px; display: none; }
#wardLegend.show { display: block; }
#analysisBar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; background: var(--bg); border-bottom: 1px solid var(--border); flex-wrap: wrap; font-size: 12.5px; }
#analysisBar label { display: flex; align-items: center; gap: 5px; white-space: nowrap; }
#analysisBar select { font: inherit; font-size: 12.5px; padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); color: var(--text); }
.analysis-summary { font-size: 12px; color: var(--text-dim); }
.analysis-summary b { color: var(--text); }
.zone-match-ring { filter: drop-shadow(0 0 3px var(--amber)); }
#nearbyPanel { position: absolute; top: 10px; left: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 260px; display: none; }
#nearbyPanel.show { display: block; }
#nearbyPanel b { color: var(--text); display: block; margin-bottom: 4px; font-size: 12px; }
#nearbyPanel .nb-row { display: flex; justify-content: space-between; padding: 2px 0; }
.weak-cov-outline { stroke-dasharray: 6 4 !important; }
#methodOverlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1900; display: none; align-items: center; justify-content: center; }
#methodOverlay.show { display: flex; }
#methodPanel2 { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; max-width: 480px; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 30px rgba(0,0,0,.3); }
#methodPanel2 h3 { margin: 0 0 10px; font-size: 16px; }
#methodPanel2 p, #methodPanel2 li { font-size: 12.5px; color: var(--text-dim); line-height: 1.6; }
#methodPanel2 button { margin-top: 10px; font: inherit; font-size: 12px; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; }
.unsafe-factor-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; font-family: monospace; }
</style>
</head>
<body>
<div id="topbar">
  <h1>Delhi District Safety Index — Interactive Map</h1>
  <label>Metric: <select id="metricSelect"></select></label>
  <div class="seg" id="yearToggle"></div>
  <div class="seg" id="rateToggle"></div>
  <div class="seg" id="displayModeToggle"></div>
  <label><input type="checkbox" id="chkBivariate"> Bivariate mode</label>
  <label id="bivInfraWrap" style="display:none">vs. <select id="bivInfraSelect"></select></label>
  <label><input type="checkbox" id="chkHeatmap"> Heatmap (crash zones)</label>
  <label><input type="checkbox" id="chkWardBivariate"> Ward bivariate (290 wards)</label>
  <label id="wardInfraWrap" style="display:none">
    <select id="wardInfraXSelect"></select> × <select id="wardInfraYSelect"></select>
  </label>
  <label><input type="checkbox" id="chkWardExploratoryIndex"> Liquor-crash exploratory index (wards)</label>
  <div style="position:relative;">
    <input id="districtSearch" type="text" placeholder="Search district…" autocomplete="off">
    <div id="searchResults"></div>
  </div>
  <button id="resetMapBtn" type="button">⟲ Reset map</button>
  <button id="shareUrlBtn" type="button">🔗 Share view</button>
  <button id="downloadCsvBtn" type="button">⬇ CSV</button>
  <button id="downloadGeoJsonBtn" type="button">⬇ GeoJSON</button>
  <button id="mobileFilterToggle" type="button" class="mobile-only">☰ Filters</button>
  <a class="back" href="delhi_safety_dashboard.html">← Back to dashboard</a>
  <div class="point-toggles-row" id="pointLayerToggles">
    <label><input type="checkbox" id="chkPolice"> Police stations <span class="layer-count" id="cntPolice"></span></label>
    <label><input type="checkbox" id="chkPosts"> Chowkis/posts <span class="layer-count" id="cntPosts"></span></label>
    <label><input type="checkbox" id="chkZones"> Crash zones <span class="layer-count" id="cntZones"></span></label>
    <label>Zone year: <div class="seg" id="zoneYearToggle"><button class="active" data-year="2023">2023</button><button data-year="2024">2024</button></div></label>
    <label><input type="checkbox" id="chkBus"> Bus stops <span class="layer-count" id="cntBus"></span></label>
    <label><input type="checkbox" id="chkAtm"> ATMs <span class="layer-count" id="cntAtm"></span></label>
    <label><input type="checkbox" id="chkAlcohol"> Liquor shops <span class="layer-count" id="cntAlcohol"></span></label>
    <label><input type="checkbox" id="chkSurveillance"> CCTV/guards <span class="layer-count" id="cntSurveillance"></span></label>
    <label><input type="checkbox" id="chkCctvPriority"> CCTV priority sites <span class="layer-count" id="cntCctvPriority"></span></label>
    <label><input type="checkbox" id="chkLiquorVends"> Liquor vends (official, approx.) <span class="layer-count" id="cntLiquorVends"></span></label>
    <label><input type="checkbox" id="chkCrashZones2024Approx"> Crash zones 2024 (full, approx.) <span class="layer-count" id="cntCrashZones2024Approx"></span></label>
  </div>
</div>
<div id="analysisBar">
  <label>Spatial analysis: <select id="analysisSelect">
    <option value="none">None</option>
    <option value="crashesNearLiquor">Crashes near liquor shops</option>
    <option value="crashesNoSurveillance">Crashes without nearby surveillance</option>
    <option value="crashesNearBus">Crashes near bus stops</option>
    <option value="weakPoliceCoverage">High-crime districts, weak police coverage</option>
  </select></label>
  <label>Radius: <div class="seg" id="radiusToggle"></div></label>
  <label><input type="checkbox" id="chkUnsafe"> Show unsafe areas (composite)</label>
  <span id="unsafeMethodLink" style="display:none; cursor:pointer; text-decoration:underline; color:var(--text-dim); font-size:11.5px;">ⓘ methodology</span>
  <span class="analysis-summary" id="analysisSummary"></span>
</div>
<div id="mapRegion">
  <div id="mapWrap"><div id="map"></div></div>
  <div class="leg" id="legend"></div>
  <div class="point-legend" id="pointLegend"></div>
  <div id="wardLegend"></div>
  <div id="nearbyPanel"></div>
  <div id="drawer">
    <button class="drawer-close" id="drawerClose" aria-label="Close">✕</button>
    <div id="drawerBody"></div>
  </div>
</div>
<div id="methodOverlay">
  <div id="methodPanel2">
    <h3>Composite "Unsafe Areas" — methodology</h3>
    <p>Each district's score is the plain average of five factors, each converted to a 0-1 percentile rank across the 15 districts first (so no single factor's raw scale can dominate the others). No hidden weighting — every factor counts equally.</p>
    <ul>
      <li><b>Total IPC crime density</b> (higher rank = less safe)</li>
      <li><b>Crime against women density</b> (higher rank = less safe)</li>
      <li><b>Fatal crashes (2023) density</b> (higher rank = less safe)</li>
      <li><b>Police infrastructure density</b> (rank inverted — lower coverage = less safe)</li>
      <li><b>Streetlight density</b> (rank inverted — lower coverage = less safe; districts the PAPL survey never covered are excluded from this one factor only, and flagged, rather than silently counted as "no streetlights")</li>
    </ul>
    <p>This is one illustrative composite, not an official risk index — click any district while this mode is on to see its exact factor-by-factor breakdown in the popup.</p>
    <button id="methodCloseBtn" type="button">Close</button>
  </div>
</div>

<script>
const BOUNDARIES = ${JSON.stringify(boundaries)};
const POLICE = ${JSON.stringify(policeMarkers)};
const POI = ${JSON.stringify(poiMarkers)};
const ZONES_BY_YEAR = { '2023': ${JSON.stringify(crashZones)}, '2024': ${JSON.stringify(crashZones2024)} };
const ZONES = ZONES_BY_YEAR['2023'];
const wardsInfra = ${JSON.stringify(wardsInfra)};
const LIQUOR_VENDS_APPROX = ${JSON.stringify(liquorVendsApprox)};
const CRASH_ZONES_2024_APPROX = ${JSON.stringify(crashZones2024Approx)};

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

// Ward-level metrics available to the bivariate mode, split into two groups so any pairing —
// infra x infra, crime x crime, or infra x crime — is possible, not just infra x infra as before.
// "Infra" fields are OSM/official point layers aggregated onto wards by point-in-polygon (basis:
// exploratory, since the source coordinates for liquor vends are themselves approximate).
// "Crime/incidents" fields are either true ward-level incident counts (2024 crash zones — also
// approximate-coordinate point-in-polygon, basis: exploratory) or a district crime figure copied
// down onto every ward inside it, since NCRB does not publish crime below district level (basis:
// district-inherited). Field names match data/delhi_wards_infra.geojson exactly.
const WARD_INFRA = [
  { key: 'busStops', densityKey: 'busStopsDensity', label: 'Bus Stops', group: 'infra', basis: null },
  { key: 'atms', densityKey: 'atmsDensity', label: 'ATMs', group: 'infra', basis: null },
  { key: 'alcoholShops', densityKey: 'alcoholShopsDensity', label: 'Liquor Shops (OSM)', group: 'infra', basis: null },
  { key: 'surveillance', densityKey: 'surveillanceDensity', label: 'CCTV & Guards', group: 'infra', basis: null },
  { key: 'officialLiquorVends', densityKey: 'officialLiquorVendsDensity', label: 'Liquor Vends (official)', group: 'infra', basis: 'exploratory' },
  { key: 'crashZones2024', densityKey: 'crashZones2024Density', label: 'Crash Zones (2024)', group: 'crime', basis: 'exploratory' },
  { key: 'totalIPCDensity2024Inherited', densityKey: 'totalIPCDensity2024Inherited', label: 'Total IPC Crime Rate (district)', group: 'crime', basis: 'district-inherited' },
  { key: 'crimeAgainstWomenDensity2024Inherited', densityKey: 'crimeAgainstWomenDensity2024Inherited', label: 'Crime vs. Women Rate (district)', group: 'crime', basis: 'district-inherited' },
];
const WARD_INFRA_BASIS_LABEL = {
  exploratory: 'exploratory — assigned to this ward from an approximate coordinate, not a verified location',
  'district-inherited': "district-inherited — this is the enclosing district's figure, not ward-specific data",
};

// Districts the PAPL survey actually drove through — shared gap for streetlights and
// underpasses. Mirrors build.js's SURVEYED set/infraCovered() exactly.
const SURVEYED = new Set(['Central','East','New Delhi','North','Shahdara','South','South-East','South-West','West']);
function infraCovered(d, infraKey) {
  if (infraKey === 'metroGate' || infraKey === 'busStop' || infraKey === 'atm' || infraKey === 'alcoholShop' || infraKey === 'surveillance') return true;
  if (infraKey === 'policeInfra') return d.chowkiPosts > 0;
  return SURVEYED.has(d.district) && d[infraKey === 'streetlight' ? 'surveyPoints' : 'underpasses'] >= 10;
}
function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for (let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
  return num/Math.sqrt(dx2*dy2);
}

let activeYear = '2023';
let rateMode = 'density'; // 'density' (per km²) or 'perCapita' (per 100k residents)
let bivariateMode = false;
let bivariateInfra = 'policeInfra';
let unsafeMode = false; // declared here (not near its own module further below) because
                          // renderChoropleth() references it and runs once during initial
                          // page setup, before later let/const lines would otherwise execute --
                          // referencing a not-yet-initialized let throws and silently halts the
                          // rest of the script, which is exactly what happened before this fix.
let selectedDistrict = null;

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

// ── Ward-level bivariate mode: two WARD_INFRA metrics cross-referenced at ward granularity (290
// wards) instead of the 15 districts — infra x infra, crime x crime, or infra x crime, using the
// same 3x3 tertile-matrix approach as the district bivariate mode above, against WARDS_INFRA's
// per-ward density fields directly.
let wardBivariateMode = false;
let wardInfraX = 'busStops';
let wardInfraY = 'surveillance';
let wardLayer = null;
let wardExploratoryMode = false; // declared here, not near its own section further below, for the
                                   // same TDZ reason as heatLayer/zoneYear above.
// heatLayer and zoneYear are declared here (not near their own sections further below) because
// rebuildZonesLayer()'s initial call, and the first updateUrlState() call inside the initial
// renderChoropleth(), both happen before those sections textually run -- referencing either
// variable before its let executes would throw a TDZ ReferenceError and silently halt the rest
// of the script, the same class of bug already documented on unsafeMode above.
let heatLayer = null;
let zoneYear = '2023';

function getWardBivariateColor(feats, props, xInf, yInf) {
  const valid = feats.map(f => f.properties).filter(p => p[xInf.densityKey] != null && p[yInf.densityKey] != null);
  if (!valid.length) return '#999';
  const xValues = valid.map(p => p[xInf.densityKey]).sort((a,b)=>a-b);
  const yValues = valid.map(p => p[yInf.densityKey]).sort((a,b)=>a-b);
  const xv = props[xInf.densityKey], yv = props[yInf.densityKey];
  if (xv == null || yv == null) return '#999';
  const xIndex = getTertileIndex(xv, xValues);
  const yIndex = getTertileIndex(yv, yValues);
  return BIVARIATE_MATRIX[yIndex][xIndex];
}

function wardMetricLine(p, inf) {
  const sameKey = inf.key === inf.densityKey;
  const valueHtml = sameKey
    ? '<b>' + fmtNum(p[inf.key]) + '</b>/km²'
    : '<b>' + fmtNum(p[inf.key]) + '</b> (' + fmtNum(p[inf.densityKey]) + '/km²)';
  const caveat = inf.basis ? ' <span style="font-style:italic;">— ' + WARD_INFRA_BASIS_LABEL[inf.basis] + '</span>' : '';
  return '<div>' + inf.label + ': ' + valueHtml + caveat + '</div>';
}
function renderWardLayer() {
  if (wardLayer) { map.removeLayer(wardLayer); wardLayer = null; }
  if (!wardBivariateMode) { renderWardLegend(false); return; }
  const xInf = WARD_INFRA.find(w => w.key === wardInfraX);
  const yInf = WARD_INFRA.find(w => w.key === wardInfraY);
  const feats = wardsInfra.features;
  wardLayer = L.geoJSON(wardsInfra, {
    style: f => ({ fillColor: getWardBivariateColor(feats, f.properties, xInf, yInf), fillOpacity: 0.75, color: '#fff', weight: 0.8 }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      const body = '<div class="popup-title">' + p.Ward_Name + '</div>' +
        '<div class="popup-rank">Ward — ' + p.areaSqKm + ' km² · enclosing district (approx.): ' + (p.assignedDistrict || 'unassigned') + '</div>' +
        (p.highInjuryNetwork ? '<div style="color:var(--rust);font-weight:700;">⚠ High-Injury Network — #' + p.highInjuryNetworkRank + ' of 18 wards accounting for half of 2024\\'s ward-assigned fatal crashes</div>' : '') +
        wardMetricLine(p, xInf) + wardMetricLine(p, yInf) +
        '<div class="popup-src">Ward boundaries: DataMeet Municipal_Spatial_Data (likely pre-2022 delimitation, used for spatial aggregation only) · ' + WARD_INFRA.filter(w=>[xInf.key,yInf.key].includes(w.key)).map(w=>w.label).join(' & ') + ' — see caveats above</div>';
      layer.bindPopup(body);
      layer.on('mouseover', () => layer.setStyle({ weight: 2.5, color: '#1c2331' }));
      layer.on('mouseout', () => layer.setStyle({ weight: 0.8, color: '#fff' }));
    },
  }).addTo(map);
  renderWardLegend(true, xInf, yInf);
}

function renderWardLegend(show, xInf, yInf) {
  const el = document.getElementById('wardLegend');
  if (!show) { el.classList.remove('show'); return; }
  const cells = [];
  for (let row = 2; row >= 0; row--) {
    for (let col = 0; col < 3; col++) cells.push('<div style="background:' + BIVARIATE_MATRIX[row][col] + '"></div>');
  }
  const caveats = [xInf, yInf].filter(inf => inf.basis).map(inf => inf.label + ': ' + WARD_INFRA_BASIS_LABEL[inf.basis]);
  el.innerHTML = '<b>' + xInf.label + ' (' + xInf.group + ') × ' + yInf.label + ' (' + yInf.group + ') — per ward</b>' +
    '<div class="leg-biv-grid">' + cells.join('') + '</div>' +
    '<div class="leg-biv-axes"><span>↑ ' + yInf.label + '</span></div>' +
    '<div class="leg-biv-axes"><span>Low ' + xInf.label + ' →</span><span>High</span></div>' +
    '<div style="margin-top:4px;font-style:italic;">290 wards · tertiles, computed live</div>' +
    (caveats.length ? '<div style="margin-top:4px;font-style:italic;">' + caveats.join('<br>') + '</div>' : '');
  el.classList.add('show');
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
const districtLayers = {};
function renderChoropleth() {
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const vals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null);
  const scale = percentileScale(vals);
  const lo = Math.min(...vals), hi = Math.max(...vals);

  if (geoLayer) map.removeLayer(geoLayer);
  Object.keys(districtLayers).forEach(k => delete districtLayers[k]);
  const unsafeScores = unsafeMode ? computeUnsafeScores() : null;
  geoLayer = L.geoJSON(BOUNDARIES, {
    style: f => {
      let fillColor;
      if (unsafeMode) {
        const s = unsafeScores[f.properties.district].score;
        fillColor = s == null ? '#999' : rustScale(s);
      } else if (bivariateMode) {
        fillColor = getBivariateColor(feats, f.properties, m, inf);
      } else {
        const v = metricValue(f.properties, m);
        fillColor = v == null ? '#999' : rustScale(scale(v));
      }
      const isSelected = selectedDistrict === f.properties.district;
      return { fillColor, fillOpacity: displayMode === 'circles' ? 0.12 : 0.65, color: isSelected ? 'var(--amber)' : '#fff', weight: isSelected ? 3.5 : 1.5 };
    },
    onEachFeature: (f, layer) => {
      const d = f.properties;
      districtLayers[d.district] = layer;
      const v = metricValue(d, m);
      const year = effectiveYear(m);
      const prevYear = prevYearOf(activeYear);
      const prevRaw = m.prevKey && prevYear ? d[yearFieldKey(m, prevYear)] : null;
      const prevRate = prevRaw != null ? getRateVal(prevRaw, d) : null;

      let body = '<div class="popup-title">' + d.district + '</div>';
      if (unsafeMode) {
        const us = unsafeScores[d.district];
        body += '<div class="popup-rank">Composite unsafe score: <b>' + (us.score != null ? (us.score*100).toFixed(0) + '/100' : '—') + '</b> (' + us.coveredFactors + '/' + us.totalFactors + ' factors covered)</div>';
        body += us.contributions.map(c => '<div class="unsafe-factor-row"><span>' + c.label + '</span><span>' + (c.percentile != null ? (c.percentile*100).toFixed(0) + 'pct' : 'n/a') + '</span></div>').join('');
        body += '<div class="popup-src">Equal-weight average of percentile ranks — click "ⓘ methodology" for the full writeup.</div>';
      } else {
        body += '<div class="popup-rank">' + m.full + ', ' + year + ' — rank ' + ordinal(rank(d)) + ' of 15</div>';
        body += '<div><b>' + fmtNum(v) + '</b> ' + (rateMode === 'perCapita' ? 'per 100k residents' : 'per km²') + '</div>';
        if (prevRate != null) body += '<div>' + yoyBadge(v, prevRate) + '</div>';
        if (bivariateMode) {
          body += '<div style="margin-top:4px;">' + inf.label + ': <b>' + fmtNum(getInfraVal(d, inf)) + '</b> ' + (rateMode === 'perCapita' ? '/100k' : '/km²') + '</div>';
        }
        body += '<div class="popup-src">Source: ' + m.source + (bivariateMode ? ' · ' + inf.source : '') + '</div>';
      }

      layer.bindPopup(body);
      layer.on('mouseover', () => { if (selectedDistrict !== d.district) layer.setStyle({ weight: 3, color: '#1c2331' }); });
      layer.on('mouseout', () => { if (selectedDistrict !== d.district) layer.setStyle({ weight: 1.5, color: '#fff' }); });
      layer.on('click', () => selectDistrict(d.district));
    },
  }).addTo(map);

  renderLegend(m, inf, lo, hi);
  renderProportionalCircles(m, inf, feats);
  if (selectedDistrict) renderDrawer(selectedDistrict);
  if (typeof updateUrlState === 'function') updateUrlState();
}

// ── District search + zoom, and the right-side district intelligence drawer ──
function selectDistrict(name, opts) {
  if (!districtLayers[name]) return;
  selectedDistrict = name;
  renderChoropleth(); // rebuilds geoLayer (recolors the selected outline, re-renders the drawer) --
  // districtLayers is repopulated as a side effect, so re-read the layer reference afterwards
  // rather than reusing one captured before the rebuild (the old layer object is detached).
  const layer = districtLayers[name];
  if (!opts || opts.fitBounds !== false) map.fitBounds(layer.getBounds(), { maxZoom: 13, animate: false });
  layer.openPopup();
  document.getElementById('drawer').classList.add('open');
}

function renderDrawer(name) {
  const props = BOUNDARIES.features.find(f => f.properties.district === name).properties;
  const allProps = BOUNDARIES.features.map(f => f.properties);
  const m = currentMetric();
  const yKey = yearFieldKey(m, activeYear);
  const rank = rankOf(allProps, yKey)(props);
  const v = metricValue(props, m);
  const prevYear = prevYearOf(activeYear);
  const prevRaw = m.prevKey && prevYear ? props[yearFieldKey(m, prevYear)] : null;
  const prevRate = prevRaw != null ? getRateVal(prevRaw, props) : null;

  const statsHtml =
    '<div class="stat-row"><span>' + m.full + ' (' + effectiveYear(m) + ')</span><span class="v">' + fmtNum(v) + '</span></div>' +
    '<div class="stat-row"><span>Rank of 15</span><span class="v">' + ordinal(rank) + '</span></div>' +
    (prevRate != null ? '<div class="stat-row"><span>Change vs ' + prevYear + '</span><span class="v">' + yoyBadge(v, prevRate) + '</span></div>' : '') +
    '<div class="stat-row"><span>Area</span><span class="v">' + props.areaSqKm + ' km²</span></div>' +
    '<div class="stat-row"><span>Population</span><span class="v">' + fmtNum(props.population) + '</span></div>';

  const infraHtml = INFRA.map(inf => {
    const covered = infraCovered(props, inf.key);
    const val = getInfraVal(props, inf);
    return '<div class="infra-row"><span>' + inf.label + '</span><span>' +
      (val != null ? fmtNum(val) + (rateMode === 'perCapita' ? '/100k' : '/km²') : '—') +
      ' <span class="badge ' + (covered ? 'covered' : 'gap') + '">' + (covered ? 'covered' : 'gap') + '</span></span></div>';
  }).join('');

  const corrHtml = INFRA.map(inf => {
    const valid = BOUNDARIES.features.map(f=>f.properties).filter(d => infraCovered(d, inf.key) && d[yKey] != null);
    const xs = valid.map(d => getInfraVal(d, inf));
    const ys = valid.map(d => getRateVal(d[yKey], d));
    const r = valid.length >= 2 ? pearson(xs, ys) : 0;
    const color = Math.abs(r) >= 0.5 ? 'var(--rust)' : Math.abs(r) >= 0.25 ? 'var(--amber)' : 'var(--text-dim)';
    return '<div class="corr-row"><span>' + inf.label + '</span><span style="color:' + color + ';font-weight:700;">' + (r>=0?'+':'') + r.toFixed(3) + '</span></div>';
  }).join('');

  document.getElementById('drawerBody').innerHTML =
    '<h2>' + name + '</h2>' +
    '<div class="drawer-sub">District intelligence — ' + effectiveYear(m) + (rateMode==='perCapita' ? ' · per 100k' : ' · per km²') + '</div>' +
    '<div class="drawer-section"><h3>Selected metric</h3>' + statsHtml + '</div>' +
    '<div class="drawer-section"><h3>Infrastructure coverage</h3>' + infraHtml + '</div>' +
    '<div class="drawer-section"><h3>Correlation vs. ' + m.label + ' (citywide, r)</h3>' + corrHtml + '</div>';
}

document.getElementById('drawerClose').addEventListener('click', () => {
  document.getElementById('drawer').classList.remove('open');
  selectedDistrict = null;
  renderChoropleth();
});

const searchInput = document.getElementById('districtSearch');
const searchResults = document.getElementById('searchResults');
const districtNames = BOUNDARIES.features.map(f => f.properties.district).sort();
function showSearchResults(query) {
  const q = query.trim().toLowerCase();
  const matches = q ? districtNames.filter(n => n.toLowerCase().includes(q)) : [];
  if (!matches.length) { searchResults.style.display = 'none'; return; }
  searchResults.innerHTML = matches.map(n => '<div data-name="' + n + '">' + n + '</div>').join('');
  searchResults.style.display = 'block';
  searchResults.querySelectorAll('div').forEach(row => {
    row.addEventListener('click', () => {
      selectDistrict(row.dataset.name);
      searchInput.value = row.dataset.name;
      searchResults.style.display = 'none';
    });
  });
}
searchInput.addEventListener('input', () => showSearchResults(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const exact = districtNames.find(n => n.toLowerCase() === searchInput.value.trim().toLowerCase());
    const first = searchResults.querySelector('div');
    const target = exact || (first && first.dataset.name);
    if (target) { selectDistrict(target); searchInput.value = target; searchResults.style.display = 'none'; }
  } else if (e.key === 'Escape') {
    searchResults.style.display = 'none';
  }
});
document.addEventListener('click', (e) => {
  if (e.target !== searchInput && !searchResults.contains(e.target)) searchResults.style.display = 'none';
});

function renderLegend(m, inf, lo, hi) {
  const el = document.getElementById('legend');
  if (unsafeMode) {
    el.innerHTML = '<b>Composite Unsafe Score</b>' +
      '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
      '<div style="display:flex;justify-content:space-between;"><span>Safer</span><span>Less safe</span></div>' +
      '<div style="margin-top:4px;font-style:italic;">equal-weight avg of 5 percentile-ranked factors — click "ⓘ methodology"</div>';
  } else if (bivariateMode) {
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

const wardInfraXSelect = document.getElementById('wardInfraXSelect');
const wardInfraYSelect = document.getElementById('wardInfraYSelect');
function wardInfraOptionsHtml() {
  const groups = [['infra', 'Infrastructure'], ['crime', 'Crime / Incidents']];
  return groups.map(([g, label]) =>
    '<optgroup label="' + label + '">' +
    WARD_INFRA.filter(w => w.group === g).map(w => '<option value="' + w.key + '">' + w.label + '</option>').join('') +
    '</optgroup>'
  ).join('');
}
wardInfraXSelect.innerHTML = wardInfraOptionsHtml();
wardInfraYSelect.innerHTML = wardInfraOptionsHtml();
wardInfraXSelect.value = wardInfraX;
wardInfraYSelect.value = wardInfraY;
document.getElementById('chkWardBivariate').addEventListener('change', (e) => {
  wardBivariateMode = e.target.checked;
  document.getElementById('wardInfraWrap').style.display = wardBivariateMode ? '' : 'none';
  if (wardBivariateMode) {
    wardExploratoryMode = false;
    document.getElementById('chkWardExploratoryIndex').checked = false;
  }
  renderWardLayer();
  updateUrlState();
});
wardInfraXSelect.addEventListener('change', () => { wardInfraX = wardInfraXSelect.value; renderWardLayer(); updateUrlState(); });
wardInfraYSelect.addEventListener('change', () => { wardInfraY = wardInfraYSelect.value; renderWardLayer(); updateUrlState(); });

// ── Proportional-circle display mode -- alternative to the choropleth fill that avoids the
// area bias of coloring physically large/small districts the same way (a small dense district
// and a large sparse one can look equally "intense" under a fill; circle area scales directly
// with the metric instead). Adds circles sized by sqrt(value) (area-proportional, not radius-
// proportional, so visual size fairly reflects magnitude) at each district's polygon centroid.
let displayMode = 'choropleth'; // 'choropleth' | 'circles'
function buildDisplayModeToggle() {
  const el = document.getElementById('displayModeToggle');
  el.innerHTML = [['choropleth','Choropleth'],['circles','Circles']].map(([val,label]) =>
    '<button class="' + (displayMode===val?'active':'') + '" data-v="' + val + '">' + label + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { displayMode = btn.dataset.v; buildDisplayModeToggle(); renderChoropleth(); });
  });
}

let circleLayer = null;
function renderProportionalCircles(m, inf, feats) {
  if (circleLayer) { map.removeLayer(circleLayer); circleLayer = null; }
  if (displayMode !== 'circles') return;
  const vals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null);
  const maxVal = Math.max(...vals) || 1;
  const maxRadiusPx = 42;
  circleLayer = L.layerGroup();
  feats.forEach(f => {
    const d = f.properties;
    const layer = districtLayers[d.district];
    if (!layer) return;
    const center = layer.getBounds().getCenter();
    const v = metricValue(d, m);
    if (v == null) return;
    const radius = Math.max(4, Math.sqrt(v / maxVal) * maxRadiusPx);
    const color = bivariateMode ? getBivariateColor(feats, d, m, inf) : rustScale(percentileScale(vals)(v));
    L.circleMarker(center, { radius, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.75 })
      .bindPopup('<div class="popup-title">' + d.district + '</div><div>' + fmtNum(v) + ' ' + (rateMode==='perCapita'?'per 100k':'per km²') + '</div>')
      .addTo(circleLayer);
  });
  circleLayer.addTo(map);
}

document.getElementById('resetMapBtn').addEventListener('click', () => {
  map.setView([28.62, 77.21], 11, { animate: false });
  selectedDistrict = null;
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('districtSearch').value = '';
  document.getElementById('searchResults').style.display = 'none';
  bivariateMode = false;
  document.getElementById('chkBivariate').checked = false;
  document.getElementById('bivInfraWrap').style.display = 'none';
  displayMode = 'choropleth';
  buildDisplayModeToggle();
  document.querySelectorAll('#pointLayerToggles input[type=checkbox]').forEach(chk => { const wasChecked = chk.checked; chk.checked = false; if (wasChecked) chk.dispatchEvent(new Event('change')); });
  document.getElementById('chkHeatmap').checked = false;
  rebuildHeatLayer();
  document.getElementById('analysisSelect').value = 'none';
  if (typeof clearAnalysisHighlight === 'function') clearAnalysisHighlight();
  document.getElementById('nearbyPanel').classList.remove('show');
  unsafeMode = false;
  document.getElementById('chkUnsafe').checked = false;
  document.getElementById('unsafeMethodLink').style.display = 'none';
  wardBivariateMode = false;
  document.getElementById('chkWardBivariate').checked = false;
  document.getElementById('wardInfraWrap').style.display = 'none';
  wardExploratoryMode = false;
  document.getElementById('chkWardExploratoryIndex').checked = false;
  renderWardLayer();
  zoneYear = '2023';
  document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear));
  rebuildZonesLayer();
  renderChoropleth();
});

// ── Shareable URL state: ?year=2023&crime=theft&infra=streetlight&district=North&heatmap=1&
// zoneYear=2024&ward=biv&wx=..&wy=..&layers=chkBus,chkAtm ── Read once on load (before the first
// render, so the initial paint already reflects it) and written back via history.replaceState()
// on every relevant control change. Every value read back from the URL is validated against the
// actual known option lists below before being applied -- an unrecognized value is silently
// ignored and the corresponding default is kept, never applied blindly.
const POINT_LAYER_IDS = ['chkPolice', 'chkPosts', 'chkZones', 'chkBus', 'chkAtm', 'chkAlcohol', 'chkSurveillance', 'chkCctvPriority', 'chkLiquorVends', 'chkCrashZones2024Approx'];
let pendingUrlDistrict = null;
let pendingUrlState = null; // { heatmap, zoneYear, ward, wx, wy, layers } -- applied once every
                              // relevant section has finished wiring its own event listeners (see
                              // applyDeferredUrlState() at the very end of the script).
function applyUrlStateOnLoad() {
  const params = new URLSearchParams(location.search);
  const crime = params.get('crime');
  const year = params.get('year');
  const rate = params.get('rate');
  const bivariate = params.get('bivariate');
  const infra = params.get('infra');
  const district = params.get('district');
  if (crime && METRICS.some(m => m.key === crime)) metricSelect.value = crime;
  if (year && ['2022','2023','2024'].includes(year)) activeYear = year;
  if (rate === 'perCapita') rateMode = 'perCapita';
  if (infra && INFRA.some(i => i.key === infra)) { bivariateInfra = infra; bivInfraSelect.value = infra; }
  if (bivariate === '1') {
    bivariateMode = true;
    document.getElementById('chkBivariate').checked = true;
    document.getElementById('bivInfraWrap').style.display = '';
  }
  if (district) pendingUrlDistrict = district; // applied after the first render, once districtLayers exists

  const heatmap = params.get('heatmap');
  const zoneYearParam = params.get('zoneYear');
  const ward = params.get('ward');
  const wx = params.get('wx');
  const wy = params.get('wy');
  const layersParam = params.get('layers');
  pendingUrlState = {
    heatmap: heatmap === '1',
    zoneYear: (zoneYearParam && ['2023', '2024'].includes(zoneYearParam)) ? zoneYearParam : null,
    ward: (ward === 'biv' || ward === 'exp') ? ward : null,
    wx: (wx && WARD_INFRA.some(w => w.key === wx)) ? wx : null,
    wy: (wy && WARD_INFRA.some(w => w.key === wy)) ? wy : null,
    layers: layersParam ? layersParam.split(',').filter(id => POINT_LAYER_IDS.includes(id)) : [],
  };
}
function updateUrlState() {
  const m = currentMetric();
  const params = new URLSearchParams();
  if (activeYear !== '2023') params.set('year', activeYear);
  params.set('crime', m.key);
  if (rateMode !== 'density') params.set('rate', rateMode);
  if (bivariateMode) { params.set('bivariate', '1'); params.set('infra', bivariateInfra); }
  if (selectedDistrict) params.set('district', selectedDistrict);
  if (document.getElementById('chkHeatmap').checked) params.set('heatmap', '1');
  if (zoneYear !== '2023') params.set('zoneYear', zoneYear);
  if (wardBivariateMode) { params.set('ward', 'biv'); params.set('wx', wardInfraX); params.set('wy', wardInfraY); }
  else if (wardExploratoryMode) { params.set('ward', 'exp'); }
  const checkedLayers = POINT_LAYER_IDS.filter(id => { const el = document.getElementById(id); return el && el.checked; });
  if (checkedLayers.length) params.set('layers', checkedLayers.join(','));
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

applyUrlStateOnLoad();
buildYearToggle();
buildRateToggle();
buildDisplayModeToggle();
renderChoropleth();
if (pendingUrlDistrict && districtLayers[pendingUrlDistrict]) {
  selectDistrict(pendingUrlDistrict);
  pendingUrlDistrict = null;
}

// ── CSV / GeoJSON export of the currently filtered map (current metric/year/rate mode) ──
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function currentStateSuffix() {
  const m = currentMetric();
  return m.key + '_' + activeYear + '_' + rateMode + (bivariateMode ? '_vs_' + bivariateInfra : '');
}
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const header = ['district', m.key + '_' + (rateMode==='perCapita'?'per100k':'perKm2'), 'rank_of_15'];
  if (bivariateMode) header.push(inf.key + '_' + (rateMode==='perCapita'?'per100k':'perKm2'));
  const rows = feats.map(f => {
    const d = f.properties;
    const row = [d.district, metricValue(d, m), rank(d)];
    if (bivariateMode) row.push(getInfraVal(d, inf));
    return row.join(',');
  });
  downloadBlob(header.join(',') + '\\n' + rows.join('\\n'), 'delhi_map_' + currentStateSuffix() + '.csv', 'text/csv');
});
document.getElementById('downloadGeoJsonBtn').addEventListener('click', () => {
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const out = {
    type: 'FeatureCollection',
    metadata: { metric: m.label, year: effectiveYear(m), rateMode, bivariate: bivariateMode ? inf.label : null, source: m.source },
    features: feats.map(f => {
      const d = f.properties;
      const props = { district: d.district, value: metricValue(d, m), rank: rank(d) };
      if (bivariateMode) props[inf.key] = getInfraVal(d, inf);
      return { type: 'Feature', properties: props, geometry: f.geometry };
    }),
  };
  downloadBlob(JSON.stringify(out, null, 1), 'delhi_map_' + currentStateSuffix() + '.geojson', 'application/geo+json');
});
document.getElementById('shareUrlBtn').addEventListener('click', () => {
  updateUrlState();
  const input = document.createElement('input');
  input.value = location.href;
  document.body.appendChild(input);
  input.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(input);
  const btn = document.getElementById('shareUrlBtn');
  const original = btn.textContent;
  btn.textContent = '✓ Copied';
  setTimeout(() => { btn.textContent = original; }, 1500);
});

// ── Mobile: filter controls collapse into a bottom sheet below 720px (see the matching
// @media block in <style>); the district drawer also becomes a bottom sheet on mobile via CSS. ──
document.getElementById('mobileFilterToggle').addEventListener('click', () => {
  document.body.classList.toggle('mobile-filters-open');
});

// ── Point layers, all off by default so the map opens uncluttered ──
// Small colored shape icons (square/triangle/diamond/ring) instead of uniform circles, so
// layers stay visually distinguishable even before checking which color is which.
function shapeIcon(color, shape, size) {
  const s = size || 12;
  const cls = { square: 'sq', triangle: 'tri', diamond: 'dia', dot: 'dot', ring: 'ring' }[shape] || 'dot';
  const style = shape === 'triangle'
    ? 'border-bottom-color:' + color + ';'
    : 'width:' + s + 'px;height:' + s + 'px;background:' + color + ';border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)' + (shape==='ring' ? ',inset 0 0 0 2px #fff' : '') + ';';
  return L.divIcon({ className: 'shape-icon ' + cls, html: '<div class="shape-icon ' + cls + '" style="' + style + '"></div>', iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -s/2] });
}

function makeShapeLayer(points, color, shape, size) {
  const group = L.layerGroup();
  points.forEach(([lat, lng, name]) => {
    L.marker([lat, lng], { icon: shapeIcon(color, shape, size) }).bindPopup(name + '<div class="popup-src">Source: see footer citation on the main dashboard</div>').addTo(group);
  });
  return group;
}
// Dense layers (thousands of points) get marker clustering instead of individual shape icons —
// rendering 3,151 bus stops or 649 ATMs unclustered would be unreadable and slow to pan/zoom.
function makeClusterLayer(points, color, popupLabel) {
  const cluster = L.markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true });
  points.forEach(([lat, lng, name]) => {
    L.marker([lat, lng], { icon: shapeIcon(color, 'dot', 8) }).bindPopup((name || popupLabel) + '<div class="popup-src">Source: see footer citation on the main dashboard</div>').addTo(cluster);
  });
  return cluster;
}

const policeStationLayer = makeShapeLayer(POLICE.stations, '#3d5a99', 'square', 13);
const policePostLayer = makeShapeLayer(POLICE.posts, '#7c3aed', 'triangle', 13);
const busStopLayer = makeClusterLayer(POI.busStops, '#3f7d52', 'Bus Stop');
const atmLayer = makeClusterLayer(POI.atms, '#d4af37', 'ATM');
const alcoholLayer = makeShapeLayer(POI.alcoholShops, '#8b2f5e', 'diamond', 12);
const surveillanceLayer = makeShapeLayer(POI.surveillance, '#0891b2', 'ring', 11);

// ── Official liquor vends (approximate coordinates) — independent point layer, not the OSM-
// derived "Liquor Shops" layer above. Faded/hollow diamond styling signals "approximate, not a
// verified location" at a glance, matching this project's established approximate-vs-exact
// visual convention. Includes both the 374 official DSCSC/DCCWS records and the 13 OSM-only ones
// already present in the source file, distinguished in the popup by record_source.
const liquorVendsLayer = L.layerGroup();
LIQUOR_VENDS_APPROX.features.forEach(f => {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const isOfficial = p.record_source !== 'OpenStreetMap';
  L.marker([lat, lng], { icon: shapeIcon(isOfficial ? '#8b2f5e' : '#b98cae', 'diamond', 11) })
    .bindPopup('<div class="popup-title">' + p.name + '</div>' +
      '<div class="popup-rank">' + (isOfficial ? 'Official liquor vend' : 'OSM-only record') + (p.vend_category ? ' — ' + p.vend_category : '') + '</div>' +
      '<div style="font-style:italic;">Approximate coordinate (' + (p.coordinate_confidence || 'unknown') + ' confidence, ±' + fmtNum(p.estimated_accuracy_m) + 'm) — ' + (p.coordinate_warning || 'not a verified vend entrance') + '</div>' +
      '<div class="popup-src">Source: ' + (p.operator || 'DSCSC/DCCWS official list') + '</div>')
    .addTo(liquorVendsLayer);
});

// ── 2024 crash zones, full 93-zone approximate-coordinate pass — a separate, richer dataset from
// the "Crash zones" layer's 2024 option above (which uses only the 54/93 Nominatim-geocoded
// subset). Every one of these 93 has a coordinate, but every coordinate is an approximation
// (landmark/intersection/locality centre), never a surveyed crash location — labeled as such in
// every popup, not just a tooltip.
const crashZones2024ApproxLayer = L.layerGroup();
CRASH_ZONES_2024_APPROX.features.forEach(f => {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const fatal = p.all_fatal_crashes, total = p.all_total_crashes;
  const t = fatal != null ? Math.max(0, Math.min(1, (fatal - 1) / 6)) : 0.3;
  L.circleMarker([lat, lng], { radius: 4 + t * 4, color: '#e3a13b', weight: 1.5, dashArray: '3 2', fillColor: '#b14a34', fillOpacity: 0.5 + t * 0.35 })
    .bindPopup('<div class="popup-title">' + p.location_name + '</div>' +
      '<div class="popup-rank">' + (p.road_name || '') + '</div>' +
      '<div>' + (fatal != null ? fatal + ' fatal, ' + total + ' total crashes, 2024' : 'Not individually tabulated in Table 6.29 — no crash counts available') + '</div>' +
      '<div style="font-style:italic;">Approximate coordinate (' + p.coordinate_method + ', ' + p.coordinate_confidence + ' confidence, ±' + fmtNum(p.estimated_accuracy_m) + 'm) — ' + p.coordinate_warning + '</div>' +
      '<div class="popup-src">Source: Delhi Road Crash Report 2024, Delhi Traffic Police. Full 93-zone approximate-coordinate pass — distinct from the 54/93 geocoded subset in the "Crash zones" layer.</div>')
    .addTo(crashZones2024ApproxLayer);
});

// Crash zones support a year toggle (2023/2024) -- rebuildZonesLayer() clears and repopulates
// zonesGroup/zoneMarkers from whichever year is selected, so every spatial-analysis tool already
// built around zoneMarkers (runAnalysis(), showNearbyInfra()) automatically operates on the
// selected year without needing its own year-awareness.
const zonesGroup = L.layerGroup();
let zoneMarkers = []; // { zone, marker, baseStyle } -- kept so spatial-analysis highlighting and the
                        // click-for-nearby-infra panel can restyle/query individual zone markers.
function richBreakdownLine(z) {
  const parts = [];
  if (z.pedestrian_crash_prone) parts.push('Pedestrian: ' + z.pedestrian_fatal_crashes + ' fatal / ' + z.pedestrian_total_crashes + ' total');
  if (z.two_wheeler_crash_prone) parts.push('Two-wheeler: ' + z.two_wheeler_fatal_crashes + ' fatal / ' + z.two_wheeler_total_crashes + ' total');
  if (z.htv_crash_prone) parts.push('HTV: ' + z.htv_fatal_crashes + ' fatal / ' + z.htv_total_crashes + ' total');
  if (z.hit_and_run_crash_prone) parts.push('Hit-and-run: ' + z.hit_and_run_fatal_crashes + ' fatal / ' + z.hit_and_run_total_crashes + ' total');
  return parts.length ? '<div class="popup-src">' + parts.join(' · ') + '</div>' : '';
}
function rebuildZonesLayer() {
  zonesGroup.clearLayers();
  zoneMarkers = [];
  const wasOnMap = map.hasLayer(zonesGroup);
  ZONES_BY_YEAR[zoneYear].filter(z => z.lat != null && z.lng != null).forEach(z => {
    const t = Math.max(0, Math.min(1, (z.fatal - 1) / 6));
    const baseStyle = { radius: 4 + t * 4, color: '#fff', weight: 1, fillColor: '#b14a34', fillOpacity: 0.55 + t * 0.4 };
    const marker = L.circleMarker([z.lat, z.lng], baseStyle)
      .bindPopup('<b>' + z.name + '</b> (' + z.road + ')<br>' + z.fatal + ' fatal, ' + z.total + ' total crashes, ' + zoneYear +
        richBreakdownLine(z) +
        '<div class="popup-src">Source: Delhi Road Crash Report ' + zoneYear + '</div>')
      .addTo(zonesGroup);
    marker.on('click', () => showNearbyInfra(z));
    zoneMarkers.push({ zone: z, marker, baseStyle });
  });
  document.getElementById('cntZones').textContent = '(' + zoneMarkers.length.toLocaleString('en-IN') + ')';
  if (wasOnMap && !map.hasLayer(zonesGroup)) zonesGroup.addTo(map);
  if (typeof rebuildHeatLayer === 'function') rebuildHeatLayer();
}
rebuildZonesLayer();

// CCTV priority-candidate locations (report-recommended sites, not an existing camera inventory)
// -- pooled across both years' geocoded zones, grouped by name since a location can recur across
// report years. Every year a location was recommended in is shown in its popup, rather than
// keeping only the first year seen and silently dropping the rest.
const cctvPriorityLayer = L.layerGroup();
const cctvByName = new Map();
['2023', '2024'].forEach(year => {
  ZONES_BY_YEAR[year].filter(z => z.lat != null && z.cctvPriorityCandidate).forEach(z => {
    if (!cctvByName.has(z.name)) cctvByName.set(z.name, { name: z.name, lat: z.lat, lng: z.lng, years: [] });
    cctvByName.get(z.name).years.push({ year, fatal: z.fatal, total: z.total });
  });
});
cctvByName.forEach(site => {
  const yearsLine = site.years.map(y => y.year + ' (' + y.fatal + ' fatal / ' + y.total + ' total)').join(', ');
  L.marker([site.lat, site.lng], { icon: shapeIcon('#0891b2', 'ring', 13) })
    .bindPopup('<div class="popup-title">' + site.name + '</div>' +
      '<div class="popup-rank">Recommended CCTV site — ' + site.years.length + ' report year' + (site.years.length > 1 ? 's' : '') + '</div>' +
      '<div>Recommended in: <b>' + yearsLine + '</b></div>' +
      '<div class="popup-src">Report recommendation, not a verified existing camera — see the "CCTV/guards" layer for OSM-mapped existing cameras nearby. Source: Delhi Road Crash Report(s), Table 6.37.</div>')
    .addTo(cctvPriorityLayer);
});

const toggles = [
  ['chkPolice', policeStationLayer, 'cntPolice'], ['chkPosts', policePostLayer, 'cntPosts'], ['chkZones', zonesGroup, 'cntZones'],
  ['chkBus', busStopLayer, 'cntBus'], ['chkAtm', atmLayer, 'cntAtm'], ['chkAlcohol', alcoholLayer, 'cntAlcohol'], ['chkSurveillance', surveillanceLayer, 'cntSurveillance'],
  ['chkCctvPriority', cctvPriorityLayer, 'cntCctvPriority'],
  ['chkLiquorVends', liquorVendsLayer, 'cntLiquorVends'], ['chkCrashZones2024Approx', crashZones2024ApproxLayer, 'cntCrashZones2024Approx'],
];
const layerCounts = { cntPolice: POLICE.stations.length, cntPosts: POLICE.posts.length, cntZones: zoneMarkers.length, cntBus: POI.busStops.length, cntAtm: POI.atms.length, cntAlcohol: POI.alcoholShops.length, cntSurveillance: POI.surveillance.length, cntCctvPriority: cctvPriorityLayer.getLayers().length, cntLiquorVends: liquorVendsLayer.getLayers().length, cntCrashZones2024Approx: crashZones2024ApproxLayer.getLayers().length };
toggles.forEach(([id, layer, countId]) => {
  document.getElementById(countId).textContent = '(' + layerCounts[countId].toLocaleString('en-IN') + ')';
  document.getElementById(id).addEventListener('change', (e) => {
    if (e.target.checked) layer.addTo(map); else map.removeLayer(layer);
    updatePointLegend();
    updateUrlState();
  });
});

document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    zoneYear = btn.dataset.year;
    document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear));
    rebuildZonesLayer();
    updateUrlState();
  });
});

const POINT_LEGEND_ITEMS = [
  ['chkPolice', '#3d5a99', 'square', 'Police stations'], ['chkPosts', '#7c3aed', 'triangle', 'Chowkis/posts'],
  ['chkZones', '#b14a34', 'dot', 'Crash zones (size = fatal crashes)'], ['chkBus', '#3f7d52', 'dot', 'Bus stops (clustered)'],
  ['chkAtm', '#d4af37', 'dot', 'ATMs (clustered)'], ['chkAlcohol', '#8b2f5e', 'diamond', 'Liquor shops'], ['chkSurveillance', '#0891b2', 'ring', 'CCTV/guards'],
  ['chkCctvPriority', '#0891b2', 'ring', 'CCTV priority candidates (recommended, not existing)'],
  ['chkLiquorVends', '#8b2f5e', 'diamond', 'Liquor vends, official (approx. coordinates)'],
  ['chkCrashZones2024Approx', '#b14a34', 'dot', 'Crash zones 2024, full 93 (approx. coordinates)'],
];
function updatePointLegend() {
  const active = POINT_LEGEND_ITEMS.filter(([id]) => document.getElementById(id).checked);
  const el = document.getElementById('pointLegend');
  if (!active.length) { el.classList.remove('show'); return; }
  el.innerHTML = '<b style="color:var(--text);display:block;margin-bottom:4px;">Point layers</b>' + active.map(([id, color, shape, label]) =>
    '<div class="row"><span class="shape-icon ' + ({square:'sq',triangle:'tri',diamond:'dia',dot:'dot',ring:'ring'}[shape]) + '" style="width:10px;height:10px;background:' + (shape==='triangle'?'transparent':color) + ';' + (shape==='triangle' ? 'border-bottom-color:' + color + ';border-bottom-width:9px;' : 'border:1px solid #fff;') + '"></span>' + label + '</div>'
  ).join('');
  el.classList.add('show');
}

// ── Heatmap mode (Leaflet.heat) — crash zones weighted by fatal-crash count, as an alternative
// to plotting each zone as a discrete circle. Density heatmaps read more naturally than dozens
// of overlapping circles when zooming out to see citywide crash concentration at a glance.
// rebuildHeatLayer() is the single place that ever creates/replaces heatLayer, called both from
// this checkbox and from rebuildZonesLayer()/the reset button, so switching the crash-zone year
// while the heatmap is on refreshes it in place instead of leaving stale points on screen, and at
// most one heatLayer instance ever exists on the map at a time.
function rebuildHeatLayer() {
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  if (!document.getElementById('chkHeatmap').checked) return;
  const points = ZONES_BY_YEAR[zoneYear].filter(z => z.lat != null && z.lng != null).map(z => [z.lat, z.lng, Math.min(1, z.fatal / 10)]);
  heatLayer = L.heatLayer(points, { radius: 28, blur: 20, maxZoom: 15, gradient: { 0.2: '#e8d6b3', 0.5: '#d48a5a', 0.8: '#b14a34', 1: '#7a2515' } });
  heatLayer.addTo(map);
}
document.getElementById('chkHeatmap').addEventListener('change', () => { rebuildHeatLayer(); updateUrlState(); });

// ── Spatial-intersection analysis tools ──
// Haversine great-circle distance in meters -- accurate enough at Delhi's scale (city spans
// ~50km, well within the range where the spherical-earth approximation's error is negligible).
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function pointsWithin(lat, lng, points, radiusM) {
  return points.filter(p => haversineMeters(lat, lng, p[0], p[1]) <= radiusM);
}

let analysisRadius = 250;
function buildRadiusToggle() {
  const el = document.getElementById('radiusToggle');
  el.innerHTML = [100, 250, 500, 1000].map(r =>
    '<button class="' + (analysisRadius===r?'active':'') + '" data-r="' + r + '">' + (r>=1000 ? (r/1000)+'km' : r+'m') + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { analysisRadius = Number(btn.dataset.r); buildRadiusToggle(); runAnalysis(); });
  });
}
buildRadiusToggle();

const weakCoverageLayer = L.layerGroup();
function clearAnalysisHighlight() {
  zoneMarkers.forEach(({ marker, baseStyle }) => marker.setStyle(Object.assign({}, baseStyle, { className: '' })));
  map.removeLayer(weakCoverageLayer);
  document.getElementById('analysisSummary').textContent = '';
}

function runAnalysis() {
  const type = document.getElementById('analysisSelect').value;
  clearAnalysisHighlight();
  const summaryEl = document.getElementById('analysisSummary');
  if (type === 'none') return;

  if (type === 'weakPoliceCoverage') {
    // District-level, not radius-based: districts in the top tertile for the selected crime
    // metric AND the bottom tertile for police infrastructure density -- high crime, thin cover.
    const m = currentMetric();
    const feats = BOUNDARIES.features;
    const crimeVals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null).sort((a,b)=>a-b);
    const policeVals = feats.map(f => f.properties.policeInfraDensity).filter(v => v != null).sort((a,b)=>a-b);
    const matches = feats.filter(f => {
      const crime = metricValue(f.properties, m), police = f.properties.policeInfraDensity;
      if (crime == null || police == null) return false;
      return getTertileIndex(crime, crimeVals) === 2 && getTertileIndex(police, policeVals) === 0;
    });
    matches.forEach(f => {
      L.geoJSON(f, { style: { fillColor: 'transparent', fillOpacity: 0, color: 'var(--rust)', weight: 3, className: 'weak-cov-outline' } })
        .bindTooltip(f.properties.district + ' — high ' + m.label.toLowerCase() + ', weak police coverage', { sticky: true })
        .addTo(weakCoverageLayer);
    });
    weakCoverageLayer.addTo(map);
    summaryEl.innerHTML = '<b>' + matches.length + ' of 15</b> districts: top-tertile ' + m.label + ' + bottom-tertile Police Infra density (dashed rust outline).';
    return;
  }

  // Point-radius analyses over the 107 geocoded crash zones.
  const liquorPts = POI.alcoholShops.map(p => [p[0], p[1]]);
  const survPts = POI.surveillance.map(p => [p[0], p[1]]);
  const busPts = POI.busStops.map(p => [p[0], p[1]]);
  let matchCount = 0, label = '';
  zoneMarkers.forEach(({ zone, marker, baseStyle }) => {
    let isMatch = false;
    if (type === 'crashesNearLiquor') { isMatch = pointsWithin(zone.lat, zone.lng, liquorPts, analysisRadius).length > 0; label = 'have a liquor shop within'; }
    else if (type === 'crashesNoSurveillance') { isMatch = pointsWithin(zone.lat, zone.lng, survPts, analysisRadius).length === 0; label = 'have NO surveillance point within'; }
    else if (type === 'crashesNearBus') { isMatch = pointsWithin(zone.lat, zone.lng, busPts, analysisRadius).length > 0; label = 'have a bus stop within'; }
    if (isMatch) {
      matchCount++;
      marker.setStyle(Object.assign({}, baseStyle, { color: 'var(--amber)', weight: 3 }));
    } else {
      marker.setStyle(Object.assign({}, baseStyle, { fillOpacity: 0.15, color: '#fff' }));
    }
  });
  if (!map.hasLayer(zonesGroup)) { zonesGroup.addTo(map); document.getElementById('chkZones').checked = true; }
  summaryEl.innerHTML = '<b>' + matchCount + ' of ' + zoneMarkers.length + '</b> crash zones ' + label + ' ' + (analysisRadius>=1000 ? analysisRadius/1000+'km' : analysisRadius+'m') + '. Amber ring = match, faded = no match.';
}
document.getElementById('analysisSelect').addEventListener('change', runAnalysis);

// Click a crash zone → nearby-infrastructure panel, counting each POI type within the current
// analysis radius (defaults to 250m if no radius has been picked via the analysis tools yet).
function showNearbyInfra(zone) {
  const r = analysisRadius;
  const counts = {
    'Liquor shops': pointsWithin(zone.lat, zone.lng, POI.alcoholShops.map(p=>[p[0],p[1]]), r).length,
    'CCTV/guards': pointsWithin(zone.lat, zone.lng, POI.surveillance.map(p=>[p[0],p[1]]), r).length,
    'Bus stops': pointsWithin(zone.lat, zone.lng, POI.busStops.map(p=>[p[0],p[1]]), r).length,
    'ATMs': pointsWithin(zone.lat, zone.lng, POI.atms.map(p=>[p[0],p[1]]), r).length,
    'Police stations': pointsWithin(zone.lat, zone.lng, POLICE.stations.map(p=>[p[0],p[1]]), r).length,
    'Chowkis/posts': pointsWithin(zone.lat, zone.lng, POLICE.posts.map(p=>[p[0],p[1]]), r).length,
  };
  const el = document.getElementById('nearbyPanel');
  el.innerHTML = '<b>' + zone.name + ' — within ' + (r>=1000 ? r/1000+'km' : r+'m') + '</b>' +
    Object.entries(counts).map(([label, n]) => '<div class="nb-row"><span>' + label + '</span><span><b>' + n + '</b></span></div>').join('') +
    '<div style="margin-top:6px;font-style:italic;">Change the Radius control above to adjust.</div>';
  el.classList.add('show');
}

// ── Shared, validated exploratory-scoring helper — one implementation reused by every composite
// score on this page, instead of each score reinventing its own weighting/NaN-handling. Given a
// list of items and factors (each { key, label, invert, get(item) -> number|null }) and an
// optional weight map:
//   - Weights are normalized to sum to 1. If none are supplied, or any is missing/negative/non-
//     finite, or they sum to 0, falls back to equal weighting across all factors (never silently
//     drops a factor to weight 0 due to a bad input).
//   - A missing (null) factor value for an item is excluded from that item's score and its
//     weight is redistributed across the item's remaining covered factors — never coerced to 0,
//     so missing data cannot masquerade as "safest possible" or "worst possible".
//   - The result is always finite and clamped to [0, 100], or null if an item has zero covered
//     factors (never NaN).
//   - This only ever returns a percentile-based score — it never infers or displays a count (e.g.
//     "N cameras") from the score itself.
function normalizeExploratoryWeights(factorKeys, weights) {
  const equal = () => { const out = {}; factorKeys.forEach(k => { out[k] = 1 / factorKeys.length; }); return out; };
  if (!weights) return equal();
  const raw = factorKeys.map(k => weights[k]);
  const allValid = raw.every(w => typeof w === 'number' && Number.isFinite(w) && w >= 0);
  if (!allValid) return equal();
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equal();
  const out = {};
  factorKeys.forEach((k, i) => { out[k] = raw[i] / sum; });
  return out;
}
function computeExploratoryScore(items, factors, weights) {
  const normWeights = normalizeExploratoryWeights(factors.map(f => f.key), weights);
  const factorScales = factors.map(f => {
    const vals = items.map(f.get).filter(v => v != null && Number.isFinite(v));
    return { factor: f, scale: percentileScale(vals) };
  });
  const results = new Map();
  items.forEach(item => {
    const contributions = factorScales.map(({ factor, scale }) => {
      const v = factor.get(item);
      const weight = normWeights[factor.key];
      if (v == null || !Number.isFinite(v)) return { key: factor.key, label: factor.label, value: null, percentile: null, weight };
      const pct = factor.invert ? 1 - scale(v) : scale(v);
      return { key: factor.key, label: factor.label, value: v, percentile: pct, weight };
    });
    const covered = contributions.filter(c => c.percentile != null);
    const coveredWeightSum = covered.reduce((a, c) => a + c.weight, 0);
    let score = null;
    if (covered.length && coveredWeightSum > 0) {
      const weighted = covered.reduce((a, c) => a + (c.percentile * c.weight) / coveredWeightSum, 0);
      score = Math.max(0, Math.min(100, Math.round(weighted * 1000) / 10));
      if (!Number.isFinite(score)) score = null; // defensive: never surface a non-finite score
    }
    results.set(item, { score, contributions, coveredFactors: covered.length, totalFactors: factors.length });
  });
  return { scores: results, weights: normWeights };
}

// ── Composite "unsafe areas" layer — transparent methodology: plain average of five equally-
// weighted, percentile-ranked factors (see #methodOverlay for the full writeup, shown to the
// user via the "ⓘ methodology" link rather than left undocumented). No hidden weighting, no
// black-box scoring — every factor and its direction is spelled out and re-derivable from the
// same district fields already used elsewhere on this page. Uses computeExploratoryScore with no
// explicit weights, which falls back to the same equal-weighting this always used.
const UNSAFE_FACTORS = [
  { key: 'totalIPCDensity', label: 'Total IPC crime density', invert: false, get: d => d.totalIPC != null ? d.totalIPC / d.areaSqKm : null },
  { key: 'crimeAgainstWomenDensity', label: 'Crime against women density', invert: false, get: d => d.crimeAgainstWomen != null ? d.crimeAgainstWomen / d.areaSqKm : null },
  { key: 'fatalCrashDensity', label: 'Fatal crashes (2023) density', invert: false, get: d => d.fatalCrashes2023 != null ? d.fatalCrashes2023 / d.areaSqKm : null },
  { key: 'policeInfraDensity', label: 'Police infrastructure density', invert: true, get: d => d.policeInfraDensity },
  { key: 'lightDensityPerKm2', label: 'Streetlight density', invert: true, get: d => (SURVEYED.has(d.district) ? d.lightDensityPerKm2 : null) },
];
function computeUnsafeScores() {
  const allProps = BOUNDARIES.features.map(f => f.properties);
  const { scores: scoreMap } = computeExploratoryScore(allProps, UNSAFE_FACTORS, null);
  const scores = {};
  allProps.forEach(d => {
    const r = scoreMap.get(d);
    scores[d.district] = {
      score: r.score != null ? r.score / 100 : null, // kept on this page's existing 0-1 convention (popup multiplies by 100)
      contributions: r.contributions.map(c => ({ label: c.label, value: c.value, percentile: c.percentile })),
      coveredFactors: r.coveredFactors,
      totalFactors: r.totalFactors,
    };
  });
  return scores;
}

document.getElementById('chkUnsafe').addEventListener('change', (e) => {
  unsafeMode = e.target.checked;
  document.getElementById('unsafeMethodLink').style.display = unsafeMode ? '' : 'none';
  renderChoropleth();
});
document.getElementById('unsafeMethodLink').addEventListener('click', () => document.getElementById('methodOverlay').classList.add('show'));
document.getElementById('methodCloseBtn').addEventListener('click', () => document.getElementById('methodOverlay').classList.remove('show'));
document.getElementById('methodOverlay').addEventListener('click', (e) => { if (e.target.id === 'methodOverlay') e.currentTarget.classList.remove('show'); });

// ── Ward liquor-crash exploratory risk index — a new, ward-level composite distinct from both
// the district "unsafe areas" score above and the CCTV-priority-candidate layer (which is a
// report recommendation, not a model score). Explicitly exploratory: built from approximate-
// coordinate ward aggregates (2024 crash-zone density + official liquor-vend density), not an
// official Delhi Police index, and never attributes camera counts or any other inference beyond
// the percentile score itself.
const WARD_EXPLORATORY_FACTORS = [
  { key: 'crashZones2024Density', label: '2024 crash-zone density', invert: false, get: p => p.crashZones2024Density },
  { key: 'officialLiquorVendsDensity', label: 'Official liquor-vend density', invert: false, get: p => p.officialLiquorVendsDensity },
];
const WARD_EXPLORATORY_WEIGHTS = { crashZones2024Density: 0.6, officialLiquorVendsDensity: 0.4 };
let wardExploratoryScores = null;
function computeWardExploratoryScores() {
  const { scores } = computeExploratoryScore(wardsInfra.features.map(f => f.properties), WARD_EXPLORATORY_FACTORS, WARD_EXPLORATORY_WEIGHTS);
  return scores;
}

function renderWardExploratoryLayer() {
  if (wardLayer) { map.removeLayer(wardLayer); wardLayer = null; }
  if (!wardExploratoryMode) { renderWardLegend(false); return; }
  wardExploratoryScores = computeWardExploratoryScores();
  wardLayer = L.geoJSON(wardsInfra, {
    style: f => {
      const s = wardExploratoryScores.get(f.properties);
      return { fillColor: s.score == null ? '#999' : rustScale(s.score / 100), fillOpacity: 0.75, color: '#fff', weight: 0.8, dashArray: '4 2' };
    },
    onEachFeature: (f, layer) => {
      const p = f.properties;
      const s = wardExploratoryScores.get(p);
      const body = '<div class="popup-title">' + p.Ward_Name + '</div>' +
        (p.highInjuryNetwork ? '<div style="color:var(--rust);font-weight:700;">⚠ High-Injury Network — #' + p.highInjuryNetworkRank + ' of 18 wards accounting for half of 2024\\'s ward-assigned fatal crashes</div>' : '') +
        '<div class="popup-rank">Liquor-crash exploratory index: <b>' + (s.score != null ? s.score.toFixed(0) + '/100' : '—') + '</b> (' + s.coveredFactors + '/' + s.totalFactors + ' factors covered)</div>' +
        s.contributions.map(c => '<div class="unsafe-factor-row"><span>' + c.label + '</span><span>' + (c.percentile != null ? (c.percentile * 100).toFixed(0) + 'pct' : 'n/a') + '</span></div>').join('') +
        '<div class="popup-src">Exploratory index only — not an official Delhi Police score, not a camera-placement recommendation. Weighted average of percentile-ranked, approximate-coordinate ward aggregates (' + WARD_INFRA_BASIS_LABEL.exploratory + ').</div>';
      layer.bindPopup(body);
      layer.on('mouseover', () => layer.setStyle({ weight: 2.5, color: '#1c2331' }));
      layer.on('mouseout', () => layer.setStyle({ weight: 0.8, color: '#fff' }));
    },
  }).addTo(map);
  const el = document.getElementById('wardLegend');
  el.innerHTML = '<b>Liquor-Crash Exploratory Index (per ward)</b>' +
    '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
    '<div style="display:flex;justify-content:space-between;"><span>Lower</span><span>Higher</span></div>' +
    '<div style="margin-top:4px;font-style:italic;">0-100, exploratory — not an official score. Weighted avg: crash-zone density 60%, liquor-vend density 40%.</div>';
  el.classList.add('show');
}
document.getElementById('chkWardExploratoryIndex').addEventListener('change', (e) => {
  wardExploratoryMode = e.target.checked;
  if (wardExploratoryMode) {
    wardBivariateMode = false;
    document.getElementById('chkWardBivariate').checked = false;
    document.getElementById('wardInfraWrap').style.display = 'none';
  }
  renderWardExploratoryLayer();
  updateUrlState();
});

// ── Apply the deferred parts of the shared URL state (heatmap, zone year, ward mode/selectors,
// point layers) now that every section above has finished wiring its own event listeners --
// checking a box and dispatching 'change' here reaches the same code path a real click would.
function applyDeferredUrlState() {
  const s = pendingUrlState;
  if (!s) return;
  if (s.zoneYear && s.zoneYear !== zoneYear) {
    zoneYear = s.zoneYear;
    document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear));
    rebuildZonesLayer();
  }
  if (s.layers.length) {
    s.layers.forEach(id => {
      const chk = document.getElementById(id);
      if (chk && !chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
    });
  }
  if (s.heatmap) {
    const chk = document.getElementById('chkHeatmap');
    if (!chk.checked) { chk.checked = true; rebuildHeatLayer(); }
  }
  if (s.ward === 'biv') {
    if (s.wx) { wardInfraX = s.wx; wardInfraXSelect.value = s.wx; }
    if (s.wy) { wardInfraY = s.wy; wardInfraYSelect.value = s.wy; }
    document.getElementById('chkWardBivariate').checked = true;
    wardBivariateMode = true;
    document.getElementById('wardInfraWrap').style.display = '';
    renderWardLayer();
  } else if (s.ward === 'exp') {
    document.getElementById('chkWardExploratoryIndex').checked = true;
    wardExploratoryMode = true;
    renderWardExploratoryLayer();
  }
  updateUrlState();
}
applyDeferredUrlState();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'interactive_map.html'), html);
console.log('Written interactive_map.html. Size:', (html.length/1024).toFixed(1), 'KB');
