const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SERIES_STATUS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/series_status.json'), 'utf8'));
const covEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));
// Historical years (2011-2018) are drawn on the same map with the districts reported at the time; see scripts/lib/historical_map_shapes.js.
const histLib = require('./lib/historical_map_shapes');
const contLib = require('./lib/continuity');
const UT_SERIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/releases/delhi_ut_series/delhi_ut_crime.json'), 'utf8')).map(r => ({ year: r.year, status: r.status, offence_basis: r.offence_basis, theft: r.theft, robbery: r.robbery, burglary_old_head: r.burglary_old_head, criminal_trespass_burglary_revised_head: r.criminal_trespass_burglary_revised_head, burglary: r.burglary, total_ipc_bns: r.total_ipc_bns, total_sll: r.total_sll, total_crimes_against_women: r.total_crimes_against_women }));
const CONTINUITY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/continuity.json'), 'utf8'));
// The page needs the rules and reasons, not the evidence paths (those stay in data/continuity.json).
const CONTINUITY_PAGE = JSON.parse(JSON.stringify(CONTINUITY, (k, v) => k === 'evidence' ? undefined : v));
const histCounts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/historical_reporting/counts_2011_2018.json'), 'utf8'));
const HIST = {
  viewBox: histLib.VIEW_BOX,
  maps: histLib.buildShapes(ROOT).maps,
  notes: histLib.notes(ROOT),
  years: histCounts.years.map(y => ({
    year: y.year, sourceLabel: y.sourceLabel, notes: y.notes || [], territorialCount: y.territorialCount, map: {status: y.map.status, referenceYear: y.map.referenceYear},
    citywide: {scope: y.citywide.scope, values: y.citywide.values},
    units: y.units.map(u => ({label: u.label, territorial: u.territorial, values: u.values}))
  }))
};
const STATS_SRC = fs.readFileSync(path.join(__dirname, 'lib/stats.js'), 'utf8');
const grid = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/streetlight_grid.json'), 'utf8'));

const correlations = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/correlations.json'), 'utf8'));
const policeMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/police_markers.json'), 'utf8'));
const airportShape = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/airport_shape.json'), 'utf8'));
const roadSafetyTrends = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/road_safety_trends.json'), 'utf8'));
const trendFirstYear = roadSafetyTrends.trends[0].year;
const trendLastYear = roadSafetyTrends.trends[roadSafetyTrends.trends.length - 1].year;
const roadSafetyExtra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/road_safety_extra_2023_2024.json'), 'utf8'));
const accidentZones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_raw.json'), 'utf8'));
const accidentZonesMapped = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_mapped.json'), 'utf8'));
const accidentZones2024 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2024_geocoded.json'), 'utf8'));
const poiMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers.json'), 'utf8'));
const infraExtraMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers_infra_extras.json'), 'utf8'));
const osmStreetLampMarkers = infraExtraMarkers.streetLamps.map(([lat, lon, name]) => [
  Math.round((lon - 76.77599705784841) * 1576.2410031459287 * 10) / 10,
  Math.round((28.894521166321024 - lat) * 1795.3134203215425 * 10) / 10,
  name
]);
const font600 = fs.readFileSync(path.join(ROOT, 'fonts/bigshoulders600.woff2')).toString('base64');
const font800 = fs.readFileSync(path.join(ROOT, 'fonts/bigshoulders800.woff2')).toString('base64');

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Delhi Urban Safety Observatory</title><meta name="description" content="District-level crime and road-safety figures for Delhi's 15 police districts, 2016-2024, compared with public infrastructure: streetlights, underpasses, overbridges, metro gates and police."><meta name="theme-color" content="#1c2331"><link rel="icon" href="assets/favicon.svg" type="image/svg+xml"><script>try{var t=localStorage.getItem("ds-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
<style>
@font-face { font-family: 'Big Shoulders'; font-weight: 600; font-style: normal; src: url(data:font/woff2;base64,${font600}) format('woff2'); }
@font-face { font-family: 'Big Shoulders'; font-weight: 800; font-style: normal; src: url(data:font/woff2;base64,${font800}) format('woff2'); }

:root {
  --night: #1c2331;
  --paper: #edeae2;
  --paper-raised: #f6f4ee;
  --amber: #e3a13b;
  --amber-dim: #c98f34;
  --rust: #b14a34;
  --slate: #626b78;
  --bone: #e8e4da;
  --bg: var(--paper);
  --surface: var(--paper-raised);
  --border: #d8d3c6;
  --text: var(--night);
  --text-dim: var(--slate);
  --map-nodata-stripe: #cac5b6;
  --shadow: 0 1px 3px rgba(28,35,49,.08), 0 4px 14px rgba(28,35,49,.06);
  --label-fill: var(--night);
  --label-stroke: var(--paper-raised);
  --good: #3f7d52;
  --warn: var(--rust);
  --accent-text: #8a5800;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14181f; --surface: #1c2331; --border: #303a4c;
    --text: var(--bone); --text-dim: #9aa3b2;
    --map-nodata-stripe: #2c3648;
    --shadow: 0 1px 3px rgba(0,0,0,.3), 0 4px 20px rgba(0,0,0,.25);
    --label-fill: #ffffff; --label-stroke: #10131a;
    --good: #7bc492;
    --accent-text: var(--amber);
  }
}
:root[data-theme="dark"] {
  --accent-text: var(--amber);
  --bg: #14181f; --surface: #1c2331; --border: #303a4c;
  --text: var(--bone); --text-dim: #9aa3b2;
  --map-nodata-stripe: #2c3648;
  --shadow: 0 1px 3px rgba(0,0,0,.3), 0 4px 20px rgba(0,0,0,.25);
  --label-fill: #ffffff; --label-stroke: #10131a;
  --good: #7bc492;
}
:root[data-theme="light"] {
  --accent-text: #8a5800;
  --bg: var(--paper); --surface: var(--paper-raised); --border: #d8d3c6;
  --text: var(--night); --text-dim: var(--slate);
  --map-nodata-stripe: #cac5b6;
  --shadow: 0 1px 3px rgba(28,35,49,.08), 0 4px 14px rgba(28,35,49,.06);
  --label-fill: var(--night); --label-stroke: var(--paper-raised);
  --good: #3f7d52;
}

* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 14px; line-height: 1.5;
}
.wrap { max-width: 1280px; margin: 0 auto; padding: 0 24px 60px; }
html { scroll-behavior: smooth; scroll-padding-top: 64px; }
:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
.skip-link { position: absolute; left: 12px; top: -48px; z-index: 1000; background: var(--night); color: var(--bone); padding: 10px 14px; border-radius: 0 0 8px 8px; font-weight: 700; text-decoration: none; }
.skip-link:focus { top: 0; }
.topnav { position: sticky; top: 0; z-index: 500; display: flex; align-items: center; gap: 14px; margin: 0 -24px 14px; padding: 8px 24px; background: var(--surface); border-bottom: 1px solid var(--border); box-shadow: var(--shadow); }
.topnav .brand { font-family: 'Big Shoulders', -apple-system, sans-serif; font-weight: 800; font-size: 18px; letter-spacing: -.005em; color: var(--text); text-decoration: none; white-space: nowrap; }
.topnav-links { display: flex; gap: 2px; margin-left: 8px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.topnav-links::-webkit-scrollbar { display: none; }
.topnav-links a { color: var(--text-dim); text-decoration: none; font-size: 12.5px; font-weight: 650; padding: 7px 10px; border-radius: 6px; white-space: nowrap; }
.topnav-links a:hover { background: var(--bg); color: var(--text); }
.theme-btn { font: inherit; font-size: 16px; line-height: 1; width: 36px; height: 36px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); cursor: pointer; }
.theme-btn:hover { background: var(--bg); }
.nav-cta { background: var(--amber); color: var(--night); text-decoration: none; font-size: 12.5px; font-weight: 750; padding: 8px 13px; border-radius: 7px; white-space: nowrap; }
.nav-cta:hover { background: var(--amber-dim); }
.caveat-line { margin: 8px 0 0; font-size: 12.5px; color: var(--text-dim); max-width: 70ch; }
.caveat-line b { color: var(--text); }
.caveat-line a { color: var(--accent-text); font-weight: 650; }
.about-lede { margin: 0 0 10px; font-size: 13px; color: var(--text); max-width: 76ch; }
.sources { font-size: 12px; }
.sources summary { cursor: pointer; font-weight: 700; color: var(--text); padding: 6px 0; }
.sources ul { margin: 6px 0 0; padding-left: 18px; columns: 2 380px; column-gap: 28px; }
.sources li { margin-bottom: 6px; break-inside: avoid; }
.sources a { color: var(--accent-text); }
main > section, main > div { scroll-margin-top: 64px; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } *, *::before, *::after { transition-duration: .01ms !important; animation-duration: .01ms !important; } }
@media (pointer: coarse) { .metric-tab, .compare-btn, .dl-mini-btn, .layer-chip, .layer-action, .search-clear, .street-view-btn, .dl-item button, .topnav-links a { min-height: 44px; display: inline-flex; align-items: center; justify-content: center; } .toggle-row { min-height: 44px; } .search-item { min-height: 44px; } .search-input { min-height: 36px; } .control-select { min-height: 44px; } }

header.masthead { display: grid; grid-template-columns: minmax(0,1fr) minmax(220px,320px); gap: 20px; align-items: center; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
.header-copy { min-width: 0; }
.hero-image { width: 100%; height: 150px; object-fit: cover; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); }
.dynamic-map-link { display: none; margin-top: 14px; padding: 10px 15px; background: var(--amber); border-color: var(--amber); color: var(--night); text-decoration: none; font-size: 13px; }
.dynamic-map-link:hover { background: var(--amber-dim); color: var(--night); }
@media (max-width: 760px) { .wrap { padding: 0 14px 44px; } .topnav { margin: 0 -14px 12px; padding: 6px 12px; gap: 8px; } .topnav .brand { display: none; } .hero-image { display: none; } header.masthead { grid-template-columns: 1fr; } .dynamic-map-link { width: 100%; justify-content: center; min-height: 44px; } h1 { font-size: clamp(26px, 7.4vw, 36px); } .subhead { font-size: 13px; } .controls { gap: 9px; } .metric-tabs { width: 100%; overflow-x: auto; flex-wrap: nowrap; } .metric-tab { flex: 0 0 auto; } .toggle-row { width: 100%; margin-left: 0; } .panel { border-radius: 8px; } .map-panel, .detail, .method-panel, .scatter-panel, .download-panel { padding: 12px; } .detail-head { align-items: flex-start; flex-direction: column; } }
@media (max-width: 760px) { .topnav { overflow-x: auto; scrollbar-width: none; } .topnav::-webkit-scrollbar { display: none; } .topnav > * { flex: none; } }
.eyebrow { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--accent-text); }
h1 { font-family: 'Big Shoulders', -apple-system, sans-serif; font-weight: 800; font-size: 42px; line-height: 1.02; margin: 2px 0 4px; text-wrap: balance; letter-spacing: -.01em; }
.subhead { color: var(--text-dim); font-size: 13.5px; max-width: 66ch; }

.purpose-banner {
  display: flex; gap: 14px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--border); border-left: 4px solid var(--amber);
  border-radius: 8px; padding: 14px 18px; font-size: 13px; color: var(--text-dim); margin-bottom: 22px;
  box-shadow: var(--shadow);
}
.purpose-title { color: var(--text); font-size: 14.5px; display: block; margin-bottom: 4px; font-weight: 700; }
.purpose-banner p { margin: 0; line-height: 1.45; }
.purpose-banner p b { display: inline; font-weight: 700; color: var(--text); }
.purpose-icon { font-size: 24px; line-height: 1; flex-shrink: 0; }

.tt-metric { font-size: 12px; margin-bottom: 4px; font-weight: 600; color: var(--text); }
.tt-breakdown { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; font-size: 11px; min-width: 170px; }
.tt-row { display: flex; justify-content: space-between; gap: 14px; color: var(--text-dim); }
.tt-row b { color: var(--text); font-weight: 700; }

.datanote {
  background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--amber);
  border-radius: 6px; font-size: 12.5px; color: var(--text-dim); margin-bottom: 16px;
}
.datanote summary { cursor: pointer; list-style: none; padding: 10px 14px; color: var(--text); font-weight: 750; display: flex; align-items: center; gap: 8px; }
.datanote summary::-webkit-details-marker { display: none; }
.cov-wrap { overflow-x: auto; margin: 8px 0; }
.cov-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.cov-table th, .cov-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
.cov-table thead th { color: var(--text-dim); font-weight: 650; }
.cov-table tbody th { font-weight: 650; color: var(--text); }
#roadTrendCaveat a { color: var(--accent-text); text-underline-offset: 2px; }
.cov-status { display: inline-block; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 700; border: 1px solid var(--border); white-space: nowrap; }
.cov-production { color: var(--text); } .cov-provisional, .cov-staged { color: var(--accent-text); } .cov-not_published, .cov-not_implemented, .cov-retained_legacy_year { color: var(--text-dim); }
.cov-note { color: var(--text-dim); font-size: 13px; }
.datanote summary::before { content: '▸'; color: var(--accent-text); }
.datanote[open] summary::before { content: '▾'; }
.datanote[open] summary { border-bottom: 1px solid var(--border); }
.datanote-body { padding: 10px 14px 12px; }
.datanote b { color: var(--text); font-weight: 700; }
.datanote ul { margin: 0; padding-left: 18px; }
.datanote li { margin-bottom: 5px; }
.data-status-panel { margin: 12px 0 0; border:1px solid var(--border); border-left:3px solid var(--amber); border-radius:8px; background:var(--surface); padding:12px 14px; display:grid; grid-template-columns:minmax(190px,1.2fr) repeat(4,minmax(120px,1fr)); gap:8px 14px; align-items:start; font-size:11.5px; box-shadow:var(--shadow); } .data-status-panel b { font-size:13px; } .data-status-label { display:block; font-size: 11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:var(--text-dim); margin-bottom:2px; } .data-status-value { color:var(--text); line-height:1.35; } .data-status-badge { display:inline-block; border-radius:999px; padding:2px 7px; font-size: 11px; font-weight:800; letter-spacing:.04em; text-transform:uppercase; } .data-status-badge.production { background:rgba(63,125,82,.16); color:var(--good); } .data-status-badge.partial { background:rgba(227,161,59,.2); color:#8a5800; } @media (max-width:760px) { .data-status-panel { grid-template-columns:1fr 1fr; } .data-status-panel b { grid-column:1/-1; } }

.controls { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-bottom: 16px; }

.search-container { width: 100%; position: relative; margin-bottom: 6px; }
.search-input-wrap {
  display: flex; align-items: center; background: var(--surface);
  border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; gap: 10px;
  box-shadow: var(--shadow); transition: border-color .15s;
}
.search-input-wrap:focus-within { border-color: var(--amber); }
.search-icon { font-size: 14px; opacity: .6; }
.search-input { border: none; background: transparent; color: var(--text); font: inherit; font-size: 13px; width: 100%; outline: none; }
.search-input::placeholder { color: var(--text-dim); }
.search-clear { border: none; background: transparent; color: var(--text-dim); font-size: 14px; cursor: pointer; padding: 0 4px; display: none; }
.search-clear:hover { color: var(--text); }

.search-dropdown {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0;
  background: var(--night); border: 1px solid var(--border); border-radius: 8px;
  max-height: 260px; overflow-y: auto; z-index: 100; box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  display: none;
}
.search-dropdown.on { display: block; }
.search-item {
  padding: 10px 14px; font-size: 12.5px; color: var(--bone); cursor: pointer;
  display: flex; justify-content: space-between; align-items: center;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.search-item:last-child { border-bottom: none; }
.search-item:hover { background: rgba(255,255,255,0.12); }
.search-item .type { font-size: 11px; color: var(--text-dim); background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; }

.compare-btn {
  font: inherit; font-size: 12px; font-weight: 700; padding: 7px 12px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--surface);
  color: var(--text); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
  transition: background .12s, color .12s;
}
.compare-btn:hover { background: var(--night); color: var(--bone); }
.compare-btn.active { background: var(--amber); color: var(--night); border-color: var(--amber); }

.compare-card { margin-top: 18px; padding: 18px 20px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }
.compare-card h2 { font-family: 'Big Shoulders', sans-serif; font-size: 22px; font-weight: 800; margin: 0 0 12px; display: flex; justify-content: space-between; align-items: center; }
.compare-grid { margin-top: 14px; max-width: 480px; }
.compare-col { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
.compare-col h3 { font-family: 'Big Shoulders', sans-serif; font-size: 24px; margin: 0 0 10px; color: var(--text); }

.sparkline-wrap { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; vertical-align: middle; }
.sparkline-svg { width: 70px; height: 22px; overflow: visible; }

.metric-tabs { display: inline-flex; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; padding: 3px; gap: 2px; flex-wrap: wrap; }
.metric-tab { font: inherit; font-size: 12px; font-weight: 600; padding: 7px 12px; border: none; background: transparent; color: var(--text-dim); border-radius: 5px; cursor: pointer; white-space: nowrap; transition: background .12s, color .12s; }
.metric-tab:hover { color: var(--text); }
.metric-tab.active { background: var(--night); color: var(--bone); }

.control-bar { display: grid; grid-template-columns: minmax(260px, 1.5fr) minmax(210px, .85fr) minmax(112px, .45fr) auto auto auto; gap: 10px; align-items: end; margin-bottom: 12px; }
.control-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.control-label { color: var(--text-dim); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.control-select { width: 100%; min-height: 38px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); font: inherit; font-size: 12.5px; font-weight: 650; padding: 0 34px 0 11px; }
.control-select:focus-visible, .metric-tab:focus-visible, .compare-btn:focus-visible, .layer-action:focus-visible, .layer-chip:focus-visible { outline: 2px solid var(--amber); outline-offset: 2px; }
.control-segment { min-height: 38px; align-items: center; flex-wrap: nowrap; }
.display-control .metric-tab.active { background: var(--amber); color: var(--night); }
.primary-action { min-height: 38px; justify-content: center; }

.toggle-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-dim); cursor: pointer; user-select: none; }
.switch { width: 34px; height: 19px; border-radius: 20px; background: var(--border); position: relative; transition: background .15s; flex-shrink: 0; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--surface); transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.toggle-row.on .switch { background: var(--amber); }
.toggle-row.on .switch::after { transform: translateX(15px); }

.layer-group { border: 1px solid var(--border); border-radius: 9px; background: var(--surface); margin-bottom: 10px; }
.layer-group.active { border-color: var(--amber); }
.layer-group summary { cursor: pointer; padding: 10px 14px; font-size: 12.5px; font-weight: 750; color: var(--text-dim); list-style: none; user-select: none; display: flex; align-items: center; gap: 8px; }
.layer-group summary::-webkit-details-marker { display: none; }
.layer-group summary::before { content: '▸ '; display: inline-block; }
.layer-group[open] summary::before { content: '▾ '; }
.layer-group[open] summary { color: var(--text); border-bottom: 1px solid var(--border); }
.layer-count-badge { margin-left: auto; color: var(--text-dim); background: var(--bg); border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 750; }
.layer-group-body { padding: 12px 14px; }
.layer-group-grid { display: grid; grid-template-columns: repeat(3, minmax(180px, 1fr)); gap: 8px 20px; }
.layer-section { display: grid; gap: 8px; align-content: start; }
.layer-section-title { color: var(--text-dim); font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 1px; }
.layer-footer { display: flex; justify-content: flex-end; border-top: 1px solid var(--border); margin-top: 12px; padding-top: 10px; }
.layer-action { border: 0; background: transparent; color: var(--rust); font: inherit; font-size: 11.5px; font-weight: 750; cursor: pointer; padding: 5px 7px; border-radius: 5px; }
.layer-action:disabled { color: var(--text-dim); cursor: default; opacity: .55; }
.active-layer-strip { display: none; align-items: center; gap: 7px; flex-wrap: wrap; margin: 0 0 14px; }
.active-layer-strip.on { display: flex; }
.active-layer-label { color: var(--text-dim); font-size: 11px; font-weight: 750; }
.layer-chip { border: 1px solid var(--amber); background: var(--surface); color: var(--text); border-radius: 999px; font: inherit; font-size: 11px; font-weight: 650; padding: 5px 9px; cursor: pointer; }
.layer-chip:hover { background: var(--night); color: var(--bone); }

@media (max-width: 1080px) {
  .control-bar { grid-template-columns: minmax(260px, 1fr) minmax(210px, 1fr) minmax(110px, .5fr); }
  .layer-group-grid { grid-template-columns: repeat(2, minmax(180px, 1fr)); }
}
@media (max-width: 760px) {
  .control-bar { grid-template-columns: 1fr 1fr; gap: 9px; }
  .control-bar .search-container, .control-field.metric-field { grid-column: 1 / -1; }
  .primary-action, .control-select { min-height: 44px; }
  .control-segment { min-height: 44px; width: 100%; }
  .control-segment .metric-tab { flex: 1; min-height: 36px; }
  .layer-group summary { min-height: 44px; }
  .layer-group-grid { grid-template-columns: 1fr; gap: 14px; }
  .toggle-row { min-height: 36px; }
}

.grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 20px; align-items: start; }
@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }

.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }

.map-panel { padding: 14px; }
.map-stage { position: relative; width: 100%; }
.map-stage svg { width: 100%; height: auto; display: block; outline: none; }
path.district { stroke: var(--surface); stroke-width: 1.6; cursor: pointer; transition: opacity .12s; outline: none !important; }
path.district:focus, path.district:focus-visible, svg *:focus, svg *:focus-visible { outline: none !important; }
path.district:hover { opacity: .82; }
.district-hatch { fill: url(#hatch); pointer-events: none; }
.district-label { font-family: 'Big Shoulders', sans-serif; font-weight: 700; font-size: 13px; fill: var(--label-fill); paint-order: stroke; stroke: var(--label-stroke); stroke-width: 3px; stroke-linejoin: round; pointer-events: none; text-anchor: middle; }
.police-marker { stroke: white; stroke-width: 1; cursor: default; }
.police-marker.station { fill: #3d5a99; }
.police-marker.post { fill: #7c3aed; }
.district-center-ring { fill: none; stroke: var(--label-fill); stroke-width: 1.6; pointer-events: auto; cursor: help; }
.district-center-dot { fill: var(--label-fill); pointer-events: none; }
.zone-marker { fill: var(--rust); stroke: white; stroke-width: 1; pointer-events: auto; cursor: default; }
.poi-marker { cursor: default; pointer-events: auto; }
.streetlight-survey-point { fill: #f2c94c; stroke: #6b4f00; stroke-width: .6; opacity: .68; cursor: help; pointer-events: auto; }
.streetlight-survey-point:hover { opacity: 1; stroke-width: 1.2; }
.poi-osm-lamp { fill: #22b8cf; stroke: #083344; stroke-width: .55; opacity: .78; }
.poi-osm-lamp:hover { opacity: 1; stroke-width: 1; }
.poi-bus { fill: var(--good); stroke: white; stroke-width: .5; opacity: .55; }
.poi-atm { fill: #d4af37; stroke: white; stroke-width: .75; opacity: .8; }
.poi-alcohol { fill: #8b2f5e; stroke: white; stroke-width: .75; opacity: .85; }
.poi-surveillance { fill: #0891b2; stroke: white; stroke-width: .75; opacity: .8; }
.airport-shape { fill: var(--slate); fill-opacity: .35; stroke: var(--slate); stroke-width: 1.4; stroke-dasharray: 4,3; pointer-events: auto; cursor: help; }
.airport-label { font-family: 'Big Shoulders', sans-serif; font-weight: 700; font-size: 11px; fill: var(--label-fill); paint-order: stroke; stroke: var(--label-stroke); stroke-width: 2.5px; stroke-linejoin: round; pointer-events: none; text-anchor: middle; }

.legend { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 11.5px; color: var(--text-dim); flex-wrap: wrap; }
.legend-scale-note { font-size: 11px; font-style: italic; opacity: .8; }
.map-tooltip { position: fixed; pointer-events: none; z-index: 9999; background: var(--night); color: var(--bone); font-size: 12px; line-height: 1.4; padding: 8px 12px; border-radius: 6px; box-shadow: 0 4px 16px rgba(0,0,0,0.35); opacity: 0; transition: opacity .1s ease; max-width: 260px; white-space: normal; border: 1px solid var(--border); }
.map-tooltip.on { opacity: 1; }
.map-tooltip b { display: block; margin-bottom: 3px; font-weight: 700; color: var(--bone); }
.map-tooltip .tt-body { color: var(--text-dim); font-size: 11.5px; line-height: 1.4; }
.legend-scale { display: flex; height: 10px; width: 140px; border-radius: 3px; overflow: hidden; }
.legend-scale span { flex: 1; }
.legend-swatch { width: 12px; height: 12px; border-radius: 2px; display: inline-block; margin-right: 5px; vertical-align: -1px; }

.list-panel { padding: 16px 16px 8px; max-height: 640px; overflow-y: auto; }
.list-panel h2 { font-family: 'Big Shoulders', sans-serif; font-size: 18px; font-weight: 800; margin: 0 0 4px; letter-spacing: -.005em; }
.list-sub { font-size: 11.5px; color: var(--text-dim); margin-bottom: 12px; }
.rank-row { display: grid; grid-template-columns: 20px 1fr auto; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid var(--border); cursor: pointer; border-radius: 4px; }
.rank-row:last-child { border-bottom: none; }
body.history-mode .rate-field, body.history-mode .display-field, body.history-mode #compareToggleBtn, body.history-mode #mapLayersGroup, body.history-mode #activeLayerChips, body.history-mode .search-container, body.history-mode #methodSection, body.history-mode #scatterSection, body.history-mode #compareCard { display: none !important; }
#mapHistory path { stroke: var(--surface); stroke-width: 1.3; fill-rule: evenodd; cursor: pointer; transition: fill .25s ease; }
#mapHistory path.sel, #mapHistory path:hover, #mapHistory path:focus-visible { stroke: var(--night); stroke-width: 3; outline: none; }
:root[data-theme="dark"] #mapHistory path.sel, :root[data-theme="dark"] #mapHistory path:hover { stroke: #fff; }
@media (prefers-reduced-motion: reduce) { #mapHistory path { transition: none; } }
.rank-row:hover { background: var(--bg); }
.rank-row.selected { background: var(--bg); box-shadow: inset 3px 0 0 var(--amber); }
.rank-num { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace; font-size: 11px; color: var(--text-dim); text-align: right; }
.rank-name { font-weight: 700; font-size: 13px; }
.rank-bar-track { grid-column: 1 / -1; height: 5px; background: var(--bg); border-radius: 3px; overflow: hidden; margin-top: -2px; }
.rank-bar-fill { height: 100%; border-radius: 3px; }
.rank-val { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 12.5px; font-weight: 600; }

.street-view-btn {
  font-family: -apple-system, sans-serif;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--accent-text);
  text-decoration: none;
  white-space: nowrap;
  margin-left: 6px;
  transition: background .12s, color .12s;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.street-view-btn:hover {
  background: var(--amber);
  color: var(--night);
  border-color: var(--amber);
}

.detail { margin-top: 18px; padding: 16px 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 14px 20px; }
.detail-head { grid-column: 1 / -1; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 2px; }
.detail-head h2 { font-family: 'Big Shoulders', sans-serif; font-size: 26px; font-weight: 800; margin: 0; }
.detail-head .area { font-size: 12px; color: var(--text-dim); font-family: "IBM Plex Mono", monospace; }
.stat { display: flex; flex-direction: column; gap: 2px; }
.stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 700; display: flex; align-items: center; gap: 5px; }
.stat-val { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; }
.stat-val.nodata { font-size: 13px; font-style: italic; color: var(--text-dim); font-weight: 400; }
.stat-sub { font-size: 11px; color: var(--text-dim); font-weight: 400; }
.yoy-badge { font-family: -apple-system, sans-serif; font-size: 11px; font-weight: 700; margin-left: 6px; vertical-align: middle; }
.confidence-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.confidence-dot.high { background: var(--good); }
.confidence-dot.partial { background: var(--warn); }

.section-divider { grid-column: 1 / -1; height: 1px; background: var(--border); margin: 4px 0; }

.analysis { grid-column: 1 / -1; margin-top: 6px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 10px; }
.confidence-badge { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; font-size: 11px; font-weight: 700; letter-spacing: .02em; padding: 4px 10px; border-radius: 20px; }
.confidence-badge.high { background: rgba(69,133,86,.14); color: var(--good); }
.confidence-badge.partial { background: rgba(177,74,52,.14); color: var(--rust); }
.analysis p { margin: 0; font-size: 13px; line-height: 1.6; color: var(--text-dim); max-width: 76ch; }
.analysis p b { color: var(--text); font-weight: 700; }

.method-panel { margin-top: 20px; padding: 18px 20px; }
.method-panel h2 { font-family: 'Big Shoulders', sans-serif; font-size: 18px; font-weight: 800; margin: 0 0 4px; }
.method-sub { font-size: 12px; color: var(--text-dim); margin-bottom: 16px; max-width: 74ch; }
.method-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px; }
.method-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
.method-card .name { font-weight: 700; font-size: 12.5px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
.method-card .formula { font-family: "IBM Plex Mono", monospace; font-size: 11.5px; background: var(--bg); border-radius: 4px; padding: 6px 8px; margin: 6px 0; color: var(--text); }
.method-card p { margin: 4px 0 0; font-size: 11.5px; color: var(--text-dim); line-height: 1.5; }
.r-value { font-family: "IBM Plex Mono", monospace; font-weight: 700; font-size: 15px; }
details.method-detail { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 14px; }
details.method-detail summary { cursor: pointer; font-size: 12.5px; font-weight: 700; color: var(--text-dim); }
details.method-detail summary:hover { color: var(--text); }
details.method-detail .body { font-size: 12.5px; color: var(--text-dim); line-height: 1.6; margin-top: 10px; max-width: 76ch; }
details.method-detail .body p { margin: 0 0 8px; }
details.method-detail code { font-family: "IBM Plex Mono", monospace; background: var(--bg); padding: 1px 5px; border-radius: 3px; }

.scatter-panel { margin-top: 20px; padding: 18px 20px; }
.scatter-panel h2 { font-family: 'Big Shoulders', sans-serif; font-size: 18px; font-weight: 800; margin: 0 0 4px; }
.scatter-sub { font-size: 12px; color: var(--text-dim); margin-bottom: 14px; max-width: 72ch; }
.scatter-layout { display: grid; grid-template-columns: minmax(0,1fr) 200px; gap: 20px; align-items: start; }
@media (max-width: 700px) { .scatter-layout { grid-template-columns: 1fr; } }
.scatter-layout canvas { width: 100%; height: auto; display: block; }
.scatter-stat { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; }
.scatter-stat .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 700; }
.scatter-stat .val { font-family: "IBM Plex Mono", monospace; font-size: 22px; font-weight: 700; margin-top: 2px; }
.scatter-read { font-size: 11.5px; color: var(--text-dim); line-height: 1.5; }
.zone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px 12px; margin-top: 14px; }
.zone-item { font-size: 12.5px; color: var(--text); padding: 6px 8px; border-radius: 5px; background: var(--surface); border: 1px solid var(--border); display: flex; gap: 8px; align-items: baseline; }
.zone-item .zone-num { font-family: "IBM Plex Mono", monospace; font-size: 11px; color: var(--text-dim); flex-shrink: 0; }
.zone-item .zone-name { flex: 1; }
.zone-item .zone-road { color: var(--text-dim); font-size: 11px; }
.zone-item .zone-severity { font-family: "IBM Plex Mono", monospace; font-size: 11px; font-weight: 700; color: var(--rust); flex-shrink: 0; white-space: nowrap; }
.rs-tab-panel { display: none; }
.rs-tab-panel.active { display: block; }

.download-panel { margin-top: 20px; padding: 18px 20px; }
.download-panel h2 { font-family: 'Big Shoulders', sans-serif; font-size: 18px; font-weight: 800; margin: 0 0 4px; }
.dl-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
@media (max-width: 700px) { .dl-columns { grid-template-columns: 1fr; } }
.dl-col-head { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; font-weight: 700; color: var(--text-dim); margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dl-list { border: 1px solid var(--border); border-radius: 8px; min-height: 140px; max-height: 260px; overflow-y: auto; padding: 6px; display: flex; flex-direction: column; gap: 4px; background: var(--bg); }
.dl-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 5px; background: var(--surface); border: 1px solid var(--border); font-size: 12.5px; }
.dl-item .dl-item-label { flex: 1; }
.dl-item button { font: inherit; font-size: 11px; font-weight: 700; border: none; background: transparent; color: var(--text-dim); cursor: pointer; padding: 2px 5px; border-radius: 4px; line-height: 1; }
.dl-item button:hover { background: var(--bg); color: var(--text); }
.dl-mini-btn { font: inherit; font-size: 11px; font-weight: 700; border: 1px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; padding: 3px 8px; border-radius: 12px; text-transform: none; letter-spacing: 0; }
.dl-mini-btn:hover { color: var(--text); border-color: var(--text-dim); }
.dl-download-btn { font: inherit; font-size: 13px; font-weight: 700; border: none; background: var(--amber); color: var(--night); cursor: pointer; padding: 10px 18px; border-radius: 7px; transition: background .12s; }
.dl-download-btn:hover { background: var(--amber-dim); }
.dl-download-btn:disabled { opacity: .5; cursor: not-allowed; }
.dl-static { margin: 0 0 16px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); display: flex; flex-wrap: wrap; gap: 10px 14px; align-items: center; }
.dl-static-label { flex: 1 1 240px; font-size: 12.5px; color: var(--text-dim); line-height: 1.4; }
.dl-static-label b { display: block; font-size: 13px; color: var(--text); font-weight: 800; margin-bottom: 2px; }
.dl-link-btn { font: inherit; font-size: 12.5px; font-weight: 700; text-decoration: none; padding: 9px 14px; border-radius: 7px; display: inline-block; white-space: nowrap; transition: background .12s, border-color .12s, color .12s; }
.dl-link-btn.primary { background: var(--amber); color: var(--night); }
.dl-link-btn.primary:hover { background: var(--amber-dim); }
.dl-link-btn.secondary { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
.dl-link-btn.secondary:hover { color: var(--text); border-color: var(--text-dim); }
.dl-sheet-list { margin: 0 0 16px; padding-left: 20px; font-size: 12.5px; color: var(--text-dim); line-height: 1.7; }
.dl-sheet-list li { margin-bottom: 3px; }
.dl-sheet-list b { color: var(--text); }

/* Overview / Explore / Data & methods */
.site-section { margin: 0 0 40px; }
.section-title { font-family: 'Big Shoulders', -apple-system, sans-serif; font-weight: 800; font-size: 34px; line-height: 1.05; margin: 0 0 6px; letter-spacing: -.01em; }
.section-lede { margin: 0 0 16px; color: var(--text-dim); max-width: 76ch; font-size: 14px; }
.nav-more { position: relative; flex: none; }
.nav-more summary { list-style: none; cursor: pointer; font-size: 12.5px; font-weight: 750; padding: 8px 13px; border-radius: 7px; border: 1px solid var(--border); background: var(--surface); color: var(--text); white-space: nowrap; }
.nav-more summary::-webkit-details-marker { display: none; }
.nav-more[open] .nav-more-menu { position: fixed; top: 58px; right: 14px; z-index: 600; min-width: 260px; display: flex; flex-direction: column; padding: 6px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }
.nav-more-menu a { color: var(--text); text-decoration: none; font-size: 13px; font-weight: 650; padding: 10px 12px; border-radius: 6px; }
.nav-more-menu a:hover { background: var(--bg); }
.overview-grid { display: grid; grid-template-columns: 3fr 2fr; gap: 16px; margin: 0 0 16px; }
.overview-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); }
.overview-card h2 { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 24px; font-weight: 800; margin: 0 0 10px; }
.finding { padding: 10px 0; border-bottom: 1px solid var(--border); }
.finding:last-child { border-bottom: none; padding-bottom: 0; }
.finding h3 { margin: 0 0 3px; font-size: 13px; font-weight: 800; }
.finding p, .limit-list li { margin: 0; font-size: 13px; line-height: 1.5; color: var(--text-dim); }
.limit-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }
.limit-list b { color: var(--text); }
.start-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.start-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); }
.topic-start, .topic-btn { font: inherit; font-size: 13px; font-weight: 750; padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); cursor: pointer; min-height: 40px; }
.topic-start { background: var(--amber); border-color: var(--amber); color: var(--night); }
.topic-start:hover { background: var(--amber-dim); }
.topic-switch { display: inline-flex; gap: 6px; padding: 4px; margin: 0 0 14px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); }
.topic-btn { border-color: transparent; }
.topic-btn[aria-pressed="true"] { background: var(--amber); color: var(--night); }
body.topic-road #roadSection { display: block; }
body:not(.topic-road) #roadSection { display: none; }
.explainer { margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); }
.explainer-title { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 20px; font-weight: 800; margin: 0 0 10px; }
.explainer-title-sm { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); margin: 0 0 8px; }
.explainer-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 20px; }
.explainer-grid h3 { margin: 0 0 2px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 800; }
.explainer-grid p { margin: 0; font-size: 13px; line-height: 1.5; }
.explainer-more { margin-top: 10px; font-size: 13px; }
.explainer-more summary { cursor: pointer; font-weight: 750; color: var(--accent-text); }
.explainer-more p { margin: 8px 0 0; line-height: 1.5; color: var(--text-dim); }
.mini-glossary { margin: 8px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 4px 12px; font-size: 12.5px; }
.mini-glossary dt, #glossaryList dt { font-weight: 800; }
.mini-glossary dd, #glossaryList dd { margin: 0; color: var(--text-dim); }
.explainer-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
.explainer-status { font-size: 12px; color: var(--text-dim); }
.table-wrap { margin-top: 12px; max-height: 360px; overflow: auto; border: 1px solid var(--border); border-radius: 8px; }
.view-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.view-table caption { text-align: left; font-weight: 750; padding: 10px 12px; }
.view-table th, .view-table td { text-align: left; padding: 7px 12px; border-top: 1px solid var(--border); }
.view-table td { text-align: right; font-variant-numeric: tabular-nums; }
.dm-jump { margin: 0 0 14px; font-size: 13px; }
.dm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0 0 16px; }
.dm-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); }
.dm-card h3 { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 20px; font-weight: 800; margin: 0 0 8px; }
.dm-card p, .dm-card li { font-size: 13px; line-height: 1.5; color: var(--text-dim); margin: 0 0 8px; }
.dm-card ul { margin: 0; padding-left: 18px; }
.cite-box { margin: 8px 0; padding: 10px 12px; border: 1px dashed var(--border); border-radius: 8px; font-size: 12.5px; color: var(--text); word-break: break-word; }
#glossaryList { margin: 10px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; font-size: 13px; }
@media (max-width: 760px) {
  .overview-grid, .dm-grid, .explainer-grid { grid-template-columns: 1fr; }
  .section-title { font-size: 28px; }
  #glossaryList, .mini-glossary { grid-template-columns: 1fr; }
  #glossaryList dd, .mini-glossary dd { margin-bottom: 6px; }
}

.continuity { display: flex; gap: 10px; align-items: flex-start; margin: 6px 0; padding: 8px 10px; border: 1px solid var(--border); border-left-width: 4px; border-radius: 8px; font-size: 13px; line-height: 1.5; }
.continuity.comparable { border-left-color: var(--good); }
.continuity.caution { border-left-color: var(--amber); }
.continuity.not_comparable { border-left-color: var(--rust); }
.continuity.unavailable { border-left-color: var(--slate); }
.cont-badge { flex: none; font-size: 11.5px; font-weight: 800; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--border); white-space: nowrap; }
.cont-badge.comparable { color: var(--good); border-color: var(--good); }
.cont-badge.caution { color: var(--accent-text); border-color: var(--amber); }
.cont-badge.not_comparable { color: var(--rust); border-color: var(--rust); }
.cont-text { min-width: 0; }
.explainer-compare { margin-top: 12px; }
.explainer-compare h3 { margin: 0 0 4px; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 800; }
.cont-none, .cont-note { margin: 4px 0 0; font-size: 12.5px; color: var(--text-dim); }
.cont-none-cell { color: var(--text-dim); font-style: italic; cursor: help; }
.cont-warn { display: inline-block; width: 16px; height: 16px; line-height: 16px; text-align: center; border-radius: 50%; background: var(--amber); color: var(--night); font-size: 11px; font-weight: 800; cursor: help; }
.cont-reason { font-size: 12px; color: var(--text-dim); }
.metric-tab:disabled { opacity: .45; cursor: not-allowed; }
.beta-banner { display: flex; gap: 10px; align-items: center; padding: 8px 0 10px; margin: 0 0 10px; border-bottom: 1px solid var(--border); font-size: 13px; }
.beta-tag { background: var(--amber); color: var(--night); font-weight: 800; font-size: 11.5px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 8px; border-radius: 4px; }
.last-updated { margin: 2px 0 8px; font-size: 13px; color: var(--text-dim); }
.contents { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: baseline; margin: 0 0 16px; padding: 10px 14px; border-left: 4px solid var(--amber); background: var(--surface); border-radius: 0 8px 8px 0; font-size: 13px; }
.contents-label { font-weight: 800; text-transform: uppercase; letter-spacing: .06em; font-size: 11.5px; color: var(--text-dim); }
.topics-title { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 26px; font-weight: 800; margin: 20px 0 4px; }
.topic-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.topic-card { text-align: left; display: flex; flex-direction: column; gap: 6px; padding: 16px 18px; border: 1px solid var(--border); border-left: 5px solid var(--amber); border-radius: 10px; background: var(--surface); color: var(--text); cursor: pointer; font: inherit; box-shadow: var(--shadow); }
.topic-card:hover { border-color: var(--amber); }
.topic-start.topic-card { background: var(--surface); color: var(--text); }
.topic-card-title { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 22px; font-weight: 800; }
.topic-card-desc { font-size: 13px; line-height: 1.5; color: var(--text-dim); }
.topic-card-go { font-size: 13px; font-weight: 800; color: var(--accent-text); }
.headline-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 0 0 16px; }
.hcard { padding: 14px 16px; background: var(--surface); border: 1px solid var(--border); border-top: 4px solid var(--amber); border-radius: 10px; box-shadow: var(--shadow); }
.hcard-wide { grid-column: 1 / -1; }
.hcard-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: var(--text-dim); }
.hcard-value { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace; font-size: 30px; font-weight: 600; line-height: 1.2; margin: 4px 0; font-variant-numeric: tabular-nums; }
.hcard-none { font-size: 16px; font-style: italic; color: var(--text-dim); font-weight: 400; }
.hcard-sub { font-size: 12.5px; color: var(--text-dim); }
.hcard-change { margin-top: 8px; font-size: 12.5px; line-height: 1.45; }
.cards-note { grid-column: 1 / -1; margin: 0; font-size: 12.5px; color: var(--text-dim); }
.tabstrip { display: flex; flex-wrap: wrap; gap: 2px; margin: 10px 0 12px; border-bottom: 2px solid var(--border); align-items: flex-end; }
.tab-btn { font: inherit; font-size: 13px; font-weight: 750; padding: 9px 16px; border: 1px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; background: transparent; color: var(--text-dim); cursor: pointer; min-height: 40px; margin-bottom: -2px; }
.tab-btn[aria-selected="true"] { background: var(--surface); color: var(--text); border-color: var(--border); border-bottom: 2px solid var(--surface); }
.tab-btn:hover { color: var(--text); }
.tab-action { margin-left: auto; font: inherit; font-size: 12.5px; font-weight: 750; padding: 7px 12px; border: 1px solid var(--border); border-radius: 7px; background: var(--surface); color: var(--text); cursor: pointer; margin-bottom: 4px; }
.map-heading, .ut-block > h2 { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 24px; font-weight: 800; margin: 0 0 4px; }
.map-desc, .ut-desc { margin: 0; font-size: 13px; color: var(--text-dim); max-width: 76ch; }
.map-continuity { margin-top: 10px; }
.ut-block { margin: 0 0 20px; }
.ut-chart { width: 100%; height: auto; display: block; }
.ut-gap { fill: var(--map-nodata-stripe); opacity: .5; }
.ut-grid { stroke: var(--border); stroke-width: 1; }
.ut-axis { font-size: 11px; fill: var(--text-dim); }
.ut-note { font-size: 11px; fill: var(--text-dim); font-style: italic; }
.ut-line { stroke: var(--rust); stroke-width: 2.4; fill: none; }
.ut-line.caution { stroke-dasharray: 6 4; }
.ut-break { stroke: var(--slate); stroke-width: 1.4; stroke-dasharray: 2 4; cursor: help; }
.ut-point { fill: var(--rust); stroke: var(--surface); stroke-width: 1.5; cursor: help; }
.ut-point.sel { stroke: var(--text); stroke-width: 2.4; }
.ut-legend { margin: 6px 0 0; display: flex; flex-wrap: wrap; gap: 4px 14px; align-items: center; }
.ut-key { display: inline-block; width: 22px; height: 0; border-top: 2.4px solid var(--rust); vertical-align: middle; margin-right: 4px; }
.ut-key.dashed { border-top-style: dashed; }
.ut-key.none { border-top: 2px dotted var(--slate); }
body.topic-road #utSection { display: none; }
@media (max-width: 760px) { .topic-cards, .headline-cards { grid-template-columns: 1fr; } .hcard-value { font-size: 26px; } }
:fullscreen.map-panel { overflow: auto; background: var(--bg); padding: 16px; }
footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11.5px; color: var(--text-dim); display: flex; flex-direction: column; gap: 4px; }
footer a { color: inherit; }
</style>
</head>
<body>
<a class="skip-link" href="#main">Skip to the content</a>
<div class="wrap">
  <nav class="topnav" aria-label="Page sections">
    <a class="brand" href="#main">Delhi Urban Safety Observatory</a>
    <div class="topnav-links">
      <a href="#overview">Overview</a>
      <a href="#explore">Explore</a>
      <a href="#data-methods">Data &amp; methods</a>
    </div>
    <button class="theme-btn" id="themeToggle" type="button" aria-label="Switch colour theme">◐</button>
    <details class="nav-more" id="navMore">
      <summary>More pages</summary>
      <div class="nav-more-menu">
        <a href="interactive_map.html">Interactive map</a>
        <a href="historical_crime.html">Historical crime table, 2011–2018</a>
        <a href="for_reporters.html" title="What you can and cannot say">Reporters &amp; researchers</a>
        <a href="irad_stations.html" title="Prototype: monthly road-accident counts for 2025 and 2026 from district iRAD reports">2025&ndash;26 road accidents (iRAD)</a>
        <a href="map_3d.html" title="Prototype 3D ward view">3D view (prototype)</a>
      </div>
    </details>
  </nav>
  <main id="main" data-version="${SERIES_STATUS.updated}">
  <section id="overview" class="site-section" aria-label="Overview">
  <div class="beta-banner"><span class="beta-tag">Beta</span><span>This is a new design. Your <a href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/issues/new" target="_blank" rel="noopener">feedback</a> will help us improve it.</span></div>
  <header class="masthead">
    <div class="header-copy">
      <div class="eyebrow">Delhi Police &amp; Traffic Police district data · 2011–2024</div>
      <h1>Delhi Urban Safety Observatory</h1>
      <p class="last-updated">Last updated on <time datetime="${SERIES_STATUS.updated}">${new Date(SERIES_STATUS.updated + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</time></p>
      <p class="subhead">Official crime and road-safety figures for Delhi's 15 police districts, set against real public infrastructure: streetlights, underpasses, pedestrian overbridges, metro gates and police posts.</p>
      <p class="caveat-line"><b>Read before comparing:</b> a zero from a survey-based layer can mean "not surveyed", and OpenStreetMap layers are community-mapped. <a href="#about" id="aboutLink">See the coverage notes</a>.</p>
    </div>
    <img class="hero-image" src="assets/delhi-safety-hero.webp" width="960" height="540" loading="lazy" decoding="async" alt="Stylized map of Delhi showing districts, transport corridors, safety-risk circles and public-infrastructure markers">
  </header>
  <nav class="contents" aria-label="Contents"><span class="contents-label">Contents</span><a href="#findings">What the data shows</a><a href="#keep-in-mind">What to keep in mind</a><a href="#explore">Explore the data</a><a href="#comparability">Can I compare these years?</a><a href="#data-methods">Data &amp; methods</a><a href="#glossary">Glossary</a></nav>
  <div class="overview-grid">
    <div class="overview-card" id="findings">
      <h2>What the data shows</h2>
      <div id="findingList"></div>
    </div>
    <div class="overview-card" id="keep-in-mind">
      <h2>What to keep in mind</h2>
      <ul class="limit-list">
        <li><b>Registered cases are not crime levels.</b> Counts depend on reporting and registration as well as on crime.</li>
        <li><b>Boundaries changed.</b> Older years use the districts reported at the time, drawn on schematic reference shapes that are labelled inferred or derived.</li>
        <li><b>A zero can mean not surveyed.</b> Survey-based layers did not cover every district; OpenStreetMap layers are community-mapped.</li>
        <li><b>Crash data uses other districts.</b> Some Traffic Police tables use 11 reporting districts, not the 15 police districts.</li>
      </ul>
    </div>
  </div>
  <h2 class="topics-title">Topics</h2>
  <p class="section-lede">Select a topic to explore. Each shows a headline figure, a chart you can read as a table, and where the data comes from.</p>
  <div class="topic-cards">
    <button type="button" class="topic-card topic-start" data-topic="crime"><span class="topic-card-title">Crime</span><span class="topic-card-desc">Registered IPC/BNS and Special and Local Laws cases: Delhi-wide totals by year, and a map of police districts.</span><span class="topic-card-go">Explore crime</span></button>
    <button type="button" class="topic-card topic-start" data-topic="road"><span class="topic-card-title">Road crashes</span><span class="topic-card-desc">Crashes, fatal crashes and persons killed: Delhi-wide trend since 2011, district figures and crash-prone zones.</span><span class="topic-card-go">Explore road crashes</span></button>
  </div>
  </section>

  <section id="explore" class="site-section" aria-labelledby="exploreTitle">
  <h2 class="section-title" id="exploreTitle">Explore the data</h2>
  <p class="section-lede">Choose what to look at, then a year and a measure. The map, ranked list and district detail stay together, and every view explains what it shows, how to read it, its limits and its source.</p>
  <div class="topic-switch" role="group" aria-label="Topic">
    <button type="button" class="topic-btn" id="topicCrime" data-topic="crime" aria-pressed="true">Crime</button>
    <button type="button" class="topic-btn" id="topicRoad" data-topic="road" aria-pressed="false">Road crashes</button>
  </div>
  <div class="headline-cards" id="headlineCards" aria-live="polite"></div>
  <section class="control-bar" id="mapSection" aria-label="Map controls">
    <div class="search-container">
      <div class="search-input-wrap">
        <input type="text" id="districtSearch" class="search-input" placeholder="Search district or police station (e.g. Rohini, Kashmere Gate, Majnu ka Tila, Vasant Kunj)..." autocomplete="off" />
        <button type="button" id="searchClear" class="search-clear" aria-label="Clear search">✕</button>
      </div>
      <div id="searchDropdown" class="search-dropdown"></div>
    </div>
    <label class="control-field metric-field">
      <span class="control-label">Metric</span>
      <select class="control-select" id="metricTabs" aria-label="Select crime or road-safety metric"></select>
    </label>
    <label class="control-field year-field" id="yearField">
      <span class="control-label">Year</span>
      <select class="control-select" id="yearToggle" aria-label="Select reporting year"></select>
    </label>
    <div class="control-field rate-field">
      <span class="control-label">Calculation</span>
      <div class="metric-tabs control-segment" id="rateToggle"></div>
    </div>
    <div class="control-field scale-field">
      <span class="control-label">Colours</span>
      <div class="metric-tabs control-segment" id="scaleToggle">
        <button type="button" class="metric-tab active" data-scale="rank" aria-pressed="true">Rank in year</button>
        <button type="button" class="metric-tab" data-scale="fixed" aria-pressed="false">Shared scale</button>
      </div>
    </div>
    <div class="control-field display-field">
      <span class="control-label">Display</span>
      <div class="metric-tabs control-segment display-control">
        <button class="metric-tab active" id="choroplethMode" type="button" aria-pressed="true">Choropleth</button>
        <button class="metric-tab" id="bivariateToggle" type="button" role="switch" tabindex="0" aria-checked="false">Bivariate</button>
      </div>
    </div>
    <button class="compare-btn primary-action" id="compareToggleBtn" type="button">Compare districts</button>
  </section>
  <details class="layer-group" id="mapLayersGroup">
    <summary><span>Map layers</span><span class="layer-count-badge" id="layerCountBadge">0 active</span></summary>
    <div class="layer-group-body">
      <div class="layer-group-grid">
        <div class="layer-section">
          <div class="layer-section-title">Safety and risk</div>
          <div class="toggle-row" id="policeToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show police markers"><span class="switch"></span>Police stations and posts</div>
          <div class="toggle-row" id="zonesToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show accident-prone zones"><span class="switch"></span>Crash-prone zones</div>
          <div class="toggle-row" id="surveillanceToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show CCTV and guard posts"><span class="switch"></span>CCTV and guard posts</div>
        </div>
        <div class="layer-section">
          <div class="layer-section-title">Public infrastructure</div>
          <div class="toggle-row" id="busStopToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show bus stops"><span class="switch"></span>Bus stops</div>
          <div class="toggle-row" id="atmToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show ATMs"><span class="switch"></span>ATMs</div>
          <div class="toggle-row" id="alcoholToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show liquor shops"><span class="switch"></span>Liquor shops</div>
        </div>
        <div class="layer-section">
          <div class="layer-section-title">Streetlights — two sources</div>
          <div class="toggle-row" id="streetlightPointsToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show PAPL streetlight survey points"><span class="switch"></span>PAPL survey points (3,150)</div>
          <div class="toggle-row" id="osmStreetLampToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show OpenStreetMap street lamps"><span class="switch"></span>OSM street lamps (1,457)</div>
        </div>
      </div>
      <div class="layer-footer"><button class="layer-action" type="button" id="clearLayersBtn" disabled>Clear all layers</button></div>
    </div>
  </details>
  <div class="active-layer-strip" id="activeLayerChips" aria-live="polite"></div>
  <div id="compareCard" class="compare-card" style="display:none;"></div>

  <div class="grid">
    <div class="panel map-panel">
      <h2 class="map-heading" id="mapHeading"></h2>
      <p class="map-desc" id="mapDesc"></p>
      <div class="tabstrip" role="tablist" aria-label="Map views">
        <button type="button" role="tab" class="tab-btn" id="map-tab-map" data-tabgroup="map" data-tab="map" aria-selected="true" aria-controls="mapTabMap">Map</button>
        <button type="button" role="tab" class="tab-btn" id="map-tab-table" data-tabgroup="map" data-tab="table" aria-selected="false" aria-controls="mapTabTable" tabindex="-1">Table</button>
        <button type="button" role="tab" class="tab-btn" id="map-tab-download" data-tabgroup="map" data-tab="download" aria-selected="false" aria-controls="mapTabDownload" tabindex="-1">Download</button>
        <button type="button" role="tab" class="tab-btn" id="map-tab-about" data-tabgroup="map" data-tab="about" aria-selected="false" aria-controls="mapTabAbout" tabindex="-1">About</button>
        <button type="button" class="tab-action" id="mapFullscreen" hidden>Enter fullscreen</button>
      </div>
      <div role="tabpanel" id="mapTabMap" data-tabgroup="map" data-tab="map" aria-labelledby="map-tab-map">
      <div class="map-stage">
        <svg id="map" viewBox="${data.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of Delhi's 15 police districts, shaded by the selected crime or road-safety metric"></svg>
        <svg id="mapHistory" viewBox="${HIST.viewBox}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Delhi police districts as reported in the selected historical year, shaded by the selected crime metric" style="display:none"></svg>
        <div id="mapTooltip" class="map-tooltip"></div>
      </div>
      <div class="data-status-panel" id="dataStatus" aria-live="polite"></div>
      <div class="legend">
        <div id="singleLegend" style="display:contents;">
          <span id="legendLabel">Theft (Sec. 379 IPC), 2023</span>
          <div class="legend-scale" id="legendScale"></div>
          <span id="legendMin"></span> – <span id="legendMax"></span>
          <span class="legend-scale-note">(ranked, not linear — an outlier district can't wash out the rest of the scale)</span>
        </div>
        <div id="bivariateLegend" style="display:none;align-items:center;gap:10px;">
          <div style="display:flex;align-items:flex-end;gap:4px;">
            <div style="display:flex;flex-direction:column-reverse;gap:2px;" class="bivariate-legend">
              <div style="display:grid;grid-template-columns:repeat(3,16px);grid-template-rows:repeat(3,16px);gap:2px;" data-tt-title="Bivariate key" data-tt-body="Rows = infrastructure density (bottom to top: low to high). Columns = crime (left to right: low to high). Dark red-brown = high crime + high infra; teal = low crime + high infra.">
              <div style="background:#5b9e9e;"></div><div style="background:#5d757d;"></div><div style="background:#574249;"></div>
              <div style="background:#a0c7c7;"></div><div style="background:#ad9ea5;"></div><div style="background:#985356;"></div>
              <div style="background:#e8e8e8;"></div><div style="background:#e4acac;"></div><div style="background:#c85a5a;"></div>
              </div>
            </div>
            <span id="bivariateYLabel" style="font-size: 11px;color:var(--text-dim);writing-mode:vertical-rl;transform:rotate(180deg);">Infra →</span>
          </div>
          <span id="bivariateXLabel" style="font-size: 11px;color:var(--text-dim);">Crime →</span>
          <span class="legend-scale-note">(tertiles — low/med/high thirds of covered districts, not fixed cut points)</span>
        </div>
        <span style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--map-nodata-stripe);"></span>no streetlight/underpass survey</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--slate);opacity:.6;border:1px dashed var(--slate);"></span>IGI Airport (separate jurisdiction)</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#3d5a99;border-radius:50%;"></span>police station</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#7c3aed;border-radius:50%;"></span>chowki / outpost / post</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:transparent;border:1.6px solid var(--label-fill);border-radius:50%;"></span>district center</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--rust);clip-path:polygon(50% 0%, 100% 100%, 0% 100%);"></span>crash-prone zone, 2023 (size/shade = fatal crashes)</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--good);border-radius:50%;opacity:.55;"></span>bus stop</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#d4af37;border-radius:50%;"></span>ATM</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#8b2f5e;border-radius:50%;"></span>liquor shop</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#0891b2;border-radius:50%;"></span>CCTV / guard post</span>
        </span>
      </div>
      <div id="mapContinuity" class="map-continuity"></div>
      </div>
      <div role="tabpanel" id="mapTabTable" data-tabgroup="map" data-tab="table" aria-labelledby="map-tab-table" hidden></div>
      <div role="tabpanel" id="mapTabDownload" data-tabgroup="map" data-tab="download" aria-labelledby="map-tab-download" hidden></div>
      <div role="tabpanel" id="mapTabAbout" data-tabgroup="map" data-tab="about" aria-labelledby="map-tab-about" hidden><div class="explainer" id="mapExplainer"></div></div>
    </div>

    <div class="panel list-panel">
      <h2>Ranked</h2>
      <div class="list-sub" id="listSub">Districts by theft cases, 2023</div>
      <div id="rankList"></div>
    </div>
  </div>

  <div class="panel detail" id="detail" aria-live="polite"></div>

  <div class="panel ut-block" id="utSection">
    <h2 id="utTitle">Delhi-wide registered crime by year</h2>
    <p class="ut-desc" id="utDesc"></p>
    <div class="tabstrip" role="tablist" aria-label="Delhi-wide series views">
      <button type="button" role="tab" class="tab-btn" id="ut-tab-chart" data-tabgroup="ut" data-tab="chart" aria-selected="true" aria-controls="utPanelChart">Chart</button>
      <button type="button" role="tab" class="tab-btn" id="ut-tab-table" data-tabgroup="ut" data-tab="table" aria-selected="false" aria-controls="utPanelTable" tabindex="-1">Table</button>
      <button type="button" role="tab" class="tab-btn" id="ut-tab-download" data-tabgroup="ut" data-tab="download" aria-selected="false" aria-controls="utPanelDownload" tabindex="-1">Download</button>
      <button type="button" role="tab" class="tab-btn" id="ut-tab-about" data-tabgroup="ut" data-tab="about" aria-selected="false" aria-controls="utPanelAbout" tabindex="-1">About</button>
    </div>
    <div role="tabpanel" id="utPanelChart" data-tabgroup="ut" data-tab="chart" aria-labelledby="ut-tab-chart"></div>
    <div role="tabpanel" id="utPanelTable" data-tabgroup="ut" data-tab="table" aria-labelledby="ut-tab-table" hidden></div>
    <div role="tabpanel" id="utPanelDownload" data-tabgroup="ut" data-tab="download" aria-labelledby="ut-tab-download" hidden></div>
    <div role="tabpanel" id="utPanelAbout" data-tabgroup="ut" data-tab="about" aria-labelledby="ut-tab-about" hidden></div>
  </div>

  <div class="panel scatter-panel" id="scatterSection">
    <h2 id="scatterTitle">Infrastructure density vs. theft density</h2>
    <p class="scatter-sub">Each dot is one district. X-axis: infrastructure density (per km²). Y-axis: crime density (per km²), computed live for whichever crime type is selected. The line is a least-squares fit showing the direction of any linear relationship.</p>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
      <div class="metric-tabs" id="scatterTabs"></div>
      <div class="metric-tabs" id="scatterYTabs"></div>
    </div>
    <div class="scatter-layout">
      <canvas id="scatterCanvas" width="640" height="380"></canvas>
      <div>
        <div class="scatter-stat">
          <div class="label">Correlation (r)</div>
          <div class="val" id="scatterR"></div>
        </div>
        <div class="scatter-stat">
          <div class="label">Districts included</div>
          <div class="val" id="scatterN"></div>
        </div>
        <div class="scatter-read" id="scatterRead"></div>
      </div>
    </div>
    <div class="explainer" id="scatterExplainer"></div>
  </div>

  <div class="panel scatter-panel road-safety-panel" id="roadSection">
    <h2>Road safety detail</h2>
    <p class="scatter-sub">The district-level 2023 crash-prone-zone and fatal-crash figures (Delhi Road Crash Report 2023) are already selectable in the map/list above — <b>Crash Zones</b>, <b>Fatal Crashes</b>, <b>Total Crashes</b> tabs, all 15 districts covered. The citywide-only figures below (multi-year trends, victim mode breakdown, and the individual named blackspots) aren't broken down by district in their source, so they're kept here rather than folded into the map where that would misleadingly imply per-district precision they don't have.</p>
    <div class="metric-tabs" id="roadSafetyTabs" style="margin-bottom:16px;"></div>

    <div id="rsTrendsPanel" class="rs-tab-panel">
      <p class="scatter-sub">${trendFirstYear}–${trendLastYear}. <b>Counts, not rates.</b> Each count series is indexed to ${trendFirstYear} = 100 to show relative change; this is not a population- or travel-adjusted risk rate.</p>
      <div class="scatter-layout">
        <canvas id="trendsCanvas" width="640" height="320" role="img" aria-label="Delhi citywide road crashes, fatal crashes and deaths, ${trendFirstYear}–${trendLastYear}; indexed counts, not rates. Annual counts appear in the table below."></canvas>
        <div>
          <div class="scatter-stat">
            <div class="label">Road crashes, ${trendFirstYear}→${trendLastYear}</div>
            <div class="val" id="trendsCrashesChange"></div>
          </div>
          <div class="scatter-stat">
            <div class="label">Road crash fatalities, ${trendFirstYear}→${trendLastYear}</div>
            <div class="val" id="trendsFatalitiesChange"></div>
          </div>
          <div class="scatter-read" id="trendsRead"></div>
        </div>
      </div>
      <p class="scatter-sub" id="roadTrendCaveat">Delhi citywide only. Fatal crashes and persons killed are different counts. The 2011–2013 totals agree across archived and later <a href="https://traffic.delhipolice.gov.in/statistics" target="_blank" rel="noopener">Traffic Police statistics</a>; injury and simple/non-injury figures differ by source edition and are excluded from this extension. The early reports’ standardized 30-day fatality definition could not be confirmed. <a href="data/releases/citywide_road_trend/manifest.json">Sources and caveats</a>.</p>
      <details><summary>Show annual counts</summary>
        <div class="cov-wrap"><table class="cov-table" id="roadTrendCounts"><caption>Delhi citywide annual counts, not rates</caption><thead><tr><th scope="col">Year</th><th scope="col">Total crashes</th><th scope="col">Fatal crashes</th><th scope="col">Persons killed</th></tr></thead><tbody>${roadSafetyTrends.trends.map(t => '<tr><th scope="row">' + t.year + '</th><td>' + t.crashes.toLocaleString('en-IN') + '</td><td>' + t.fatalCrashes.toLocaleString('en-IN') + '</td><td>' + t.fatalities.toLocaleString('en-IN') + '</td></tr>').join('')}</tbody></table></div>
      </details>
      <button type="button" class="dl-download-btn" id="dlTrendsDownload" style="margin-top:14px;">⬇ Download CSV — Citywide Road Safety Trends</button>
      <div class="explainer" id="trendsExplainer"></div>
    </div>

    <div id="rsVictimsPanel" class="rs-tab-panel">
      <p class="scatter-sub">Who's actually dying on Delhi's roads, 2019-2024 — pedestrians, two-wheeler riders, cyclists, car occupants, bus passengers, or other/slow-moving vehicles. Directly relevant to a walkability index: pedestrians are unprotected road users by definition.</p>
      <div class="scatter-layout">
        <canvas id="victimsCanvas" width="640" height="320"></canvas>
        <div>
          <div class="scatter-stat">
            <div class="label">Pedestrian share of all road deaths, 2024</div>
            <div class="val" id="pedestrianShare"></div>
          </div>
          <div class="scatter-stat">
            <div class="label">Two-wheeler rider share, 2024</div>
            <div class="val" id="twoWheelerShare"></div>
          </div>
          <div class="scatter-read" id="victimsRead"></div>
        </div>
      </div>
      <button type="button" class="dl-download-btn" id="dlVictimsDownload" style="margin-top:14px;">⬇ Download CSV — Road Deaths by Mode of Travel</button>
      <div class="explainer" id="victimsExplainer"></div>
    </div>

    <div id="rsZonesPanel" class="rs-tab-panel">
      <p class="scatter-sub">Delhi Traffic Police's official blackspot list from the <b>Delhi Road Crash Report 2023</b> — 107 identified crash-prone zones, each with its actual 2023 crash counts (not just a name), matched to specific coordinates and cross-checked against every zone's rank and fatal-crash count from the source table (all 107 matched exactly). <b>105 of 107</b> fall inside one of the 15 district polygons and are plotted on the map above — toggle "Show accident-prone zones" to see them, sized and shaded by fatal crash count. The remaining 2 sit just outside every simplified district boundary and are listed here with their real severity numbers instead of being force-placed. Sorted fatal-crashes descending, as in the source report.</p>
      <div class="zone-grid" id="zoneGrid"></div>
      <button type="button" class="dl-download-btn" id="dlZonesDownload" style="margin-top:14px;">⬇ Download CSV — Accident-Prone Zones List</button>
      <div class="explainer" id="zonesExplainer"></div>
    </div>

    <div id="rsZones2024Panel" class="rs-tab-panel">
      <p class="scatter-sub">Delhi Traffic Police's blackspot list from the <b>Delhi Road Crash Report 2024</b> — 93 named crash-prone zones, each with real 2024 crash counts and (where the report itself flags it) a breakdown by pedestrian/two-wheeler/HTV/hit-and-run and day/night crashes. None of the 2024 report's zones have published coordinates — <b>54 of 93</b> were matched to a coordinate (42 shared a name with an already-geocoded 2023 zone, 12 resolved via OpenStreetMap geocoding) and are plotted on the map above under the 2024 zone-year option; the remaining 39 are hyper-local names a geocoder can't resolve on free text alone, listed here with their real severity numbers rather than force-placed. Sorted fatal-crashes descending, as in the source report.</p>
      <div class="zone-grid" id="zoneGrid2024"></div>
      <button type="button" class="dl-download-btn" id="dlZones2024Download" style="margin-top:14px;">⬇ Download CSV — Accident-Prone Zones List (2024)</button>
      <div class="explainer" id="zones2024Explainer"></div>
    </div>

    <div id="rsEnforcementPanel" class="rs-tab-panel">
      <p class="scatter-sub">Citywide enforcement and hit-and-run figures, 2023 vs 2024 — not broken down by district in the source, so kept here rather than on the map.</p>
      <div id="enforcementGrid"></div>
      <div class="explainer" id="enforcementExplainer"></div>
    </div>

    <div id="rsRoadsPanel" class="rs-tab-panel">
      <p class="scatter-sub">Roads with the most identified crash-prone zones, 2023 vs 2024 (Table 6.33) — crashes recorded specifically within those zones on each road, not the road's full crash count. Sorted by 2024 fatal crashes descending.</p>
      <div id="roadSummaryGrid"></div>
      <button type="button" class="dl-download-btn" id="dlRoadsDownload" style="margin-top:14px;">⬇ Download CSV — Top Roads by Crash-Prone Zones</button>
      <div class="explainer" id="roadsExplainer"></div>
    </div>
  </div>

  </section>

  <section id="data-methods" class="site-section" aria-labelledby="dmTitle">
  <h2 class="section-title" id="dmTitle">Data &amp; methods</h2>
  <p class="section-lede">Original sources, definitions, how geography changed, downloads and how to cite or reproduce a view. Everything in Explore is built from the files described here.</p>
  <p class="dm-jump"><b>On this page:</b> <a href="#coverage">How current is each series</a> &middot; <a href="#about">Coverage notes</a> &middot; <a href="#methodSection">How it is calculated</a> &middot; <a href="#comparability">Can I compare years</a> &middot; <a href="#downloadSection">Downloads</a> &middot; <a href="#glossary">Glossary</a></p>
  <div class="panel" id="comparability">
    <h2>Can I compare these years?</h2>
    <p class="method-sub">Having a value for every year does not make a valid trend: a change can come from how the data was collected, defined or mapped rather than from what happened. These are the documented breaks the charts, tables and downloads use. The rules live in <a href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/blob/main/data/continuity.json" target="_blank" rel="noopener">data/continuity.json</a>.</p>
    <div class="cov-wrap"><table class="cov-table" id="continuityTable"><caption>Documented breaks, by years compared</caption><thead><tr><th scope="col">Years</th><th scope="col">Measures</th><th scope="col">Effect</th><th scope="col">Why</th></tr></thead><tbody></tbody></table></div>
    <p class="cov-note">Comparable: a change figure is shown. Compare with caution: shown with a warning. Not comparable: both values stay visible, the change is not calculated and trend lines are not joined. Unavailable: left blank, never zero.</p>
  </div>

  <div class="dm-grid">
    <div class="dm-card">
      <h3>How the geography changed</h3>
      <ul>
        <li>Delhi had 11 police districts until 2016. Rohini and Shahdara were notified on 14 October 2016 and reported as newly created in early December 2016; Dwarka followed on 9 November 2017 (14 districts in 2017 and 2018); Outer North began on 1 January 2019 (15 districts).</li>
        <li>2011 to 2013, 2015 and 2016 are drawn on 2014 reference shapes, labelled inferred. 2017 and 2018 apply the November 2017 gazette station schedule to the same shapes, labelled derived. The outlines are schematic and not to scale.</li>
        <li>Older counts are never divided among today's districts, and rates and infrastructure are not shown for them.</li>
      </ul>
      <p><a href="historical_crime.html">Full historical table with source rows</a> &middot; <a href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/tree/main/data/staged/police_geography_history" target="_blank" rel="noopener">Boundary evidence</a></p>
    </div>
    <div class="dm-card">
      <h3>Cite or reproduce a view</h3>
      <p>Data version (series status updated): <b>${SERIES_STATUS.updated}</b>. Every figure is rebuilt from the files in the repository.</p>
      <div class="cite-box" id="citeText"></div>
      <p><button type="button" class="dl-mini-btn" id="copyViewLink">Copy link to the current view</button> <span class="explainer-status" id="copyStatus" role="status" aria-live="polite"></span></p>
      <p>The link keeps the topic, measure, year, calculation and selected district. <a href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard" target="_blank" rel="noopener">Code and data on GitHub</a></p>
    </div>
  </div>
  <details class="datanote" id="coverage">
    <summary>How current is each data series?</summary>
    <div class="datanote-body">
      <p class="about-lede">Official crime and crash figures stop at <b>2024</b>. Newer material exists but is kept off the maps on purpose. <b>Never compare a year-to-date or provisional series with a full year.</b> Source: <code>data/series_status.json</code>.</p>
      <div class="cov-wrap"><table class="cov-table"><thead><tr><th scope="col">Series</th><th scope="col">Latest period</th><th scope="col">Status</th><th scope="col">Geography</th></tr></thead><tbody>${SERIES_STATUS.series.map(s => `<tr><th scope="row">${covEsc(s.name)}</th><td>${covEsc(s.latest_reference_period || 'none')}</td><td><span class="cov-status cov-${covEsc(s.status)}">${covEsc(s.status.replace(/_/g, ' '))}</span></td><td>${covEsc(s.geography)}</td></tr>`).join('')}</tbody></table></div>
      <p class="cov-note">Ward-level layers use the <b>legacy 290-ward geography</b> (before the 2022 delimitation), not the current 250 MCD wards.</p>
    </div>
  </details>

  <details class="datanote" id="about">
    <summary>About this project and data coverage notes</summary>
    <div class="datanote-body">
      <p class="about-lede">This dashboard puts <b>NCRB crime reports (2011-2024; 2011-2018 in the districts reported at the time)</b>, <b>Delhi Traffic Police crash data</b> and <b>public-infrastructure counts</b> side by side for Delhi's 15 police districts, so citizens, planners and researchers can see where safety and infrastructure coverage line up, and where they do not. It describes patterns. It does not show cause and effect.</p>
      <ul>
        <li><b>Streetlights</b> (PAPL survey, ~40k points) and <b>underpasses</b> (PAPL survey, 417 points) share the exact same gap: <b>Dwarka, North-East, North-West, Outer, Outer North and Rohini were never driven through.</b> Zero there means "not surveyed," not "not present."</li>
        <li><b>Pedestrian overbridges</b> (OpenStreetMap/Overpass snapshot, 242 connected mapped bridge groups) are available across all district polygons, but this is a mapped inventory rather than an official completeness register. A zero means no matching OSM feature was mapped, not verified absence.</li>
        <li><b>Metro station gates</b> (OpenStreetMap, 529 points), <b>bus stops</b> (OpenStreetMap, 3,199 points), and <b>ATMs</b> (OpenStreetMap via Overpass API, 666 points) have real, complete coverage across all 15 districts.</li>
        <li><b>Police Infra</b> combines two sources: full <b>police stations</b> (Delhi Police GSDL, official geocoded list, 224 points — complete for all 15 districts) plus <b>chowkis, outposts &amp; booths</b> (OpenStreetMap community mapping, 120 points — no official geocoded chowki dataset exists publicly, confirmed against the same GSDL source). The combined figure is fully trustworthy for 14 of 15 districts; <b>Outer</b> shows 12 real stations but zero mapped chowkis, almost certainly an OSM under-mapping gap, so its combined count is flagged as an undercount.</li>
        <li><b>Road Deaths &amp; Hit-and-Run</b> (Delhi Traffic Police, 2022 Delhi Road Crash Fatalities Report) can be plotted on the map and scatter chart alongside the 2023 crime figures. It's a year older and uses Traffic Police's own <b>11-district reporting geography</b>, not the 15 Delhi Police districts — <b>Outer, Outer North, Rohini and South-West have no separate entry</b> and show hatched on the map, not zero deaths.</li>
        <li><b>Year comparison</b>: the six NCRB crime metrics (theft, robbery, burglary, total IPC, crime against women, SLL crimes) each have a matching figure for <b>2022, 2023 and 2024</b> from the same NCRB district-wise tables. Use the <b>Year</b> selector above the map to switch the map, ranked list, and district detail panel to that year — the road-safety metrics have no equivalent multi-year series, so that toggle is hidden when they're selected. Selecting a year shows the percent change from the previous year in the district detail panel. The 2024 IPC table also switched to the new BNS section numbering alongside the old IPC references — the offence categories carry over, it's the legal citation that changed. All six crime metrics additionally extend back to <b>2017</b> via a separately verified NCRB extract (sourced from the full district-wise offence-category tables and cross-checked by reproducing the official 2022 totals exactly, 45/45, before extending backward), and <b>theft &amp; robbery</b> go one year further back to <b>2016</b>. Burglary, total IPC, crime against women and SLL crime all omit 2016 — an older, non-matching category schema with no 2016-era known-correct total to validate the reconstruction against, so those four rows show "—" in 2016 rather than a number nobody's checked. Infrastructure-correlation text is suppressed for any year before 2022 regardless of metric, since today's streetlight/underpass/police survey data can't be meaningfully compared against a different decade's crime figures. Year-over-year change is hidden wherever the underlying source data isn't comparable across the boundary (e.g. the 2016→2017 burglary definition break, or a district that didn't yet exist as its own reporting zone).</li>
      </ul>
    </div>
  </details>

  <div class="panel method-panel" id="methodSection">
    <h2>How this is calculated & Dynamic Correlation Matrix</h2>
    <p class="method-sub">The exact formulas behind every number above, and the real statistical correlations they produce — updated dynamically for the selected metric and year.</p>
    <div class="method-grid" id="methodGrid"></div>
    <div id="correlationMatrixCard" style="margin-top:20px;padding:16px 18px;background:var(--surface);border:1px solid var(--border);border-radius:10px;"></div>
    <details class="method-detail">
      <summary>Full methodology — ranks, percentiles, and confidence thresholds</summary>
      <div class="body">
        <p><b>Density</b> for any infrastructure count is <code>count ÷ district area (km²)</code> — this is what's actually plotted and ranked, not the raw count, so bigger districts aren't unfairly flattered for having more of everything.</p>
        <p><b>Rank</b> is a district's position when all 15 are sorted by a metric, descending — "1st" is the highest value in Delhi.</p>
        <p><b>Percent vs. citywide average</b> is <code>(district value − mean of all 15) ÷ mean × 100</code>.</p>
        <p><b>Correlation (r)</b> is the Pearson correlation coefficient between an infrastructure density and theft density, computed only across districts with real survey coverage for that infrastructure type. r ranges from −1 (perfect inverse relationship) to +1 (perfect direct relationship); values near 0 mean no linear relationship. With only 9 or 15 districts, these r values have wide uncertainty — treat them as suggestive, not conclusive, and never as proof of cause and effect.</p>
        <p><b>Confidence tiers</b>: <code>High</code> = the infrastructure type has real survey/mapping coverage for that specific district. <code>Partial</code> = the district falls in the unsurveyed gap (streetlights/underpasses) or has too sparse a sample (fewer than 10 points) to trust.</p>
        <p><b>Important caveat on the police station correlation</b>: a positive r here almost certainly reflects <i>reactive</i> resource allocation — stations are sited where crime and population already are — not a failure of policing to prevent crime. Don't read it backwards.</p>
        <p><b>How OpenStreetMap-derived layers are treated</b>: pedestrian overbridges, bus stops, ATMs, liquor shops, metro gates and CCTV/guard posts are community-mapped inventories, not official registers. Unlike the streetlight and underpass survey — which has a known district-level gap and is therefore excluded from r for uncovered districts — these layers have no authoritative coverage map to check against, so a district counted as zero is kept in the correlation as a genuine zero. That is a deliberate choice, and it cuts both ways: it keeps all 15 districts in the sample, but a zero means <i>nothing mapped here</i>, which is not the same as nothing present. Where mapping is thin, r is measuring mapping effort as much as the thing being mapped. Treat these coefficients as weaker evidence than the surveyed-infrastructure ones.</p>
      </div>
    </details>
  </div>

  <div class="panel download-panel" id="downloadSection">
    <h2>Download the data</h2>
    <p class="method-sub">Every number on this page, exportable for reuse — plain CSV for scripting, or a full Excel workbook with sources, methodology, and a data dictionary included for citation.</p>

    <div class="dl-static">
      <div class="dl-static-label"><b>Prefer pre-published files instead of generating one here?</b>Two sets are on GitHub, built by this repo's own scripts — not the buttons below.</div>
      <select id="dlReleaseYear" class="dl-mini-btn" style="font-size:12.5px; padding:9px 10px; border-radius:7px; cursor:pointer;">
        <option value="">All years (2016-2024)</option>
        <option value="2024">2024 only</option>
        <option value="2023">2023 only</option>
        <option value="2022">2022 only</option>
        <option value="2021">2021 only</option>
        <option value="2020">2020 only</option>
        <option value="2019">2019 only</option>
        <option value="2018">2018 only</option>
        <option value="2017">2017 only</option>
        <option value="2016">2016 only</option>
      </select>
      <a class="dl-link-btn primary" id="dlManifestLink" href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/tree/main/data/releases" target="_blank" rel="noopener">Open manifest release</a>
      <a class="dl-link-btn secondary" href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/tree/main/exports" target="_blank" rel="noopener">Legacy export (deprecated)</a>
    </div>

    <div class="metric-tabs" id="downloadTabs" style="margin-bottom:16px;"></div>

    <div id="dlAllPanel" class="dl-panel">
      <div class="dl-columns">
        <div class="dl-col">
          <div class="dl-col-head">Available fields</div>
          <div id="dlAvailable" class="dl-list"></div>
        </div>
        <div class="dl-col">
          <div class="dl-col-head">Selected, in export order <button type="button" class="dl-mini-btn" id="dlResetOrder">Reset to default</button></div>
          <div id="dlSelected" class="dl-list"></div>
        </div>
      </div>
      <button type="button" class="dl-download-btn" id="dlAllDownload">⬇ Download CSV — All District Data</button>
    </div>

    <div id="dlHistoryPanel" class="dl-panel" style="display:none;">
      <p class="scatter-read" style="margin-bottom:14px;">The selected historical year, exactly as printed: every reporting district and other reporting unit, plus the printed Delhi total. Counts only. Nothing here is divided by today's areas or populations, joined to today's infrastructure or allocated to today's 15 districts.</p>
      <button type="button" class="dl-download-btn" id="dlHistoryDownload">⬇ Download CSV — Historical Counts, Selected Year</button>
    </div>

    <div id="dlCorrPanel" class="dl-panel" style="display:none;">
      <p class="scatter-read" style="margin-bottom:14px;">Every infrastructure type against every crime/road-safety metric — \${INFRA.length * METRICS.length} combinations, each with its own live-computed r and district count, exactly like the scatter chart above.</p>
      <button type="button" class="dl-download-btn" id="dlCorrDownload">⬇ Download CSV — Full Correlation Matrix</button>
    </div>

    <div id="dlVersusPanel" class="dl-panel" style="display:none;">
      <p class="scatter-read" style="margin-bottom:14px;">Whatever's currently plotted in the scatter chart above: <b id="dlVersusLabel"></b>. Change the X/Y selection there and this updates to match.</p>
      <button type="button" class="dl-download-btn" id="dlVersusDownload">⬇ Download CSV — Current Comparison</button>
    </div>

    <div id="dlExcelPanel" class="dl-panel" style="display:none;">
      <p class="scatter-read" style="margin-bottom:14px;">One workbook, five sheets — built for citation, not just re-plotting:</p>
      <ul class="dl-sheet-list">
        <li><b>Data</b> — all 15 districts, every field, plus explicit coverage-status columns (no dots/hatching to decode).</li>
        <li><b>Correlation Matrix</b> — all 32 infrastructure × metric combinations with r and n.</li>
        <li><b>Data Dictionary</b> — every column name, its unit, and which source it comes from.</li>
        <li><b>Sources &amp; Methodology</b> — full citations with URLs, retrieval date, formulas used, and every known coverage gap and caveat spelled out in one place — meant to be quoted directly in a methods section.</li>
        <li><b>Current Comparison</b> — whatever's plotted in the scatter chart right now.</li>
      </ul>
      <button type="button" class="dl-download-btn" id="dlExcelDownload">⬇ Download Excel Workbook (.xml, 5 sheets)</button>
    </div>
  <div class="panel" id="glossary">
    <h2>Plain-language glossary</h2>
    <dl id="glossaryList"></dl>
  </div>
  </section>
  </main>

  <footer>
    <details class="sources">
      <summary>Sources and licences (16 entries)</summary>
      <ul>
        <li>Crime data (2022, 2023 &amp; 2024) — National Crime Records Bureau, Crime in India, District Wise Reports: <a href="https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx" target="_blank" rel="noopener">IPC Crimes 2024</a>, <a href="https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx" target="_blank" rel="noopener">IPC Crimes 2023</a>, <a href="https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx" target="_blank" rel="noopener">IPC Crimes 2022</a>, <a href="https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx" target="_blank" rel="noopener">SLL Crimes 2024</a>, <a href="https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx" target="_blank" rel="noopener">SLL Crimes 2023</a>, <a href="https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx" target="_blank" rel="noopener">SLL Crimes 2022</a>, <a href="https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx" target="_blank" rel="noopener">Crime against Women 2024</a>, <a href="https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx" target="_blank" rel="noopener">Crime against Women 2023</a>, <a href="https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx" target="_blank" rel="noopener">Crime against Women 2022</a></li>
        <li>Historical crime data (2016-2021): National Crime Records Bureau, Crime in India, via <a href="https://indiadataportal.com" target="_blank" rel="noopener">India Data Portal</a> — theft &amp; robbery 2016-2021, burglary 2017-2021 (2016 burglary omitted, incompatible source definition); total IPC crime, crime against women &amp; SLL crime reconstructed by summing each metric's full district-wise offence-category table for 2017-2021, verified by exactly reproducing the official 2022 total for all 15 districts before extending backward — 2016 omitted for these three (older, non-matching category schema with no same-schema year available to validate the summation against)</li>
        <li>Official licensed liquor vends: Delhi State Civil Supplies Corporation (DSCSC) / DCCWS published list, 374 records citywide (all 374 mapped in the <a href="interactive_map.html">interactive map</a> — as an independent point layer and as a ward-bivariate pairing against 2024 crash zones — using approximate locality/sector-centroid coordinates, not verified vend entrances; only 1 has an exact OSM-matched coordinate). The same point layer carries 13 additional standalone OpenStreetMap-mapped shops that could not be tied to an official record — flagged <i>OSM-only</i>, counted separately from the 374, and already part of the 65-point Liquor Shops layer</li>
        <li>Fatal road crashes &amp; hit-and-run: <a href="https://transport.delhi.gov.in/sites/default/files/2024-09/2022_delhi_road_crash_fatalities_report_1.pdf" target="_blank" rel="noopener">2022 Delhi Road Crash Fatalities Report</a>, Delhi Traffic Police / Transport Dept. GNCTD</li>
        <li>Citywide road crash/fatality trends (${trendFirstYear}–${trendLastYear}, counts not rates) and road deaths by mode of travel (2019-2024): Delhi Traffic Police annual road crash data</li>
        <li>District-wise crash data and 107/111 crash-prone zones (2023/2024): <a href="https://traffic.delhipolice.gov.in/delhi-crash-report-2023" target="_blank" rel="noopener">Delhi Road Crash Report 2023</a> &amp; <a href="https://traffic.delhipolice.gov.in/delhi-crash-report-2024" target="_blank" rel="noopener">2024</a>, Delhi Traffic Police (all 15 districts, no reporting-geography gap); zone coordinates cross-checked against the source table by rank and fatal-crash count — 105 of 107 (2023) and 54 of 93 named (2024) resolved to real coordinates (2024's remainder are hyper-local names an OSM geocoder can't resolve; flagged unresolved rather than force-placed)</li>
        <li>Persons killed/injured, top crash-prone roads, and citywide enforcement stats (hit-and-run share, drink-driving prosecutions, RLVD/OSVD cameras) for 2023/2024: Delhi Road Crash Report 2023 &amp; 2024, Tables 6.2/6.33 and report-level metrics</li>
        <li>CCTV priority-candidate sites: Delhi Road Crash Report 2023/2024, Table 6.37 — report-recommended installation sites, not a verified existing-camera inventory</li>
        <li>Streetlight &amp; underpass survey: PAPL, via <a href="https://otd.delhi.gov.in/" target="_blank" rel="noopener">Delhi Transport Stack Open Transit Data</a></li>
        <li>OSM street lamps: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (highway=street_lamp via Overpass API snapshot, 1,529 fetched; 1,457 inside district polygons), ODbL</li>
        <li>Metro station gates: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (railway=subway_entrance), ODbL</li>
        <li>Bus stops: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (highway=bus_stop / public_transport=platform, 3,199 points), ODbL</li>
        <li>ATMs: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (amenity=atm via Overpass API, 666 points), ODbL</li>
        <li>Liquor shops: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (shop=alcohol, shop=wine, shop=beverages+alcohol tag via Overpass API, 65 points), ODbL</li>
        <li>CCTV &amp; guard posts: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (man_made=surveillance via Overpass API, 1,596 points, 1,583 within district polygons), ODbL</li>
        <li>Police station locations &amp; district boundaries: Delhi Police GSDL, via <a href="https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac" target="_blank" rel="noopener">community mirror</a></li>
      </ul>
    </details>
    <span>District boundary polygons simplified for display (~165m tolerance) — not survey-grade. IGI Airport unit and non-geographic units (Crime Branch, EOW, Metro, Railway, Vigilance, etc.) excluded from district figures.</span>
  </footer>
</div>

<script>
const DATA = ${JSON.stringify(data.districts)};
const HIST = ${JSON.stringify(HIST).replace(/</g, '\\u003c')};
const CONTINUITY = ${JSON.stringify(CONTINUITY_PAGE).replace(/</g, '\\u003c')};
const UT_SERIES = ${JSON.stringify(UT_SERIES)};
const compareYears = ${contLib.compareYears.toString()};
const segmentOf = ${contLib.segmentOf.toString()};
const changeBetween = ${contLib.changeBetween.toString()};
const GRID = ${JSON.stringify(grid)};
const OSM_STREET_LAMP_MARKERS = ${JSON.stringify(osmStreetLampMarkers)};
const CORR = ${JSON.stringify(correlations)};
const POLICE_MARKERS = ${JSON.stringify(policeMarkers)};
const AIRPORT_SHAPE = ${JSON.stringify(airportShape)};
const TRENDS = ${JSON.stringify(roadSafetyTrends.trends)};
const VICTIMS = ${JSON.stringify(roadSafetyTrends.victims)};
const ROAD_EXTRA = ${JSON.stringify(roadSafetyExtra)};
const ACCIDENT_ZONES = ${JSON.stringify(accidentZones)};
const ACCIDENT_ZONES_MAPPED = ${JSON.stringify(accidentZonesMapped)};
const ACCIDENT_ZONES_2024 = ${JSON.stringify(accidentZones2024)};
const POI_MARKERS = ${JSON.stringify(poiMarkers)};

const METRICS = [
  { key: 'theft', label: 'Theft', short: 'theft', year: '2023', full: 'Theft (Sec. 379 IPC), 2023', prevKey: 'theft2022', prevYear: '2022', key2024: 'theft2024', title: 'Theft (Sec. 379 IPC)', desc: 'Reported vehicle, property, and personal theft offences registered in the district.', source: 'NCRB Crime in India District-Wise Reports', historicalYears: ['2016','2017','2018','2019','2020','2021'], historicalSource: 'NCRB Crime in India, via India Data Portal (verified extract, 2016-2021)' },
  { key: 'robbery', label: 'Robbery', short: 'robbery', year: '2023', full: 'Robbery (Sec. 392/394/397 IPC), 2023', prevKey: 'robbery2022', prevYear: '2022', key2024: 'robbery2024', title: 'Robbery (Sec. 392/394/397 IPC)', desc: 'Reported robbery, mugging, and extortion offences involving force or threat.', source: 'NCRB Crime in India District-Wise Reports', historicalYears: ['2016','2017','2018','2019','2020','2021'], historicalSource: 'NCRB Crime in India, via India Data Portal (verified extract, 2016-2021)' },
  { key: 'burglary', label: 'Burglary', short: 'burglary', year: '2023', full: 'Burglary (Sec. 454-460 IPC), 2023', prevKey: 'burglary2022', prevYear: '2022', key2024: 'burglary2024', title: 'Burglary (Sec. 454-460 IPC)', desc: 'Residential and commercial housebreaking, house-trespass, and break-ins.', source: 'NCRB Crime in India District-Wise Reports', historicalYears: ['2017','2018','2019','2020','2021'], historicalSource: 'NCRB Crime in India, via India Data Portal (verified extract, 2017-2021; 2016 omitted — source definition combines criminal trespass and burglary)' },
  { key: 'totalIPC', label: 'Total IPC', short: 'total IPC crime', year: '2023', full: 'Total Cognizable IPC Crimes, 2023', prevKey: 'totalIPC2022', prevYear: '2022', key2024: 'totalIPC2024', title: 'Total Cognizable IPC Crimes', desc: 'Aggregate count of all major Indian Penal Code crimes registered in the district.', source: 'NCRB Crime in India District-Wise Reports', historicalYears: ['2017','2018','2019','2020','2021'], historicalSource: 'NCRB Crime in India, via India Data Portal — summed from the full district-wise IPC offence-category CSV, verified by exactly reproducing the official 2022 total for all 15 districts before extending to 2017-2021; 2016 omitted (incompatible older category schema, no same-schema year available to validate summation against)' },
  { key: 'crimeAgainstWomen', label: 'Vs. Women', short: 'crime against women', year: '2023', full: 'Total Crime Against Women, 2023', prevKey: 'crimeAgainstWomen2022', prevYear: '2022', key2024: 'crimeAgainstWomen2024', title: 'Crime Against Women', desc: 'Registered cases of assault, harassment, cruelty, and domestic offences against women.', source: 'NCRB Crime in India District-Wise Reports', historicalYears: ['2017','2018','2019','2020','2021'], historicalSource: 'NCRB Crime in India, via India Data Portal — summed from the dedicated district-wise crime-against-women CSV, verified against the official 2022 total for all 15 districts; 2016 omitted (incompatible older category schema)' },
  { key: 'totalSLL', label: 'SLL Crimes', short: 'SLL crime', year: '2023', full: 'Total Cognizable SLL Crimes, 2023', prevKey: 'totalSLL2022', prevYear: '2022', key2024: 'totalSLL2024', title: 'Special & Local Laws (SLL) Crimes', desc: 'Offences registered under special acts (Arms Act, NDPS, Excise, Cyber Crimes, etc.).', source: 'NCRB Crime in India District-Wise Reports', historicalYears: ['2017','2018','2019','2020','2021'], historicalSource: 'NCRB Crime in India, via India Data Portal — summed from the district-wise SLL offence-category CSV, verified against the official 2022 total for all 15 districts; excludes one source record misfiled under Delhi (district_code 553, actually Lakshadweep) which the district-name matcher already skips; 2016 omitted (incompatible older category schema)' },
  { key: 'fatalRoadCrashes2022', label: 'Road Deaths', short: 'fatal road crashes', year: '2022', full: 'Fatal Road Crashes, 2022 (Delhi Traffic Police)', gaps: true, title: 'Fatal Road Crashes (2022)', desc: 'Fatal traffic crashes resulting in deaths recorded by Delhi Traffic Police.', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'hitAndRunCrashes2022', label: 'Hit & Run', short: 'hit-and-run fatal crashes', year: '2022', full: 'Hit-and-Run Fatal Crashes, 2022 (Delhi Traffic Police)', gaps: true, title: 'Hit-and-Run Fatal Crashes (2022)', desc: 'Fatal road crashes where the offending vehicle fled the scene without stopping.', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'crashProneZones2023', label: 'Crash Zones', short: 'crash-prone zones', year: '2023', yearVariants: { '2023': 'crashProneZones2023', '2024': 'crashProneZones2024' }, full: 'Crash-Prone Zones, 2023 (Delhi Road Crash Report)', title: 'Identified Crash-Prone Zones', desc: 'Identified accident blackspots and high-risk traffic corridors.', source: 'Delhi Road Crash Report 2023', sourceByYear: { '2023': 'Delhi Road Crash Report 2023', '2024': 'Delhi Road Crash Report 2024, Table 6.31' } },
  { key: 'fatalCrashes2023', label: 'Fatal Crashes', short: 'fatal crashes', year: '2023', yearVariants: { '2023': 'fatalCrashes2023', '2024': 'fatalCrashes2024' }, full: 'Fatal Crashes, 2023 (Delhi Road Crash Report)', title: 'Fatal Crashes', desc: 'Fatal traffic crashes recorded specifically within this district\\'s identified crash-prone zones — not the district\\'s full citywide crash total (see Persons Killed for the full-district figure).', source: 'Delhi Road Crash Report 2023', sourceByYear: { '2023': 'Delhi Road Crash Report 2023', '2024': 'Delhi Road Crash Report 2024, Table 6.31' } },
  { key: 'totalCrashes2023', label: 'Total Crashes', short: 'total crashes', year: '2023', yearVariants: { '2023': 'totalCrashes2023', '2024': 'totalCrashes2024' }, full: 'Total Crashes, 2023 (Delhi Road Crash Report)', title: 'Total Road Crashes', desc: 'Fatal + simple-injury crashes recorded specifically within this district\\'s identified crash-prone zones — not the district\\'s full citywide crash total (see Persons Killed for the full-district figure).', source: 'Delhi Road Crash Report 2023', sourceByYear: { '2023': 'Delhi Road Crash Report 2023', '2024': 'Delhi Road Crash Report 2024, Table 6.31' } },
  { key: 'crashProneZones2024', hiddenFromSelector: true, label: 'Crash Zones \\'24', short: 'crash-prone zones', year: '2024', full: 'Crash-Prone Zones, 2024 (Delhi Road Crash Report)', title: 'Identified Crash-Prone Zones (2024)', desc: 'Identified accident blackspots and high-risk traffic corridors.', source: 'Delhi Road Crash Report 2024, Table 6.31' },
  { key: 'fatalCrashes2024', hiddenFromSelector: true, label: 'Fatal Crashes \\'24', short: 'fatal crashes (2024)', year: '2024', full: 'Fatal Crashes, 2024 (Delhi Road Crash Report)', title: 'Fatal Crashes (2024)', desc: 'Fatal traffic crashes recorded specifically within this district\\'s identified crash-prone zones in 2024 — not the district\\'s full citywide crash total (see Persons Killed for the full-district figure).', source: 'Delhi Road Crash Report 2024, Table 6.31' },
  { key: 'totalCrashes2024', hiddenFromSelector: true, label: 'Total Crashes \\'24', short: 'total crashes (2024)', year: '2024', full: 'Total Crashes, 2024 (Delhi Road Crash Report)', title: 'Total Road Crashes (2024)', desc: 'Fatal + simple-injury crashes recorded specifically within this district\\'s identified crash-prone zones in 2024 — not the district\\'s full citywide crash total (see Persons Killed for the full-district figure).', source: 'Delhi Road Crash Report 2024, Table 6.31' },
  { key: 'personsKilled2023', label: 'Persons Killed', short: 'persons killed in road crashes', year: '2023', yearVariants: { '2023': 'personsKilled2023', '2024': 'personsKilled2024' }, full: 'Persons Killed in Road Crashes, 2023 (Delhi Road Crash Report)', title: 'Persons Killed in Road Crashes', desc: 'Total persons killed across all road crashes citywide in this district (full district total, not limited to crash-prone zones — a wider scope than the Fatal/Total Crashes metrics above).', source: 'Delhi Road Crash Report 2024, Table 6.2' },
  { key: 'personsKilled2024', hiddenFromSelector: true, label: 'Persons Killed \\'24', short: 'persons killed in road crashes (2024)', year: '2024', full: 'Persons Killed in Road Crashes, 2024 (Delhi Road Crash Report)', title: 'Persons Killed in Road Crashes (2024)', desc: 'Total persons killed across all road crashes citywide in this district in 2024 (full district total, not limited to crash-prone zones — a wider scope than the Fatal/Total Crashes metrics above).', source: 'Delhi Road Crash Report 2024, Table 6.2' },
  { key: 'personsInjured2023', label: 'Persons Injured', short: 'persons injured in road crashes', year: '2023', yearVariants: { '2023': 'personsInjured2023', '2024': 'personsInjured2024' }, full: 'Persons Injured in Road Crashes, 2023 (Delhi Road Crash Report)', title: 'Persons Injured in Road Crashes', desc: 'Total persons injured across all road crashes citywide in this district (full district total, not limited to crash-prone zones).', source: 'Delhi Road Crash Report 2024, Table 6.2' },
  { key: 'personsInjured2024', hiddenFromSelector: true, label: 'Persons Injured \\'24', short: 'persons injured in road crashes (2024)', year: '2024', full: 'Persons Injured in Road Crashes, 2024 (Delhi Road Crash Report)', title: 'Persons Injured in Road Crashes (2024)', desc: 'Total persons injured across all road crashes citywide in this district in 2024 (full district total, not limited to crash-prone zones).', source: 'Delhi Road Crash Report 2024, Table 6.2' },
];

const INFRA = [
  { key: 'streetlight', densityKey: 'lightDensityPerKm2', countKey: 'totalLights', label: 'Streetlights', unit: 'streetlights', title: 'Streetlight Density', desc: 'Number of surveyed functioning streetlights per square kilometer of district area.', source: 'PAPL Open Transit Survey' },
  { key: 'underpass', densityKey: 'underpassDensity', countKey: 'underpasses', label: 'Underpasses', unit: 'underpasses', title: 'Pedestrian Underpass Density', desc: 'Number of pedestrian underpasses and subways per square kilometer.', source: 'PAPL Open Transit Survey' },
  { key: 'pedestrianOverpass', densityKey: 'pedestrianOverpassDensity', countKey: 'pedestrianOverpasses', label: 'Pedestrian Overbridges', unit: 'mapped bridges', title: 'Mapped Pedestrian Overbridge Density', desc: 'OpenStreetMap footway/path/steps bridge segments grouped into pedestrian bridge features per square kilometer. Mapped inventory, not an official completeness register.', source: 'OpenStreetMap (Overpass API snapshot 2026-08-04)' },
  { key: 'metroGate', densityKey: 'metroGateDensity', countKey: 'metroGates', label: 'Metro gates', unit: 'metro gates', title: 'Metro Entrance Gate Density', desc: 'Number of Delhi Metro station entrance/exit gates per square kilometer.', source: 'OpenStreetMap' },
  { key: 'policeInfra', densityKey: 'policeInfraDensity', countKey: 'policeInfraCount', label: 'Police Infra', unit: 'police posts', title: 'Police Infrastructure Density', desc: 'Combined police stations, posts, chowkis, and booths per square kilometer.', source: 'Delhi Police GSDL + OpenStreetMap' },
  { key: 'busStop', densityKey: 'busStopDensity', countKey: 'busStops', label: 'Bus Stops', unit: 'bus stops', title: 'Bus Stop Density', desc: 'Number of OpenStreetMap-tagged bus stops per square kilometer.', source: 'OpenStreetMap' },
  { key: 'atm', densityKey: 'atmDensity', countKey: 'atms', label: 'ATMs', unit: 'ATMs', title: 'ATM Density', desc: 'Number of OpenStreetMap-tagged automated teller machines per square kilometer.', source: 'OpenStreetMap (Overpass API)' },
  { key: 'alcoholShop', densityKey: 'alcoholShopDensity', countKey: 'alcoholShops', label: 'Liquor Shops', unit: 'liquor shops', title: 'Liquor & Wine Shop Density', desc: 'Number of OpenStreetMap-tagged liquor vends and wine/beer shops per square kilometer. Mapped inventory, not an official completeness register — a district showing zero has none mapped in OSM, which is not the same as none operating there. The official DSCSC/DCCWS licensed-vend total is reported separately as a citywide figure.', source: 'OpenStreetMap (Overpass API)' },
  { key: 'surveillance', densityKey: 'surveillanceDensity', countKey: 'surveillanceCameras', label: 'CCTV & Guards', unit: 'cameras/posts', title: 'Surveillance Camera & Guard Density', desc: 'Number of OpenStreetMap-tagged CCTV cameras, ALPR systems, and security guards per square kilometer. Mapped inventory, not an official completeness register — a district showing zero has none mapped in OSM, which is not the same as none installed there. No official citywide camera inventory is published to check this against.', source: 'OpenStreetMap (Overpass API)' },
];

// Districts the PAPL survey actually drove through — shared gap for streetlights and underpasses.
const SURVEYED = new Set(['Central','East','New Delhi','North','Shahdara','South','South-East','South-West','West']);
function infraCovered(d, infraKey) {
  if (infraKey === 'metroGate' || infraKey === 'busStop' || infraKey === 'atm' || infraKey === 'alcoholShop' || infraKey === 'surveillance' || infraKey === 'pedestrianOverpass') return true;
  if (infraKey === 'policeInfra') return d.chowkiPosts > 0;
  return SURVEYED.has(d.district) && d[infraKey === 'streetlight' ? 'surveyPoints' : 'underpasses'] >= 10;
}

let activeMetric = 'theft';
let activeYear = '2024'; // most recent year with complete data for all 15 districts on every metric
let rateMode = 'counts'; // 'counts' (default), 'density' (per km²) or 'perCapita' (per 100k residents)
let corrCoeffMode = 'pearson'; // 'pearson' (linear) or 'spearman' (rank)
let showStreetlightPoints = false;
let showOsmStreetLamps = false;
let showPolice = false;
let showZones = false;
let showBusStops = false;
let showAtms = false;
let showAlcohol = false;
let showSurveillance = false;
let isBivariateMode = false;
let selected = null;
let scatterType = 'streetlight';
let scatterYMetric = 'hitAndRunCrashes2022';

${STATS_SRC}

// Exact two-tailed Student t test (see scripts/lib/stats.js); spearmanRank is Pearson on average ranks.
function getCorrelationPValue(r, n) { return statsPFromR(r, n); }
function spearmanRank(xs, ys) { return statsSpearman(xs, ys); }

function calcMean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function calcStdDev(arr, mean) {
  if (!arr || arr.length <= 1) return 1;
  const m = mean !== undefined ? mean : calcMean(arr);
  const variance = arr.reduce((a, b) => a + Math.pow(b - m, 2), 0) / arr.length;
  return Math.sqrt(variance) || 1;
}

function computeZScore(val, mean, stdDev) {
  if (!stdDev) return 0;
  return (val - mean) / stdDev;
}

function getRateVal(rawCount, d) {
  if (rawCount == null) return null;
  if (rateMode === 'counts') return rawCount;
  if (rateMode === 'perCapita') {
    return Math.round((rawCount / d.population) * 100000 * 10) / 10;
  }
  return Math.round((rawCount / d.areaSqKm) * 10) / 10;
}

function getInfraVal(d, inf) {
  const count = d[inf.countKey];
  if (count == null) return null;
  if (rateMode === 'perCapita') {
    return Math.round((count / d.population) * 100000 * 10) / 10;
  }
  return d[inf.densityKey];
}

function rustScale(t) {
  const c1 = [230, 214, 179], c2 = [177, 74, 52];
  const r = Math.round(c1[0] + (c2[0]-c1[0])*t);
  const g = Math.round(c1[1] + (c2[1]-c1[1])*t);
  const b = Math.round(c1[2] + (c2[2]-c1[2])*t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}
function fmtNum(n) { return n == null ? '—' : n.toLocaleString('en-IN'); }

function setupHighDPICanvas(canvas, aspectRatio) {
  const cssWidth = canvas.clientWidth;
  if (!cssWidth) return null;
  const cssHeight = Math.round(cssWidth * aspectRatio);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return { ctx, W: cssWidth, H: cssHeight };
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function findDistrictName(x, y) {
  return DATA.reduce((best, d) => {
    const dist = Math.hypot(d.cx - x, d.cy - y);
    return dist < best.dist ? { d, dist } : best;
  }, { dist: Infinity }).d.name;
}

function currentMetric() { return METRICS.find(m => m.key === activeMetric); }

// Field-naming convention for the NCRB series: metricKey + year, except 2023,
// which uses the bare metric key. Road-safety series declare explicit yearVariants.
function yearFieldKey(m, year) {
  if (!m.prevKey) return m.key;
  if (year === m.year) return m.key;
  return m.key + year;
}
function metricSupportsYear(m, year) {
  if (m.yearVariants) return !!m.yearVariants[year];
  if (!m.prevKey) return year === m.year;
  if (['2022','2023','2024'].includes(year)) return true;
  if (+year >= 2011 && +year <= 2018) return true; // drawn from the historical reporting data, see isHistoryView()
  return !!(m.historicalYears && m.historicalYears.includes(year));
}

function metricRawValue(d, m) {
  return m.yearVariants ? d[m.yearVariants[activeYear]] : (!m.prevKey ? d[m.key] : d[yearFieldKey(m, activeYear)]);
}

function metricValue(d, m) {
  return getRateVal(metricRawValue(d, m), d);
}

function yearFieldVal(d, baseKey) {
  const m = METRICS.find(x => x.key === baseKey);
  if (!m) return d[baseKey];
  if (m.yearVariants) return d[m.yearVariants[activeYear]];
  if (!m.prevKey) return d[baseKey];
  return d[yearFieldKey(m, activeYear)];
}

function yearLabel(m) {
  if (!m.prevKey && !m.yearVariants) return m.full;
  return m.full.replace(m.year, activeYear);
}

function yearSuffix(m) {
  return (m.prevKey || m.yearVariants) ? activeYear : m.year;
}

// The crash-zone tables are published in a different report per year, so cite the one the
// selected year actually came from instead of a single fixed string. Metrics whose whole
// series really does come from one report (persons killed/injured, both years in the 2024
// report's Table 6.2) carry no sourceByYear and fall through to the fixed source.
function metricSource(m) {
  return (m.sourceByYear && m.sourceByYear[yearSuffix(m)]) || m.source;
}
function dataStatusFor(m) {
  const year = yearSuffix(m);
  if (m.prevKey) {
    if (+year < 2022) return { state: 'production', label: 'Production · verified historical', coverage: '15 police districts where published; intentional early-year nulls', comparable: 'Only adjacent available years in the same series', source: m.source + ' / verified India Data Portal extract' };
    return { state: 'production', label: 'Production', coverage: 'All 15 Delhi Police districts', comparable: '2022–2024 same district series; 2024 uses BNS-era table numbering', source: metricSource(m) };
  }
  if (m.key === 'fatalRoadCrashes2022' || m.key === 'hitAndRunCrashes2022') return { state: 'partial', label: 'Partial coverage', coverage: '11 Traffic Police reporting districts; four police districts not separately reported', comparable: 'Not a 15-district comparison; missing districts are not zero', source: metricSource(m) };
  if (m.key === 'crashProneZones2023' || m.key === 'fatalCrashes2023' || m.key === 'totalCrashes2023') return { state: 'production', label: 'Production', coverage: 'All 15 police districts; crash-prone-zone scope only', comparable: '2023–2024 within this series, not with full district totals', source: metricSource(m) };
  return { state: 'production', label: 'Production', coverage: 'All 15 police districts; full district road-crash totals', comparable: '2023–2024 within this series', source: metricSource(m) };
}
function renderDataStatus() {
  const m = currentMetric(), s = dataStatusFor(m), el = document.getElementById('dataStatus');
  el.innerHTML = '<b>Data status · ' + m.label + ' (' + yearSuffix(m) + ')</b><span><span class="data-status-label">Status</span><span class="data-status-badge ' + s.state + '">' + s.label + '</span></span><span><span class="data-status-label">Coverage</span><span class="data-status-value">' + s.coverage + '</span></span><span><span class="data-status-label">Comparable?</span><span class="data-status-value">' + s.comparable + '</span></span><span><span class="data-status-label">Source</span><span class="data-status-value">' + s.source + '</span></span>';
}

function buildMetricTabs() {
  const el = document.getElementById('metricTabs');
  const visible = METRICS.filter(m => !m.hiddenFromSelector);
  const crime = visible.filter(m => !!m.prevKey);
  const road = visible.filter(m => !m.prevKey);
  const options = group => group.map(m => '<option value="' + m.key + '"' + (m.key === activeMetric ? ' selected' : '') + '>' + m.label + '</option>').join('');
  el.innerHTML = options(topicOf(currentMetric()) === 'crime' ? crime : road);
  const m = currentMetric();
  el.title = m.title + ' — ' + m.desc + ' Source: ' + metricSource(m);
  el.onchange = () => {
    activeMetric = el.value;
    const next = currentMetric();
    if (!metricSupportsYear(next, activeYear)) {
      const supported = next.yearVariants ? Object.keys(next.yearVariants) : (next.historicalYears ? [...next.historicalYears, '2022', '2023', '2024'] : [next.year]);
      activeYear = supported[supported.length - 1];
    }
    render();
  };
  buildYearToggle();
  buildRateToggle();
  updateDisplayControls();
}

function buildYearToggle() {
  const el = document.getElementById('yearToggle');
  const field = document.getElementById('yearField');
  const m = currentMetric();
  if (!m.prevKey && !m.yearVariants) { field.style.display = 'none'; return; }
  field.style.display = '';
  const years = m.yearVariants ? Object.keys(m.yearVariants) : (m.prevKey ? ['2011','2012','2013','2014','2015','2016','2017','2018',...(m.historicalYears || []).filter(y => +y >= 2019), '2022', '2023', '2024'] : ['2022', '2023', '2024']);
  el.innerHTML = years.map(y => '<option value="' + y + '"' + (activeYear === y ? ' selected' : '') + '>' + y + '</option>').join('');
  el.title = m.historicalYears ? m.historicalSource : 'Available reporting years for ' + m.label;
  el.onchange = () => {
    activeYear = el.value; render();
  };
}

function buildRateToggle() {
  const el = document.getElementById('rateToggle');
  if (!el) return;
  const opts = [['counts', 'Count'], ['density', 'Per km²'], ['perCapita', 'Per 100k']];
  el.innerHTML = opts.map(([val, label]) => '<button class="metric-tab' + (rateMode===val?' active':'') + '" data-val="' + val + '" aria-pressed="' + (rateMode===val) + '">' + label + '</button>').join('');
  el.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      rateMode = btn.dataset.val;
      render();
    });
  });
}

function updateDisplayControls() {
  const choropleth = document.getElementById('choroplethMode');
  const bivariate = document.getElementById('bivariateToggle');
  if (!choropleth || !bivariate) return;
  choropleth.classList.toggle('active', !isBivariateMode);
  choropleth.setAttribute('aria-pressed', String(!isBivariateMode));
  bivariate.classList.toggle('active', isBivariateMode);
  bivariate.setAttribute('aria-checked', String(isBivariateMode));
}
function currentDomain() {
  const m = currentMetric();
  const vals = DATA.map(d => metricValue(d, m)).filter(v => v != null);
  return [Math.min(...vals), Math.max(...vals)];
}

// Rank-based (percentile) scale instead of linear min-max: a district's color depends on how
// many other districts it beats, not its raw distance from the extremes. One outlier district
// (e.g. 20,000 thefts against a field mostly under 2,000) would otherwise squash everyone else
// into the bottom of the color range under a linear scale, hiding real variance among the rest.
function percentileScale(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return v => {
    if (n <= 1) return 0.5;
    const first = sorted.indexOf(v);
    const last = sorted.length - 1 - [...sorted].reverse().indexOf(v);
    return ((first + last) / 2) / (n - 1);
  };
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tt(title, body) { return ' data-tt-title="' + esc(title) + '" data-tt-body="' + esc(body || '') + '"'; }

// 3x3 Bivariate Color Matrix — rows = infrastructure density (low → high), columns = crime (low → high)
const BIVARIATE_MATRIX = [
  ['#e8e8e8', '#e4acac', '#c85a5a'], // Low infra:  [Low, Med, High] crime
  ['#a0c7c7', '#ad9ea5', '#985356'], // Med infra
  ['#5b9e9e', '#5d757d', '#574249'], // High infra
];

function getTertileIndex(val, sortedArr) {
  if (val == null || sortedArr.length === 0) return 0;
  const q33 = sortedArr[Math.floor(sortedArr.length * 0.33)];
  const q66 = sortedArr[Math.floor(sortedArr.length * 0.66)];
  if (val <= q33) return 0;
  if (val <= q66) return 1;
  return 2;
}

// Bivariate color for one district, crossing a crime metric against an infrastructure layer.
// Reuses metricValue()/getInfraVal() rather than dividing by area directly, so this respects
// whichever year (activeYear) and rate mode (density vs per-capita, rateMode) are already
// selected elsewhere on the page instead of silently showing a different basis than the rest
// of the dashboard. Tertiles are computed live from whichever districts have valid data on
// both axes, not fixed cut points, so the grouping stays meaningful across metric/year/rate-mode
// switches instead of drifting when the underlying value scale changes.
function getBivariateColor(d, crimeMetricKey, infraMetricKey) {
  const m = METRICS.find(x => x.key === crimeMetricKey);
  const inf = INFRA.find(x => x.key === infraMetricKey);
  if (!m || !inf) return 'var(--map-nodata-stripe)';

  const validDists = DATA.filter(x => infraCovered(x, infraMetricKey) && metricValue(x, m) != null);
  if (!validDists.length) return 'var(--map-nodata-stripe)';

  const crimeValues = validDists.map(x => metricValue(x, m)).sort((a, b) => a - b);
  const infraValues = validDists.map(x => getInfraVal(x, inf)).sort((a, b) => a - b);

  if (!infraCovered(d, infraMetricKey)) return 'var(--map-nodata-stripe)';
  const currentCrime = metricValue(d, m);
  const currentInfra = getInfraVal(d, inf);
  if (currentCrime == null) return 'var(--map-nodata-stripe)';

  const xIndex = getTertileIndex(currentCrime, crimeValues);
  const yIndex = getTertileIndex(currentInfra, infraValues);
  return BIVARIATE_MATRIX[yIndex][xIndex];
}

let mapInitialized = false;

function initMap() {
  const svg = document.getElementById('map');
  if (!svg || mapInitialized) return;
  mapInitialized = true;

  const parts = [
    '<defs><pattern id="hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="7" stroke="var(--label-stroke)" stroke-width="2.5" opacity=".35"></line></pattern></defs>',
    '<g id="districtPathsLayer"></g>',
    '<g id="hatchLayer"></g>',
    '<g id="airportLayer"></g>',
    '<g id="centerMarkersLayer"></g>',
    '<g id="policeLayer"></g>',
    '<g id="zonesLayer"></g>',
    '<g id="streetlightSurveyLayer"></g>',
    '<g id="osmStreetLampLayer"></g>',
    '<g id="busStopLayer"></g>',
    '<g id="atmLayer"></g>',
    '<g id="alcoholLayer"></g>',
    '<g id="surveillanceLayer"></g>'
  ];
  svg.innerHTML = parts.join('');

  const distLayer = svg.querySelector('#districtPathsLayer');
  DATA.forEach(d => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('class', 'district');
    p.setAttribute('data-name', d.name);
    p.setAttribute('d', d.path);
    p.setAttribute('tabindex', '0');
    p.setAttribute('role', 'button');
    p.setAttribute('aria-label', d.name + ' District');
    distLayer.appendChild(p);
  });

  const hatchLayer = svg.querySelector('#hatchLayer');
  DATA.forEach(d => {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('class', 'district-hatch');
    p.setAttribute('data-name', d.name);
    p.setAttribute('d', d.path);
    p.style.display = 'none';
    hatchLayer.appendChild(p);
  });

  const airportLayer = svg.querySelector('#airportLayer');
  airportLayer.innerHTML = '<path class="airport-shape" d="' + AIRPORT_SHAPE.path + '" data-tt-title="IGI Airport" data-tt-body="Separate police jurisdiction — no crime data in this dataset"></path>' +
    '<text class="airport-label" x="' + AIRPORT_SHAPE.cx + '" y="' + AIRPORT_SHAPE.cy + '">IGI Airport</text>';

  const centerLayer = svg.querySelector('#centerMarkersLayer');
  const centerParts = [];
  DATA.forEach(d => {
    centerParts.push('<circle class="district-center-ring" cx="' + d.cx + '" cy="' + d.cy + '" r="5.5" data-tt-title="' + esc(d.name) + '" data-tt-body="Approximate district center (polygon centroid)"></circle>');
    centerParts.push('<circle class="district-center-dot" cx="' + d.cx + '" cy="' + d.cy + '" r="2"></circle>');
    centerParts.push('<text class="district-label" x="' + d.cx + '" y="' + (d.cy + 17) + '">' + d.name + '</text>');
  });
  centerLayer.innerHTML = centerParts.join('');

  function findDistrictName(x, y) {
    return DATA.reduce((best, d) => {
      const dist = Math.hypot(d.cx - x, d.cy - y);
      return dist < best.dist ? { d, dist } : best;
    }, { dist: Infinity }).d.name;
  }

  const policeLayer = svg.querySelector('#policeLayer');
  const policeParts = [];
  POLICE_MARKERS.posts.forEach(([x, y, name]) => {
    const distName = findDistrictName(x, y);
    const svUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' Delhi Police ' + distName);
    policeParts.push('<circle class="police-marker post" cx="' + x + '" cy="' + y + '" r="3.2" data-sv-url="' + svUrl + '" data-tt-title="' + esc(name) + '" data-tt-body="Police Chowki / Outpost · ' + esc(distName) + ' District (Click to open Street View / Location)"></circle>');
  });
  POLICE_MARKERS.stations.forEach(([x, y, name]) => {
    const distName = findDistrictName(x, y);
    const svUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' Delhi Police ' + distName);
    policeParts.push('<circle class="police-marker station" cx="' + x + '" cy="' + y + '" r="4.2" data-sv-url="' + svUrl + '" data-tt-title="' + esc(name) + '" data-tt-body="Official Police Station · ' + esc(distName) + ' District (Click to open Street View / Location)"></circle>');
  });
  policeLayer.innerHTML = policeParts.join('');

  const zonesLayer = svg.querySelector('#zonesLayer');
  const zoneParts = [];
  ACCIDENT_ZONES_MAPPED.forEach(z => {
    const x = z.x, y = z.y;
    const t = Math.max(0, Math.min(1, (z.fatal - 1) / 6));
    const size = 4.5 + t * 3.5;
    const opacity = (0.55 + t * 0.45).toFixed(2);
    const svUrl = z.lat && z.lng ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + z.lat + ',' + z.lng : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(z.name + ' ' + z.road + ' Delhi');
    zoneParts.push('<path class="zone-marker" style="opacity:' + opacity + '" d="M' + x + ',' + (y - size) + ' L' + (x + size * 0.87) + ',' + (y + size * 0.67) + ' L' + (x - size * 0.87) + ',' + (y + size * 0.67) + ' Z" data-sv-url="' + svUrl + '" data-tt-title="' + esc(z.name + ' (' + z.road + ')') + '" data-tt-body="' + esc(z.district + ' · ' + z.fatal + ' fatal, ' + z.total + ' total crashes, 2023') + ' (Click for 360° Street View)"></path>');
  });
  zonesLayer.innerHTML = zoneParts.join('');

  // PAPL survey observations shown as proportional points rather than a heatmap. Each grid
  // cell preserves the survey's recorded light count; logarithmic sizing keeps dense cells
  // visible without allowing the largest observation to obscure nearby locations.
  const streetlightSurveyLayer = svg.querySelector('#streetlightSurveyLayer');
  const maxStreetlightCount = Math.max(...GRID.points.map(p => p[2]));
  streetlightSurveyLayer.innerHTML = GRID.points.map(([gx, gy, count]) => {
    const x = gx * GRID.cell;
    const y = gy * GRID.cell;
    const radius = 1.15 + 3.1 * (Math.log1p(count) / Math.log1p(maxStreetlightCount));
    return '<circle class="streetlight-survey-point" cx="' + x + '" cy="' + y + '" r="' + radius.toFixed(2) + '" data-tt-title="Streetlight survey observation" data-tt-body="' + fmtNum(count) + ' lights recorded in this survey cell · PAPL / Delhi Transport Stack OTD"></circle>';
  }).join('');

  // POI marker layers — plain point data (no per-item Street View lookup, unlike police/zones
  // above), kept as small low-opacity dots so 3,000+ bus stops don't visually overwhelm the
  // choropleth underneath. Toggled independently so multiple layers can be compared against
  // each other and against the crime coloring at once.
  function poiLayer(id, points, className, radius) {
    const layer = svg.querySelector('#' + id);
    if (!layer) return;
    layer.innerHTML = points.map(([x, y, name]) => {
      const distName = findDistrictName(x, y);
      return '<circle class="' + className + '" cx="' + x + '" cy="' + y + '" r="' + radius + '" data-tt-title="' + esc(name) + '" data-tt-body="' + esc(distName + ' District') + '"></circle>';
    }).join('');
  }
  poiLayer('osmStreetLampLayer', OSM_STREET_LAMP_MARKERS, 'poi-marker poi-osm-lamp', 1.8);
  poiLayer('busStopLayer', POI_MARKERS.busStops, 'poi-marker poi-bus', 1.6);
  poiLayer('atmLayer', POI_MARKERS.atms, 'poi-marker poi-atm', 2.2);
  poiLayer('alcoholLayer', POI_MARKERS.alcoholShops, 'poi-marker poi-alcohol', 3);
  poiLayer('surveillanceLayer', POI_MARKERS.surveillance, 'poi-marker poi-surveillance', 2.2);

  svg.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const path = e.target.closest('.district');
      if (path) {
        e.preventDefault();
        selected = selected === path.dataset.name ? null : path.dataset.name;
        render();
      }
    }
  });
}

function renderMap() {
  initMap();
  const m = currentMetric();
  const inf = INFRA.find(x => x.key === scatterType);
  const vs = viewScale(DATA.map(d => metricValue(d, m)).filter(v => v != null), m, yearSuffix(m));
  const [lo, hi] = vs.fixed ? [vs.lo, vs.hi] : currentDomain();
  const scale = vs.scale;

  document.querySelectorAll('#map path.district').forEach(path => {
    const name = path.dataset.name;
    const d = DATA.find(x => x.name === name);
    if (!d) return;
    const v = metricValue(d, m);
    const isSel = selected === d.name;

    const yearTheft = yearFieldVal(d, 'theft');
    const yearRobbery = yearFieldVal(d, 'robbery');
    const yearBurglary = yearFieldVal(d, 'burglary');
    const yearCAW = yearFieldVal(d, 'crimeAgainstWomen');
    const yearSLL = yearFieldVal(d, 'totalSLL');

    let fill, body;
    if (isBivariateMode) {
      fill = getBivariateColor(d, activeMetric, scatterType);
      const infraVal = infraCovered(d, scatterType) ? getInfraVal(d, inf) : null;
      body = (v == null || infraVal == null)
        ? 'No data for one or both axes'
        : '<div class="tt-metric"><b>' + m.short + ' (' + activeYear + '):</b> ' + fmtNum(v) + '</div>' +
          '<div class="tt-metric"><b>' + inf.label + ':</b> ' + fmtNum(infraVal) + '</div>';
    } else {
      fill = v == null ? 'var(--map-nodata-stripe)' : rustScale(scale(v));
      body = v == null
        ? 'No data for this metric'
        : '<div class="tt-metric"><b>' + m.short + ' (' + activeYear + '):</b> ' + fmtNum(v) + '</div>' +
          '<div class="tt-breakdown">' +
            '<div class="tt-row"><span>Theft:</span><b>' + fmtNum(yearTheft) + '</b></div>' +
            '<div class="tt-row"><span>Robbery:</span><b>' + fmtNum(yearRobbery) + '</b></div>' +
            '<div class="tt-row"><span>Burglary:</span><b>' + fmtNum(yearBurglary) + '</b></div>' +
            '<div class="tt-row"><span>Vs. Women:</span><b>' + fmtNum(yearCAW) + '</b></div>' +
            '<div class="tt-row"><span>SLL Crimes:</span><b>' + fmtNum(yearSLL) + '</b></div>' +
          '</div>';
    }

    path.setAttribute('fill', fill);
    path.style.stroke = isSel ? 'var(--night)' : '';
    path.style.strokeWidth = isSel ? '2.4' : '';
    path.setAttribute('aria-selected', isSel ? 'true' : 'false');
    path.setAttribute('data-tt-title', d.name + ' District');
    path.setAttribute('data-tt-body', body);
  });

  document.querySelectorAll('#map path.district-hatch').forEach(path => {
    const name = path.dataset.name;
    const d = DATA.find(x => x.name === name);
    if (!d) return;
    const v = metricValue(d, m);
    const showHatch = isBivariateMode
      ? (v == null || !infraCovered(d, scatterType))
      : (v == null);
    path.style.display = showHatch ? 'inline' : 'none';
  });

  const policeLayer = document.getElementById('policeLayer');
  if (policeLayer) policeLayer.style.display = showPolice ? 'inline' : 'none';

  const zonesLayer = document.getElementById('zonesLayer');
  if (zonesLayer) zonesLayer.style.display = showZones ? 'inline' : 'none';

  const streetlightSurveyLayer = document.getElementById('streetlightSurveyLayer');
  if (streetlightSurveyLayer) streetlightSurveyLayer.style.display = showStreetlightPoints ? 'inline' : 'none';

  const osmStreetLampLayer = document.getElementById('osmStreetLampLayer');
  if (osmStreetLampLayer) osmStreetLampLayer.style.display = showOsmStreetLamps ? 'inline' : 'none';

  const busStopLayer = document.getElementById('busStopLayer');
  if (busStopLayer) busStopLayer.style.display = showBusStops ? 'inline' : 'none';
  const atmLayer = document.getElementById('atmLayer');
  if (atmLayer) atmLayer.style.display = showAtms ? 'inline' : 'none';
  const alcoholLayer = document.getElementById('alcoholLayer');
  if (alcoholLayer) alcoholLayer.style.display = showAlcohol ? 'inline' : 'none';
  const surveillanceLayer = document.getElementById('surveillanceLayer');
  if (surveillanceLayer) surveillanceLayer.style.display = showSurveillance ? 'inline' : 'none';

  const singleLegend = document.getElementById('singleLegend');
  const bivariateLegend = document.getElementById('bivariateLegend');
  if (singleLegend) singleLegend.style.display = isBivariateMode ? 'none' : '';
  if (bivariateLegend) bivariateLegend.style.display = isBivariateMode ? '' : 'none';

  if (isBivariateMode) {
    const xLabel = document.getElementById('bivariateXLabel');
    const yLabel = document.getElementById('bivariateYLabel');
    if (xLabel) xLabel.textContent = m.short + ' →';
    if (yLabel) yLabel.textContent = inf.label + ' →';
  } else {
    document.getElementById('legendLabel').textContent = yearLabel(m) + ' · ' + unitPhrase(m) + (vs.fixed ? ' · ' + vs.note : '');
    document.querySelector('#singleLegend .legend-scale-note').textContent = vs.fixed ? '(one linear scale shared by these years, so colours can be compared across them)' : "(ranked within this year, not linear: an outlier district can't wash out the rest of the scale)";
    document.getElementById('legendMin').textContent = fmtNum(lo);
    document.getElementById('legendMax').textContent = fmtNum(hi);
    const legendScale = document.getElementById('legendScale');
    legendScale.innerHTML = Array.from({length:10}, (_,i) => '<span style="background:' + rustScale(i/9) + '"></span>').join('');
    legendScale.setAttribute('data-tt-title', 'District Crime Percentile Scale');
    legendScale.setAttribute('data-tt-body', 'Light: Lowest Crime Density in Delhi → Dark Rust: Highest Crime Density in Delhi');
  }
}

function renderList() {
  const m = currentMetric();
  document.getElementById('listSub').textContent = 'Districts by ' + m.short + ', ' + yearSuffix(m);
  const vs = viewScale(DATA.map(d => metricValue(d, m)).filter(v => v != null), m, yearSuffix(m));
  const [lo, hi] = vs.fixed ? [vs.lo, vs.hi] : currentDomain();
  const scale = vs.scale;
  const sorted = [...DATA].sort((a,b) => (metricValue(b,m)??-Infinity) - (metricValue(a,m)??-Infinity));
  const el = document.getElementById('rankList');
  el.innerHTML = sorted.map((d, i) => {
    const v = metricValue(d, m);
    const pct = v == null ? 0 : Math.max(3, (hi===lo?100:(v-lo)/(hi-lo)*100));
    const color = v == null ? 'var(--map-nodata-stripe)' : rustScale(scale(v));
    const valLabel = fmtNum(v);
    const selClass = selected === d.name ? ' selected' : '';
    return '<div class="rank-row' + selClass + '" data-name="' + d.name + '">' +
      '<span class="rank-num">' + (i + 1) + '</span>' +
      '<span class="rank-name">' + d.name + '</span>' +
      '<span class="rank-val">' + valLabel + '</span>' +
      '<div class="rank-bar-track"><div class="rank-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div>' +
    '</div>';
  }).join('');
}

function rankOf(d, key) {
  const vals = DATA.map(x => x[key]).filter(v => v != null).sort((a,b) => b - a);
  return vals.indexOf(d[key]) + 1;
}
function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function pctVsCityAvg(d, key) {
  const vals = DATA.map(x => x[key]).filter(v => v != null);
  const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
  return Math.round(((d[key] - avg) / avg) * 100);
}

function yoyBadge(cur, prev, label) {
  if (cur == null || prev == null || prev === 0) return '';
  const pct = ((cur - prev) / prev) * 100;
  const color = pct >= 0 ? 'var(--rust)' : 'var(--good)';
  const arrow = pct >= 0 ? '▲' : '▼';
  return '<span class="yoy-badge" style="color:' + color + '">' + arrow + ' ' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% ' + label + '</span>';
}

function renderSparkline(d, baseKey) {
  const m = METRICS.find(x => x.key === baseKey);
  if (!m || !m.prevKey) return '';
  // Earlier reporting geographies belong to the separate historical view. Do not connect
  // their same-named district counts to this current-geography sparkline.
  const years = [...(m.historicalYears || []).filter(y => +y >= 2019), '2022', '2023', '2024'];
  const points = years.map(y => {
    const key = y === '2022' ? m.prevKey : y === '2023' ? m.key : y === '2024' ? m.key2024 : baseKey + y;
    return { year: y, value: d[key] };
  }).filter(p => p.value != null);
  if (points.length < 2) return '';

  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const range = (max - min) || 1;
  const w = 60, pad = 4, innerW = w - pad * 2;
  const px = i => points.length === 1 ? pad : pad + (i / (points.length - 1)) * innerW;
  const py = v => 18 - ((v - min) / range) * 14;
  const coords = points.map((p, i) => [px(i), py(p.value)]);

  const first = points[0].value, last = points[points.length - 1].value;
  const pctChange = first !== 0 ? ((last - first) / first) * 100 : null;
  const strokeColor = pctChange == null ? 'var(--text-dim)' : pctChange >= 0 ? 'var(--rust)' : 'var(--good)';
  const spanLabel = points[0].year + '-' + points[points.length - 1].year;
  const tooltipBody = points.map(p => p.year + ': ' + fmtNum(p.value)).join(' · ') + (pctChange != null ? ' (' + (pctChange >= 0 ? '+' : '') + pctChange.toFixed(1) + '% over ' + spanLabel + ')' : '');

  return '<span class="sparkline-wrap" data-tt-title="' + esc(m.label + ' ' + spanLabel + ' Trajectory') + '" data-tt-body="' + esc(tooltipBody) + '">' +
    '<svg class="sparkline-svg" viewBox="0 0 60 22">' +
      '<polyline points="' + coords.map(c => c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ') + '" fill="none" stroke="' + strokeColor + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      coords.map(c => '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="1.8" fill="' + strokeColor + '"/>').join('') +
    '</svg>' +
  '</span>';
}

// Maps a crime metric's canonical (unsuffixed, 2023) key to whichever year's field is
// actually being displayed right now, so the detail panel and its narrative can follow
// the same 2022/2023/2024 toggle as the map and ranked list.
function yearField(baseKey, year) {
  const m = METRICS.find(x => x.key === baseKey);
  if (!m || !m.prevKey) return baseKey;
  return yearFieldKey(m, year);
}
// Generalized to any year - 1 (not just 2022-2024) now that theft/robbery/burglary carry
// 2016-2021 data too. Safe for metrics without historical data: yoyBadge()/fmtNum() already
// treat a missing/undefined field the same as null (renders '—', no badge), so asking for e.g.
// totalIPC2021 (a field that doesn't exist) just produces the same "no data" result it always did.
function prevYearOf(year) {
  const y = Number(year);
  return Number.isFinite(y) ? String(y - 1) : null;
}

function computeAnalysis(d, year) {
  const n = DATA.length;
  // theft/robbery/burglary carry 2016-2021 data; total IPC/crime against women/SLL crime only
  // 2017-2021 (2016 uses an incompatible older category schema with no same-schema year to
  // validate simple column-summation against — see METRICS[].historicalYears). Referencing a
  // field outside a metric's supported years would silently resolve to undefined and produce
  // garbage ranks/percentages, so branch on what's actually available for this specific year.
  const isHistoricalYear = !['2022','2023','2024'].includes(year);
  const hasFullCrimeMetrics = metricSupportsYear(METRICS.find(m => m.key === 'totalIPC'), year);
  const theftKey = yearField('theft', year);
  const theftRank = rankOf(d, theftKey);
  const theftPct = pctVsCityAvg(d, theftKey);
  let crimeP;
  if (!hasFullCrimeMetrics) {
    crimeP = d.name + ' ranks <b>' + ordinal(theftRank) + ' of ' + n + '</b> districts by theft in <b>' + year + '</b>, with theft cases ' +
      (theftPct >= 0 ? '<b>' + theftPct + '% above</b>' : '<b>' + Math.abs(theftPct) + '% below</b>') +
      ' the citywide average. 2016 is theft/robbery/burglary only — total IPC crime, crime against women, and SLL crime were not reconstructed for that year (incompatible source schema, see Sources).';
  } else {
    const ipcKey = yearField('totalIPC', year), cawKey = yearField('crimeAgainstWomen', year);
    const ipcRank = rankOf(d, ipcKey);
    const cawRank = rankOf(d, cawKey);
    const severityWord = ipcRank <= 5 ? 'among the highest-crime districts' : ipcRank >= 11 ? 'among the lower-crime districts' : 'in the middle of the pack';
    crimeP = d.name + ' ranks <b>' + ordinal(ipcRank) + ' of ' + n + '</b> districts by total IPC crime in <b>' + year + '</b> — ' + severityWord + ' in Delhi, with theft cases ' +
      (theftPct >= 0 ? '<b>' + theftPct + '% above</b>' : '<b>' + Math.abs(theftPct) + '% below</b>') +
      ' the citywide average (' + ordinal(theftRank) + ' highest for theft specifically). It ranks ' + ordinal(cawRank) + ' of ' + n + ' for crime against women.';
  }

  const roadSafetyCovered = DATA.filter(x => x.fatalRoadCrashes2022 != null).length;
  const roadP = d.fatalRoadCrashes2022 != null
    ? 'Separately, Delhi Traffic Police recorded <b>' + fmtNum(d.fatalRoadCrashes2022) + ' fatal road crashes</b> here in 2022 (' + ordinal(rankOf(d,'fatalRoadCrashes2022')) + ' of ' + roadSafetyCovered + ' reporting districts), ' + fmtNum(d.hitAndRunCrashes2022) + ' of them hit-and-run.'
    : 'Delhi Traffic Police’s 2022 fatal-crash report doesn’t cover this district separately — it uses an 11-district reporting geography, not the 15 Delhi Police districts here.';

  // The 2023 Delhi Road Crash Report uses Traffic Police's 15-district geography, which
  // (unlike the 2022 report above) matches the 15 Delhi Police districts exactly — full
  // coverage, no reporting-geography gap to caveat.
  const crash23Rank = rankOf(d, 'fatalCrashes2023');
  const crash23P = 'The 2023 Delhi Road Crash Report — which does use these same 15 districts, no gap — puts ' + d.name + ' at <b>' + fmtNum(d.crashProneZones2023) + ' identified crash-prone zone' + (d.crashProneZones2023===1?'':'s') + '</b> with <b>' + fmtNum(d.fatalCrashes2023) + ' fatal crashes</b> (' + ordinal(crash23Rank) + ' of ' + n + ') out of ' + fmtNum(d.totalCrashes2023) + ' total crashes recorded here in 2023.';

  const infraLines = INFRA.map(inf => {
    const covered = infraCovered(d, inf.key);
    const dens = d[inf.densityKey];
    if (!covered) {
      if (inf.key === 'policeInfra') {
        return inf.label + ': ' + d.policeStations + ' official station' + (d.policeStations===1?'':'s') + ' confirmed, but chowki/outpost mapping is missing here — the combined figure undercounts.';
      }
      const raw = d[inf.countKey];
      if (raw > 0 && raw < 10) return inf.label + ': only ' + raw + ' points found — too sparse to trust.';
      return inf.label + ': no survey coverage here.';
    }
    const densRank = rankOf(d, inf.densityKey);
    const sub = inf.key === 'policeInfra' ? ' (' + d.policeStations + ' stations + ' + d.chowkiPosts + ' chowkis/outposts)' : '';
    return inf.label + ': <b>' + dens + '/km²</b> (' + ordinal(densRank) + ' of ' + n + '), ' + fmtNum(d[inf.countKey]) + ' total' + sub + '.';
  });
  const infraP = infraLines.join(' ');

  const activeM = currentMetric();
  const activeFieldKey = yearField(activeM.key, year);

  let correlationP = null;
  const streetCovered = infraCovered(d, 'streetlight') && d[activeFieldKey] != null;
  if (isHistoricalYear) {
    correlationP = 'Infrastructure correlation is not computed for historical years — current streetlight/underpass/police survey data reflects present-day conditions, not ' + year + ', so comparing them would conflate two different time periods.';
  } else if (streetCovered) {
    const validDists = DATA.filter(x => infraCovered(x, 'streetlight') && x[activeFieldKey] != null);
    const xs = validDists.map(x => x.lightDensityPerKm2);
    const ys = validDists.map(x => x[activeFieldKey] / x.areaSqKm);
    const r = validDists.length >= 2 ? pearson(xs, ys) : 0;

    const rate = d[activeFieldKey] / d.areaSqKm;
    const rates = validDists.map(x => x[activeFieldKey] / x.areaSqKm).sort((a,b)=>b-a);
    const rRank = rates.indexOf(rate) + 1;
    const dir = r >= 0 ? 'positive' : 'negative';
    const strength = Math.abs(r) >= 0.5 ? 'moderate-to-strong' : Math.abs(r) >= 0.25 ? 'weak' : 'negligible';

    correlationP = 'Across the ' + validDists.length + ' districts with streetlight survey coverage, streetlight density shows a <b>' + strength + ' ' + dir + ' correlation (r = ' + (r >= 0 ? '+' : '') + r.toFixed(3) + ')</b> with ' + activeM.label.toLowerCase() + ' density (' + year + '). ' + d.name + "'s own " + activeM.label.toLowerCase() + ' density ranks <b>' + ordinal(rRank) + ' of ' + validDists.length + '</b> in this group.';
  } else if (d[activeFieldKey] != null) {
    correlationP = 'Streetlight correlation with ' + activeM.label.toLowerCase() + ' cannot be computed here — ' + d.name + ' has no PAPL streetlight survey coverage.';
  }

  const coveredCount = INFRA.filter(inf => infraCovered(d, inf.key)).length;
  const confidenceLevel = coveredCount >= Math.ceil(INFRA.length * 0.75) ? 'high' : 'partial';
  const confidenceLabel = confidenceLevel === 'high'
    ? 'High confidence — ' + coveredCount + ' of ' + INFRA.length + ' infrastructure layers covered here'
    : 'Limited confidence — only ' + coveredCount + ' of ' + INFRA.length + ' infrastructure layers covered here';

  return { crimeP, roadP, crash23P, infraP, correlationP, confidenceLevel, confidenceLabel };
}

// Shown in the detail panel when no district is selected -- citywide totals rather than
// arbitrarily defaulting to one district (South-East, previously). Also the only place the
// official DSCSC/DCCWS licensed liquor vend count belongs: it's a citywide administrative total
// with no reliable district-level breakdown (only 1 of 374 official records has a matched
// coordinate), so it can't be shown as a per-district stat anywhere else on the page.
function renderTotalInfraSummary() {
  const el = document.getElementById('detail');
  const totalArea = DATA.reduce((a, d) => a + d.areaSqKm, 0);
  const totalPop = DATA.reduce((a, d) => a + d.population, 0);

  function totalCrimeRow(label, baseKey) {
    const key = yearField(baseKey, activeYear);
    const coveredDistricts = DATA.filter(d => d[key] != null);
    const total = coveredDistricts.reduce((a, d) => a + d[key], 0);
    const coverageNote = coveredDistricts.length < 15 ? ' <span class="stat-sub">(' + coveredDistricts.length + '/15 districts)</span>' : '';
    return '<div class="stat"><span class="stat-label">' + label + ' (' + activeYear + ')' + coverageNote + '</span><span class="stat-val">' + fmtNum(coveredDistricts.length ? total : null) + '</span></div>';
  }

  const infraTiles = INFRA.map(inf => {
    const coveredDistricts = DATA.filter(d => infraCovered(d, inf.key));
    const total = DATA.reduce((a, d) => a + (d[inf.countKey] || 0), 0);
    const dotClass = coveredDistricts.length === 15 ? 'high' : 'partial';
    return '<div class="stat"><span class="stat-label"><span class="confidence-dot ' + dotClass + '"></span>' + inf.label + '</span><span class="stat-val">' + fmtNum(total) + ' <span class="stat-sub">(' + coveredDistricts.length + '/15 districts covered)</span></span></div>';
  }).join('');

  el.innerHTML = \`
    <div class="detail-head">
      <h2>Total Infrastructure — Citywide</h2>
      <span class="area">\${totalArea.toLocaleString('en-IN')} km² · pop. \${totalPop.toLocaleString('en-IN')}</span>
    </div>
    <p style="font-size:12.5px;color:var(--text-dim);margin:4px 0 12px;">No district selected — citywide totals across all 15 police districts. Click a district on the map or in the ranked list for its individual profile.</p>
    \${totalCrimeRow('Theft', 'theft')}
    \${totalCrimeRow('Robbery', 'robbery')}
    \${totalCrimeRow('Burglary', 'burglary')}
    \${totalCrimeRow('Total IPC', 'totalIPC')}
    \${totalCrimeRow('Vs. women', 'crimeAgainstWomen')}
    \${totalCrimeRow('SLL crimes', 'totalSLL')}
    <div class="section-divider"></div>
    \${infraTiles}
    <div class="stat"><span class="stat-label"><span class="confidence-dot partial"></span>Official licensed liquor vends</span><span class="stat-val">374 <span class="stat-sub">(DSCSC/DCCWS, citywide only — not mappable per-district)</span></span></div>
  \`;
}

function renderDetail() {
  const el = document.getElementById('detail');
  if (!selected) { renderTotalInfraSummary(); return; }
  const d = DATA.find(x => x.name === selected);
  if (!d) { renderTotalInfraSummary(); return; }
  const detailYear = activeYear;
  const a = computeAnalysis(d, detailYear);
  const prevYear = prevYearOf(detailYear);
  function crimeRow(label, baseKey) {
    const key = yearField(baseKey, detailYear);
    const val = d[key];
    let sub = '';
    // A flag field only exists for the 2016-2021 historical extension (e.g.
    // theftPreviousYearComparable2017); its absence means "2022-2024 range", which was always
    // comparable, so treat a missing flag as comparable rather than as "no".
    const comparableFlagKey = baseKey + 'PreviousYearComparable' + detailYear;
    const isComparable = +detailYear >= 2020 && (!(comparableFlagKey in d) || d[comparableFlagKey]);
    if (prevYear && isComparable) {
      const prevKey = yearField(baseKey, prevYear);
      const prevVal = d[prevKey];
      const badge = yoyBadge(val, prevVal, 'vs ' + prevYear);
      sub = '<span class="stat-sub">' + badge + '</span>';
    } else if (prevYear && !isComparable) {
      sub = '<span class="stat-sub" style="color:var(--text-dim);font-style:italic;">not comparable to ' + prevYear + '</span>';
    }
    const spark = renderSparkline(d, baseKey);
    return '<div class="stat"><span class="stat-label">' + label + ' (' + detailYear + ')' + spark + '</span><span class="stat-val">' + fmtNum(val) + '</span>' + sub + '</div>';
  }

  const infraTiles = INFRA.map(inf => {
    const covered = infraCovered(d, inf.key);
    const dotClass = covered ? 'high' : 'partial';
    const val = covered
      ? fmtNum(d[inf.countKey]) + ' <span class="stat-sub">(' + d[inf.densityKey] + '/km²)</span>'
      : '<span class="stat-val nodata">' + (d[inf.countKey] > 0 ? d[inf.countKey] + ' (too sparse)' : 'No coverage') + '</span>';
    return '<div class="stat"><span class="stat-label"><span class="confidence-dot ' + dotClass + '"></span>' + inf.label + '</span>' +
      (covered ? '<span class="stat-val">' + val + '</span>' : val) + '</div>';
  }).join('');

  function findDistrictNameForDetail(x, y) {
    return DATA.reduce((best, distObj) => {
      const dist = Math.hypot(distObj.cx - x, distObj.cy - y);
      return dist < best.dist ? { distObj, dist } : best;
    }, { dist: Infinity }).distObj.name;
  }

  const distStations = POLICE_MARKERS.stations.filter(([x,y,name]) => findDistrictNameForDetail(x,y) === d.name);
  const distZones = ACCIDENT_ZONES_MAPPED.filter(z => z.district === d.name);

  const svSection = '<div class="section-divider"></div>' +
    '<div class="analysis" style="border:none;padding-top:0;margin-top:0;">' +
      '<div class="stat-label">Street View Locations (' + d.name + ')</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">' +
        distStations.slice(0, 3).map(([x,y,name]) =>
          '<a href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(name + ' Delhi Police ' + d.name) + '" target="_blank" rel="noopener" class="street-view-btn" style="margin:0;">PS ' + esc(name) + '</a>'
        ).join('') +
        distZones.slice(0, 3).map(z =>
          '<a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + z.lat + ',' + z.lng + '" target="_blank" rel="noopener" class="street-view-btn" style="margin:0;">Zone ' + esc(z.name) + ' (' + z.fatal + ' fatal)</a>'
        ).join('') +
      '</div>' +
    '</div>';

  el.innerHTML = \`
    <div class="detail-head">
      <h2>\${d.name}</h2>
      <span class="area">\${d.areaSqKm.toLocaleString('en-IN')} km²</span>
    </div>
    \${crimeRow('Theft', 'theft')}
    \${crimeRow('Robbery', 'robbery')}
    \${crimeRow('Burglary', 'burglary')}
    \${crimeRow('Total IPC', 'totalIPC')}
    \${crimeRow('Vs. women', 'crimeAgainstWomen')}
    \${crimeRow('SLL crimes', 'totalSLL')}
    <div class="section-divider"></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Crash-prone zones '23</span><span class="stat-val">\${fmtNum(d.crashProneZones2023)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Fatal crashes '23</span><span class="stat-val">\${fmtNum(d.fatalCrashes2023)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Total crashes '23</span><span class="stat-val">\${fmtNum(d.totalCrashes2023)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Crash-prone zones '24</span><span class="stat-val">\${fmtNum(d.crashProneZones2024)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Fatal crashes '24</span><span class="stat-val">\${fmtNum(d.fatalCrashes2024)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Total crashes '24</span><span class="stat-val">\${fmtNum(d.totalCrashes2024)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Persons killed '23 / '24</span><span class="stat-val">\${fmtNum(d.personsKilled2023)} / \${fmtNum(d.personsKilled2024)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot high"></span>Persons injured '23 / '24</span><span class="stat-val">\${fmtNum(d.personsInjured2023)} / \${fmtNum(d.personsInjured2024)}</span></div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot \${d.fatalRoadCrashes2022!=null?'high':'partial'}"></span>Road deaths '22</span>\${d.fatalRoadCrashes2022!=null ? '<span class="stat-val">'+fmtNum(d.fatalRoadCrashes2022)+'</span>' : '<span class="stat-val nodata">Not reported</span>'}</div>
    <div class="stat"><span class="stat-label"><span class="confidence-dot \${d.hitAndRunCrashes2022!=null?'high':'partial'}"></span>Hit & run '22</span>\${d.hitAndRunCrashes2022!=null ? '<span class="stat-val">'+fmtNum(d.hitAndRunCrashes2022)+'</span>' : '<span class="stat-val nodata">Not reported</span>'}</div>
    <div class="section-divider"></div>
    \${infraTiles}
    \${svSection}
    <div class="analysis">
      <div class="confidence-badge \${a.confidenceLevel}">\${a.confidenceLevel === 'high' ? '●' : '◐'} \${a.confidenceLabel}</div>
      <p>\${a.crimeP}</p>
      <p>\${a.crash23P}</p>
      <p>\${a.roadP}</p>
      \${a.correlationP ? '<p style="color:var(--text);font-weight:600;">' + a.correlationP + '</p>' : ''}
      <p>\${a.infraP}</p>
    </div>
  \`;
}

const INFRA_NOTES = {
  streetlight: 'PAPL survey — 9 of 15 districts covered',
  underpass: 'PAPL survey — same 9 districts',
  pedestrianOverpass: 'OpenStreetMap (Overpass API snapshot 2026-08-04, 242 mapped bridge groups) — all 15 districts',
  metroGate: 'OpenStreetMap — all 15 districts',
  policeInfra: 'Stations: Delhi Police GSDL, official — all 15. Chowkis/outposts: OpenStreetMap — 14 of 15 (Outer unmapped)',
  busStop: 'OpenStreetMap (highway=bus_stop / public_transport=platform, 3,199 points) — all 15 districts',
  atm: 'OpenStreetMap (amenity=atm via Overpass API, 666 points) — all 15 districts',
  alcoholShop: 'OpenStreetMap (shop=alcohol, shop=wine, shop=beverages+alcohol tag via Overpass API, 65 points) — all 15 districts',
  surveillance: 'OpenStreetMap (man_made=surveillance via Overpass API, 1,596 points; 13 fall outside every district polygon and are excluded) — all 15 districts',
};

function renderMethod() {
  const el = document.getElementById('methodGrid');
  if (!el) return;
  const m = currentMetric();
  const yKey = yearField(m.key, activeYear);

  el.innerHTML = INFRA.map(inf => {
    const validDistricts = DATA.filter(d => infraCovered(d, inf.key) && d[yKey] != null);
    const xs = validDistricts.map(d => getInfraVal(d, inf));
    const ys = validDistricts.map(d => getRateVal(d[yKey], d));
    const n = xs.length;
    const r = n >= 2 ? pearson(xs, ys) : 0;
    const rho = n >= 2 ? spearmanRank(xs, ys) : 0;
    const pObj = getCorrelationPValue(corrCoeffMode === 'spearman' ? rho : r, n);

    const coeffVal = corrCoeffMode === 'spearman' ? rho : r;
    const rColor = Math.abs(coeffVal) >= 0.5 ? 'var(--rust)' : Math.abs(coeffVal) >= 0.25 ? 'var(--amber-dim)' : 'var(--text-dim)';
    const interp = Math.abs(coeffVal) >= 0.5 ? 'Moderate to Strong' : Math.abs(coeffVal) >= 0.25 ? 'Weak Relationship' : 'No Clear Pattern';
    const sigLabel = pObj.isSig ? ' (p<0.05*)' : ' (ns, p≥0.05)';

    return '<div class="method-card">' +
      '<div class="name">' + inf.label + ' (' + (rateMode === 'perCapita' ? 'Per 100k' : 'Per km²') + ')</div>' +
      '<div class="formula">' + inf.unit + ' ÷ ' + (rateMode === 'perCapita' ? 'Population (100k)' : 'District Area (km²)') + '</div>' +
      '<div style="margin:8px 0;padding:8px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border);">' +
        '<div style="font-size: 11px;color:var(--text-dim);text-transform:uppercase;font-weight:700;">' + (corrCoeffMode === 'spearman' ? 'Spearman ρ' : 'Pearson r') + ' vs. ' + esc(m.label) + ' (' + activeYear + ')</div>' +
        '<div style="font-size:16px;font-weight:700;color:' + rColor + ';margin-top:2px;">' + (corrCoeffMode === 'spearman' ? 'ρ' : 'r') + ' = ' + (coeffVal >= 0 ? '+' : '') + coeffVal.toFixed(3) + ' <span style="font-size:11px;font-weight:600;color:var(--text-dim);">' + sigLabel + '</span></div>' +
        '<div style="font-size:11px;color:var(--text-dim);margin-top:2px;">r = ' + (r>=0?'+':'') + r.toFixed(3) + ' · ρ = ' + (rho>=0?'+':'') + rho.toFixed(3) + ' (n=' + n + ')</div>' +
        '<div style="font-size:11px;font-weight:600;color:var(--text-dim);margin-top:2px;">' + interp + '</div>' +
      '</div>' +
      '<p style="font-size:11px;margin:4px 0 0;color:var(--text-dim);">' + INFRA_NOTES[inf.key] + '</p>' +
    '</div>';
  }).join('');
}

function renderCorrelationMatrix() {
  const container = document.getElementById('correlationMatrixCard');
  if (!container) return;

  const year = activeYear;
  const infraKeys = INFRA;
  const metricKeys = METRICS;
  const isRho = corrCoeffMode === 'spearman';

  // First pass: every cell's coefficient, exact p and n. Then adjust all p-values together (Benjamini-Hochberg),
  // because dozens of cells are tested at once and some will cross 0.05 by chance.
  const grid = metricKeys.map(m => {
    const yKey = yearField(m.key, year);
    return infraKeys.map(inf => {
      const valid = DATA.filter(d => infraCovered(d, inf.key) && d[yKey] != null);
      const xs = valid.map(d => getInfraVal(d, inf));
      const ys = valid.map(d => getRateVal(d[yKey], d));
      const r = valid.length >= 3 ? pearson(xs, ys) : null;
      const rho = valid.length >= 3 ? spearmanRank(xs, ys) : null;
      const val = isRho ? rho : r;
      const pObj = val == null ? { p: null, t: null, df: valid.length - 2, isSig: false } : getCorrelationPValue(val, valid.length);
      let partial = null;
      if (val != null && valid.length >= 5) {
        const zs = valid.map(d => d.population / d.areaSqKm);
        partial = isRho ? statsPartial(statsRanks(xs), statsRanks(ys), statsRanks(zs)) : statsPartial(xs, ys, zs);
      }
      return { m, inf, valid, r, rho, val, pObj, partial };
    });
  });
  const flat = [].concat.apply([], grid);
  const qs = statsBH(flat.map(c => c.pObj.p));
  flat.forEach((c, i) => { c.q = qs[i]; });
  const tests = flat.filter(c => c.pObj.p != null).length;
  const rawSig = flat.filter(c => c.pObj.p != null && c.pObj.p < 0.05).length;
  const adjSig = flat.filter(c => c.q != null && c.q < 0.05).length;

  const tableHeader = '<thead><tr style="border-bottom:1px solid var(--border);">' +
    '<th style="text-align:left;padding:8px 12px;color:var(--text-dim);position:sticky;left:0;background:var(--surface);z-index:1;">Metric (' + year + ')</th>' +
    infraKeys.map(inf => '<th style="text-align:center;padding:8px 10px;color:var(--text-dim);white-space:nowrap;">' + esc(inf.label) + '</th>').join('') +
  '</tr></thead>';

  const rows = grid.map(row => {
    const m = row[0].m;
    const cells = row.map(c => {
      const val = c.val;
      if (val == null) {
        return '<td style="text-align:center;padding:8px 10px;color:var(--text-dim);" ' + tt(m.label + ' vs ' + c.inf.label, 'Fewer than 3 districts have data for both, so no correlation is shown.') + '>n/a</td>';
      }
      const bg = val >= 0.4 ? 'rgba(231,76,60,0.18)' : val <= -0.4 ? 'rgba(46,204,113,0.18)' : 'rgba(255,255,255,0.04)';
      const color = val >= 0.4 ? 'var(--rust)' : val <= -0.4 ? 'var(--good)' : 'var(--text)';
      const adj = c.q != null && c.q < 0.05;
      const raw = c.pObj.p < 0.05;
      const sigBadge = adj ? '<span style="color:var(--amber);margin-left:2px;font-size:11px;">*</span>'
        : raw ? '<span style="color:var(--text-dim);font-size:11px;margin-left:2px;">(\u2020)</span>'
        : '<span style="color:var(--text-dim);font-size:11px;margin-left:2px;">(ns)</span>';
      const names = c.valid.map(d => d.name).join(', ');
      const ttBody = (isRho ? 'Spearman \u03c1' : 'Pearson r') + ' = ' + (val >= 0 ? '+' : '') + val.toFixed(3) +
        '<br>' + (isRho ? 'Pearson r' : 'Spearman \u03c1') + ' = ' + (isRho ? (c.r >= 0 ? '+' : '') + c.r.toFixed(3) : (c.rho >= 0 ? '+' : '') + c.rho.toFixed(3)) +
        '<br>Valid districts n = ' + c.valid.length + ' (t = ' + c.pObj.t.toFixed(2) + ', df = ' + c.pObj.df + ')' +
        '<br>Exact two-tailed p = ' + c.pObj.p.toFixed(4) + '; adjusted for ' + tests + ' tests (Benjamini\u2013Hochberg) q = ' + c.q.toFixed(3) +
        '<br>Controlling for residents per km\u00b2: ' + (c.partial == null ? 'n/a' : (isRho ? '\u03c1' : 'r') + ' = ' + (c.partial >= 0 ? '+' : '') + c.partial.toFixed(3)) + ' (n is small; indicative only)' +
        '<br>Mode: ' + (rateMode === 'perCapita' ? 'per 100k residents' : rateMode === 'density' ? 'per km\u00b2' : 'counts against density') +
        '<br>Districts: ' + names +
        '<br><b>Click to see the scatterplot.</b>';

      return '<td tabindex="0" role="button" data-cm="' + esc(m.key) + '" data-ci="' + esc(c.inf.key) + '" style="cursor:pointer;text-align:center;padding:8px 10px;background:' + bg + ';color:' + color + ';font-weight:700;font-family:monospace;"' + tt(m.label + ' vs ' + c.inf.label, ttBody) + ' aria-label="' + esc(m.label + ' vs ' + c.inf.label + ': ' + (isRho ? 'rho' : 'r') + ' ' + val.toFixed(2) + ', n ' + c.valid.length + '. Open scatterplot') + '">' +
        (val >= 0 ? '+' : '') + val.toFixed(3) + sigBadge +
      '</td>';
    }).join('');

    return '<tr style="border-bottom:1px solid var(--border);">' +
      '<td style="font-weight:700;padding:8px 12px;white-space:nowrap;position:sticky;left:0;background:var(--surface);">' + esc(m.label) + '</td>' +
      cells +
    '</tr>';
  }).join('');

  container.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">' +
      '<h3 style="font-size:20px;font-weight:800;margin:0;color:var(--text);">Infrastructure and recorded crime: associations across districts (' + year + ')</h3>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
        '<div class="metric-tabs" id="corrCoeffToggle">' +
          '<button class="metric-tab' + (corrCoeffMode === 'pearson' ? ' active' : '') + '" data-coeff="pearson" aria-pressed="' + (corrCoeffMode === 'pearson') + '">Pearson r (Linear)</button>' +
          '<button class="metric-tab' + (corrCoeffMode === 'spearman' ? ' active' : '') + '" data-coeff="spearman" aria-pressed="' + (corrCoeffMode === 'spearman') + '">Spearman \u03c1 (Rank)</button>' +
        '</div>' +
        '<span style="font-size:11px;color:var(--text-dim);font-family:monospace;background:var(--bg);padding:4px 8px;border-radius:4px;border:1px solid var(--border);">' + (rateMode === 'perCapita' ? 'Per 100k Residents' : 'Per km\u00b2 Density') + '</span>' +
      '</div>' +
    '</div>' +
    '<p style="font-size:13px;color:var(--text);margin:0 0 8px;line-height:1.5;font-weight:600;">These are geographic associations across at most 15 districts. They do not establish causation, and with so few districts and so many comparisons they are leads to check, not findings.</p>' +
    '<p style="font-size:12.5px;color:var(--text-dim);margin:0 0 12px;line-height:1.5;">Each row is a crime or road-safety metric; each column is an infrastructure type. A cell is the ' + (isRho ? 'Spearman rank correlation (\u03c1)' : 'Pearson correlation (r)') + ' between that metric and that infrastructure across districts. <b>Click or tap a cell</b> to see its scatterplot, the districts and the exact p-value. <span style="color:var(--amber);font-weight:700;">*</span> survives the correction for multiple tests (q &lt; 0.05); (\u2020) is below 0.05 before correction only; (ns) is not.</p>' +
    '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        tableHeader +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="font-size:11.5px;color:var(--text-dim);margin-top:12px;line-height:1.5;background:var(--bg);padding:10px 14px;border-radius:6px;border:1px solid var(--border);">' +
      '<b>Statistical notes</b>: p-values are exact two-tailed Student\u2019s t tests on the correlation (n \u2212 2 degrees of freedom). This matrix tests <b>' + tests + '</b> cells at once: <b>' + rawSig + '</b> fall under p = 0.05 before correction and <b>' + adjSig + '</b> after the Benjamini\u2013Hochberg false-discovery correction. Cells share districts and metrics, so they are not independent tests. With 15 districts, |r| below about 0.51 cannot be told apart from chance. Several infrastructure layers are mapped (OpenStreetMap), so low counts can mean unmapped, not absent. Residents per km\u00b2 is the only control offered, and with this few districts it is indicative only.' +
    '</div>';

  const corrToggle = document.getElementById('corrCoeffToggle');
  if (corrToggle) {
    corrToggle.querySelectorAll('.metric-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        corrCoeffMode = btn.dataset.coeff;
        renderCorrelationMatrix();
        renderMethod();
      });
    });
  }
  const openCell = td => {
    scatterType = td.dataset.ci;
    scatterYMetric = td.dataset.cm;
    buildScatterTabs();
    renderScatter();
    if (isBivariateMode) renderMap();
    const sec = document.getElementById('scatterSection');
    if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  container.querySelectorAll('td[data-cm]').forEach(td => {
    td.addEventListener('click', () => openCell(td));
    td.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCell(td); } });
  });
}

function pearson(xs, ys) { return statsPearson(xs, ys); }

function buildScatterTabs() {
  const el = document.getElementById('scatterTabs');
  // Surface each layer's own description and source here, the way the metric selector does —
  // it is the only place the per-layer OSM completeness caveats reach the reader at point of use.
  el.innerHTML = INFRA.map(inf => '<button class="metric-tab' + (inf.key===scatterType?' active':'') + '" data-key="' + inf.key + '" title="' + (inf.title + ' — ' + inf.desc + ' Source: ' + inf.source).replace(/"/g, '&quot;') + '" aria-pressed="' + (inf.key===scatterType) + '">' + inf.label + '</button>').join('');
  el.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => { scatterType = btn.dataset.key; renderScatter(); if (isBivariateMode) renderMap(); });
  });
  const yEl = document.getElementById('scatterYTabs');
  yEl.innerHTML = METRICS.map(m => '<button class="metric-tab' + (m.key===scatterYMetric?' active':'') + '" data-key="' + m.key + '" aria-pressed="' + (m.key===scatterYMetric) + '">' + m.label + '</button>').join('');
  yEl.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => { scatterYMetric = btn.dataset.key; renderScatter(); });
  });
}

let scatterHoveredIndex = -1;
let scatterPointsCache = [];

function renderScatter() {
  const inf = INFRA.find(i => i.key === scatterType);
  const yMetric = METRICS.find(m => m.key === scatterYMetric);
  const modeLabel = rateMode === 'perCapita' ? ' (Per 100k Residents)' : ' (Per km² Density)';
  const yLabel = yMetric.short + (rateMode === 'perCapita' ? ' rate' : ' density');
  document.getElementById('scatterTitle').textContent = inf.label + ' vs. ' + yLabel + modeLabel;

  const yKeyS = yearField(yMetric.key, activeYear);
  const covered = DATA.filter(d => infraCovered(d, inf.key) && d[yKeyS] != null);
  const pts = covered.map(d => ({ x: getInfraVal(d, inf), y: getRateVal(d[yKeyS], d), name: d.name }));
  const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
  const r = pts.length >= 2 ? pearson(xs, ys) : 0;
  const rho = pts.length >= 2 ? spearmanRank(xs, ys) : 0;
  const pR = getCorrelationPValue(r, pts.length);
  const pRho = getCorrelationPValue(rho, pts.length);

  document.getElementById('scatterR').innerHTML =
    'r = ' + (r >= 0 ? '+' : '') + r.toFixed(3) + ' <span style="font-size:11px;font-weight:400;color:var(--text-dim);">(p=' + pR.p.toFixed(3) + ', ' + (pR.isSig ? 'p<0.05*' : 'ns') + ')</span>' +
    ' &nbsp;·&nbsp; ρ = ' + (rho >= 0 ? '+' : '') + rho.toFixed(3) + ' <span style="font-size:11px;font-weight:400;color:var(--text-dim);">(p=' + pRho.p.toFixed(3) + ', ' + (pRho.isSig ? 'p<0.05*' : 'ns') + ')</span>';

  document.getElementById('scatterN').textContent = pts.length + ' of 15 districts';
  const mainCoeff = corrCoeffMode === 'spearman' ? rho : r;
  const strength = Math.abs(mainCoeff) >= 0.5 ? 'a moderate-to-strong' : Math.abs(mainCoeff) >= 0.25 ? 'a weak' : 'essentially no';
  const direction = mainCoeff >= 0 ? 'higher ' + inf.unit + ' tracks with higher ' + yLabel : 'higher ' + inf.unit + ' tracks with lower ' + yLabel;
  let extra = '';
  if (inf.key === 'policeInfra' && mainCoeff > 0.3) extra = ' Read this as police presence following crime, not causing it — stations and posts go where crime and population already are.';
  document.getElementById('scatterRead').textContent = 'This is ' + strength + ' relationship: ' + direction + ' across these ' + pts.length + ' districts.' + extra;

  const canvas = document.getElementById('scatterCanvas');
  const setup = setupHighDPICanvas(canvas, 380/640);
  if (!setup) return;
  const { ctx, W, H } = setup;
  const MARKER_R = 5;
  const PAD = { l: 55, r: 20 + MARKER_R, t: 20 + MARKER_R, b: 40 };
  ctx.clearRect(0,0,W,H);

  const xMax = Math.max(...xs, 0) * 1.1 || 1, yMax = Math.max(...ys, 0) * 1.1 || 1;
  const px = x => PAD.l + (x/xMax) * (W-PAD.l-PAD.r);
  const py = y => H-PAD.b - (y/yMax) * (H-PAD.t-PAD.b);

  scatterPointsCache = pts.map(p => ({
    ...p,
    cx: px(p.x),
    cy: py(p.y)
  }));

  const styles = getComputedStyle(document.body);
  const border = styles.getPropertyValue('--border').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const amber = styles.getPropertyValue('--amber').trim();
  const rust = styles.getPropertyValue('--rust').trim();
  const text = styles.getPropertyValue('--text').trim();

  // gridlines + axes
  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = textDim;
  for (let i=0;i<=4;i++){
    const gx = PAD.l + i*(W-PAD.l-PAD.r)/4;
    ctx.beginPath(); ctx.moveTo(gx,PAD.t); ctx.lineTo(gx,H-PAD.b); ctx.stroke();
    ctx.fillText((xMax*i/4).toFixed(1), gx-10, H-PAD.b+16);
    const gy = H-PAD.b - i*(H-PAD.t-PAD.b)/4;
    ctx.beginPath(); ctx.moveTo(PAD.l,gy); ctx.lineTo(W-PAD.r,gy); ctx.stroke();
    ctx.fillText((yMax*i/4).toFixed(0), 8, gy+4);
  }
  ctx.fillText(inf.label + ' density (per km²) →', PAD.l, H-8);
  ctx.save(); ctx.translate(14, PAD.t+40); ctx.rotate(-Math.PI/2); ctx.fillText(yMetric.label + ' density (per km²)', 0, 0); ctx.restore();

  // regression line
  if (pts.length >= 2) {
    const n = pts.length, mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
    let num=0, den=0;
    for (let i=0;i<n;i++){ num += (xs[i]-mx)*(ys[i]-my); den += (xs[i]-mx)**2; }
    const slope = den ? num/den : 0, intercept = my - slope*mx;
    ctx.strokeStyle = amber; ctx.lineWidth = 2; ctx.setLineDash([5,4]);
    ctx.beginPath();
    ctx.moveTo(px(0), py(Math.max(0,intercept)));
    ctx.lineTo(px(xMax), py(Math.max(0,intercept+slope*xMax)));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Draw points without static text labels to eliminate collisions
  scatterPointsCache.forEach((p, idx) => {
    const isHovered = idx === scatterHoveredIndex;
    const radius = isHovered ? MARKER_R + 3 : MARKER_R;
    ctx.beginPath();
    ctx.arc(p.cx, p.cy, radius, 0, Math.PI*2);
    ctx.fillStyle = isHovered ? rust : amber;
    ctx.fill();

    if (isHovered) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = text;
      ctx.stroke();
    }
  });

  // Dynamic hover label/tooltip on active point
  if (scatterHoveredIndex >= 0 && scatterPointsCache[scatterHoveredIndex]) {
    const p = scatterPointsCache[scatterHoveredIndex];
    ctx.font = 'bold 11px -apple-system, sans-serif';
    const labelText = p.name + ': (' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ')';
    const labelW = ctx.measureText(labelText).width;
    let lx = p.cx + 8;
    if (lx + labelW > W - 10) lx = p.cx - labelW - 8;
    let ly = p.cy - 6;
    if (ly < PAD.t + 10) ly = p.cy + 14;

    ctx.fillStyle = styles.getPropertyValue('--surface').trim();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.fillRect(lx - 4, ly - 12, labelW + 8, 18);
    ctx.strokeRect(lx - 4, ly - 12, labelW + 8, 18);

    ctx.fillStyle = text;
    ctx.fillText(labelText, lx, ly);
  }

  updateVersusLabel();
}

function renderTrends() {
  const first = TRENDS[0], last = TRENDS[TRENDS.length - 1];
  const crashesChange = Math.round(((last.crashes - first.crashes) / first.crashes) * 100);
  const fatalitiesChange = Math.round(((last.fatalities - first.fatalities) / first.fatalities) * 100);
  document.getElementById('trendsCrashesChange').textContent = (crashesChange >= 0 ? '+' : '') + crashesChange + '%';
  document.getElementById('trendsCrashesChange').style.color = crashesChange >= 0 ? 'var(--rust)' : 'var(--good)';
  document.getElementById('trendsFatalitiesChange').textContent = (fatalitiesChange >= 0 ? '+' : '') + fatalitiesChange + '%';
  document.getElementById('trendsFatalitiesChange').style.color = fatalitiesChange >= 0 ? 'var(--rust)' : 'var(--good)';
  const minYear = TRENDS.reduce((m,t) => t.fatalities < m.fatalities ? t : m, TRENDS[0]);
  document.getElementById('trendsRead').textContent = 'Both crashes and fatalities fell sharply through 2020 (the COVID lockdown year, ' + minYear.year + ' was the low point at ' + fmtNum(minYear.fatalities) + ' deaths) and have partly rebounded since — ' + last.year + ' fatalities are still ' + Math.round(((last.fatalities - minYear.fatalities)/minYear.fatalities)*100) + '% above that low.';

  const canvas = document.getElementById('trendsCanvas');
  const setup = setupHighDPICanvas(canvas, 320/640);
  if (!setup) return;
  const { ctx, W, H } = setup;
  const PAD = { l: 45, r: 100, t: 20, b: 30 };
  ctx.clearRect(0,0,W,H);

  const styles = getComputedStyle(document.body);
  const border = styles.getPropertyValue('--border').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const text = styles.getPropertyValue('--text').trim();
  const amber = styles.getPropertyValue('--amber').trim();
  const rust = styles.getPropertyValue('--rust').trim();
  const slate = styles.getPropertyValue('--slate').trim();

  const series = [
    { key: 'crashes', label: 'Road crashes', color: slate },
    { key: 'fatalities', label: 'Fatalities', color: rust },
    { key: 'fatalCrashes', label: 'Fatal crashes', color: amber },
  ];
  const indexed = series.map(s => ({ ...s, vals: TRENDS.map(t => (t[s.key] / TRENDS[0][s.key]) * 100) }));
  const allVals = indexed.flatMap(s => s.vals);
  const yMin = Math.min(...allVals, 100) * 0.95, yMax = Math.max(...allVals, 100) * 1.05;
  const n = TRENDS.length;
  const px = i => PAD.l + (i/(n-1)) * (W-PAD.l-PAD.r);
  const py = v => H-PAD.b - ((v-yMin)/(yMax-yMin)) * (H-PAD.t-PAD.b);

  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = textDim;
  for (let i=0;i<n;i++) {
    const gx = px(i);
    ctx.beginPath(); ctx.moveTo(gx,PAD.t); ctx.lineTo(gx,H-PAD.b); ctx.stroke();
    if (i % 2 === 0 || i === n - 1) ctx.fillText(TRENDS[i].year, gx-12, H-PAD.b+14);
  }
  ctx.beginPath(); ctx.moveTo(PAD.l, py(100)); ctx.lineTo(W-PAD.r, py(100)); ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillText(first.year + ' = 100', PAD.l+4, py(100)-4);

  indexed.forEach(s => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2.2;
    ctx.beginPath();
    s.vals.forEach((v,i) => { i===0 ? ctx.moveTo(px(i),py(v)) : ctx.lineTo(px(i),py(v)); });
    ctx.stroke();
    s.vals.forEach((v,i) => { ctx.beginPath(); ctx.arc(px(i),py(v),2.6,0,Math.PI*2); ctx.fillStyle = s.color; ctx.fill(); });
  });

  let ly = PAD.t;
  indexed.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(W-PAD.r+14, ly, 10, 10);
    ctx.fillStyle = text; ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(s.label, W-PAD.r+28, ly+9);
    ly += 20;
  });
}

function renderVictimsByMode() {
  const last = VICTIMS[VICTIMS.length - 1];
  const pedShare = Math.round((last.pedestrianKilled / last.totalKilled) * 100);
  const twShare = Math.round((last.twoWheelerKilled / last.totalKilled) * 100);
  document.getElementById('pedestrianShare').textContent = pedShare + '%';
  document.getElementById('twoWheelerShare').textContent = twShare + '%';
  const allPedHighest = VICTIMS.every(v => v.pedestrianKilled >= v.cyclistKilled && v.pedestrianKilled >= v.carKilled && v.pedestrianKilled >= v.busPassengerKilled);
  document.getElementById('victimsRead').textContent = 'Pedestrians and two-wheeler riders together account for ' + (pedShare+twShare) + '% of all road deaths in ' + last.year + '.' +
    (allPedHighest ? ' Pedestrians are the single largest killed category of any mode in every year from ' + VICTIMS[0].year + ' to ' + last.year + ' except where two-wheeler riders edge slightly ahead.' : '');

  const groups = [
    { key: 'pedestrian', label: 'Pedestrian', color: 'var(--rust)' },
    { key: 'twoWheeler', label: 'Two-wheeler', color: 'var(--amber)' },
    { key: 'car', label: 'Car occupant', color: 'var(--slate)' },
    { key: 'cyclist', label: 'Cyclist', color: 'var(--good)' },
    { key: 'busPassenger', label: 'Bus passenger', color: '#7c3aed' },
  ];
  const canvas = document.getElementById('victimsCanvas');
  const setup = setupHighDPICanvas(canvas, 320/640);
  if (!setup) return;
  const { ctx, W, H } = setup;
  const PAD = { l: 45, r: 110, t: 20, b: 30 };
  ctx.clearRect(0,0,W,H);

  const styles = getComputedStyle(document.body);
  const border = styles.getPropertyValue('--border').trim();
  const textDim = styles.getPropertyValue('--text-dim').trim();
  const text = styles.getPropertyValue('--text').trim();

  const otherOf = v => v.slowMovingKilled + v.animalDrivenKilled + v.otherKilled;
  const stackKeys = ['pedestrianKilled','twoWheelerKilled','carKilled','cyclistKilled','busPassengerKilled'];
  const maxTotal = Math.max(...VICTIMS.map(v => v.totalKilled)) * 1.1;
  const n = VICTIMS.length;
  const barW = (W-PAD.l-PAD.r) / n * 0.6;
  const px = i => PAD.l + (i+0.5) * (W-PAD.l-PAD.r)/n;
  const py = v => H-PAD.b - (v/maxTotal) * (H-PAD.t-PAD.b);

  ctx.strokeStyle = border; ctx.lineWidth = 1;
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = textDim;
  for (let i=0;i<=4;i++) {
    const gy = H-PAD.b - i*(H-PAD.t-PAD.b)/4;
    ctx.beginPath(); ctx.moveTo(PAD.l,gy); ctx.lineTo(W-PAD.r,gy); ctx.stroke();
    ctx.fillText(Math.round(maxTotal*i/4), 6, gy+4);
  }

  VICTIMS.forEach((v,i) => {
    let yTop = H-PAD.b;
    const cx = px(i);
    stackKeys.forEach(key => {
      const val = v[key];
      const h = (val/maxTotal) * (H-PAD.t-PAD.b);
      const g = groups.find(g => key.startsWith(g.key));
      ctx.fillStyle = g.color.startsWith('var') ? styles.getPropertyValue(g.color.slice(4,-1)).trim() : g.color;
      ctx.fillRect(cx-barW/2, yTop-h, barW, h);
      yTop -= h;
    });
    const otherVal = otherOf(v);
    const hOther = (otherVal/maxTotal) * (H-PAD.t-PAD.b);
    ctx.fillStyle = textDim;
    ctx.fillRect(cx-barW/2, yTop-hOther, barW, hOther);
    ctx.fillStyle = text; ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(v.year, cx-10, H-PAD.b+14);
  });

  let ly = PAD.t;
  [...groups, { key:'other', label:'Slow-moving / animal-driven / other', color: textDim }].forEach(g => {
    ctx.fillStyle = g.color.startsWith('var') ? styles.getPropertyValue(g.color.slice(4,-1)).trim() : g.color;
    ctx.fillRect(W-PAD.r+8, ly, 10, 10);
    ctx.fillStyle = text; ctx.font = '11px -apple-system, sans-serif';
    ctx.fillText(g.label, W-PAD.r+22, ly+9);
    ly += 18;
  });
}

function renderZones() {
  const el = document.getElementById('zoneGrid');
  el.innerHTML = ACCIDENT_ZONES.map(z => {
    const svUrl = z.lat && z.lng
      ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + z.lat + ',' + z.lng
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(z.name + ' ' + z.road + ' Delhi');
    return '<div class="zone-item">' +
      '<span class="zone-num">' + z.rank + '</span>' +
      '<span class="zone-name">' + esc(z.name) + ' <span class="zone-road">(' + esc(z.road) + ')</span></span>' +
      '<span class="zone-severity" title="' + z.fatal + ' fatal, ' + z.simple + ' simple, ' + z.total + ' total crashes in 2023">' + z.fatal + ' fatal</span>' +
      '<a href="' + svUrl + '" target="_blank" rel="noopener" class="street-view-btn" data-tt-title="Open Google Street View" data-tt-body="View 360° Street View photography for ' + esc(z.name) + '">Street View</a>' +
    '</div>';
  }).join('');
}

function renderZones2024() {
  const el = document.getElementById('zoneGrid2024');
  el.innerHTML = ACCIDENT_ZONES_2024.map(z => {
    const svUrl = z.lat && z.lng
      ? 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + z.lat + ',' + z.lng
      : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(z.name + ' ' + z.road + ' Delhi');
    return '<div class="zone-item">' +
      '<span class="zone-num">' + z.rank + '</span>' +
      '<span class="zone-name">' + esc(z.name) + ' <span class="zone-road">(' + esc(z.road) + ')</span></span>' +
      '<span class="zone-severity" title="' + z.fatal + ' fatal, ' + z.simple + ' simple, ' + z.total + ' total crashes in 2024' + (z.lat == null ? ' — coordinate unresolved' : '') + '">' + z.fatal + ' fatal</span>' +
      '<a href="' + svUrl + '" target="_blank" rel="noopener" class="street-view-btn" data-tt-title="Open Google Street View" data-tt-body="View 360° Street View photography for ' + esc(z.name) + '">Street View</a>' +
    '</div>';
  }).join('');
}

function renderEnforcement() {
  const el = document.getElementById('enforcementGrid');
  const e23 = ROAD_EXTRA.enforcement['2023'], e24 = ROAD_EXTRA.enforcement['2024'];
  const rows = [
    ['Hit-and-run fatal crashes', fmtNum(e23.hitAndRunFatalCrashes), fmtNum(e24.hitAndRunFatalCrashes)],
    ['Hit-and-run share of fatal crashes', e23.hitAndRunShareOfFatalPercent + '%', e24.hitAndRunShareOfFatalPercent + '%'],
    ['Drinking &amp; driving prosecutions', fmtNum(e23.drinkingDrivingProsecutions), fmtNum(e24.drinkingDrivingProsecutions)],
    ['RLVD camera systems / junctions', e23.rlvdCameraSystems + ' / ' + e23.rlvdJunctions, e24.rlvdCameraSystems + ' / ' + e24.rlvdJunctions],
    ['OSVD camera systems / locations', e23.osvdCameraSystems + ' / ' + e23.osvdLocations, e24.osvdCameraSystems + ' / ' + e24.osvdLocations],
    ['Overspeed notices (OSVD + tripod)', fmtNum(e23.overspeedNotices), fmtNum(e24.overspeedNotices)],
  ];
  el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);"><th style="text-align:left;padding:8px 12px;color:var(--text-dim);">Metric</th><th style="text-align:right;padding:8px 12px;color:var(--text-dim);">2023</th><th style="text-align:right;padding:8px 12px;color:var(--text-dim);">2024</th></tr></thead>' +
    '<tbody>' + rows.map(r => '<tr style="border-bottom:1px solid var(--border);"><td style="padding:8px 12px;">' + r[0] + '</td><td style="padding:8px 12px;text-align:right;font-weight:700;">' + r[1] + '</td><td style="padding:8px 12px;text-align:right;font-weight:700;">' + r[2] + '</td></tr>').join('') + '</tbody>' +
  '</table>';
}

function renderRoadSummary() {
  const el = document.getElementById('roadSummaryGrid');
  const r23 = Object.fromEntries(ROAD_EXTRA.roadSummary['2023'].map(r => [r.road, r]));
  const r24 = ROAD_EXTRA.roadSummary['2024'];
  const merged = r24.map(r => ({ road: r.road, fatal24: r.fatal, total24: r.total, fatal23: r23[r.road] ? r23[r.road].fatal : null, total23: r23[r.road] ? r23[r.road].total : null }))
    .sort((a,b) => b.fatal24 - a.fatal24)
    .slice(0, 15);
  el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:1px solid var(--border);">' +
      '<th style="text-align:left;padding:8px 12px;color:var(--text-dim);">Road</th>' +
      '<th style="text-align:right;padding:8px 12px;color:var(--text-dim);">Fatal &apos;23</th>' +
      '<th style="text-align:right;padding:8px 12px;color:var(--text-dim);">Fatal &apos;24</th>' +
      '<th style="text-align:right;padding:8px 12px;color:var(--text-dim);">Total &apos;23</th>' +
      '<th style="text-align:right;padding:8px 12px;color:var(--text-dim);">Total &apos;24</th>' +
    '</tr></thead>' +
    '<tbody>' + merged.map(r => '<tr style="border-bottom:1px solid var(--border);">' +
      '<td style="padding:8px 12px;font-weight:700;">' + esc(r.road) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;">' + fmtNum(r.fatal23) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;font-weight:700;">' + fmtNum(r.fatal24) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;">' + fmtNum(r.total23) + '</td>' +
      '<td style="padding:8px 12px;text-align:right;font-weight:700;">' + fmtNum(r.total24) + '</td>' +
    '</tr>').join('') + '</tbody>' +
  '</table>';
}

// ---- Historical years (2011-2018): the same map, drawn with the districts reported at the time ----
// Counts as printed. Never allocated to today's 15 districts; the shapes are schematic and labelled by how they were derived.
const HIST_KEYS = { theft: 'theft', robbery: 'robbery', totalIPC: 'total_ipc', crimeAgainstWomen: 'total_crimes_against_women', totalSLL: 'total_sll' };
let histSelected = null;
function isHistoryView() { const m = currentMetric(); return !!(m && m.prevKey && +activeYear <= 2018); }
function histKey(m, year) {
  if (m.key === 'burglary') return +year < 2014 ? 'burglary_old_definition' : (+year < 2016 ? 'criminal_trespass_burglary_revised_definition' : 'burglary');
  return HIST_KEYS[m.key];
}
function histMeasureName(key) {
  return { theft: 'Theft', robbery: 'Robbery', burglary_old_definition: 'Burglary (original 2011-2013 head)', criminal_trespass_burglary_revised_definition: 'Criminal trespass/burglary (revised 2014-2015 head)', burglary: 'Burglary', total_ipc: 'Total IPC', total_crimes_against_women: 'Crimes against women', total_sll: 'SLL crimes' }[key] || key;
}
function histCanon(s) { return String(s).toLowerCase().replace(/[^a-z]/g, ''); }
function histYearData() { return HIST.years.find(y => y.year === +activeYear); }
function histMapStatus(d) {
  if (d.map.status === 'reference_only') return '2014 reference map (reconstruction, not certified)';
  if (d.map.status === 'inferred_reference') return '2014 shapes applied, inferred, not verified';
  return 'Nov 2017 gazette schedule on 2014 shapes, derived';
}
function histMapNote(d) {
  if (d.map.status === 'reference_only') return HIST.notes.reference2014;
  if (d.map.status === 'inferred_reference') return HIST.notes.inferred + (d.year >= 2015 ? ' ' + HIST.notes.inferred2015 : '') + (d.year === 2016 ? ' ' + HIST.notes.inferred2016 : '');
  return HIST.notes.derived;
}
// Counts-only export for the selected historical year: original reporting units and the printed Delhi total.
// No modern denominators, no allocation to today's districts, nothing from the current-district data.
function histExport(year) {
  const d = HIST.years.find(y => y.year === +year);
  const bKey = histKey({ key: 'burglary' }, d.year);
  const headers = ['Reference year', 'Reporting unit (as printed)', 'Unit type', 'Theft', 'Robbery', 'Burglary measure', 'Burglary', 'Total IPC', 'Crimes against women', 'SLL crimes', 'Map status', 'Source', 'Note', 'Geography version', 'Offence definition', 'Reporting period', 'Comparability with previous year (theft and robbery)', 'Reason for any break'];
  const theft = METRICS.find(x => x.key === 'theft');
  const row = (label, type, v, note) => {
    const info = type === 'Territorial district' && d.year > CONTINUITY.yearRange[0] ? contFor(theft, label, d.year) : null;
    return [d.year, label, type, v.theft, v.robbery, histMeasureName(bKey), v[bKey], v.total_ipc, v.total_crimes_against_women, v.total_sll, type === 'Territorial district' ? histMapStatus(d) : '', d.sourceLabel, note,
      geoVersion(theft, d.year), histDefinition(d.year, false), 'Calendar year', info ? CONTINUITY.states[info.cmp.state] : (type === 'Territorial district' ? 'No earlier year' : 'Not applicable'), info ? info.cmp.reasons.join(' ') : ''];
  };
  const rows = d.units.map(u => row(u.label, u.territorial ? 'Territorial district' : 'Other reporting unit', u.values, ''));
  rows.push(row('Delhi UT total', 'Printed total', d.citywide.values, 'Printed Delhi total; not the sum of the rows above. Blank means not reported, never zero.'));
  return { headers, rows };
}
function histSelect(name) {
  histSelected = histSelected === name ? null : name;
  render();
}
function histBuildSvg() {
  const svg = document.getElementById('mapHistory');
  if (svg.dataset.built) return svg;
  svg.innerHTML = Object.keys(HIST.maps).map(r => '<g data-ref="' + r + '">' + HIST.maps[r].map((f, i) => '<path tabindex="0" role="button" data-i="' + i + '" d="' + f.d + '"></path>').join('') + '</g>').join('');
  svg.querySelectorAll('path').forEach(p => {
    const go = () => { const f = HIST.maps[p.parentNode.dataset.ref][Number(p.dataset.i)]; if (f.properties.territorial) histSelect(f.properties.name); };
    p.addEventListener('click', go);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  svg.dataset.built = '1';
  return svg;
}
function renderHistoryView() {
  const m = currentMetric(), d = histYearData(), key = histKey(m, d.year), ref = String(d.map.referenceYear);
  const svg = histBuildSvg();
  svg.querySelectorAll('g').forEach(g => { g.style.display = g.dataset.ref === ref ? '' : 'none'; });
  const units = d.units.filter(u => u.territorial);
  const find = name => d.units.find(u => histCanon(u.label) === histCanon(name));
  const vals = units.map(u => u.values[key]).filter(v => v != null);
  const vs = viewScale(vals, m, d.year);
  const scale = vs.scale;
  const lo = vs.lo, hi = vs.hi;
  const measure = histMeasureName(key);
  svg.querySelectorAll('g[data-ref="' + ref + '"] path').forEach(p => {
    const f = HIST.maps[ref][Number(p.dataset.i)], u = f.properties.territorial ? find(f.properties.name) : null;
    const v = u ? u.values[key] : null, isSel = !!u && histSelected && histCanon(histSelected) === histCanon(u.label);
    p.setAttribute('fill', v == null ? 'var(--map-nodata-stripe)' : rustScale(scale(v)));
    p.classList.toggle('sel', !!isSel);
    p.setAttribute('aria-selected', isSel ? 'true' : 'false');
    const title = f.properties.territorial ? f.properties.name + ' reporting district' : 'IGI Airport';
    const body = !f.properties.territorial ? 'Separate police jurisdiction; not in the territorial colour scale.'
      : '<div class="tt-metric"><b>' + measure + ' (' + d.year + '):</b> ' + (v == null ? 'not reported' : fmtNum(v)) + '</div><div class="tt-metric">Registered cases, as printed. Shape: ' + histMapStatus(d) + '.</div>';
    p.setAttribute('data-tt-title', title);
    p.setAttribute('data-tt-body', body);
    p.setAttribute('aria-label', title + ': ' + (v == null ? 'not reported' : fmtNum(v)));
  });
  document.getElementById('singleLegend').style.display = '';
  document.getElementById('bivariateLegend').style.display = 'none';
  document.getElementById('legendLabel').textContent = measure + ', ' + d.year + ' (as printed)' + (vs.fixed ? ' · ' + vs.note : '');
  document.querySelector('#singleLegend .legend-scale-note').textContent = vs.fixed ? '(one linear scale shared by these years, so colours can be compared across them)' : "(ranked within this year, not linear: an outlier district can't wash out the rest of the scale)";
  document.getElementById('legendMin').textContent = lo == null ? 'Not reported' : fmtNum(lo);
  document.getElementById('legendMax').textContent = hi == null ? '' : fmtNum(hi);
  document.getElementById('legendScale').innerHTML = Array.from({length: 10}, (_, i) => '<span style="background:' + rustScale(i / 9) + '"></span>').join('');
  const special = d.units.filter(u => !u.territorial);
  document.getElementById('dataStatus').innerHTML = '<b>Data status · ' + esc(m.label) + ' (' + d.year + ')</b>' +
    '<span><span class="data-status-label">Status</span><span class="data-status-badge ' + (vals.length ? 'production' : 'partial') + '">' + (vals.length ? 'Production · counts as printed' : 'Not reported in the source') + '</span></span>' +
    '<span><span class="data-status-label">Coverage</span><span class="data-status-value">' + d.territorialCount + ' territorial reporting districts as reported in ' + d.year + (special.length ? ', plus ' + special.length + ' other units listed separately' : '') + '</span></span>' +
    '<span><span class="data-status-label">Comparable?</span><span class="data-status-value">Not comparable with the current 15-district years; offence definitions differ by year (see notes). Counts, not rates.</span></span>' +
    '<span><span class="data-status-label">Map</span><span class="data-status-value">' + esc(histMapStatus(d)) + '</span></span>' +
    '<span><span class="data-status-label">Source</span><span class="data-status-value">' + esc(d.sourceLabel) + '</span></span>';
  document.getElementById('listSub').textContent = 'Reporting districts by ' + measure.toLowerCase() + ', ' + d.year + ' (as printed)';
  const sorted = units.slice().sort((a, b) => (b.values[key] == null ? -Infinity : b.values[key]) - (a.values[key] == null ? -Infinity : a.values[key]));
  document.getElementById('rankList').innerHTML = sorted.map((u, i) => {
    const v = u.values[key], pct = v == null || hi == null ? 0 : Math.max(3, hi === lo ? 100 : (v - lo) / (hi - lo) * 100);
    const color = v == null ? 'var(--map-nodata-stripe)' : rustScale(scale(v));
    const sel = histSelected && histCanon(histSelected) === histCanon(u.label) ? ' selected' : '';
    return '<div class="rank-row hist-row' + sel + '" data-name="' + esc(u.label) + '"><span class="rank-num">' + (i + 1) + '</span><span class="rank-name">' + esc(u.label) + '</span><span class="rank-val">' + (v == null ? 'n/r' : fmtNum(v)) + '</span><div class="rank-bar-track"><div class="rank-bar-fill" style="width:' + pct + '%;background:' + color + ';"></div></div></div>';
  }).join('');
  const sel = histSelected ? find(histSelected) : null;
  const tile = (label, k) => { const v = sel.values[k]; return '<div class="stat"><span class="stat-label">' + label + ' (' + d.year + ')</span>' + (v == null ? '<span class="stat-val nodata">Not reported</span>' : '<span class="stat-val">' + fmtNum(v) + '</span>') + '</div>'; };
  const tiles = sel ? [['Theft', 'theft'], ['Robbery', 'robbery'], [histMeasureName(histKey({key: 'burglary'}, d.year)), histKey({key: 'burglary'}, d.year)], ['Total IPC', 'total_ipc'], ['Vs. women', 'total_crimes_against_women'], ['SLL crimes', 'total_sll']].map(t => tile(t[0], t[1])).join('') : '';
  const city = d.citywide && d.citywide.values ? d.citywide.values[key] : null;
  const specialRows = special.length ? '<div class="section-divider"></div><div class="stat-label">Other reporting units, as printed</div>' + special.map(u => '<div class="stat"><span class="stat-label">' + esc(u.label) + '</span>' + (u.values[key] == null ? '<span class="stat-val nodata">Not reported</span>' : '<span class="stat-val">' + fmtNum(u.values[key]) + '</span>') + '</div>').join('') : '';
  document.getElementById('detail').innerHTML =
    '<div class="detail-head"><h2>' + esc(sel ? sel.label : 'Delhi, ' + d.year + ', as reported') + '</h2><span class="area">' + (sel ? 'reporting district' : d.territorialCount + ' districts') + '</span></div>' +
    (sel ? tiles + changeTile(m, sel.label, d.year) : '<p style="margin:0;color:var(--text-dim);">Select a district on the map or in the list to see its counts for ' + d.year + '.</p>') +
    '<div class="section-divider"></div>' +
    '<div class="stat"><span class="stat-label">Delhi UT total, ' + esc(measure) + ' (' + d.year + ')</span>' + (city == null ? '<span class="stat-val nodata">Not reported</span>' : '<span class="stat-val">' + fmtNum(city) + '</span>') + '</div>' +
    '<p class="small" style="color:var(--text-dim);margin:4px 0 0;">The printed Delhi total is separate from the district rows; it is not their sum.</p>' +
    specialRows +
    '<div class="section-divider"></div>' +
    '<div class="analysis" style="border:none;padding-top:0;margin-top:0;"><div class="confidence-badge partial">◐ How to read this</div>' +
      '<p>' + esc(histMapNote(d)) + '</p>' +
      d.notes.map(n => '<p>' + esc(n) + '</p>').join('') +
      '<p><a href="historical_crime.html?year=' + d.year + '&metric=' + encodeURIComponent(key) + '">Open the full table, original source rows and evidence →</a></p></div>';
}

// ---- Overview, topics, explainers and shareable views ----
// Plain-language layer: every visual says what it shows, how to read it, its limits and its source.
const GLOSSARY = [
  ['IPC', 'Indian Penal Code, the main criminal law until 30 June 2024.', 'IPC'],
  ['BNS', 'Bharatiya Nyaya Sanhita, which replaced the IPC from 1 July 2024. The 2024 tables use BNS numbering.', 'BNS'],
  ['SLL', 'Special and Local Laws: offences under laws other than the IPC or BNS.', 'SLL|Special and Local'],
  ['NCRB', 'National Crime Records Bureau, which publishes Crime in India, the source of the district crime counts.', 'NCRB'],
  ['Registered case', 'A case recorded by the police. Counts reflect how crime is reported and registered, not only how much crime happens.', 'registered'],
  ['Fatal crash', 'A road crash in which at least one person died.', 'fatal crash'],
  ['Persons killed', 'The number of people who died in road crashes. One fatal crash can kill several people, so this can exceed the number of fatal crashes.', 'persons killed|killed'],
  ['Hit-and-run', 'A crash in which the driver leaves the scene without stopping to help.', 'hit-and-run|hit and run'],
  ['Crash-prone zone', 'A location the Delhi Traffic Police crash report lists as having repeated serious crashes.', 'crash-prone'],
  ['iRAD', 'Integrated Road Accident Database, the national road-accident reporting system.', 'iRAD'],
  ['Police district / reporting district', 'The unit a source reports by. Delhi had 11 police districts until 2016, 14 in 2017 and 2018, and 15 from 2019, so older years use the districts reported at the time.', 'police district|reporting district'],
  ['Count, per km², per 100k', 'A count is the number of cases. Per km² divides by the district area and per 100k by its population, using the current districts only.', 'per km|per 100|per square']
];
const CRIME_NOUN = { theft: 'theft cases', robbery: 'robbery cases', burglary: 'burglary cases', totalIPC: 'IPC/BNS cases (all offences)', crimeAgainstWomen: 'cases of crime against women', totalSLL: 'Special and Local Laws cases' };

function topicOf(m) { return m.prevKey ? 'crime' : 'road'; }
const TOPIC_MEMORY = {};
const TOPIC_DEFAULT_METRIC = { crime: 'theft', road: 'totalCrashes2023' };
function setTopic(topic) {
  if (topicOf(currentMetric()) !== topic) {
    TOPIC_MEMORY[topicOf(currentMetric())] = { metric: activeMetric, year: activeYear };
    const saved = TOPIC_MEMORY[topic];
    const target = METRICS.find(m => m.key === (saved ? saved.metric : TOPIC_DEFAULT_METRIC[topic])) || METRICS.find(m => !m.hiddenFromSelector && topicOf(m) === topic);
    activeMetric = target.key;
    if (saved && metricSupportsYear(target, saved.year)) {
      activeYear = saved.year;
    } else if (!metricSupportsYear(target, activeYear)) {
      const supported = target.yearVariants ? Object.keys(target.yearVariants) : (target.historicalYears ? [...target.historicalYears, '2022', '2023', '2024'] : [target.year]);
      activeYear = supported[supported.length - 1];
    }
  }
  render();
}
function renderTopicControls() {
  const topic = topicOf(currentMetric());
  document.body.classList.toggle('topic-road', topic === 'road');
  document.querySelectorAll('.topic-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === topic)));
}

function unitPhrase(m) {
  if (rateMode === 'perCapita') return 'per 100,000 residents';
  if (rateMode === 'density') return 'per square kilometre';
  return topicOf(m) === 'crime' ? 'registered cases' : 'reported counts';
}

function termsFor(text) {
  const t = String(text);
  return GLOSSARY.filter(g => new RegExp(g[2], 'i').test(t));
}

function histMapPhrase(d) {
  if (d.map.status === 'reference_only') return 'on a 2014 reference map, a reconstruction that is not certified';
  if (d.map.status === 'inferred_reference') return 'on 2014 reference shapes, inferred and not verified for this year';
  return 'on 2014 station shapes regrouped by the November 2017 gazette schedule (derived)';
}

function scaleSentence(m, year) {
  if (colourMode === 'fixed' && fixedScaleAvailable(m, year)) return 'on one scale shared by ' + segmentOf(CONTINUITY, m.key, Number(year)).join(' to ') + ', so colours can be compared across those years.';
  return 'ranked within this year only: a district can turn darker because its rank rose, not because its count did.';
}
function mapExplainerSpec() {
  const m = currentMetric(), hist = isHistoryView(), crime = topicOf(m) === 'crime';
  if (hist) {
    const d = histYearData(), key = histKey(m, d.year), measure = histMeasureName(key);
    return {
      what: 'Registered ' + (CRIME_NOUN[m.key] || measure.toLowerCase()) + ' by reporting district, ' + d.year + ', as printed in the source.',
      detail: 'Each district is shaded by its registered cases as printed in the source. The ranked list, the district panel and the table show the same figures.',
      how: 'Darker colours mean more registered cases, ' + scaleSentence(m, d.year) + ' The colours show how many cases were registered, not how dangerous a district is.',
      limits: d.year + ' counts are shown ' + histMapPhrase(d) + '. The outlines are schematic, and offence definitions differ by year. Grey means not reported in the source, not zero.',
      source: d.sourceLabel + '.',
      more: '<p>' + esc(m.desc) + '</p><p>' + esc(histMapNote(d)) + '</p>',
      continuity: mapContinuityHtml()
    };
  }
  const s = dataStatusFor(m), year = yearSuffix(m);
  const noun = crime ? (CRIME_NOUN[m.key] || m.short) : m.short;
  const what = (crime ? 'Registered ' : 'Reported ') + noun + (rateMode === 'counts' ? '' : ' ' + unitPhrase(m)) + ' by police district, ' + year + '.';
  const how = crime
    ? 'Darker colours mean more ' + (rateMode === 'counts' ? 'registered cases' : 'cases ' + unitPhrase(m)) + ', ' + scaleSentence(m, year) + ' The colours show how many cases were registered, not how dangerous a district is.'
    : 'Darker colours mean a higher ' + (rateMode === 'counts' ? 'count' : 'figure ' + unitPhrase(m)) + '. They do not by themselves show which roads or districts are riskiest.';
  return {
    what: what,
    detail: 'Each district is shaded by its value. The ranked list, the district panel and the table show the same figures.',
    how: how,
    limits: s.coverage + '. ' + (s.comparable || '') + ((s.comparable || '').slice(-1) === '.' ? '' : '.') + ' Hatched or grey districts have no data for this measure, which is not the same as zero.',
    source: metricSource(m) + '.',
    more: '<p>' + esc(m.desc) + '</p>',
    continuity: mapContinuityHtml()
  };
}

function glossaryHtml(text) {
  const terms = termsFor(text);
  return terms.length ? '<dl class="mini-glossary">' + terms.map(g => '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>').join('') + '</dl>' : '';
}

function explainerHtml(spec, actions) {
  return '<div class="explainer-grid">' +
    '<div><h3>What am I seeing?</h3><p>' + esc(spec.detail || spec.what) + '</p></div>' +
    '<div><h3>How do I read it?</h3><p>' + esc(spec.how) + '</p></div>' +
    '<div><h3>What are the limits?</h3><p>' + esc(spec.limits) + '</p></div>' +
    '<div><h3>Where did it come from?</h3><p>' + esc(spec.source) + '</p></div></div>' +
    (spec.continuity ? '<div class="explainer-compare"><h3>Can I compare these years?</h3>' + spec.continuity + '</div>' : '') +
    '<details class="explainer-more"><summary>Source &amp; definitions</summary>' + (spec.more || '') + glossaryHtml(spec.what + ' ' + (spec.more || '') + ' ' + spec.limits) + '<p><a href="#data-methods">All sources, definitions and downloads</a></p></details>' +
    (actions || '');
}

let mapTableOpen = false;
function viewRows() {
  const m = currentMetric(), year = yearSuffix(m), hist = isHistoryView();
  const names = hist ? histYearData().units.filter(u => u.territorial).map(u => u.label) : DATA.map(x => x.name);
  return names.map(name => ({
    name: name,
    value: hist ? rawFor(m, name, year) : metricValue(DATA.find(x => x.name === name), m),
    info: contFor(m, name, year)
  }));
}
function viewTableHtml(title) {
  const m = currentMetric(), prev = prevYearForCompare(m, yearSuffix(m));
  const rows = viewRows().sort((a, b) => (b.value == null ? -Infinity : b.value) - (a.value == null ? -Infinity : a.value));
  return '<table class="view-table"><caption>' + esc(title) + '</caption><thead><tr><th scope="col">District</th><th scope="col">Value</th>' + (prev != null ? '<th scope="col">Change in cases from ' + prev + '</th>' : '') + '</tr></thead><tbody>' +
    rows.map(r => '<tr><th scope="row">' + esc(r.name) + '</th><td>' + (r.value == null ? 'Not reported' : fmtNum(r.value)) + '</td>' + (prev != null ? '<td>' + changeCellHtml(r.info) + '</td>' : '') + '</tr>').join('') + '</tbody></table>';
}
function viewCsv() {
  const m = currentMetric(), hist = isHistoryView(), year = yearSuffix(m);
  const spec = mapExplainerSpec();
  const headers = ['Dataset', 'Geography', 'Geography version', 'Measure', 'Offence definition', 'Year', 'Reporting period', 'Calculation', 'District', 'Value', 'Comparability with previous year', 'Reason for any break', 'Source', 'Dataset version'];
  const version = document.getElementById('main').dataset.version;
  const geo = hist ? histMapStatus(histYearData()) : dataStatusFor(m).coverage;
  const calc = hist ? 'count, as printed' : (rateMode === 'counts' ? 'count' : unitPhrase(m));
  const definition = hist ? histMeasureName(histKey(m, Number(year))) + ' (' + histDefinition(Number(year), m.key === 'burglary') + ')' : m.title + (Number(year) >= 2024 && m.prevKey ? ' (BNS numbering)' : '');
  const rows = viewRows().map(r => {
    const state = r.info ? CONTINUITY.states[r.info.cmp.state] : 'No earlier year';
    const reason = r.info ? r.info.cmp.reasons.join(' ') : '';
    return ['Delhi Urban Safety Observatory', geo, geoVersion(m, year), m.title, definition, year, 'Calendar year', calc, r.name, r.value, state, reason, spec.source, version];
  });
  return { headers: headers, rows: rows };
}
function histDefinition(year, burglary) {
  if (year <= 2013) return 'NCRB format before 2014' + (burglary ? ', original burglary head' : '');
  if (year <= 2015) return 'NCRB format revised in 2014' + (burglary ? ', criminal trespass/burglary head' : '');
  if (year === 2016) return 'India Data Portal extract, theft and robbery only';
  return 'India Data Portal extract' + (burglary ? ', day-plus-night burglary definition' : '');
}
function copyText(text, done) {
  const finish = ok => { if (done) done(ok); };
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(() => finish(true), () => finish(false)); return; }
  } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta); finish(ok);
  } catch (e) { finish(false); }
}

function compactContinuity() {
  const m = currentMetric(), year = yearSuffix(m), prev = prevYearForCompare(m, year);
  if (prev == null) return '<p class="cont-none">No earlier year is available for this measure, so there is nothing to compare it with.</p>';
  const cmp = compareYears(CONTINUITY, m.key, prev, Number(year));
  return '<div class="continuity ' + cmp.state + '">' + contBadge(cmp) + '<span class="cont-text"><b>Compared with ' + prev + '.</b> ' + (cmp.state === 'comparable' ? 'Same districts and definitions.' : 'See About for why.') + '</span></div>';
}
function renderMapExplainer() {
  const el = document.getElementById('mapExplainer');
  if (!el) return;
  const spec = mapExplainerSpec();
  document.getElementById('mapHeading').textContent = spec.what;
  document.getElementById('mapDesc').textContent = spec.detail;
  document.getElementById('mapContinuity').innerHTML = compactContinuity();
  document.getElementById('mapTabTable').innerHTML = '<div class="table-wrap">' + viewTableHtml(spec.what) + '</div>';
  document.getElementById('mapTabDownload').innerHTML = '<p>Download the districts shown on the map, with the geography version, offence definition, reporting period, whether the year is comparable with the one before and the reason for any break.</p>' +
    '<div class="explainer-actions"><button type="button" class="dl-mini-btn" id="exDownload">Download CSV</button><button type="button" class="dl-mini-btn" id="exCopyLink">Copy link to this view</button><span class="explainer-status" id="exStatus" role="status" aria-live="polite"></span></div>';
  el.innerHTML = explainerHtml(spec, '');
  applyTabs('map');
}

const STATIC_EXPLAINERS = {
  scatterExplainer: {
    what: 'Each dot is a police district: infrastructure density against crime or road-safety density, per square kilometre or per 100,000 residents.',
    how: 'A dot higher and further right means more of both. A relationship between two measures does not show that one causes the other.',
    limits: 'Current 15 districts only. The streetlight and underpass surveys did not cover six districts, so those dots are missing, not zero. Police stations tend to follow crime rather than prevent it.',
    source: 'District counts from NCRB and the Delhi Traffic Police; infrastructure from the sources listed in Data & methods.',
    more: '<p>Density divides a count by the district area in square kilometres.</p>',
    download: 'dlVersusDownload'
  },
  trendsExplainer: {
    what: 'Delhi-wide road crashes, fatal crashes and persons killed each year from 2011 to 2024.',
    how: 'The chart sets 2011 to 100, so a line at 78 means 22% below 2011. Use Show annual counts for the actual numbers.',
    limits: 'Counts, not rates: traffic and population changed over the period. Delhi-wide only, with no district split. Report editions classify injuries differently, so injuries are left out.',
    source: 'Delhi Traffic Police annual road crash statistics.',
    more: '<p>A fatal crash has at least one death; persons killed counts people.</p>',
    download: 'dlTrendsDownload',
    table: 'roadTrendCounts'
  },
  victimsExplainer: {
    what: 'Road deaths in Delhi by the mode of travel of the person killed, 2019 to 2024.',
    how: 'Larger shares mean more deaths in that group. Figures are counts of people, not rates per trip or per kilometre.',
    limits: 'Delhi-wide only. Categories follow the Traffic Police report and are not split by district.',
    source: 'Delhi Traffic Police annual road crash data.',
    more: '',
    download: 'dlVictimsDownload'
  },
  zonesExplainer: {
    what: 'Locations listed as crash-prone in the 2023 Delhi Road Crash Report.',
    how: 'Each card is one zone with its fatal and total crashes.',
    limits: 'A zone is a location named in the report, not a measured level of risk. The 2023 and 2024 lists come from separate reports.',
    source: 'Delhi Road Crash Report 2023.',
    more: '',
    download: 'dlZonesDownload'
  },
  zones2024Explainer: {
    what: 'Locations listed as crash-prone in the 2024 Delhi Road Crash Report.',
    how: 'Each card is one zone with its fatal and total crashes.',
    limits: 'A zone is a location named in the report, not a measured level of risk. The 2023 and 2024 lists come from separate reports.',
    source: 'Delhi Road Crash Report 2024.',
    more: '',
    download: 'dlZones2024Download'
  },
  enforcementExplainer: {
    what: 'Citywide enforcement figures from the road crash reports.',
    how: 'These are annual totals for Delhi as a whole.',
    limits: 'Not split by district. Prosecutions measure enforcement activity, not safety outcomes.',
    source: 'Delhi Road Crash Report 2023 and 2024.',
    more: ''
  },
  roadsExplainer: {
    what: 'Roads with the most crash-prone zones.',
    how: 'Each row is a road and the number of zones on it.',
    limits: 'This counts zones, not crashes, so a long road can list many zones.',
    source: 'Delhi Road Crash Report 2023 and 2024.',
    more: '',
    download: 'dlRoadsDownload'
  }
};
function renderStaticExplainers() {
  Object.keys(STATIC_EXPLAINERS).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const spec = STATIC_EXPLAINERS[id];
    const buttons = (spec.table ? '<button type="button" class="dl-mini-btn" data-act="table" data-target="' + spec.table + '">View table</button>' : '') +
      (spec.download ? '<button type="button" class="dl-mini-btn" data-act="download" data-target="' + spec.download + '">Download data</button>' : '') +
      '<button type="button" class="dl-mini-btn" data-act="copy">Copy link to this view</button><span class="explainer-status" role="status" aria-live="polite"></span>';
    el.innerHTML = '<h3 class="explainer-title-sm">About this chart</h3>' + explainerHtml(Object.assign({}, spec, { continuity: staticContinuityHtml(id) }), '<div class="explainer-actions">' + buttons + '</div>');
  });
}

function renderOverview() {
  const el = document.getElementById('findingList');
  if (!el) return;
  const items = [];
  const withTotal = DATA.filter(d => d.totalIPC2024 != null);
  if (withTotal.length) {
    const top = withTotal.slice().sort((a, b) => b.totalIPC2024 - a.totalIPC2024)[0];
    const sum = withTotal.reduce((s, d) => s + d.totalIPC2024, 0);
    items.push(['Registered crime, 2024', fmtNum(sum) + ' IPC/BNS cases were registered across the ' + withTotal.length + ' police districts. ' + top.name + ' registered the most (' + fmtNum(top.totalIPC2024) + '). These are registered cases, which reflect reporting as well as crime.']);
  }
  if (TRENDS.length > 1) {
    const a = TRENDS[0], b = TRENDS[TRENDS.length - 1];
    const pct = (x, y) => Math.round((y - x) / x * 100);
    items.push(['Road crashes, ' + a.year + ' to ' + b.year, 'Delhi-wide road crashes are ' + Math.abs(pct(a.crashes, b.crashes)) + '% ' + (b.crashes < a.crashes ? 'lower' : 'higher') + ' and persons killed ' + Math.abs(pct(a.fatalities, b.fatalities)) + '% ' + (b.fatalities < a.fatalities ? 'lower' : 'higher') + ' than in ' + a.year + '. These are counts, not rates.']);
  }
  items.push(['Crime counts go back to 2011', 'Older years use the districts reported at the time: 11 until 2016, then 14, and 15 from 2019. Their maps are schematic and labelled inferred or derived.']);
  items.push(['Infrastructure coverage is uneven', 'The streetlight and underpass surveys did not cover Dwarka, North-East, North-West, Outer, Outer North and Rohini. A zero there means not surveyed.']);
  el.innerHTML = items.map(i => '<div class="finding"><h3>' + esc(i[0]) + '</h3><p>' + esc(i[1]) + '</p></div>').join('');
  const cite = document.getElementById('citeText');
  if (cite) cite.textContent = 'Delhi Urban Safety Observatory. Data version ' + document.getElementById('main').dataset.version + '. ' + location.origin + location.pathname;
}

function renderContinuityTable() {
  const body = document.querySelector('#continuityTable tbody');
  if (!body) return;
  const names = { theft: 'Theft', robbery: 'Robbery', burglary: 'Burglary', totalIPC: 'Total IPC', crimeAgainstWomen: 'Crimes against women', totalSLL: 'SLL crimes' };
  const list = ms => ms.length === CONTINUITY.crimeMeasures.length ? 'All crime measures' : ms.map(x => names[x] || x).join(', ');
  const range = r => r[0] === r[1] ? String(r[0]) : r[0] + ' to ' + r[1];
  const rows = [];
  CONTINUITY.availability.forEach(a => rows.push([range(a.years), list(a.measures), 'unavailable', a.reason]));
  CONTINUITY.definitionBreaks.forEach(b => rows.push([b.between[0] + ' vs ' + b.between[1], list(b.measures), b.state, b.reason]));
  CONTINUITY.geography.breaks.forEach(g => rows.push([g.between[0] + ' vs ' + g.between[1], 'All crime measures, by district. Affected: ' + g.affected.join(', ') + (g.newDistricts.length ? '. New: ' + g.newDistricts.join(', ') : ''), 'not_comparable', g.reason]));
  CONTINUITY.geography.epochs.forEach(e => rows.push([range(e.years), 'All crime measures', e.state, e.reason]));
  rows.push(['2022 vs 2023', 'Road deaths and hit-and-run (2022 series)', 'not_comparable', CONTINUITY.roadDistrict.reason2022]);
  rows.push(['2011 to 2024', 'Citywide road crashes and deaths', CONTINUITY.series.roadTrend.state, CONTINUITY.series.roadTrend.reasons.join(' ')]);
  rows.push(['Part of a year', 'Year-to-date series', CONTINUITY.series.partialYear.state, CONTINUITY.series.partialYear.reasons.join(' ')]);
  body.innerHTML = rows.map(r => '<tr><th scope="row">' + esc(r[0]) + '</th><td>' + esc(r[1]) + '</td><td>' + contBadge({ state: r[2] }) + '</td><td>' + esc(r[3]) + '</td></tr>').join('');
}

function renderGlossary() {
  const el = document.getElementById('glossaryList');
  if (el) el.innerHTML = GLOSSARY.map(g => '<dt>' + esc(g[0]) + '</dt><dd>' + esc(g[1]) + '</dd>').join('');
}

function syncUrl() {
  try {
    const u = new URL(location.href), p = u.searchParams;
    ['topic', 'metric', 'year', 'calc', 'district'].forEach(k => p.delete(k));
    p.set('topic', topicOf(currentMetric()));
    p.set('metric', activeMetric);
    p.set('year', String(activeYear));
    if (rateMode !== 'counts') p.set('calc', rateMode);
    if (colourMode === 'fixed') p.set('scale', 'fixed');
    const dn = isHistoryView() ? histSelected : selected;
    if (dn) p.set('district', dn);
    history.replaceState(null, '', u.pathname + '?' + p.toString() + u.hash);
  } catch (e) {}
}
function applyUrlState() {
  try {
    const p = new URLSearchParams(location.search);
    const mk = p.get('metric'), m = mk && METRICS.find(x => x.key === mk && !x.hiddenFromSelector);
    if (m) activeMetric = m.key;
    const cur = currentMetric(), yr = p.get('year');
    if (yr && metricSupportsYear(cur, yr)) {
      activeYear = yr;
    } else if (m && !metricSupportsYear(cur, activeYear)) {
      const supported = cur.yearVariants ? Object.keys(cur.yearVariants) : (cur.historicalYears ? [...cur.historicalYears, '2022', '2023', '2024'] : [cur.year]);
      activeYear = supported[supported.length - 1];
    }
    const calc = p.get('calc');
    if (calc === 'counts' || calc === 'density' || calc === 'perCapita') rateMode = calc;
    if (p.get('scale') === 'fixed') colourMode = 'fixed';
    const dn = p.get('district');
    if (dn) { if (DATA.some(d => d.name === dn)) selected = dn; histSelected = dn; }
  } catch (e) {}
}

function wireTabsAndFullscreen() {
  document.addEventListener('keydown', e => {
    const tab = e.target.closest ? e.target.closest('[role="tab"][data-tabgroup]') : null;
    if (!tab || ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
    const tabs = Array.from(document.querySelectorAll('[role="tab"][data-tabgroup="' + tab.dataset.tabgroup + '"]'));
    let i = tabs.indexOf(tab);
    if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') i = (i + tabs.length - 1) % tabs.length;
    else if (e.key === 'Home') i = 0;
    else i = tabs.length - 1;
    e.preventDefault();
    activateTab(tab.dataset.tabgroup, tabs[i].dataset.tab, true);
  });
  const fs = document.getElementById('mapFullscreen');
  const panel = document.querySelector('.map-panel');
  if (fs && panel && panel.requestFullscreen) {
    fs.hidden = false;
    document.addEventListener('fullscreenchange', () => { fs.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'; });
  }
}
function wireRedesign() {
  document.querySelectorAll('.topic-btn, .topic-start').forEach(b => b.addEventListener('click', () => {
    setTopic(b.dataset.topic);
    if (b.classList.contains('topic-start')) document.getElementById('explore').scrollIntoView({ behavior: 'smooth' });
  }));
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (link && link.getAttribute('href').length > 1) {
      const target = document.getElementById(link.getAttribute('href').slice(1));
      if (target && target.tagName === 'DETAILS') target.open = true;
    }
    const t = e.target.closest('button');
    const sc = e.target.closest('#scaleToggle button');
    if (sc && !sc.disabled) { colourMode = sc.dataset.scale; render(); return; }
    const tab = e.target.closest('[role="tab"][data-tabgroup]');
    if (tab) { activateTab(tab.dataset.tabgroup, tab.dataset.tab, false); return; }
    if (t && t.dataset.utYear) { activeYear = t.dataset.utYear; render(); return; }
    if (t && t.id === 'utDownload') { const key = UT_FIELDS[currentMetric().key] ? currentMetric().key : 'totalIPC'; const out = utCsv(key); triggerDownload('gaitway_delhi_wide_' + key + '.csv', toCSV(out.headers, out.rows)); return; }
    if (t && t.id === 'mapFullscreen') { const panel = document.querySelector('.map-panel'); if (document.fullscreenElement) document.exitFullscreen(); else if (panel.requestFullscreen) panel.requestFullscreen(); return; }
    if (t && t.id === 'exDownload') { const out = viewCsv(); triggerDownload('gaitway_delhi_view_' + activeMetric + '_' + activeYear + '_' + rateMode + '.csv', toCSV(out.headers, out.rows)); return; }
    if (t && (t.id === 'exCopyLink' || t.dataset.act === 'copy' || t.id === 'copyViewLink')) {
      copyText(location.href, ok => { const s = t.parentNode.querySelector('.explainer-status') || document.getElementById('copyStatus'); if (s) s.textContent = ok ? 'Link copied' : 'Copy failed: copy the address bar instead'; });
      return;
    }
    if (t && t.dataset.act === 'download') { const b = document.getElementById(t.dataset.target); if (b) b.click(); return; }
    if (t && t.dataset.act === 'table') { const tbl = document.getElementById(t.dataset.target); const det = tbl && tbl.closest('details'); if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'center' }); } return; }
    const more = document.getElementById('navMore');
    if (more && more.open && !e.target.closest('#navMore')) more.open = false;
  });
}

// ---- Can I compare these years? ----
// Reads CONTINUITY (data/continuity.json). A change figure is only ever shown when the pair is comparable or marked with caution.
const CONT_ICON = { comparable: '✓', caution: '!', not_comparable: '✕', unavailable: '–' };
let colourMode = 'rank';

function contBadge(cmp) {
  return '<span class="cont-badge ' + cmp.state + '"><span aria-hidden="true">' + CONT_ICON[cmp.state] + '</span> ' + esc(CONTINUITY.states[cmp.state]) + '</span>';
}
function contBlock(cmp, lead) {
  const text = cmp.reasons.length ? cmp.reasons.map(esc).join(' ') : (cmp.state === 'comparable' ? 'Same districts and offence definitions, so a change calculation is available.' : '');
  return '<div class="continuity ' + cmp.state + '">' + contBadge(cmp) + '<span class="cont-text">' + (lead ? '<b>' + esc(lead) + '</b> ' : '') + text + '</span></div>';
}
function prevYearForCompare(m, year) {
  if (m.yearVariants) { const ys = Object.keys(m.yearVariants).map(Number).sort(); const i = ys.indexOf(Number(year)); return i > 0 ? ys[i - 1] : null; }
  if (!m.prevKey) return null;
  return Number(year) > CONTINUITY.yearRange[0] ? Number(year) - 1 : null;
}
function rawFor(m, name, year) {
  const y = Number(year);
  if (m.prevKey && y <= 2018) {
    const hy = HIST.years.find(z => z.year === y);
    if (!hy) return null;
    const u = hy.units.find(x => x.territorial && histCanon(x.label) === histCanon(name));
    return u && u.values[histKey(m, y)] != null ? u.values[histKey(m, y)] : null;
  }
  const d = DATA.find(x => x.name === name);
  if (!d) return null;
  const v = m.yearVariants ? d[m.yearVariants[String(y)]] : d[yearFieldKey(m, String(y))];
  return v == null ? null : v;
}
function changeTile(m, name, year) {
  const info = contFor(m, name, year);
  if (!info) return '';
  const ch = changeBetween(info.cmp, info.from, info.to);
  const word = info.cmp.state === 'unavailable' ? 'Not available' : (info.cmp.state === 'not_comparable' ? 'Not comparable' : 'Not calculated');
  return '<div class="stat"><span class="stat-label">Change in cases from ' + info.prev + '</span>' +
    (ch == null ? '<span class="stat-val nodata">' + word + '</span>' : '<span class="stat-val">' + (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%</span>') +
    '<span class="stat-sub">' + contBadge(info.cmp) + '</span>' +
    (info.cmp.reasons.length ? '<span class="stat-sub cont-reason">' + esc(info.cmp.reasons[0]) + '</span>' : '') + '</div>';
}
function contFor(m, name, year) {
  const prev = prevYearForCompare(m, year);
  if (prev == null) return null;
  const cmp = compareYears(CONTINUITY, m.key, prev, Number(year), name);
  const flagKey = m.key + 'PreviousYearComparable' + year;
  const d = DATA.find(x => x.name === name);
  if (d && flagKey in d && d[flagKey] === false && cmp.state !== 'unavailable' && cmp.state !== 'not_comparable') {
    cmp.state = 'not_comparable';
    cmp.reasons = ['The source data flags the change from the previous year for this district as not comparable.'];
  }
  return { prev: prev, cmp: cmp, from: rawFor(m, name, prev), to: rawFor(m, name, year) };
}
function changeCellHtml(info) {
  if (!info) return 'n/a';
  const ch = changeBetween(info.cmp, info.from, info.to);
  if (ch == null) {
    const word = info.cmp.state === 'unavailable' ? 'Not available' : (info.cmp.state === 'not_comparable' ? 'Not comparable' : 'Not calculated');
    return '<span class="cont-none-cell" title="' + esc(info.cmp.reasons.join(' ')) + '">' + word + '</span>';
  }
  return (ch >= 0 ? '+' : '') + ch.toFixed(1) + '%' + (info.cmp.state === 'caution' ? ' <span class="cont-warn" title="' + esc(info.cmp.reasons.join(' ')) + '">!</span>' : '');
}
function mapContinuityHtml() {
  const m = currentMetric(), year = yearSuffix(m);
  const prev = prevYearForCompare(m, year);
  if (prev == null) return '<p class="cont-none">No earlier year is available for this measure, so there is nothing to compare it with.</p>';
  let out = contBlock(compareYears(CONTINUITY, m.key, prev, Number(year)), 'Compared with ' + prev + ':');
  const dn = isHistoryView() ? histSelected : selected;
  if (dn) { const info = contFor(m, dn, year); if (info) out += contBlock(info.cmp, dn + ' compared with ' + prev + ':'); }
  return out + '<p class="small cont-note">Change figures appear only where the comparison is comparable or marked with caution; they are changes in registered cases, not in risk.</p>';
}
function staticContinuityHtml(id) {
  const s = CONTINUITY.series;
  if (id === 'trendsExplainer') return contBlock({ state: s.roadTrend.state, reasons: s.roadTrend.reasons }, 'Comparing 2011 to 2024:');
  if (id === 'zonesExplainer' || id === 'zones2024Explainer') return contBlock({ state: s.roadZones.state, reasons: s.roadZones.reasons }, 'Comparing 2023 and 2024:');
  if (id === 'victimsExplainer') return '<p class="cont-none">Years are shown side by side, but no comparability check has been documented for this chart yet, so treat changes between years with care.</p>';
  return '<p class="cont-none">This view shows one year or one report at a time. No year-to-year comparison is offered.</p>';
}

// Colour scale: rank within the year, or one linear scale shared by the years that can honestly be compared.
function rowsForYear(m, y) {
  if (m.prevKey && y <= 2018) {
    const hy = HIST.years.find(z => z.year === y);
    return hy ? hy.units.filter(u => u.territorial).map(u => u.values[histKey(m, y)]) : [];
  }
  return DATA.map(d => {
    const raw = m.yearVariants ? d[m.yearVariants[String(y)]] : d[yearFieldKey(m, String(y))];
    return getRateVal(raw == null ? null : raw, d);
  });
}
function fixedScaleAvailable(m, year) {
  const seg = segmentOf(CONTINUITY, m.key, Number(year));
  return seg[0] !== seg[1];
}
function viewScale(vals, m, year) {
  const base = { scale: percentileScale(vals), lo: vals.length ? Math.min.apply(null, vals) : null, hi: vals.length ? Math.max.apply(null, vals) : null, fixed: false, note: '' };
  if (colourMode !== 'fixed' || !vals.length || !fixedScaleAvailable(m, year)) return base;
  const seg = segmentOf(CONTINUITY, m.key, Number(year));
  let hi = 0;
  for (let y = seg[0]; y <= seg[1]; y++) rowsForYear(m, y).forEach(v => { if (v != null && v > hi) hi = v; });
  if (!hi) return base;
  return { scale: v => Math.min(1, Math.max(0, v / hi)), lo: 0, hi: hi, fixed: true, note: 'same scale across ' + seg[0] + ' to ' + seg[1] };
}
function renderScaleToggle() {
  const el = document.getElementById('scaleToggle');
  if (!el) return;
  const m = currentMetric(), year = yearSuffix(m), ok = fixedScaleAvailable(m, year);
  el.querySelectorAll('button').forEach(b => {
    const on = (b.dataset.scale === 'fixed') ? (colourMode === 'fixed' && ok) : !(colourMode === 'fixed' && ok);
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', String(on));
    if (b.dataset.scale === 'fixed') { b.disabled = !ok; b.title = ok ? 'One scale for ' + segmentOf(CONTINUITY, m.key, Number(year)).join(' to ') + ', so colours can be compared across those years' : 'No other year can share a scale with this one'; }
  });
}
function geoVersion(m, year) {
  const y = Number(year);
  if (!m.prevKey) return y <= 2022 ? '11 Traffic Police reporting districts' : '15 Delhi Police districts';
  if (y <= 2016) return '11 police districts (2014 roster, inferred)';
  if (y <= 2018) return '14 police districts (November 2017 gazette schedule)';
  return '15 police districts (current)';
}

// ---- Headline cards, tabbed chart blocks and the Delhi-wide series ----
// Delhi-wide figures are the Delhi UT totals NCRB prints (UT_SERIES, data/releases/delhi_ut_series), independent of district boundaries.
const UT_FIELDS = { totalIPC: ['total_ipc_bns'], theft: ['theft'], robbery: ['robbery'], burglary: ['burglary', 'criminal_trespass_burglary_revised_head', 'burglary_old_head'], crimeAgainstWomen: ['total_crimes_against_women'], totalSLL: ['total_sll'] };
const UT_LABEL = { totalIPC: 'IPC/BNS crimes registered', theft: 'Theft', robbery: 'Robbery', burglary: 'Burglary', crimeAgainstWomen: 'Crimes against women', totalSLL: 'Special and Local Laws crimes' };
const TAB_STATE = { map: 'map', ut: 'chart' };
const UT_NOUN = { totalIPC: 'IPC/BNS crimes registered', theft: 'theft', robbery: 'robbery', burglary: 'burglary', crimeAgainstWomen: 'crimes against women', totalSLL: 'Special and Local Laws crimes' };

function utRow(year) { return UT_SERIES.find(r => r.year === Number(year)); }
function utValue(row, key) {
  if (!row || row.status === 'not_collected') return null;
  const fields = UT_FIELDS[key] || [];
  for (let i = 0; i < fields.length; i++) { if (row[fields[i]] != null) return row[fields[i]]; }
  return null;
}
function utHead(row, key) {
  if (key !== 'burglary' || !row || row.status === 'not_collected') return '';
  if (row.burglary != null) return 'later burglary definition';
  if (row.criminal_trespass_burglary_revised_head != null) return 'revised criminal trespass/burglary head';
  return row.burglary_old_head != null ? 'original burglary head' : '';
}
function utCompare(key, from, to) {
  const cmp = compareYears(CONTINUITY, key, from, to, CONTINUITY.utSeries.scopeName);
  const a = utValue(utRow(from), key), b = utValue(utRow(to), key);
  return { cmp: cmp, from: a, to: b, change: changeBetween(cmp, a, b) };
}
function changeSentence(info, prev, short) {
  const c = info.cmp;
  if (c.state === 'unavailable') return 'No comparison with ' + prev + ': ' + (c.reasons[0] || 'a figure is missing');
  if (c.state === 'not_comparable') return 'Not comparable with ' + prev + '.' + (short ? '' : ' ' + (c.reasons[0] || ''));
  if (info.change == null) return 'No change figure for ' + prev + '.';
  const diff = info.to - info.from;
  return (diff >= 0 ? '▲ Up ' : '▼ Down ') + Math.abs(info.change).toFixed(1) + '% (' + (diff >= 0 ? '+' : '-') + fmtNum(Math.abs(diff)) + ') compared with ' + prev + (c.state === 'caution' && !short ? '. Compare with caution: ' + (c.reasons[0] || '') : '.');
}
function hcard(label, value, sub, change, state) {
  return '<div class="hcard"><div class="hcard-label">' + esc(label) + '</div><div class="hcard-value">' + (value == null ? '<span class="hcard-none">Not available</span>' : fmtNum(value)) + '</div><div class="hcard-sub">' + esc(sub) + '</div>' +
    (change ? '<div class="hcard-change ' + (state || '') + '">' + (state ? contBadge({ state: state }) + ' ' : '') + esc(change) + '</div>' : '') + '</div>';
}
function renderHeadlineCards() {
  const el = document.getElementById('headlineCards');
  if (!el) return;
  const m = currentMetric(), year = Number(yearSuffix(m));
  let html = '';
  const notes = [];
  if (topicOf(m) === 'crime') {
    const row = utRow(year);
    if (!row || row.status === 'not_collected') {
      const latest = UT_SERIES.filter(r => r.status !== 'not_collected').slice(-1)[0].year;
      html = '<div class="hcard hcard-wide"><div class="hcard-label">Delhi-wide registered crime, ' + year + '</div><div class="hcard-value"><span class="hcard-none">Not collected yet</span></div><div class="hcard-sub">The printed Delhi UT totals have not been collected for ' + year + '. The map and table below still show the districts.</div><div class="hcard-change"><button type="button" class="dl-mini-btn" data-ut-year="' + latest + '">Show ' + latest + '</button></div></div>';
    } else {
      html = ['totalIPC', 'theft', 'crimeAgainstWomen'].map(key => {
        const v = utValue(row, key);
        const sub = 'Delhi-wide, calendar year ' + year;
        if (v == null && row.status === 'printed_totals_only') return hcard(UT_LABEL[key], null, sub, 'Head-wise figures for 2016 to 2020 are not extracted yet; the total is printed.', 'unavailable');
        if (year <= CONTINUITY.yearRange[0]) return hcard(UT_LABEL[key], v, sub, '', '');
        const info = utCompare(key, year - 1, year);
        if (v != null && info.cmp.state !== 'comparable') info.cmp.reasons.forEach(x => { if (notes.indexOf(x) < 0) notes.push(x); });
        return hcard(UT_LABEL[key], v, sub, v == null ? 'Not reported in the source tables for ' + year + '.' : changeSentence(info, year - 1, true), v == null ? 'unavailable' : info.cmp.state);
      }).join('');
    }
  } else {
    const row = TRENDS.find(t => t.year === year) || TRENDS[TRENDS.length - 1];
    const prev = TRENDS.find(t => t.year === row.year - 1);
    const st = CONTINUITY.series.roadTrend;
    const card = (label, field) => {
      let change = '', state = '';
      if (prev && prev[field] != null) {
        const diff = row[field] - prev[field];
        change = (diff >= 0 ? '▲ Up ' : '▼ Down ') + Math.abs(diff / prev[field] * 100).toFixed(1) + '% (' + (diff >= 0 ? '+' : '-') + fmtNum(Math.abs(diff)) + ') compared with ' + prev.year + '.';
        if (notes.indexOf(st.reasons[0]) < 0) notes.push(st.reasons[0]);
        state = st.state;
      }
      return hcard(label, row[field], 'Delhi-wide, calendar year ' + row.year, change, state);
    };
    html = card('Road crashes', 'crashes') + card('Fatal crashes', 'fatalCrashes') + card('Persons killed', 'fatalities');
  }
  el.innerHTML = html + (notes.length ? '<p class="cards-note">' + notes.map(esc).join(' ') + '</p>' : '');
}

// Tabs: Chart / Table / Download / About, as on the UKHSA dashboard
function applyTabs(group) {
  const active = TAB_STATE[group];
  document.querySelectorAll('[data-tabgroup="' + group + '"]').forEach(node => {
    if (node.getAttribute('role') === 'tab') {
      const on = node.dataset.tab === active;
      node.setAttribute('aria-selected', String(on));
      node.tabIndex = on ? 0 : -1;
    } else {
      node.hidden = node.dataset.tab !== active;
    }
  });
}
function activateTab(group, tab, focus) {
  TAB_STATE[group] = tab;
  applyTabs(group);
  if (focus) { const b = document.querySelector('[role="tab"][data-tabgroup="' + group + '"][data-tab="' + tab + '"]'); if (b) b.focus(); }
}

function utChartHtml(key) {
  const W = 640, H = 300, L = 62, R = 14, T = 16, B = 40;
  const first = CONTINUITY.yearRange[0], last = CONTINUITY.yearRange[1], span = last - first;
  const years = []; for (let y = first; y <= last; y++) years.push(y);
  const vals = years.map(y => utValue(utRow(y), key));
  const max = Math.max.apply(null, vals.filter(v => v != null).concat([1]));
  const x = y => L + (y - first) / span * (W - L - R);
  const yy = v => T + (1 - v / max) * (H - T - B);
  const step = (W - L - R) / span;
  const selected = Number(yearSuffix(currentMetric()));
  let s = '<svg class="ut-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc('Delhi-wide ' + UT_NOUN[key] + ' by year, 2011 to 2024. The table tab lists every value.') + '">';
  // missing years
  years.forEach((y, i) => {
    if (vals[i] != null) return;
    s += '<rect class="ut-gap" x="' + (x(y) - step / 2).toFixed(1) + '" y="' + T + '" width="' + step.toFixed(1) + '" height="' + (H - T - B) + '"></rect>';
  });
  const gapLabel = (from, to, text) => { if (vals[from - first] == null && vals[to - first] == null) s += '<text class="ut-note" x="' + ((x(from) + x(to)) / 2).toFixed(1) + '" y="' + (T + 14) + '" text-anchor="middle">' + text + '</text>'; };
  if (['theft', 'robbery', 'burglary'].indexOf(key) >= 0) gapLabel(2016, 2020, 'head-wise figures not extracted yet');
  gapLabel(2011, 2013, key === 'crimeAgainstWomen' || key === 'totalSLL' ? 'not reported in the source tables' : '');
  // y axis
  [0, 0.5, 1].forEach(f => {
    const v = Math.round(max * f);
    s += '<line class="ut-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy(v).toFixed(1) + '" y2="' + yy(v).toFixed(1) + '"></line><text class="ut-axis" x="' + (L - 6) + '" y="' + (yy(v) + 4).toFixed(1) + '" text-anchor="end">' + fmtNum(v) + '</text>';
  });
  years.forEach(y => { if ((y - first) % 2 === 0 || y === last) s += '<text class="ut-axis" x="' + x(y).toFixed(1) + '" y="' + (H - 18) + '" text-anchor="middle">' + y + '</text>'; });
  // lines and breaks
  for (let i = 0; i < years.length - 1; i++) {
    const a = vals[i], b = vals[i + 1];
    if (a == null || b == null) continue;
    const info = utCompare(key, years[i], years[i + 1]);
    if (info.cmp.state === 'not_comparable') {
      const mx = (x(years[i]) + x(years[i + 1])) / 2;
      s += '<line class="ut-break" x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" data-tt-title="Break between ' + years[i] + ' and ' + years[i + 1] + '" data-tt-body="' + esc(info.cmp.reasons.join(' ')) + '"></line><text class="ut-note" x="' + (mx + 4).toFixed(1) + '" y="' + (T + 12) + '">break</text>';
    } else if (info.cmp.state !== 'unavailable') {
      s += '<line class="ut-line ' + info.cmp.state + '" x1="' + x(years[i]).toFixed(1) + '" y1="' + yy(a).toFixed(1) + '" x2="' + x(years[i + 1]).toFixed(1) + '" y2="' + yy(b).toFixed(1) + '"></line>';
    }
  }
  // points
  years.forEach((y, i) => {
    const v = vals[i];
    if (v == null) return;
    const prevInfo = y > first ? utCompare(key, y - 1, y) : null;
    const body = fmtNum(v) + ' registered cases' + (utHead(utRow(y), key) ? ' (' + utHead(utRow(y), key) + ')' : '') + '. ' + (prevInfo ? changeSentence(prevInfo, y - 1) : 'First year in the series.');
    s += '<circle class="ut-point' + (y === selected ? ' sel' : '') + '" cx="' + x(y).toFixed(1) + '" cy="' + yy(v).toFixed(1) + '" r="' + (y === selected ? 6 : 4) + '" data-tt-title="' + y + ': ' + esc(UT_LABEL[key]) + '" data-tt-body="' + esc(body) + '"></circle>';
  });
  s += '</svg><p class="ut-legend small"><span class="ut-key solid"></span> comparable <span class="ut-key dashed"></span> compare with caution <span class="ut-key none"></span> no line: a break in definition, or a year without a figure</p>';
  return s;
}
function utTableHtml(key) {
  const first = CONTINUITY.yearRange[0], last = CONTINUITY.yearRange[1];
  let body = '';
  for (let y = first; y <= last; y++) {
    const row = utRow(y), v = utValue(row, key);
    let change = '<span class="cont-none-cell">First year</span>', badge = '';
    if (y > first) {
      const info = utCompare(key, y - 1, y);
      badge = contBadge(info.cmp);
      change = info.change == null ? '<span class="cont-none-cell" title="' + esc(info.cmp.reasons.join(' ')) + '">' + (info.cmp.state === 'unavailable' ? 'Not available' : 'Not comparable') + '</span>' : (info.change >= 0 ? '+' : '') + info.change.toFixed(1) + '%';
    }
    const note = row && row.status === 'not_collected' ? 'Not collected yet' : (v == null ? (row && row.status === 'printed_totals_only' ? 'Head-wise figure not extracted yet' : 'Not reported in the source tables') : utHead(row, key));
    body += '<tr><th scope="row">' + y + '</th><td>' + (v == null ? 'Not available' : fmtNum(v)) + '</td><td>' + change + '</td><td>' + badge + '</td><td>' + esc(note) + '</td></tr>';
  }
  return '<div class="table-wrap"><table class="view-table"><caption>Delhi-wide ' + esc(UT_NOUN[key]) + ', calendar years 2011 to 2024</caption><thead><tr><th scope="col">Year</th><th scope="col">Registered cases</th><th scope="col">Change from previous year</th><th scope="col">Can I compare?</th><th scope="col">Note</th></tr></thead><tbody>' + body + '</tbody></table></div>';
}
function utCsv(key) {
  const version = document.getElementById('main').dataset.version;
  const headers = ['Dataset', 'Geography', 'Measure', 'Year', 'Reporting period', 'Registered cases', 'Offence definition', 'Status', 'Comparability with previous year', 'Reason for any break', 'Source', 'Dataset version'];
  const rows = UT_SERIES.map(r => {
    const v = utValue(r, key);
    const info = r.year > CONTINUITY.yearRange[0] ? utCompare(key, r.year - 1, r.year) : null;
    return ['Delhi Urban Safety Observatory', 'Delhi UT as printed by NCRB (all reporting units)', UT_LABEL[key], r.year, 'Calendar year', v, r.offence_basis + (utHead(r, key) ? '; ' + utHead(r, key) : ''), r.status === 'not_collected' ? 'not collected' : (v == null ? (r.status === 'printed_totals_only' ? 'totals printed; head-wise figure not extracted' : 'printed, not reported') : (r.status === 'printed_totals_only' ? 'printed (totals only)' : 'printed')), info ? CONTINUITY.states[info.cmp.state] : 'First year', info ? info.cmp.reasons.join(' ') : '', r.status === 'not_collected' ? '' : (r.year <= 2015 ? 'NCRB Crime in India, printed Delhi UT summary' : (r.year <= 2020 ? 'NCRB Crime in India, State/UT-wise tables (editions compared)' : 'NCRB district-wise tables, printed Total Districts row for Delhi')), version];
  });
  return { headers: headers, rows: rows };
}
function renderUtBlock() {
  const el = document.getElementById('utSection');
  if (!el) return;
  const m = currentMetric();
  if (topicOf(m) !== 'crime') return;
  const key = UT_FIELDS[m.key] ? m.key : 'totalIPC';
  document.getElementById('utTitle').textContent = 'Delhi-wide ' + UT_NOUN[key] + ' by year';
  document.getElementById('utDesc').textContent = 'Printed Delhi UT totals, calendar years 2011 to 2024. Totals are printed for every year; theft, robbery and burglary for 2016 to 2020 are not extracted yet, so they are gaps, not zeros. Lines join only years that can be compared.';
  document.getElementById('utPanelChart').innerHTML = utChartHtml(key);
  document.getElementById('utPanelTable').innerHTML = utTableHtml(key);
  document.getElementById('utPanelDownload').innerHTML = '<p>Download the Delhi-wide series for this measure, one row per year, with the offence definition, whether the year is comparable with the one before and the reason for any break.</p><p><button type="button" class="dl-mini-btn" id="utDownload">Download CSV (Delhi-wide, ' + esc(UT_NOUN[key]) + ')</button> <span class="explainer-status" id="utStatus" role="status" aria-live="polite"></span></p><p class="small">Full release with every measure: <a href="https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/tree/main/data/releases/delhi_ut_series" target="_blank" rel="noopener">data/releases/delhi_ut_series</a></p>';
  document.getElementById('utPanelAbout').innerHTML =
    '<div class="explainer-grid"><div><h3>What am I seeing?</h3><p>The Delhi UT total for ' + esc(UT_NOUN[key]) + ' exactly as NCRB prints it, one value per calendar year.</p></div>' +
    '<div><h3>How do I read it?</h3><p>A point higher on the chart means more registered cases. A solid line joins years that can be compared, a dashed line joins years to compare with caution, and no line means a change in definition or a missing year.</p></div>' +
    '<div><h3>What are the limits?</h3><p>It includes every reporting unit NCRB lists for Delhi, including specialised units such as Metro and Railway, so it is higher than the sum of the 15 districts. Theft, robbery and burglary for 2016 to 2020 are not extracted yet. NCRB changed its reporting format in 2014 and the BNS replaced the IPC in 2024.</p></div>' +
    '<div><h3>Where did it come from?</h3><p>2011 to 2015: the printed Delhi UT summaries of the original Crime in India tables. 2022 to 2024: the printed Total Districts row of the NCRB district-wise tables, which equals the sum of the printed unit rows.</p></div></div>' +
    '<details class="explainer-more"><summary>Definitions</summary>' + glossaryHtml('IPC BNS SLL registered NCRB') + '<p>Burglary is three different definitions (original head to 2013, revised criminal trespass/burglary head 2014 to 2015, later definition from 2022), so the chart shows breaks between them.</p></details>';
  applyTabs('ut');
}

function render() {
  const hist = isHistoryView();
  document.body.classList.toggle('history-mode', hist);
  document.getElementById('map').style.display = hist ? 'none' : '';
  document.getElementById('mapHistory').style.display = hist ? '' : 'none';
  buildMetricTabs();
  if (hist) {
    renderHistoryView();
  } else {
    renderDataStatus();
    renderMap();
    renderList();
    renderDetail();
    renderMethod();
    renderCorrelationMatrix();
  }
  renderDownloadTabs();
  renderTrends();
  renderVictimsByMode();
  renderZones();
  renderZones2024();
  renderEnforcement();
  renderRoadSummary();
  if (compareMode && !hist) renderCompareCard();
  renderTopicControls();
  renderScaleToggle();
  renderHeadlineCards();
  renderUtBlock();
  renderMapExplainer();
  syncUrl();
}

const MAP_LAYER_CONTROLS = [
  ['streetlightPointsToggle', 'PAPL survey points', () => showStreetlightPoints],
  ['osmStreetLampToggle', 'OSM street lamps', () => showOsmStreetLamps],
  ['policeToggle', 'Police', () => showPolice],
  ['zonesToggle', 'Crash zones', () => showZones],
  ['busStopToggle', 'Bus stops', () => showBusStops],
  ['atmToggle', 'ATMs', () => showAtms],
  ['alcoholToggle', 'Liquor shops', () => showAlcohol],
  ['surveillanceToggle', 'CCTV and guards', () => showSurveillance],
];

function updateLayerControls() {
  const active = MAP_LAYER_CONTROLS.filter(([, , getter]) => getter());
  const badge = document.getElementById('layerCountBadge');
  const group = document.getElementById('mapLayersGroup');
  const strip = document.getElementById('activeLayerChips');
  const clear = document.getElementById('clearLayersBtn');
  if (badge) badge.textContent = active.length + ' active';
  if (group) group.classList.toggle('active', active.length > 0);
  if (clear) clear.disabled = active.length === 0;
  if (strip) {
    strip.classList.toggle('on', active.length > 0);
    strip.innerHTML = active.length ? '<span class="active-layer-label">Active layers</span>' + active.map(([id, label]) => '<button class="layer-chip" type="button" data-layer-id="' + id + '" aria-label="Remove ' + label + '">' + label + ' ×</button>').join('') : '';
    strip.querySelectorAll('.layer-chip').forEach(chip => chip.addEventListener('click', () => document.getElementById(chip.dataset.layerId).click()));
  }
}

function setupToggleControl(id, getter, setter) {
  const el = document.getElementById(id);
  if (!el) return;
  el.setAttribute('role', 'switch');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-checked', getter() ? 'true' : 'false');
  const toggle = () => {
    const newVal = !getter();
    setter(newVal);
    el.classList.toggle('on', newVal);
    el.setAttribute('aria-checked', newVal ? 'true' : 'false');
    updateDisplayControls();
    updateLayerControls();
    renderMap();
  };
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
}

setupToggleControl('streetlightPointsToggle', () => showStreetlightPoints, v => { showStreetlightPoints = v; });
setupToggleControl('osmStreetLampToggle', () => showOsmStreetLamps, v => { showOsmStreetLamps = v; });
setupToggleControl('policeToggle', () => showPolice, v => { showPolice = v; });
setupToggleControl('zonesToggle', () => showZones, v => { showZones = v; });
setupToggleControl('bivariateToggle', () => isBivariateMode, v => { isBivariateMode = v; });

document.getElementById('choroplethMode').addEventListener('click', () => { isBivariateMode = false; updateDisplayControls(); renderMap(); });
setupToggleControl('busStopToggle', () => showBusStops, v => { showBusStops = v; });
setupToggleControl('atmToggle', () => showAtms, v => { showAtms = v; });
setupToggleControl('alcoholToggle', () => showAlcohol, v => { showAlcohol = v; });
setupToggleControl('surveillanceToggle', () => showSurveillance, v => { showSurveillance = v; });

document.getElementById('clearLayersBtn').addEventListener('click', () => {
  MAP_LAYER_CONTROLS.forEach(([id, , getter]) => { if (getter()) document.getElementById(id).click(); });
});
updateLayerControls();
updateDisplayControls();

const scatterCanvasEl = document.getElementById('scatterCanvas');
if (scatterCanvasEl) {
  scatterCanvasEl.addEventListener('mousemove', (e) => {
    const rect = scatterCanvasEl.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let closestIdx = -1;
    let minDist = 16;

    scatterPointsCache.forEach((p, idx) => {
      const dist = Math.hypot(mx - p.cx, my - p.cy);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });

    if (closestIdx !== scatterHoveredIndex) {
      scatterHoveredIndex = closestIdx;
      renderScatter();
    }
  });

  scatterCanvasEl.addEventListener('mouseleave', () => {
    if (scatterHoveredIndex !== -1) {
      scatterHoveredIndex = -1;
      renderScatter();
    }
  });
}

// Delegated map interaction — one listener each instead of one per district/marker, since
// renderMap() replaces the SVG's entire innerHTML on every render (metric switch, year toggle,
// selection change, ...) and per-element listeners would just be discarded and re-added every
// time, generating GC churn for no benefit.
const mapSvg = document.getElementById('map');
const mapStage = document.querySelector('.map-stage');
const mapTooltip = document.getElementById('mapTooltip');

mapSvg.addEventListener('click', (e) => {
  const marker = e.target.closest('[data-sv-url]');
  if (marker && marker.dataset.svUrl) {
    window.open(marker.dataset.svUrl, '_blank', 'noopener');
    return;
  }
  const path = e.target.closest('.district');
  selected = path ? (selected === path.dataset.name ? null : path.dataset.name) : null;
  render();
});

document.getElementById('rankList').addEventListener('click', (e) => {
  const row = e.target.closest('.rank-row');
  if (!row) return;
  if (row.classList.contains('hist-row')) { histSelect(row.dataset.name); return; }
  selected = selected === row.dataset.name ? null : row.dataset.name;
  render();
});

// Global delegated tooltip for all elements with data-tt-title (metric tabs, district map paths, police chowkis, legend scale, etc.)
document.addEventListener('mousemove', (e) => {
  const el = e.target.closest('[data-tt-title]');
  if (!el) { mapTooltip.classList.remove('on'); return; }
  const title = el.dataset.ttTitle;
  const body = el.dataset.ttBody;

  let x = e.clientX + 14;
  let y = e.clientY + 14;

  const tooltipWidth = 260;
  const tooltipHeight = 120;
  if (x + tooltipWidth > window.innerWidth) x = e.clientX - tooltipWidth - 10;
  if (y + tooltipHeight > window.innerHeight) y = e.clientY - tooltipHeight - 10;

  mapTooltip.style.left = Math.max(10, x) + 'px';
  mapTooltip.style.top = Math.max(10, y) + 'px';
  mapTooltip.innerHTML = '<b>' + title + '</b>' + (body ? '<div class="tt-body">' + body + '</div>' : '');
  mapTooltip.classList.add('on');
});
document.addEventListener('mouseleave', () => mapTooltip.classList.remove('on'));

// Delegated: one listener on the tab strip rather than one per button, since renderRoadSafetyTabs()
// rebuilds the buttons via innerHTML on every switch.
document.getElementById('roadSafetyTabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.metric-tab');
  if (!btn) return;
  activeRoadSafetyTab = btn.dataset.key;
  renderRoadSafetyTabs();
  // The canvas in the tab just switched to was hidden (0 width) on its last render — redraw now
  // that it's visible so it isn't stuck blank.
  if (activeRoadSafetyTab === 'trends') renderTrends();
  if (activeRoadSafetyTab === 'victims') renderVictimsByMode();
});

window.addEventListener('resize', debounce(() => {
  renderScatter();
  renderTrends();
  renderVictimsByMode();
}, 200));

let compareMode = false;
let compareDist1 = 'South-East';
let compareDist2 = 'North-West';

function setupCompareMode() {
  const btn = document.getElementById('compareToggleBtn');
  const card = document.getElementById('compareCard');
  if (!btn || !card) return;

  btn.addEventListener('click', () => {
    compareMode = !compareMode;
    btn.classList.toggle('active', compareMode);
    card.style.display = compareMode ? 'block' : 'none';
    if (compareMode) renderCompareCard();
  });
}

function renderCompareCard() {
  const card = document.getElementById('compareCard');
  if (!card || !compareMode) return;

  const d1 = DATA.find(x => x.name === compareDist1) || DATA[0];
  const d2 = DATA.find(x => x.name === compareDist2) || DATA[1];

  const year = activeYear;

  function compRow(label, val1, val2, unit) {
    const isNum = typeof val1 === 'number' && typeof val2 === 'number';
    const highlight1 = isNum && val1 > val2 ? ' font-weight:700;color:var(--amber);' : '';
    const highlight2 = isNum && val2 > val1 ? ' font-weight:700;color:var(--amber);' : '';
    return '<div class="tt-row" style="padding:6px 0;border-bottom:1px solid var(--border);">' +
      '<span style="flex:1;">' + label + '</span>' +
      '<span style="width:100px;text-align:right;' + highlight1 + '">' + fmtNum(val1) + (unit ? ' ' + unit : '') + '</span>' +
      '<span style="width:100px;text-align:right;' + highlight2 + '">' + fmtNum(val2) + (unit ? ' ' + unit : '') + '</span>' +
    '</div>';
  }

  card.innerHTML =
    '<h2>Side-by-Side District Comparison ' +
      '<div style="font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:6px;">' +
        '<select id="compSel1" style="font:inherit;font-size:13px;padding:4px 8px;border-radius:6px;background:var(--bg);color:var(--text);border:1px solid var(--border);">' +
          DATA.map(x => '<option value="' + x.name + '"' + (x.name===d1.name?' selected':'') + '>' + x.name + '</option>').join('') +
        '</select>' +
        ' vs ' +
        '<select id="compSel2" style="font:inherit;font-size:13px;padding:4px 8px;border-radius:6px;background:var(--bg);color:var(--text);border:1px solid var(--border);">' +
          DATA.map(x => '<option value="' + x.name + '"' + (x.name===d2.name?' selected':'') + '>' + x.name + '</option>').join('') +
        '</select>' +
      '</div>' +
    '</h2>' +
    '<div class="compare-grid">' +
      '<div class="compare-col">' +
        '<div class="tt-row" style="padding:6px 0;border-bottom:2px solid var(--border);font-weight:800;">' +
          '<span style="flex:1;"></span>' +
          '<span style="width:100px;text-align:right;">' + d1.name + '</span>' +
          '<span style="width:100px;text-align:right;">' + d2.name + '</span>' +
        '</div>' +
        compRow('District Area', d1.areaSqKm, d2.areaSqKm, 'km²') +
        compRow('Total IPC Crime (' + year + ')', yearFieldVal(d1,'totalIPC'), yearFieldVal(d2,'totalIPC')) +
        compRow('Theft Offences (' + year + ')', yearFieldVal(d1,'theft'), yearFieldVal(d2,'theft')) +
        compRow('Robbery (' + year + ')', yearFieldVal(d1,'robbery'), yearFieldVal(d2,'robbery')) +
        compRow('Burglary (' + year + ')', yearFieldVal(d1,'burglary'), yearFieldVal(d2,'burglary')) +
        compRow('Crime Against Women (' + year + ')', yearFieldVal(d1,'crimeAgainstWomen'), yearFieldVal(d2,'crimeAgainstWomen')) +
        compRow('Streetlight Density', d1.lightDensityPerKm2, d2.lightDensityPerKm2, '/km²') +
        compRow('Police Stations & Chowkis', d1.policeInfraCount, d2.policeInfraCount) +
        compRow('Fatal Crashes (' + (activeYear === '2024' ? '2024' : '2023') + ')', activeYear === '2024' ? d1.fatalCrashes2024 : d1.fatalCrashes2023, activeYear === '2024' ? d2.fatalCrashes2024 : d2.fatalCrashes2023) +
      '</div>' +
    '</div>';

  document.getElementById('compSel1').addEventListener('change', (e) => { compareDist1 = e.target.value; renderCompareCard(); });
  document.getElementById('compSel2').addEventListener('change', (e) => { compareDist2 = e.target.value; renderCompareCard(); });
}

function setupSearch() {
  const input = document.getElementById('districtSearch');
  const clearBtn = document.getElementById('searchClear');
  const dropdown = document.getElementById('searchDropdown');
  if (!input || !dropdown) return;

  function doSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      dropdown.innerHTML = '';
      dropdown.classList.remove('on');
      clearBtn.style.display = 'none';
      return;
    }
    clearBtn.style.display = 'block';

    const distMatches = DATA.filter(d => d.name.toLowerCase().includes(q)).map(d => ({
      title: d.name + ' District',
      type: 'District',
      action: () => {
        selected = d.name;
        render();
        const detailEl = document.getElementById('detail');
        if (detailEl) detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }));

    const policeMatches = [];
    POLICE_MARKERS.stations.forEach(([x, y, name]) => {
      if (name.toLowerCase().includes(q)) {
        const distName = findDistrictName(x, y);
        policeMatches.push({
          title: name,
          type: 'Police Station · ' + distName,
          action: () => {
            selected = distName;
            showPolice = true;
            const toggle = document.getElementById('policeToggle');
            if (toggle) { toggle.classList.add('on'); toggle.setAttribute('aria-checked', 'true'); }
            render();
          }
        });
      }
    });
    POLICE_MARKERS.posts.forEach(([x, y, name]) => {
      if (name.toLowerCase().includes(q)) {
        const distName = findDistrictName(x, y);
        policeMatches.push({
          title: name,
          type: 'Chowki / Outpost · ' + distName,
          action: () => {
            selected = distName;
            showPolice = true;
            const toggle = document.getElementById('policeToggle');
            if (toggle) { toggle.classList.add('on'); toggle.setAttribute('aria-checked', 'true'); }
            render();
          }
        });
      }
    });

    const zoneMatches = [];
    ACCIDENT_ZONES.forEach(z => {
      if (z.name.toLowerCase().includes(q) || (z.road && z.road.toLowerCase().includes(q))) {
        zoneMatches.push({
          title: z.name + (z.road ? ' (' + z.road + ')' : ''),
          type: 'Crash Zone · ' + z.district,
          action: () => {
            selected = z.district;
            showZones = true;
            const toggle = document.getElementById('zonesToggle');
            if (toggle) { toggle.classList.add('on'); toggle.setAttribute('aria-checked', 'true'); }
            render();
          }
        });
      }
    });

    const allMatches = [...distMatches, ...policeMatches, ...zoneMatches].slice(0, 12);
    if (!allMatches.length) {
      dropdown.innerHTML = '<div class="search-item" style="color:var(--text-dim);">No matching district, police station, or crash zone found</div>';
      dropdown.classList.add('on');
      return;
    }

    dropdown.innerHTML = allMatches.map((m, i) =>
      '<div class="search-item" data-idx="' + i + '"><span>' + esc(m.title) + '</span><span class="type">' + esc(m.type) + '</span></div>'
    ).join('');
    dropdown.classList.add('on');

    dropdown.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx, 10);
        if (allMatches[idx]) {
          allMatches[idx].action();
          dropdown.classList.remove('on');
          input.value = '';
          clearBtn.style.display = 'none';
        }
      });
    });
  }

  input.addEventListener('input', debounce(doSearch, 50));
  input.addEventListener('focus', () => { if (input.value.trim()) doSearch(); });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    dropdown.classList.remove('on');
    clearBtn.style.display = 'none';
    input.focus();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) dropdown.classList.remove('on');
  });
}

setupSearch();
setupCompareMode();

// ── DOWNLOAD DATA ──
(function () {
  const releaseSelect = document.getElementById('dlReleaseYear');
  const releaseLink = document.getElementById('dlManifestLink');
  const baseUrl = 'https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/tree/main/data/releases';
  function updateReleaseLink() {
    const year = releaseSelect.value;
    releaseLink.href = year ? baseUrl + '/' + year : baseUrl;
    releaseLink.textContent = year ? 'Open ' + year + ' manifest release' : 'Open all manifest releases (2016-2024)';
  }
  releaseSelect.addEventListener('change', updateReleaseLink);
  updateReleaseLink();
})();

// derive fields are computed (not a raw DATA property) — mainly the coverage-flag columns,
// so the exported data is self-documenting about what's real vs. a survey/reporting gap even
// when opened outside this dashboard, with no dots or hatching to explain it.
function yoyPct(d, keyLater, keyEarlier) {
  const cur = d[keyLater], prev = d[keyEarlier];
  if (cur == null || prev == null || prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

const FIELDS = [
  { key: 'district', label: 'District' },
  { key: 'areaSqKm', label: 'Area (km²)', numeric: true },
  { key: 'theft2022', label: 'Theft (2022)', numeric: true },
  { key: 'theft', label: 'Theft (2023)', numeric: true },
  { key: 'theft2024', label: 'Theft (2024)', numeric: true },
  { key: 'theftYoy', label: 'Theft % change 2022→2024', numeric: true, derive: d => yoyPct(d, 'theft2024', 'theft2022') },
  { key: 'robbery2022', label: 'Robbery (2022)', numeric: true },
  { key: 'robbery', label: 'Robbery (2023)', numeric: true },
  { key: 'robbery2024', label: 'Robbery (2024)', numeric: true },
  { key: 'robberyYoy', label: 'Robbery % change 2022→2024', numeric: true, derive: d => yoyPct(d, 'robbery2024', 'robbery2022') },
  { key: 'burglary2022', label: 'Burglary (2022)', numeric: true },
  { key: 'burglary', label: 'Burglary (2023)', numeric: true },
  { key: 'burglary2024', label: 'Burglary (2024)', numeric: true },
  { key: 'burglaryYoy', label: 'Burglary % change 2022→2024', numeric: true, derive: d => yoyPct(d, 'burglary2024', 'burglary2022') },
  { key: 'totalIPC2022', label: 'Total IPC crime (2022)', numeric: true },
  { key: 'totalIPC', label: 'Total IPC crime (2023)', numeric: true },
  { key: 'totalIPC2024', label: 'Total IPC crime (2024)', numeric: true },
  { key: 'totalIPCYoy', label: 'Total IPC % change 2022→2024', numeric: true, derive: d => yoyPct(d, 'totalIPC2024', 'totalIPC2022') },
  { key: 'crimeAgainstWomen2022', label: 'Crime against women (2022)', numeric: true },
  { key: 'crimeAgainstWomen', label: 'Crime against women (2023)', numeric: true },
  { key: 'crimeAgainstWomen2024', label: 'Crime against women (2024)', numeric: true },
  { key: 'crimeAgainstWomenYoy', label: 'Crime against women % change 2022→2024', numeric: true, derive: d => yoyPct(d, 'crimeAgainstWomen2024', 'crimeAgainstWomen2022') },
  { key: 'totalSLL2022', label: 'SLL crime (2022)', numeric: true },
  { key: 'totalSLL', label: 'SLL crime (2023)', numeric: true },
  { key: 'totalSLL2024', label: 'SLL crime (2024)', numeric: true },
  { key: 'totalSLLYoy', label: 'SLL crime % change 2022→2024', numeric: true, derive: d => yoyPct(d, 'totalSLL2024', 'totalSLL2022') },
  { key: 'fatalRoadCrashes2022', label: 'Fatal road crashes (2022)', numeric: true },
  { key: 'hitAndRunCrashes2022', label: 'Hit-and-run crashes (2022)', numeric: true },
  { key: 'roadSafetyCoverage', label: 'Road-safety data coverage',
    derive: d => d.fatalRoadCrashes2022 != null ? 'Reported' : 'Not in Traffic Police’s 11-district scheme' },
  { key: 'crashProneZones2023', label: 'Crash-prone zones (2023)', numeric: true },
  { key: 'simpleCrashes2023', label: 'Simple (non-fatal) crashes (2023)', numeric: true },
  { key: 'fatalCrashes2023', label: 'Fatal crashes (2023)', numeric: true },
  { key: 'totalCrashes2023', label: 'Total crashes (2023)', numeric: true },
  { key: 'surveyPoints', label: 'Streetlight survey points', numeric: true },
  { key: 'totalLights', label: 'Streetlights (count)', numeric: true },
  { key: 'lightDensityPerKm2', label: 'Streetlight density (per km²)', numeric: true },
  { key: 'streetlightCoverage', label: 'Streetlight data coverage',
    derive: d => d.surveyPoints >= 10 ? 'Surveyed' : d.surveyPoints > 0 ? 'Sparse (<10 pts) — do not trust' : 'Not surveyed (PAPL gap)' },
  { key: 'underpasses', label: 'Underpasses (count)', numeric: true },
  { key: 'pedestrianOverpasses', label: 'Mapped pedestrian overbridges (count)', numeric: true },
  { key: 'pedestrianOverpassDensity', label: 'Mapped pedestrian overbridge density (per km²)', numeric: true },
  { key: 'underpassDensity', label: 'Underpass density (per km²)', numeric: true },
  { key: 'underpassCoverage', label: 'Underpass data coverage',
    derive: d => d.surveyPoints >= 10 ? 'Surveyed' : d.surveyPoints > 0 ? 'Sparse (<10 pts) — do not trust' : 'Not surveyed (PAPL gap)' },
  { key: 'metroGates', label: 'Metro gates (count)', numeric: true },
  { key: 'metroGateDensity', label: 'Metro gate density (per km²)', numeric: true },
  { key: 'policeStations', label: 'Police stations (count)', numeric: true },
  { key: 'chowkiPosts', label: 'Chowkis/outposts (count)', numeric: true },
  { key: 'policeInfraCount', label: 'Police Infra combined (count)', numeric: true },
  { key: 'policeInfraDensity', label: 'Police Infra density (per km²)', numeric: true },
  { key: 'policeInfraCoverage', label: 'Police Infra data coverage',
    derive: d => d.chowkiPosts > 0 ? 'Complete (stations + chowkis)' : 'Undercount (chowkis unmapped here)' },
  { key: 'busStops', label: 'Bus stops (count)', numeric: true },
  { key: 'busStopDensity', label: 'Bus stop density (per km²)', numeric: true },
  { key: 'atms', label: 'ATMs (count)', numeric: true },
  { key: 'atmDensity', label: 'ATM density (per km²)', numeric: true },
  { key: 'alcoholShops', label: 'Liquor shops (count)', numeric: true },
  { key: 'alcoholShopDensity', label: 'Liquor shop density (per km²)', numeric: true },
  { key: 'surveillanceCameras', label: 'CCTV & guards (count)', numeric: true },
  { key: 'surveillanceDensity', label: 'CCTV & guard density (per km²)', numeric: true },
];
function fieldValue(d, key) {
  const f = FIELDS.find(x => x.key === key);
  return f.derive ? f.derive(d) : d[key];
}
let selectedFields = FIELDS.map(f => f.key);

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(headers, rows) {
  return [headers.map(csvEscape).join(',')].concat(rows.map(r => r.map(csvEscape).join(','))).join('\\r\\n');
}
function triggerDownload(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderDownloadFields() {
  const availEl = document.getElementById('dlAvailable');
  const selEl = document.getElementById('dlSelected');
  const available = FIELDS.filter(f => !selectedFields.includes(f.key));

  availEl.innerHTML = available.map(f =>
    '<div class="dl-item"><span class="dl-item-label">' + f.label + '</span><button data-add="' + f.key + '">+ Add</button></div>'
  ).join('') || '<div class="dl-item" style="opacity:.5;">All fields selected</div>';

  selEl.innerHTML = selectedFields.map((key, i) => {
    const f = FIELDS.find(x => x.key === key);
    return '<div class="dl-item"><span class="dl-item-label">' + (i+1) + '. ' + f.label + '</span>' +
      '<button data-up="' + key + '"' + (i===0?' disabled':'') + '>↑</button>' +
      '<button data-down="' + key + '"' + (i===selectedFields.length-1?' disabled':'') + '>↓</button>' +
      '<button data-remove="' + key + '">✕</button></div>';
  }).join('') || '<div class="dl-item" style="opacity:.5;">No fields selected</div>';

  availEl.querySelectorAll('[data-add]').forEach(btn => btn.addEventListener('click', () => {
    selectedFields.push(btn.dataset.add); renderDownloadFields();
  }));
  selEl.querySelectorAll('[data-remove]').forEach(btn => btn.addEventListener('click', () => {
    selectedFields = selectedFields.filter(k => k !== btn.dataset.remove); renderDownloadFields();
  }));
  selEl.querySelectorAll('[data-up]').forEach(btn => btn.addEventListener('click', () => {
    const i = selectedFields.indexOf(btn.dataset.up);
    if (i > 0) { [selectedFields[i-1], selectedFields[i]] = [selectedFields[i], selectedFields[i-1]]; renderDownloadFields(); }
  }));
  selEl.querySelectorAll('[data-down]').forEach(btn => btn.addEventListener('click', () => {
    const i = selectedFields.indexOf(btn.dataset.down);
    if (i < selectedFields.length - 1) { [selectedFields[i+1], selectedFields[i]] = [selectedFields[i], selectedFields[i+1]]; renderDownloadFields(); }
  }));

  document.getElementById('dlAllDownload').disabled = selectedFields.length === 0;
}

document.getElementById('dlResetOrder').addEventListener('click', () => {
  selectedFields = FIELDS.map(f => f.key);
  renderDownloadFields();
});
document.getElementById('dlAllDownload').addEventListener('click', () => {
  if (!selectedFields.length) return;
  const headers = selectedFields.map(k => FIELDS.find(f => f.key === k).label);
  const rows = DATA.map(d => selectedFields.map(k => fieldValue(d, k)));
  triggerDownload('gaitway_delhi_district_data.csv', toCSV(headers, rows));
});

document.getElementById('dlHistoryDownload').addEventListener('click', () => {
  if (!isHistoryView()) return;
  const out = histExport(activeYear);
  triggerDownload('gaitway_delhi_historical_counts_' + activeYear + '.csv', toCSV(out.headers, out.rows));
});

document.getElementById('dlCorrDownload').addEventListener('click', () => {
  if (isHistoryView()) return;
  const headers = ['Infrastructure type', 'Crime/road-safety metric', 'Metric year', 'Pearson r', 'Districts included (n)', 'Coverage note'];
  const rows = [];
  INFRA.forEach(inf => {
    METRICS.forEach(m => {
      const covered = DATA.filter(d => infraCovered(d, inf.key) && metricRawValue(d, m) != null);
      const xs = covered.map(d => d[inf.densityKey]);
      const ys = covered.map(d => metricRawValue(d, m) / d.areaSqKm);
      const r = covered.length >= 2 ? pearson(xs, ys) : null;
      const note = covered.length + ' of 15 districts had usable data for both this infrastructure type and this metric.';
      rows.push([inf.label, m.label, m.year, r == null ? '' : r.toFixed(4), covered.length, note]);
    });
  });
  triggerDownload('gaitway_delhi_correlation_matrix.csv', toCSV(headers, rows));
});

document.getElementById('dlTrendsDownload').addEventListener('click', () => {
  const headers = ['Year', 'Road Crashes', 'Road Crash Fatalities', 'Fatal Road Crashes'];
  const rows = TRENDS.map(t => [t.year, t.crashes, t.fatalities, t.fatalCrashes]);
  triggerDownload('gaitway_delhi_road_safety_trends_' + TRENDS[0].year + '_' + TRENDS[TRENDS.length - 1].year + '.csv', toCSV(headers, rows));
});

document.getElementById('dlVictimsDownload').addEventListener('click', () => {
  const headers = ['Year','Pedestrian Killed','Pedestrian Injured','Cyclists Killed','Cyclists Injured','Car Occupants Killed','Car Occupants Injured','Scooter/Motorcycle Riders Killed','Scooter/Motorcycle Riders Injured','Bus Passengers Killed','Bus Passengers Injured','Slow Moving Vehicles Killed','Slow Moving Vehicles Injured','Animal Driven Vehicles Killed','Animal Driven Vehicles Injured','Other Killed','Other Injured','Total Killed','Total Injured'];
  const rows = VICTIMS.map(v => [v.year, v.pedestrianKilled, v.pedestrianInjured, v.cyclistKilled, v.cyclistInjured, v.carKilled, v.carInjured, v.twoWheelerKilled, v.twoWheelerInjured, v.busPassengerKilled, v.busPassengerInjured, v.slowMovingKilled, v.slowMovingInjured, v.animalDrivenKilled, v.animalDrivenInjured, v.otherKilled, v.otherInjured, v.totalKilled, v.totalInjured]);
  triggerDownload('gaitway_delhi_road_deaths_by_mode_2019_2024.csv', toCSV(headers, rows));
});

document.getElementById('dlZonesDownload').addEventListener('click', () => {
  const headers = ['Rank (fatal descending)', 'Crash-Prone Zone', 'Road Name', 'Simple Crashes', 'Fatal Crashes', 'Total Crashes'];
  const rows = ACCIDENT_ZONES.map(z => [z.rank, z.name, z.road, z.simple, z.fatal, z.total]);
  triggerDownload('gaitway_delhi_crash_prone_zones_2023.csv', toCSV(headers, rows));
});

document.getElementById('dlZones2024Download').addEventListener('click', () => {
  const headers = ['Rank (fatal descending)', 'Crash-Prone Zone', 'Road Name', 'Simple Crashes', 'Fatal Crashes', 'Total Crashes', 'Coordinate Resolved'];
  const rows = ACCIDENT_ZONES_2024.map(z => [z.rank, z.name, z.road, z.simple, z.fatal, z.total, z.lat != null ? 'yes' : 'no']);
  triggerDownload('gaitway_delhi_crash_prone_zones_2024.csv', toCSV(headers, rows));
});

document.getElementById('dlRoadsDownload').addEventListener('click', () => {
  const headers = ['Road Name', 'Zones \\'23', 'Simple \\'23', 'Fatal \\'23', 'Total \\'23', 'Zones \\'24', 'Simple \\'24', 'Fatal \\'24', 'Total \\'24'];
  const r23 = Object.fromEntries(ROAD_EXTRA.roadSummary['2023'].map(r => [r.road, r]));
  const r24 = Object.fromEntries(ROAD_EXTRA.roadSummary['2024'].map(r => [r.road, r]));
  const allRoads = [...new Set([...Object.keys(r23), ...Object.keys(r24)])].sort();
  const rows = allRoads.map(road => {
    const a = r23[road], b = r24[road];
    return [road, a ? a.zones : '', a ? a.simple : '', a ? a.fatal : '', a ? a.total : '', b ? b.zones : '', b ? b.simple : '', b ? b.fatal : '', b ? b.total : ''];
  });
  triggerDownload('gaitway_delhi_top_crash_roads_2023_2024.csv', toCSV(headers, rows));
});

function updateVersusLabel() {
  const inf = INFRA.find(i => i.key === scatterType);
  const m = METRICS.find(x => x.key === scatterYMetric);
  document.getElementById('dlVersusLabel').textContent = inf.label + ' density vs. ' + m.short + ' density';
}
document.getElementById('dlVersusDownload').addEventListener('click', () => {
  if (isHistoryView()) return;
  const inf = INFRA.find(i => i.key === scatterType);
  const m = METRICS.find(x => x.key === scatterYMetric);
  const headers = ['District', inf.label + ' density (per km²)', m.label + ' density (per km²)', inf.label + ' (count)', m.label + ' (raw count)'];
  const rows = DATA.filter(d => infraCovered(d, inf.key) && metricRawValue(d, m) != null)
    .map(d => [d.district, d[inf.densityKey], Math.round((metricRawValue(d, m)/d.areaSqKm)*100)/100, d[inf.countKey], metricRawValue(d, m)]);
  triggerDownload('gaitway_delhi_' + inf.key + '_vs_' + m.key + '.csv', toCSV(headers, rows));
});

// ── EXCEL WORKBOOK (SpreadsheetML — plain XML, opens natively in Excel, no ZIP/library needed) ──
function xmlEscape(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function xlCell(v, isNumeric) {
  if (v == null || v === '') return '<Cell></Cell>';
  if (isNumeric && typeof v === 'number' && isFinite(v)) return '<Cell><Data ss:Type="Number">' + v + '</Data></Cell>';
  return '<Cell><Data ss:Type="String">' + xmlEscape(v) + '</Data></Cell>';
}
function xlHeaderCell(v) {
  return '<Cell ss:StyleID="hdr"><Data ss:Type="String">' + xmlEscape(v) + '</Data></Cell>';
}
function xlRow(cellsXml) { return '<Row>' + cellsXml.join('') + '</Row>'; }
function xlSheet(name, headerCells, dataRows, numericFlags) {
  const rows = [xlRow(headerCells.map(xlHeaderCell))];
  dataRows.forEach(r => rows.push(xlRow(r.map((v,i) => xlCell(v, numericFlags && numericFlags[i])))));
  return '<Worksheet ss:Name="' + xmlEscape(name) + '"><Table>' + rows.join('') + '</Table></Worksheet>';
}

function buildDataSheet() {
  const headers = FIELDS.map(f => f.label);
  const numericFlags = FIELDS.map(f => !!f.numeric);
  const rows = DATA.map(d => FIELDS.map(f => fieldValue(d, f.key)));
  return xlSheet('Data', headers, rows, numericFlags);
}

function buildCorrelationSheet() {
  const headers = ['Infrastructure type', 'Crime/road-safety metric', 'Metric year', 'Pearson r', 'Districts included (n)', 'Coverage note'];
  const rows = [];
  INFRA.forEach(inf => {
    METRICS.forEach(m => {
      const covered = DATA.filter(d => infraCovered(d, inf.key) && metricRawValue(d, m) != null);
      const xs = covered.map(d => d[inf.densityKey]);
      const ys = covered.map(d => metricRawValue(d, m) / d.areaSqKm);
      const r = covered.length >= 2 ? Math.round(pearson(xs, ys) * 10000) / 10000 : null;
      rows.push([inf.label, m.label, m.year, r, covered.length, covered.length + ' of 15 districts had usable data for both.']);
    });
  });
  return xlSheet('Correlation Matrix', headers, rows, [false,false,false,true,true,false]);
}

function buildVersusSheet() {
  const inf = INFRA.find(i => i.key === scatterType);
  const m = METRICS.find(x => x.key === scatterYMetric);
  const headers = ['District', inf.label + ' density (per km²)', m.label + ' density (per km²)', inf.label + ' (count)', m.label + ' (raw count)'];
  const rows = DATA.filter(d => infraCovered(d, inf.key) && metricRawValue(d, m) != null)
    .map(d => [d.district, d[inf.densityKey], Math.round((metricRawValue(d, m)/d.areaSqKm)*100)/100, d[inf.countKey], metricRawValue(d, m)]);
  return xlSheet('Current Comparison (' + inf.label + ' vs ' + m.label + ')', headers, rows, [false,true,true,true,true]);
}

function buildDictionarySheet() {
  const headers = ['Column name', 'Unit', 'Source dataset', 'Description'];
  const SRC = {
    theft: 'NCRB, Crime in India — District Wise Reports, 2023', theft2022: 'NCRB, Crime in India — District Wise Reports, 2022', theft2024: 'NCRB, Crime in India — District Wise Reports, 2024',
    robbery: 'NCRB, Crime in India — District Wise Reports, 2023', robbery2022: 'NCRB, Crime in India — District Wise Reports, 2022', robbery2024: 'NCRB, Crime in India — District Wise Reports, 2024',
    burglary: 'NCRB, Crime in India — District Wise Reports, 2023', burglary2022: 'NCRB, Crime in India — District Wise Reports, 2022', burglary2024: 'NCRB, Crime in India — District Wise Reports, 2024',
    totalIPC: 'NCRB, Crime in India — District Wise Reports, 2023', totalIPC2022: 'NCRB, Crime in India — District Wise Reports, 2022', totalIPC2024: 'NCRB, Crime in India — District Wise Reports, 2024',
    crimeAgainstWomen: 'NCRB, Crime in India — District Wise Reports, 2023', crimeAgainstWomen2022: 'NCRB, Crime in India — District Wise Reports, 2022', crimeAgainstWomen2024: 'NCRB, Crime in India — District Wise Reports, 2024',
    totalSLL: 'NCRB, Crime in India — District Wise Reports, 2023', totalSLL2022: 'NCRB, Crime in India — District Wise Reports, 2022', totalSLL2024: 'NCRB, Crime in India — District Wise Reports, 2024',
    theftYoy: 'Derived — % change, 2022→2024 rows above', robberyYoy: 'Derived — % change, 2022→2024 rows above',
    burglaryYoy: 'Derived — % change, 2022→2024 rows above', totalIPCYoy: 'Derived — % change, 2022→2024 rows above',
    crimeAgainstWomenYoy: 'Derived — % change, 2022→2024 rows above', totalSLLYoy: 'Derived — % change, 2022→2024 rows above',
    fatalRoadCrashes2022: 'Delhi Traffic Police, 2022 Delhi Road Crash Fatalities Report', hitAndRunCrashes2022: 'Delhi Traffic Police, 2022 Delhi Road Crash Fatalities Report',
    crashProneZones2023: 'Delhi Road Crash Report 2023, Table 6.31', simpleCrashes2023: 'Delhi Road Crash Report 2023, Table 6.31',
    fatalCrashes2023: 'Delhi Road Crash Report 2023, Table 6.31', totalCrashes2023: 'Delhi Road Crash Report 2023, Table 6.31',
    surveyPoints: 'PAPL streetlight survey', totalLights: 'PAPL streetlight survey', lightDensityPerKm2: 'PAPL streetlight survey (derived)',
    underpasses: 'PAPL underpass survey', underpassDensity: 'PAPL underpass survey (derived)', pedestrianOverpasses: 'OpenStreetMap Overpass snapshot 2026-08-04', pedestrianOverpassDensity: 'OpenStreetMap Overpass snapshot (derived)',
    metroGates: 'OpenStreetMap', metroGateDensity: 'OpenStreetMap (derived)',
    policeStations: 'Delhi Police GSDL', chowkiPosts: 'OpenStreetMap', policeInfraCount: 'GSDL + OpenStreetMap (combined)', policeInfraDensity: 'GSDL + OpenStreetMap (derived)',
    busStops: 'OpenStreetMap', busStopDensity: 'OpenStreetMap (derived)', atms: 'OpenStreetMap (Overpass API)', atmDensity: 'OpenStreetMap (derived)',
    alcoholShops: 'OpenStreetMap (Overpass API)', alcoholShopDensity: 'OpenStreetMap (derived)', surveillanceCameras: 'OpenStreetMap (Overpass API)', surveillanceDensity: 'OpenStreetMap (derived)',
  };
  const DESC = {
    district: 'One of Delhi Police’s 15 law-and-order districts (IGI Airport excluded — separate jurisdiction).',
    areaSqKm: 'District area in square kilometres, from the GSDL boundary polygon.',
    theftYoy: 'Theft, 2022→2024 percent change: (2024 − 2022) ÷ 2022 × 100. Note the 2024 IPC table uses new BNS section numbering alongside the old IPC sections.',
    robberyYoy: 'Robbery, 2022→2024 percent change.',
    burglaryYoy: 'Burglary, 2022→2024 percent change.',
    totalIPCYoy: 'Total IPC crime, 2022→2024 percent change.',
    crimeAgainstWomenYoy: 'Crime against women, 2022→2024 percent change.',
    totalSLLYoy: 'SLL crime, 2022→2024 percent change.',
    lightDensityPerKm2: 'Total surveyed streetlights ÷ district area.',
    underpassDensity: 'Total surveyed underpasses ÷ district area.',
    metroGateDensity: 'Total metro entrance gates ÷ district area.',
    policeInfraCount: 'Official police stations + OpenStreetMap-mapped chowkis/outposts/booths.',
    policeInfraDensity: 'policeInfraCount ÷ district area.',
    roadSafetyCoverage: 'Whether Delhi Traffic Police’s 2022 report has a separate entry for this district.',
    streetlightCoverage: 'Whether the PAPL survey vehicle actually drove through this district.',
    underpassCoverage: 'Same survey as streetlights — identical coverage gap.',
    policeInfraCoverage: 'Whether both component sources (stations + chowkis) have real data here.',
  };
  const rows = FIELDS.map(f => [
    f.label,
    f.numeric ? (f.key.includes('Density') ? 'per km²' : f.key.endsWith('Yoy') ? '%' : 'count') : (f.derive ? 'category' : 'name'),
    SRC[f.key] || (f.derive ? 'Derived from coverage rules below' : '—'),
    DESC[f.key] || 'See Sources & Methodology sheet.',
  ]);
  return xlSheet('Data Dictionary', headers, rows, [false,false,false,false]);
}

function buildSourcesSheet() {
  const headers = ['Category', 'Source', 'URL / Access', 'Coverage & notes'];
  const rows = [
    ['Theft, Robbery, Burglary, Total IPC crime (2024)', 'National Crime Records Bureau (NCRB), Crime in India 2024 — Districtwise IPC Crimes', 'https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx', 'All 15 districts. 2024 table uses new BNS section numbering alongside the retained IPC section references.'],
    ['Theft, Robbery, Burglary, Total IPC crime (2023)', 'National Crime Records Bureau (NCRB), Crime in India 2023 — Districtwise IPC Crimes', 'https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx', 'All 15 districts. NCRB Additional Table, District Wise Reports category.'],
    ['Theft, Robbery, Burglary, Total IPC crime (2022)', 'National Crime Records Bureau (NCRB), Crime in India 2022 — Districtwise IPC Crimes', 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx', 'All 15 districts. Same table structure as the 2023/2024 files — this is what the three-year comparison is built from.'],
    ['Crime against women (2024)', 'NCRB, Crime in India 2024 — Districtwise Crime against Women', 'https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx', 'All 15 districts.'],
    ['Crime against women (2023)', 'NCRB, Crime in India 2023 — Districtwise Crime against Women', 'https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx', 'All 15 districts.'],
    ['Crime against women (2022)', 'NCRB, Crime in India 2022 — Districtwise Crime against Women', 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx', 'All 15 districts.'],
    ['SLL crimes (2024)', 'NCRB, Crime in India 2024 — Districtwise SLL (Special & Local Laws) Crimes', 'https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx', 'All 15 districts.'],
    ['SLL crimes (2023)', 'NCRB, Crime in India 2023 — Districtwise SLL (Special & Local Laws) Crimes', 'https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx', 'All 15 districts.'],
    ['SLL crimes (2022)', 'NCRB, Crime in India 2022 — Districtwise SLL (Special & Local Laws) Crimes', 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx', 'All 15 districts.'],
    ['Fatal road crashes, hit-and-run', 'Delhi Traffic Police / Transport Department GNCTD, 2022 Delhi Road Crash Fatalities Report', 'https://transport.delhi.gov.in/sites/default/files/2024-09/2022_delhi_road_crash_fatalities_report_1.pdf', '11 of 15 districts — Traffic Police uses its own 11-district reporting geography, not the 15 Delhi Police districts. Outer, Outer North, Rohini, South-West have no separate entry.'],
    ['Citywide road crashes/fatalities, 2011-2024', 'Delhi Traffic Police annual road crash data', 'https://traffic.delhipolice.gov.in/statistics', 'Not broken down by district, so not merged into the per-district metrics above. Used only in the standalone "Citywide road safety trends" chart.'],
    ['Road deaths by mode of travel, 2019-2023', 'Delhi Traffic Police annual road crash data', 'No single public URL — citywide totals, not district-level', 'Pedestrian, cyclist, car occupant, two-wheeler rider, bus passenger, slow-moving/animal-driven, and other categories. Citywide only, same caveat as above.'],
    ['Crash-prone zones, fatal/simple/total crash counts (2023)', 'Delhi Traffic Police, Delhi Road Crash Report 2023 — Table 6.29', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2023', '107 zones with real 2023 crash counts (not just names). Cross-validated: the sum of per-district crash-prone-zone counts (Table 6.31) equals exactly 107, matching this table.'],
    ['District-wise crash-prone zones and crashes (2023)', 'Delhi Traffic Police, Delhi Road Crash Report 2023 — Table 6.31', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2023', 'All 15 Delhi Police districts — this table uses the same 15-district geography as the rest of this page, unlike the 2022 report above which only covers 11.'],
    ['Crash-prone zone map coordinates', 'Latitude/longitude for the 107 named zones above', 'Provided coordinate set, cross-validated programmatically against the source table (rank and fatal-crash count matched exactly for all 107, zero mismatches) and spot-checked against known Delhi landmarks', '105 of 107 fall inside one of the 15 district polygons and are plotted on the map, sized/shaded by fatal crash count. The remaining 2 (Surya Nagar Red Light, Seelampur T Point) sit just outside every simplified district boundary and are listed by name with their real severity numbers rather than force-placed.'],
    ['2024 crash-prone zones, per-zone breakdown & coordinates (interactive map only)', 'Delhi Road Crash Report 2024, plus a user-supplied structured extract of Tables 6.29/6.31/6.37 with per-zone pedestrian/two-wheeler/HTV/hit-and-run/day-night breakdowns', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2024', 'The 2024 report names only 88 of its stated 111 crash-prone zones in its visible table (93 unique locations across all sub-tables); of those, 54 (58%) resolved to real coordinates — 42 by matching the same location name in the already-verified 2023 geocoded set, 12 fresh via OSM Nominatim. The remaining 39 are hyper-local names (e.g. informal landmarks, "X More") that a geocoder can\\'t resolve on free text alone; kept as unresolved (no coordinates) rather than force-placed. Available as a year toggle on the interactive map\\'s crash-zone layer, not on this page\\'s SVG map.'],
    ['CCTV priority-candidate sites (interactive map only)', 'Delhi Road Crash Report 2023 & 2024, Table 6.37 — hit-and-run crash-prone zones the report recommends for CCTV installation', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2024', 'Explicitly a recommendation list, not a verified existing-camera inventory — labeled as such in every popup. Shares coordinates with the crash-zone geocoding above, so only locations that resolved to real coordinates (a subset of 22 for 2023 and 32 for 2024, deduplicated) appear on the map.'],
    ['Persons killed/injured, top crash-prone roads, enforcement stats (2023-2024)', 'Delhi Road Crash Report 2023 & 2024 — Table 6.2 (persons killed/injured, full district totals), Table 6.33 (road-level crash-prone-zone rankings), report-level metrics (hit-and-run share, drink-driving prosecutions, RLVD/OSVD cameras, overspeed notices)', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2024', 'Persons killed/injured are full district totals (not limited to crash-prone zones, unlike Fatal/Total Crashes above) — verified by summing all 15 districts and matching the report\\'s citywide total exactly for both years. Road rankings and enforcement stats are citywide/road-level only, not further broken down by district.'],
    ['District center markers', 'Computed from the district boundary polygons already used for the choropleth', 'n/a — derived, not a separate source', 'Geometric centroid of each simplified district polygon, not a specific administrative headquarters address. Labeled "district center" on the map for that reason.'],
    ['Streetlights', 'PAPL streetlight survey', 'https://otd.delhi.gov.in/ — Delhi Transport Stack Open Transit Data, agency=paplilabs', '9 of 15 districts — the survey vehicle only physically drove through part of Delhi. Zero elsewhere means unsurveyed, not unlit.'],
    ['Pedestrian underpasses', 'PAPL underpass survey', 'https://otd.delhi.gov.in/ — Delhi Transport Stack Open Transit Data, same agency', 'Same 9 districts as streetlights — identical survey vehicle, identical gap.'],
    ['Metro station gates', 'OpenStreetMap, railway=subway_entrance tag', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — thorough community mapping citywide.'],
    ['Bus stops', 'OpenStreetMap, highway=bus_stop / public_transport=platform tags (3,199 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — 48 of 3,199 points fell outside every district polygon (likely just across the Delhi border) and are excluded from the district counts.'],
    ['ATMs', 'OpenStreetMap, amenity=atm tag, queried via Overpass API (666 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — 17 of 666 points fell outside every district polygon and are excluded from the district counts.'],
    ['Liquor Shops', 'OpenStreetMap, shop=alcohol / shop=wine / shop=beverages+alcohol tag, queried via Overpass API (65 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — mapped cleanly into district polygons via spatial point-in-polygon.'],
    ['Official licensed liquor vends (citywide total)', 'Delhi State Civil Supplies Corporation (DSCSC) / DCCWS published vend list (374 records)', 'https://dscsc.delhi.gov.in/dscsc/liquor-vends', 'Citywide count only, not district-level — only 1 of 374 official records has a matched map coordinate (13 additional standalone OSM points, already included in the 65-point Liquor Shops layer above, add no new locations). Shown as a single citywide figure in the "no district selected" summary rather than force-distributed across districts.'],
    ['Historical theft, robbery, burglary (2016-2021)', 'NCRB Crime in India, verified extract via India Data Portal', 'https://indiadataportal.com', 'Theft/robbery: 2016-2021 (11 of 15 districts in 2016, 14 of 15 in 2017-2018, all 15 from 2019). Burglary: 2017-2021 only — 2016 uses an incompatible source definition (criminal trespass combined with burglary) and is deliberately omitted rather than shown as a misleadingly comparable number. Year-over-year change is suppressed across any boundary the source data itself flags as not comparable.'],
    ['Historical total IPC, crime against women, SLL crime (2017-2021)', 'NCRB Crime in India, via India Data Portal — summed from each metric’s full district-wise offence-category CSV (no single "total" column exists in the source)', 'https://indiadataportal.com', 'All 15 districts from 2019, 14 of 15 in 2017-2018 (same coverage gap as theft/robbery/burglary). Verified before use: summing every category column for 2022 reproduced the dashboard’s existing official 2022 total exactly for all 15 districts on all three metrics (45/45), then the identical method was applied to 2017-2021. 2016 omitted — its category schema doesn’t match 2017+ and there is no 2016-schema year with a known-correct total to validate summation against. One source record misfiled under Delhi (SLL table, district_code 553, actually Lakshadweep) is excluded automatically by the district-name matcher.'],
    ['CCTV & Guards', 'OpenStreetMap, man_made=surveillance tag, queried via Overpass API (1,596 points, 1,583 within district polygons)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — includes fixed/dome CCTV cameras, ALPR systems, and security guard posts.'],
    ['Police stations', 'Delhi Police GSDL official station location list (224 points)', 'https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac — community mirror of GSDL GIS server export', 'All 15 districts, official and complete.'],
    ['Chowkis, outposts, police booths', 'OpenStreetMap, amenity=police tag (station-named entries excluded to avoid double-counting)', 'https://www.openstreetmap.org/copyright — ODbL license', '14 of 15 districts — no official geocoded chowki dataset exists publicly (confirmed against the same GSDL source as police stations). Outer has zero mapped, almost certainly an under-mapping gap.'],
    ['District boundaries, IGI Airport jurisdiction', 'Delhi Police GSDL (16 units total, including IGI Airport)', 'https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac — community mirror of GSDL GIS server export', 'Boundary polygons simplified to ~165m tolerance for display — not survey-grade.'],
    ['', '', '', ''],
    ['METHODOLOGY', '', '', ''],
['% Change (2022→2024)', '(2024 value − 2022 value) ÷ 2022 value × 100', '', 'Only computed for the 6 crime metrics with a matching NCRB table in all three years. Road-safety figures have no multi-year series (see caveat below) so no change figure is computed for them.'],
    ['Density', 'count ÷ district area (km²)', '', 'Used instead of raw counts so larger districts are not automatically ranked higher just for having more of everything.'],
    ['Rank', 'Position when all 15 districts are sorted by a metric, descending', '', '"1st" = highest value in Delhi for that metric.'],
    ['Percent vs. citywide average', '(district value − mean of all 15) ÷ mean × 100', '', ''],
    ['Correlation (Pearson r)', 'Standard Pearson correlation coefficient', '', 'Computed only across districts with real data for BOTH the infrastructure type and the crime/road-safety metric being compared — districts with a coverage gap on either axis are excluded, not treated as zero.'],
    ['Confidence: High', '', '', 'The infrastructure type has real, complete survey or official mapping for that specific district.'],
    ['Confidence: Partial', '', '', 'The district falls in a known survey/reporting gap, or has fewer than 10 data points (too sparse to trust).'],
    ['', '', '', ''],
    ['CAVEATS', '', '', ''],
    ['Correlation is not causation', '', '', 'Especially for Police Infra: a positive correlation with crime almost certainly reflects reactive resource allocation (stations/posts sited where crime and population already concentrate), not policing failing to prevent crime.'],
    ['Small samples', '', '', 'Streetlight/underpass correlations use only 8-9 districts. Coefficients from this few points carry wide uncertainty — read them as suggestive, not conclusive.'],
    ['Mixed vintage', '', '', 'Crime figures span 2022-2024 (three NCRB annual reports); road-safety figures are 2022 only (the most recent available district-wise report at time of compilation). The 2024 IPC crime table also switched to BNS section numbering (the new criminal code) alongside the old IPC references — treat the 2024 row as the same offence categories, not a break in the series.'],
    ['', '', '', ''],
    ['Compiled for', 'GaitWay walkability project — Delhi Urban Safety Observatory dashboard', '', 'Cite the individual source rows above, not this workbook, in academic or official work.'],
  ];
  return xlSheet('Sources & Methodology', headers, rows, [false,false,false,false]);
}

document.getElementById('dlExcelDownload').addEventListener('click', () => {
  if (isHistoryView()) return;
  const sheets = [
    buildDataSheet(),
    buildCorrelationSheet(),
    buildDictionarySheet(),
    buildSourcesSheet(),
    buildVersusSheet(),
  ].join('');
  const xml = '<?xml version="1.0"?>' +
    '<?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#EDEAE2" ss:Pattern="Solid"/></Style></Styles>' +
    sheets +
    '</Workbook>';
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'gaitway_delhi_safety_index.xml';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

const ROAD_SAFETY_TABS = [
  { key: 'trends', label: 'Trends, ${trendFirstYear}–${trendLastYear}' },
  { key: 'victims', label: 'By Mode of Travel' },
  { key: 'zones', label: 'Crash-Prone Zones (2023)' },
  { key: 'zones2024', label: 'Crash-Prone Zones (2024)' },
  { key: 'enforcement', label: 'Enforcement, 2023-2024' },
  { key: 'roads', label: 'Top Roads, 2023-2024' },
];
let activeRoadSafetyTab = 'trends';
function renderRoadSafetyTabs() {
  document.getElementById('roadSafetyTabs').innerHTML = ROAD_SAFETY_TABS.map(t =>
    '<button class="metric-tab' + (t.key===activeRoadSafetyTab ? ' active' : '') + '" data-key="' + t.key + '" aria-pressed="' + (t.key===activeRoadSafetyTab) + '">' + t.label + '</button>'
  ).join('');
  document.getElementById('rsTrendsPanel').classList.toggle('active', activeRoadSafetyTab === 'trends');
  document.getElementById('rsVictimsPanel').classList.toggle('active', activeRoadSafetyTab === 'victims');
  document.getElementById('rsZonesPanel').classList.toggle('active', activeRoadSafetyTab === 'zones');
  document.getElementById('rsZones2024Panel').classList.toggle('active', activeRoadSafetyTab === 'zones2024');
  document.getElementById('rsEnforcementPanel').classList.toggle('active', activeRoadSafetyTab === 'enforcement');
  document.getElementById('rsRoadsPanel').classList.toggle('active', activeRoadSafetyTab === 'roads');
}

// The correlation, comparison and Excel exports join the selected crime year to today's 15 districts (areas, infrastructure).
// They are not offered while a 2011-2018 year is showing; a separate counts-only export is offered instead.
const DOWNLOAD_TABS = [
  { key: 'all', label: 'All District Data' },
  { key: 'history', label: 'Historical counts (as printed)', historyOnly: true },
  { key: 'corr', label: 'Correlation Matrix', modernOnly: true },
  { key: 'versus', label: 'Current Comparison', modernOnly: true },
  { key: 'excel', label: 'Excel Workbook', modernOnly: true },
];
let activeDownloadTab = 'all';
function syncDownloadPanels() {
  document.getElementById('dlAllPanel').style.display = activeDownloadTab === 'all' ? '' : 'none';
  document.getElementById('dlHistoryPanel').style.display = activeDownloadTab === 'history' ? '' : 'none';
  document.getElementById('dlCorrPanel').style.display = activeDownloadTab === 'corr' ? '' : 'none';
  document.getElementById('dlVersusPanel').style.display = activeDownloadTab === 'versus' ? '' : 'none';
  document.getElementById('dlExcelPanel').style.display = activeDownloadTab === 'excel' ? '' : 'none';
}
function renderDownloadTabs() {
  const hist = isHistoryView();
  const tabs = DOWNLOAD_TABS.filter(t => hist ? !t.modernOnly : !t.historyOnly);
  if (!tabs.some(t => t.key === activeDownloadTab)) activeDownloadTab = 'all';
  document.getElementById('downloadTabs').innerHTML = tabs.map(t =>
    '<button class="metric-tab' + (t.key===activeDownloadTab ? ' active' : '') + '" data-key="' + t.key + '" aria-pressed="' + (t.key===activeDownloadTab) + '">' + t.label + '</button>'
  ).join('');
  document.querySelectorAll('#downloadTabs .metric-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDownloadTab = btn.dataset.key;
      renderDownloadTabs();
    });
  });
  syncDownloadPanels();
}

buildScatterTabs();
renderScatter();
(function () {
  const btn = document.getElementById('themeToggle');
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function sync() { btn.setAttribute('aria-pressed', isDark() ? 'true' : 'false'); btn.title = isDark() ? 'Switch to light theme' : 'Switch to dark theme'; }
  btn.addEventListener('click', () => {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ds-theme', next); } catch (e) {}
    sync();
    render();
    renderRoadSafetyTabs();
  });
  sync();
})();
applyUrlState();
renderOverview();
renderGlossary();
renderContinuityTable();
renderStaticExplainers();
wireRedesign();
wireTabsAndFullscreen();
render();
renderRoadSafetyTabs();
// The first trend render ran while its panel was hidden; draw once it has a width.
renderTrends();
renderDownloadTabs();
renderDownloadFields();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), html);
console.log('Written. Size:', (html.length/1024).toFixed(1), 'KB');
