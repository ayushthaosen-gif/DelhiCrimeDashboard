const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));
const grid = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/streetlight_grid.json'), 'utf8'));
const correlations = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/correlations.json'), 'utf8'));
const policeMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/police_markers.json'), 'utf8'));
const airportShape = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/airport_shape.json'), 'utf8'));
const roadSafetyTrends = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/road_safety_trends.json'), 'utf8'));
const accidentZones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_raw.json'), 'utf8'));
const accidentZonesMapped = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_mapped.json'), 'utf8'));
const font600 = fs.readFileSync(path.join(ROOT, 'fonts/bigshoulders600.woff2')).toString('base64');
const font800 = fs.readFileSync(path.join(ROOT, 'fonts/bigshoulders800.woff2')).toString('base64');

const html = `<title>Delhi District Safety Index — 2023</title>
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
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14181f; --surface: #1c2331; --border: #303a4c;
    --text: var(--bone); --text-dim: #9aa3b2;
    --map-nodata-stripe: #2c3648;
    --shadow: 0 1px 3px rgba(0,0,0,.3), 0 4px 20px rgba(0,0,0,.25);
    --label-fill: #ffffff; --label-stroke: #10131a;
    --good: #7bc492;
  }
}
:root[data-theme="dark"] {
  --bg: #14181f; --surface: #1c2331; --border: #303a4c;
  --text: var(--bone); --text-dim: #9aa3b2;
  --map-nodata-stripe: #2c3648;
  --shadow: 0 1px 3px rgba(0,0,0,.3), 0 4px 20px rgba(0,0,0,.25);
  --label-fill: #ffffff; --label-stroke: #10131a;
  --good: #7bc492;
}
:root[data-theme="light"] {
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
.wrap { max-width: 1280px; margin: 0 auto; padding: 28px 24px 60px; }

header { display: flex; flex-direction: column; gap: 6px; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid var(--border); }
.eyebrow { font-family: 'Big Shoulders', -apple-system, sans-serif; font-size: 13px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--amber-dim); }
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
  display: flex; gap: 10px; align-items: flex-start;
  background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--amber);
  border-radius: 4px; padding: 11px 14px; font-size: 12.5px; color: var(--text-dim); margin-bottom: 22px;
}
.datanote b { color: var(--text); font-weight: 700; }
.datanote ul { margin: 6px 0 0; padding-left: 18px; }
.datanote li { margin-bottom: 3px; }

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
.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }
@media (max-width: 680px) { .compare-grid { grid-template-columns: 1fr; } }
.compare-col { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px; }
.compare-col h3 { font-family: 'Big Shoulders', sans-serif; font-size: 24px; margin: 0 0 10px; color: var(--text); }

.sparkline-wrap { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px; vertical-align: middle; }
.sparkline-svg { width: 70px; height: 22px; overflow: visible; }

.metric-tabs { display: inline-flex; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; padding: 3px; gap: 2px; flex-wrap: wrap; }
.metric-tab { font: inherit; font-size: 12px; font-weight: 600; padding: 7px 12px; border: none; background: transparent; color: var(--text-dim); border-radius: 5px; cursor: pointer; white-space: nowrap; transition: background .12s, color .12s; }
.metric-tab:hover { color: var(--text); }
.metric-tab.active { background: var(--night); color: var(--bone); }

.toggle-row { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 600; color: var(--text-dim); margin-left: auto; cursor: pointer; user-select: none; }
.switch { width: 34px; height: 19px; border-radius: 20px; background: var(--border); position: relative; transition: background .15s; flex-shrink: 0; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: var(--surface); transition: transform .15s; box-shadow: 0 1px 2px rgba(0,0,0,.25); }
.toggle-row.on .switch { background: var(--amber); }
.toggle-row.on .switch::after { transform: translateX(15px); }

.grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr); gap: 20px; align-items: start; }
@media (max-width: 860px) { .grid { grid-template-columns: 1fr; } }

.panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: var(--shadow); }

.map-panel { padding: 14px; }
.map-stage { position: relative; width: 100%; }
.map-stage svg { width: 100%; height: auto; display: block; outline: none; }
.map-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; opacity: 0; transition: opacity .2s; }
.map-stage canvas.on { opacity: .85; }
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
.airport-shape { fill: var(--slate); fill-opacity: .35; stroke: var(--slate); stroke-width: 1.4; stroke-dasharray: 4,3; pointer-events: auto; cursor: help; }
.airport-label { font-family: 'Big Shoulders', sans-serif; font-weight: 700; font-size: 10.5px; fill: var(--label-fill); paint-order: stroke; stroke: var(--label-stroke); stroke-width: 2.5px; stroke-linejoin: round; pointer-events: none; text-anchor: middle; }

.legend { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 11.5px; color: var(--text-dim); flex-wrap: wrap; }
.legend-scale-note { font-size: 10.5px; font-style: italic; opacity: .8; }
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
.rank-row:hover { background: var(--bg); }
.rank-row.selected { background: var(--bg); box-shadow: inset 3px 0 0 var(--amber); }
.rank-num { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace; font-size: 11px; color: var(--text-dim); text-align: right; }
.rank-name { font-weight: 700; font-size: 13px; }
.rank-bar-track { grid-column: 1 / -1; height: 5px; background: var(--bg); border-radius: 3px; overflow: hidden; margin-top: -2px; }
.rank-bar-fill { height: 100%; border-radius: 3px; }
.rank-val { font-family: "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace; font-variant-numeric: tabular-nums; font-size: 12.5px; font-weight: 600; }

.street-view-btn {
  font-family: -apple-system, sans-serif;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--amber);
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
.stat-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 700; display: flex; align-items: center; gap: 5px; }
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
.scatter-stat .label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 700; }
.scatter-stat .val { font-family: "IBM Plex Mono", monospace; font-size: 22px; font-weight: 700; margin-top: 2px; }
.scatter-read { font-size: 11.5px; color: var(--text-dim); line-height: 1.5; }
.zone-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 6px 12px; margin-top: 14px; }
.zone-item { font-size: 12.5px; color: var(--text); padding: 6px 8px; border-radius: 5px; background: var(--surface); border: 1px solid var(--border); display: flex; gap: 8px; align-items: baseline; }
.zone-item .zone-num { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; color: var(--text-dim); flex-shrink: 0; }
.zone-item .zone-name { flex: 1; }
.zone-item .zone-road { color: var(--text-dim); font-size: 11px; }
.zone-item .zone-severity { font-family: "IBM Plex Mono", monospace; font-size: 10.5px; font-weight: 700; color: var(--rust); flex-shrink: 0; white-space: nowrap; }
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
.dl-mini-btn { font: inherit; font-size: 10.5px; font-weight: 700; border: 1px solid var(--border); background: var(--surface); color: var(--text-dim); cursor: pointer; padding: 3px 8px; border-radius: 12px; text-transform: none; letter-spacing: 0; }
.dl-mini-btn:hover { color: var(--text); border-color: var(--text-dim); }
.dl-download-btn { font: inherit; font-size: 13px; font-weight: 700; border: none; background: var(--amber); color: var(--night); cursor: pointer; padding: 10px 18px; border-radius: 7px; transition: background .12s; }
.dl-download-btn:hover { background: var(--amber-dim); }
.dl-download-btn:disabled { opacity: .5; cursor: not-allowed; }
.dl-sheet-list { margin: 0 0 16px; padding-left: 20px; font-size: 12.5px; color: var(--text-dim); line-height: 1.7; }
.dl-sheet-list li { margin-bottom: 3px; }
.dl-sheet-list b { color: var(--text); }

footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11.5px; color: var(--text-dim); display: flex; flex-direction: column; gap: 4px; }
footer a { color: inherit; }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Delhi Police &amp; Traffic Police District Data · 2022–2023</div>
    <h1>Where the lights end,<br>what does the crime data say?</h1>
    <p class="subhead">Official district-level crime and road-safety figures against real public-infrastructure coverage — streetlights, pedestrian underpasses, metro station gates, and full police infrastructure (stations plus chowkis/outposts) — across Delhi's 15 police districts.</p>
  </header>

  <div class="purpose-banner">
    <div class="purpose-text">
      <b class="purpose-title">About the Delhi District Safety Index &amp; Project Rationale</b>
      <p>This interactive dashboard quantifies public safety, crime density, traffic fatality risks, and municipal security infrastructure across Delhi's 15 police jurisdictions. By integrating official <b>NCRB crime reports (2022–2024)</b>, <b>Delhi Traffic Police accident blackspots</b>, and <b>Open Transit municipal surveys</b>, this platform provides citizens, urban planners, and policy researchers with empirical data on safety patterns, infrastructure equity, and urban walkability across the city.</p>
    </div>
  </div>

  <div class="datanote">
    <div>
      <b>Six infrastructure layers, six outcome metrics, several different coverage levels — read the confidence markers.</b>
      <ul>
        <li><b>Streetlights</b> (PAPL survey, ~40k points) and <b>underpasses</b> (PAPL survey, 417 points) share the exact same gap: <b>Dwarka, North-East, North-West, Outer, Outer North and Rohini were never driven through.</b> Zero there means "not surveyed," not "not present."</li>
        <li><b>Metro station gates</b> (OpenStreetMap, 529 points), <b>bus stops</b> (OpenStreetMap, 3,199 points), and <b>ATMs</b> (OpenStreetMap via Overpass API, 666 points) have real, complete coverage across all 15 districts.</li>
        <li><b>Police Infra</b> combines two sources: full <b>police stations</b> (Delhi Police GSDL, official geocoded list, 224 points — complete for all 15 districts) plus <b>chowkis, outposts &amp; booths</b> (OpenStreetMap community mapping, 120 points — no official geocoded chowki dataset exists publicly, confirmed against the same GSDL source). The combined figure is fully trustworthy for 14 of 15 districts; <b>Outer</b> shows 12 real stations but zero mapped chowkis, almost certainly an OSM under-mapping gap, so its combined count is flagged as an undercount.</li>
        <li><b>Road Deaths &amp; Hit-and-Run</b> (Delhi Traffic Police, 2022 Delhi Road Crash Fatalities Report) can be plotted on the map and scatter chart alongside the 2023 crime figures. It's a year older and uses Traffic Police's own <b>11-district reporting geography</b>, not the 15 Delhi Police districts — <b>Outer, Outer North, Rohini and South-West have no separate entry</b> and show hatched on the map, not zero deaths.</li>
        <li><b>Year comparison</b>: the six NCRB crime metrics (theft, robbery, burglary, total IPC, crime against women, SLL crimes) each have a matching figure for <b>2022, 2023 and 2024</b> from the same NCRB district-wise tables. Use the <b>2022 / 2023 / 2024</b> toggle above the map to switch the map, ranked list, and district detail panel to that year — the road-safety metrics have no equivalent multi-year series, so that toggle is hidden when they're selected. Selecting a year shows the percent change from the previous year in the district detail panel (2022 has no earlier year on record, so no change is shown there). The 2024 IPC table also switched to the new BNS section numbering alongside the old IPC references — the offence categories carry over, it's the legal citation that changed.</li>
      </ul>
    </div>
  </div>

  <div class="controls">
    <div class="search-container">
      <div class="search-input-wrap">
        <input type="text" id="districtSearch" class="search-input" placeholder="Search district or police station (e.g. Rohini, Kashmere Gate, Majnu ka Tila, Vasant Kunj)..." autocomplete="off" />
        <button id="searchClear" class="search-clear">✕</button>
      </div>
      <div id="searchDropdown" class="search-dropdown"></div>
    </div>
    <div class="metric-tabs" id="metricTabs"></div>
    <div class="metric-tabs" id="yearToggle"></div>
    <div class="metric-tabs" id="rateToggle"></div>
    <button class="compare-btn" id="compareToggleBtn">Compare Districts</button>
    <div class="toggle-row" id="lightToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show streetlight survey heatmap">
      <span class="switch"></span>
      Show streetlight survey heatmap
    </div>
    <div class="toggle-row" id="policeToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show police markers">
      <span class="switch"></span>
      Show police markers
    </div>
    <div class="toggle-row" id="zonesToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show accident-prone zones">
      <span class="switch"></span>
      Show accident-prone zones
    </div>
    <div class="toggle-row" id="bivariateToggle" role="switch" tabindex="0" aria-checked="false" aria-label="Show bivariate crime and infrastructure map">
      <span class="switch"></span>
      Bivariate map (crime × infrastructure)
    </div>
  </div>
  <div id="compareCard" class="compare-card" style="display:none;"></div>

  <div class="grid">
    <div class="panel map-panel">
      <div class="map-stage">
        <svg id="map" viewBox="${data.viewBox}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map of Delhi's 15 police districts, shaded by the selected crime or road-safety metric"></svg>
        <canvas id="heat" width="1000" height="900"></canvas>
        <div id="mapTooltip" class="map-tooltip"></div>
      </div>
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
            <span id="bivariateYLabel" style="font-size:10.5px;color:var(--text-dim);writing-mode:vertical-rl;transform:rotate(180deg);">Infra →</span>
          </div>
          <span id="bivariateXLabel" style="font-size:10.5px;color:var(--text-dim);">Crime →</span>
          <span class="legend-scale-note">(tertiles — low/med/high thirds of covered districts, not fixed cut points)</span>
        </div>
        <span style="margin-left:auto;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--map-nodata-stripe);"></span>no streetlight/underpass survey</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--slate);opacity:.6;border:1px dashed var(--slate);"></span>IGI Airport (separate jurisdiction)</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#3d5a99;border-radius:50%;"></span>police station</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:#7c3aed;border-radius:50%;"></span>chowki / outpost / post</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:transparent;border:1.6px solid var(--label-fill);border-radius:50%;"></span>district center</span>
          <span style="display:flex;align-items:center;gap:5px;"><span class="legend-swatch" style="background:var(--rust);clip-path:polygon(50% 0%, 100% 100%, 0% 100%);"></span>crash-prone zone, 2023 (size/shade = fatal crashes)</span>
        </span>
      </div>
    </div>

    <div class="panel list-panel">
      <h2>Ranked</h2>
      <div class="list-sub" id="listSub">Districts by theft cases, 2023</div>
      <div id="rankList"></div>
    </div>
  </div>

  <div class="panel detail" id="detail"></div>

  <div class="panel method-panel">
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
      </div>
    </details>
  </div>

  <div class="panel scatter-panel">
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
  </div>

  <div class="panel scatter-panel road-safety-panel">
    <h2>Road safety detail</h2>
    <p class="scatter-sub">The district-level 2023 crash-prone-zone and fatal-crash figures (Delhi Road Crash Report 2023) are already selectable in the map/list above — <b>Crash Zones</b>, <b>Fatal Crashes</b>, <b>Total Crashes</b> tabs, all 15 districts covered. The citywide-only figures below (multi-year trends, victim mode breakdown, and the individual named blackspots) aren't broken down by district in their source, so they're kept here rather than folded into the map where that would misleadingly imply per-district precision they don't have.</p>
    <div class="metric-tabs" id="roadSafetyTabs" style="margin-bottom:16px;"></div>

    <div id="rsTrendsPanel" class="rs-tab-panel">
      <p class="scatter-sub">2014-2023, indexed to 2014 = 100 so three very differently-scaled series (thousands of crashes, hundreds of deaths) can share one axis.</p>
      <div class="scatter-layout">
        <canvas id="trendsCanvas" width="640" height="320"></canvas>
        <div>
          <div class="scatter-stat">
            <div class="label">Road crashes, 2014→2023</div>
            <div class="val" id="trendsCrashesChange"></div>
          </div>
          <div class="scatter-stat">
            <div class="label">Road crash fatalities, 2014→2023</div>
            <div class="val" id="trendsFatalitiesChange"></div>
          </div>
          <div class="scatter-read" id="trendsRead"></div>
        </div>
      </div>
      <button class="dl-download-btn" id="dlTrendsDownload" style="margin-top:14px;">⬇ Download CSV — Citywide Road Safety Trends</button>
    </div>

    <div id="rsVictimsPanel" class="rs-tab-panel">
      <p class="scatter-sub">Who's actually dying on Delhi's roads, 2019-2023 — pedestrians, two-wheeler riders, cyclists, car occupants, bus passengers, or other/slow-moving vehicles. Directly relevant to a walkability index: pedestrians are unprotected road users by definition.</p>
      <div class="scatter-layout">
        <canvas id="victimsCanvas" width="640" height="320"></canvas>
        <div>
          <div class="scatter-stat">
            <div class="label">Pedestrian share of all road deaths, 2023</div>
            <div class="val" id="pedestrianShare"></div>
          </div>
          <div class="scatter-stat">
            <div class="label">Two-wheeler rider share, 2023</div>
            <div class="val" id="twoWheelerShare"></div>
          </div>
          <div class="scatter-read" id="victimsRead"></div>
        </div>
      </div>
      <button class="dl-download-btn" id="dlVictimsDownload" style="margin-top:14px;">⬇ Download CSV — Road Deaths by Mode of Travel</button>
    </div>

    <div id="rsZonesPanel" class="rs-tab-panel">
      <p class="scatter-sub">Delhi Traffic Police's official blackspot list from the <b>Delhi Road Crash Report 2023</b> — 107 identified crash-prone zones, each with its actual 2023 crash counts (not just a name), matched to specific coordinates and cross-checked against every zone's rank and fatal-crash count from the source table (all 107 matched exactly). <b>105 of 107</b> fall inside one of the 15 district polygons and are plotted on the map above — toggle "Show accident-prone zones" to see them, sized and shaded by fatal crash count. The remaining 2 sit just outside every simplified district boundary and are listed here with their real severity numbers instead of being force-placed. Sorted fatal-crashes descending, as in the source report.</p>
      <div class="zone-grid" id="zoneGrid"></div>
      <button class="dl-download-btn" id="dlZonesDownload" style="margin-top:14px;">⬇ Download CSV — Accident-Prone Zones List</button>
    </div>
  </div>

  <div class="panel download-panel">
    <h2>Download the data</h2>
    <p class="method-sub">Every number on this page, exportable for reuse — plain CSV for scripting, or a full Excel workbook with sources, methodology, and a data dictionary included for citation.</p>
    <div class="metric-tabs" id="downloadTabs" style="margin-bottom:16px;"></div>

    <div id="dlAllPanel" class="dl-panel">
      <div class="dl-columns">
        <div class="dl-col">
          <div class="dl-col-head">Available fields</div>
          <div id="dlAvailable" class="dl-list"></div>
        </div>
        <div class="dl-col">
          <div class="dl-col-head">Selected, in export order <button class="dl-mini-btn" id="dlResetOrder">Reset to default</button></div>
          <div id="dlSelected" class="dl-list"></div>
        </div>
      </div>
      <button class="dl-download-btn" id="dlAllDownload">⬇ Download CSV — All District Data</button>
    </div>

    <div id="dlCorrPanel" class="dl-panel" style="display:none;">
      <p class="scatter-read" style="margin-bottom:14px;">Every infrastructure type against every crime/road-safety metric — \${INFRA.length * METRICS.length} combinations, each with its own live-computed r and district count, exactly like the scatter chart above.</p>
      <button class="dl-download-btn" id="dlCorrDownload">⬇ Download CSV — Full Correlation Matrix</button>
    </div>

    <div id="dlVersusPanel" class="dl-panel" style="display:none;">
      <p class="scatter-read" style="margin-bottom:14px;">Whatever's currently plotted in the scatter chart above: <b id="dlVersusLabel"></b>. Change the X/Y selection there and this updates to match.</p>
      <button class="dl-download-btn" id="dlVersusDownload">⬇ Download CSV — Current Comparison</button>
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
      <button class="dl-download-btn" id="dlExcelDownload">⬇ Download Excel Workbook (.xml, 5 sheets)</button>
    </div>
  </div>

  <footer>
    <span><b>Sources:</b> Crime data (2022, 2023 &amp; 2024) — National Crime Records Bureau, Crime in India, District Wise Reports: <a href="https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx" target="_blank" rel="noopener">IPC Crimes 2024</a>, <a href="https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx" target="_blank" rel="noopener">IPC Crimes 2023</a>, <a href="https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx" target="_blank" rel="noopener">IPC Crimes 2022</a>, <a href="https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx" target="_blank" rel="noopener">SLL Crimes 2024</a>, <a href="https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx" target="_blank" rel="noopener">SLL Crimes 2023</a>, <a href="https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx" target="_blank" rel="noopener">SLL Crimes 2022</a>, <a href="https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx" target="_blank" rel="noopener">Crime against Women 2024</a>, <a href="https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx" target="_blank" rel="noopener">Crime against Women 2023</a>, <a href="https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx" target="_blank" rel="noopener">Crime against Women 2022</a> · Fatal road crashes &amp; hit-and-run: <a href="https://transport.delhi.gov.in/sites/default/files/2024-09/2022_delhi_road_crash_fatalities_report_1.pdf" target="_blank" rel="noopener">2022 Delhi Road Crash Fatalities Report</a>, Delhi Traffic Police / Transport Dept. GNCTD · Citywide road crash/fatality trends (2014-2023) and road deaths by mode of travel (2019-2023): Delhi Traffic Police annual road crash data · District-wise crash data and 107 crash-prone zones (2023): <a href="https://traffic.delhipolice.gov.in/delhi-crash-report-2023" target="_blank" rel="noopener">Delhi Road Crash Report 2023</a>, Delhi Traffic Police (all 15 districts, no reporting-geography gap); coordinates for all 107 zones cross-checked against the source table by rank and fatal-crash count, 105 of which fall inside a district polygon and are shown on the map sized by fatal crash count · Streetlight &amp; underpass survey: PAPL, via <a href="https://otd.delhi.gov.in/" target="_blank" rel="noopener">Delhi Transport Stack Open Transit Data</a> · Metro station gates: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (railway=subway_entrance), ODbL · Bus stops: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (highway=bus_stop / public_transport=platform, 3,199 points), ODbL · ATMs: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> (amenity=atm via Overpass API, 666 points), ODbL · Police station locations &amp; district boundaries: Delhi Police GSDL, via <a href="https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac" target="_blank" rel="noopener">community mirror</a>.</span>
    <span>District boundary polygons simplified for display (~165m tolerance) — not survey-grade. IGI Airport unit and non-geographic units (Crime Branch, EOW, Metro, Railway, Vigilance, etc.) excluded from district figures.</span>
  </footer>
</div>

<script>
const DATA = ${JSON.stringify(data.districts)};
const GRID = ${JSON.stringify(grid)};
const CORR = ${JSON.stringify(correlations)};
const POLICE_MARKERS = ${JSON.stringify(policeMarkers)};
const AIRPORT_SHAPE = ${JSON.stringify(airportShape)};
const TRENDS = ${JSON.stringify(roadSafetyTrends.trends)};
const VICTIMS = ${JSON.stringify(roadSafetyTrends.victims)};
const ACCIDENT_ZONES = ${JSON.stringify(accidentZones)};
const ACCIDENT_ZONES_MAPPED = ${JSON.stringify(accidentZonesMapped)};

const METRICS = [
  { key: 'theft', label: 'Theft', short: 'theft', year: '2023', full: 'Theft (Sec. 379 IPC), 2023', prevKey: 'theft2022', prevYear: '2022', key2024: 'theft2024', title: 'Theft (Sec. 379 IPC)', desc: 'Reported vehicle, property, and personal theft offences registered in the district.', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'robbery', label: 'Robbery', short: 'robbery', year: '2023', full: 'Robbery (Sec. 392/394/397 IPC), 2023', prevKey: 'robbery2022', prevYear: '2022', key2024: 'robbery2024', title: 'Robbery (Sec. 392/394/397 IPC)', desc: 'Reported robbery, mugging, and extortion offences involving force or threat.', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'burglary', label: 'Burglary', short: 'burglary', year: '2023', full: 'Burglary (Sec. 454-460 IPC), 2023', prevKey: 'burglary2022', prevYear: '2022', key2024: 'burglary2024', title: 'Burglary (Sec. 454-460 IPC)', desc: 'Residential and commercial housebreaking, house-trespass, and break-ins.', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'totalIPC', label: 'Total IPC', short: 'total IPC crime', year: '2023', full: 'Total Cognizable IPC Crimes, 2023', prevKey: 'totalIPC2022', prevYear: '2022', key2024: 'totalIPC2024', title: 'Total Cognizable IPC Crimes', desc: 'Aggregate count of all major Indian Penal Code crimes registered in the district.', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'crimeAgainstWomen', label: 'Vs. Women', short: 'crime against women', year: '2023', full: 'Total Crime Against Women, 2023', prevKey: 'crimeAgainstWomen2022', prevYear: '2022', key2024: 'crimeAgainstWomen2024', title: 'Crime Against Women', desc: 'Registered cases of assault, harassment, cruelty, and domestic offences against women.', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'totalSLL', label: 'SLL Crimes', short: 'SLL crime', year: '2023', full: 'Total Cognizable SLL Crimes, 2023', prevKey: 'totalSLL2022', prevYear: '2022', key2024: 'totalSLL2024', title: 'Special & Local Laws (SLL) Crimes', desc: 'Offences registered under special acts (Arms Act, NDPS, Excise, Cyber Crimes, etc.).', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'fatalRoadCrashes2022', label: 'Road Deaths', short: 'fatal road crashes', year: '2022', full: 'Fatal Road Crashes, 2022 (Delhi Traffic Police)', gaps: true, title: 'Fatal Road Crashes (2022)', desc: 'Fatal traffic crashes resulting in deaths recorded by Delhi Traffic Police.', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'hitAndRunCrashes2022', label: 'Hit & Run', short: 'hit-and-run fatal crashes', year: '2022', full: 'Hit-and-Run Fatal Crashes, 2022 (Delhi Traffic Police)', gaps: true, title: 'Hit-and-Run Fatal Crashes (2022)', desc: 'Fatal road crashes where the offending vehicle fled the scene without stopping.', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'crashProneZones2023', label: 'Crash Zones', short: 'crash-prone zones', year: '2023', full: 'Crash-Prone Zones, 2023 (Delhi Road Crash Report)', title: 'Identified Crash-Prone Zones (2023)', desc: 'Identified accident blackspots and high-risk traffic corridors.', source: 'Delhi Road Crash Report 2023' },
  { key: 'fatalCrashes2023', label: 'Fatal Crashes', short: 'fatal crashes', year: '2023', full: 'Fatal Crashes, 2023 (Delhi Road Crash Report)', title: 'Fatal Crashes (2023)', desc: 'Total fatal traffic crashes recorded across all 15 police districts in 2023.', source: 'Delhi Road Crash Report 2023' },
  { key: 'totalCrashes2023', label: 'Total Crashes', short: 'total crashes', year: '2023', full: 'Total Crashes, 2023 (Delhi Road Crash Report)', title: 'Total Road Crashes (2023)', desc: 'Aggregate count of all recorded road accidents (fatal + simple injury crashes).', source: 'Delhi Road Crash Report 2023' },
];

const INFRA = [
  { key: 'streetlight', densityKey: 'lightDensityPerKm2', countKey: 'totalLights', label: 'Streetlights', unit: 'streetlights', title: 'Streetlight Density', desc: 'Number of surveyed functioning streetlights per square kilometer of district area.', source: 'PAPL Open Transit Survey' },
  { key: 'underpass', densityKey: 'underpassDensity', countKey: 'underpasses', label: 'Underpasses', unit: 'underpasses', title: 'Pedestrian Underpass Density', desc: 'Number of pedestrian underpasses and subways per square kilometer.', source: 'PAPL Open Transit Survey' },
  { key: 'metroGate', densityKey: 'metroGateDensity', countKey: 'metroGates', label: 'Metro gates', unit: 'metro gates', title: 'Metro Entrance Gate Density', desc: 'Number of Delhi Metro station entrance/exit gates per square kilometer.', source: 'OpenStreetMap' },
  { key: 'policeInfra', densityKey: 'policeInfraDensity', countKey: 'policeInfraCount', label: 'Police Infra', unit: 'police posts', title: 'Police Infrastructure Density', desc: 'Combined police stations, posts, chowkis, and booths per square kilometer.', source: 'Delhi Police GSDL + OpenStreetMap' },
  { key: 'busStop', densityKey: 'busStopDensity', countKey: 'busStops', label: 'Bus Stops', unit: 'bus stops', title: 'Bus Stop Density', desc: 'Number of OpenStreetMap-tagged bus stops per square kilometer.', source: 'OpenStreetMap' },
  { key: 'atm', densityKey: 'atmDensity', countKey: 'atms', label: 'ATMs', unit: 'ATMs', title: 'ATM Density', desc: 'Number of OpenStreetMap-tagged automated teller machines per square kilometer.', source: 'OpenStreetMap (Overpass API)' },
  { key: 'alcoholShop', densityKey: 'alcoholShopDensity', countKey: 'alcoholShops', label: 'Liquor Shops', unit: 'liquor shops', title: 'Liquor & Wine Shop Density', desc: 'Number of OpenStreetMap-tagged liquor vends and wine/beer shops per square kilometer.', source: 'OpenStreetMap (Overpass API)' },
  { key: 'surveillance', densityKey: 'surveillanceDensity', countKey: 'surveillanceCameras', label: 'CCTV & Guards', unit: 'cameras/posts', title: 'Surveillance Camera & Guard Density', desc: 'Number of OpenStreetMap-tagged CCTV cameras, ALPR systems, and security guards per square kilometer.', source: 'OpenStreetMap (Overpass API)' },
];

// Districts the PAPL survey actually drove through — shared gap for streetlights and underpasses.
const SURVEYED = new Set(['Central','East','New Delhi','North','Shahdara','South','South-East','South-West','West']);
function infraCovered(d, infraKey) {
  if (infraKey === 'metroGate' || infraKey === 'busStop' || infraKey === 'atm' || infraKey === 'alcoholShop' || infraKey === 'surveillance') return true;
  if (infraKey === 'policeInfra') return d.chowkiPosts > 0;
  return SURVEYED.has(d.district) && d[infraKey === 'streetlight' ? 'surveyPoints' : 'underpasses'] >= 10;
}

let activeMetric = 'theft';
let activeYear = '2023';
let rateMode = 'density'; // 'density' (per km²) or 'perCapita' (per 100k residents)
let corrCoeffMode = 'pearson'; // 'pearson' (linear) or 'spearman' (rank)
let showLights = false;
let showPolice = false;
let showZones = false;
let isBivariateMode = false;
let selected = null;
let scatterType = 'streetlight';
let scatterYMetric = 'hitAndRunCrashes2022';

function getCorrelationPValue(r, n) {
  if (n <= 2 || Math.abs(r) >= 1) return { p: 0, t: Infinity, df: Math.max(1, n - 2), isSig: true };
  const df = n - 2;
  const t = (Math.abs(r) * Math.sqrt(df)) / Math.sqrt(1 - r * r);
  let p = 0;
  if (df === 13) {
    p = Math.exp(-0.717 * t - 0.416 * t * t);
  } else if (df === 7) {
    p = Math.exp(-0.75 * t - 0.35 * t * t);
  } else {
    p = Math.exp(-0.8 * t);
  }
  p = Math.min(1, Math.max(0, p));
  return { p, t, df, isSig: p < 0.05 };
}

function spearmanRank(xs, ys) {
  const getRanks = (arr) => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < sorted.length) {
      let j = i;
      while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
      const rank = (i + 1 + j) / 2;
      for (let k = i; k < j; k++) ranks[sorted[k].i] = rank;
      i = j;
    }
    return ranks;
  };

  const rx = getRanks(xs);
  const ry = getRanks(ys);
  const n = xs.length;
  if (n <= 1) return 0;
  let sumD2 = 0;
  for (let i = 0; i < n; i++) {
    const d = rx[i] - ry[i];
    sumD2 += d * d;
  }
  return 1 - (6 * sumD2) / (n * (n * n - 1));
}

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

function metricValue(d, m) {
  let val;
  if (!m.prevKey) val = d[m.key];
  else if (activeYear === '2022') val = d[m.prevKey];
  else if (activeYear === '2024') val = d[m.key2024];
  else val = d[m.key];

  return getRateVal(val, d);
}

function yearFieldVal(d, baseKey) {
  const m = METRICS.find(x => x.key === baseKey);
  if (!m || !m.prevKey) return d[baseKey];
  if (activeYear === '2022') return d[m.prevKey];
  if (activeYear === '2024') return d[m.key2024];
  return d[m.key];
}

function yearLabel(m) {
  if (!m.prevKey) return m.full;
  if (activeYear === '2022') return m.full.replace('2023', '2022');
  if (activeYear === '2024') return m.full.replace('2023', '2024');
  return m.full;
}

function yearSuffix(m) {
  if (!m.prevKey) return m.year;
  if (activeYear === '2022') return m.prevYear;
  if (activeYear === '2024') return '2024';
  return m.year;
}

function buildMetricTabs() {
  const el = document.getElementById('metricTabs');
  el.innerHTML = METRICS.map(m =>
    '<button class="metric-tab' + (m.key===activeMetric?' active':'') + '" data-key="' + m.key + '" aria-pressed="' + (m.key===activeMetric) + '"' + tt(m.title, m.desc + ' · Source: ' + m.source) + '>' + m.label + '</button>'
  ).join('');
  el.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => { activeMetric = btn.dataset.key; render(); });
  });
  buildYearToggle();
  buildRateToggle();
}

function buildYearToggle() {
  const el = document.getElementById('yearToggle');
  const m = currentMetric();
  if (!m.prevKey) { el.style.display = 'none'; return; }
  el.style.display = '';
  const opts = [['2022', '2022'], ['2023', '2023'], ['2024', '2024']];
  el.innerHTML = opts.map(([val, label]) => '<button class="metric-tab' + (activeYear===val?' active':'') + '" data-val="' + val + '" aria-pressed="' + (activeYear===val) + '">' + label + '</button>').join('');
  el.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => { activeYear = btn.dataset.val; render(); });
  });
}

function buildRateToggle() {
  const el = document.getElementById('rateToggle');
  if (!el) return;
  const opts = [['density', 'Spatial Density (per km²)'], ['perCapita', 'Per-Capita Rate (per 100k)']];
  el.innerHTML = opts.map(([val, label]) => '<button class="metric-tab' + (rateMode===val?' active':'') + '" data-val="' + val + '" aria-pressed="' + (rateMode===val) + '">' + label + '</button>').join('');
  el.querySelectorAll('.metric-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      rateMode = btn.dataset.val;
      buildRateToggle();
      render();
    });
  });
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
    '<g id="zonesLayer"></g>'
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
  const [lo, hi] = currentDomain();
  const scale = percentileScale(DATA.map(d => metricValue(d, m)).filter(v => v != null));

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
      : ((v == null) || (showLights && !d.surveyPoints));
    path.style.display = showHatch ? 'inline' : 'none';
  });

  const policeLayer = document.getElementById('policeLayer');
  if (policeLayer) policeLayer.style.display = showPolice ? 'inline' : 'none';

  const zonesLayer = document.getElementById('zonesLayer');
  if (zonesLayer) zonesLayer.style.display = showZones ? 'inline' : 'none';

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
    document.getElementById('legendLabel').textContent = yearLabel(m);
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
  const [lo, hi] = currentDomain();
  const scale = percentileScale(DATA.map(d => metricValue(d, m)).filter(v => v != null));
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
  const y22 = d[m.prevKey], y23 = d[m.key], y24 = d[m.key2024];
  if (y22 == null || y23 == null || y24 == null) return '';

  const min = Math.min(y22, y23, y24);
  const max = Math.max(y22, y23, y24);
  const range = (max - min) || 1;

  const py = v => 18 - ((v - min) / range) * 14;
  const p1 = '4,' + py(y22).toFixed(1);
  const p2 = '30,' + py(y23).toFixed(1);
  const p3 = '56,' + py(y24).toFixed(1);

  const pct3Y = ((y24 - y22) / y22) * 100;
  const strokeColor = pct3Y >= 0 ? 'var(--rust)' : 'var(--good)';

  return '<span class="sparkline-wrap" data-tt-title="' + esc(m.label + ' 3-Year Trajectory (2022-2024)') + '" data-tt-body="' + esc('2022: ' + fmtNum(y22) + ' · 2023: ' + fmtNum(y23) + ' · 2024: ' + fmtNum(y24) + ' (' + (pct3Y >= 0 ? '+' : '') + pct3Y.toFixed(1) + '% 3Y change)') + '">' +
    '<svg class="sparkline-svg" viewBox="0 0 60 22">' +
      '<polyline points="' + p1 + ' ' + p2 + ' ' + p3 + '" fill="none" stroke="' + strokeColor + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="4" cy="' + py(y22) + '" r="2.5" fill="' + strokeColor + '"/>' +
      '<circle cx="30" cy="' + py(y23) + '" r="2.5" fill="' + strokeColor + '"/>' +
      '<circle cx="56" cy="' + py(y24) + '" r="2.5" fill="' + strokeColor + '"/>' +
    '</svg>' +
  '</span>';
}

// Maps a crime metric's canonical (unsuffixed, 2023) key to whichever year's field is
// actually being displayed right now, so the detail panel and its narrative can follow
// the same 2022/2023/2024 toggle as the map and ranked list.
function yearField(baseKey, year) {
  const m = METRICS.find(x => x.key === baseKey);
  if (!m || !m.prevKey) return baseKey;
  if (year === '2022') return m.prevKey;
  if (year === '2024') return m.key2024;
  return m.key;
}
function prevYearOf(year) { return year === '2024' ? '2023' : year === '2023' ? '2022' : null; }

function computeAnalysis(d, year) {
  const n = DATA.length;
  const ipcKey = yearField('totalIPC', year), theftKey = yearField('theft', year), cawKey = yearField('crimeAgainstWomen', year);
  const ipcRank = rankOf(d, ipcKey);
  const theftRank = rankOf(d, theftKey);
  const cawRank = rankOf(d, cawKey);
  const theftPct = pctVsCityAvg(d, theftKey);
  const severityWord = ipcRank <= 5 ? 'among the highest-crime districts' : ipcRank >= 11 ? 'among the lower-crime districts' : 'in the middle of the pack';
  const crimeP = d.name + ' ranks <b>' + ordinal(ipcRank) + ' of ' + n + '</b> districts by total IPC crime in <b>' + year + '</b> — ' + severityWord + ' in Delhi, with theft cases ' +
    (theftPct >= 0 ? '<b>' + theftPct + '% above</b>' : '<b>' + Math.abs(theftPct) + '% below</b>') +
    ' the citywide average (' + ordinal(theftRank) + ' highest for theft specifically). It ranks ' + ordinal(cawRank) + ' of ' + n + ' for crime against women.';

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
  if (streetCovered) {
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

function renderDetail() {
  const el = document.getElementById('detail');
  const d = DATA.find(x => x.name === selected) || DATA.find(x => x.name === 'South-East');
  if (!d) { el.innerHTML = ''; return; }
  const detailYear = activeYear;
  const a = computeAnalysis(d, detailYear);
  const prevYear = prevYearOf(detailYear);
  function crimeRow(label, baseKey) {
    const key = yearField(baseKey, detailYear);
    const val = d[key];
    let sub = '';
    if (prevYear) {
      const prevKey = yearField(baseKey, prevYear);
      const prevVal = d[prevKey];
      const badge = yoyBadge(val, prevVal, 'vs ' + prevYear);
      sub = '<span class="stat-sub">' + badge + '</span>';
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
  metroGate: 'OpenStreetMap — all 15 districts',
  policeInfra: 'Stations: Delhi Police GSDL, official — all 15. Chowkis/outposts: OpenStreetMap — 14 of 15 (Outer unmapped)',
  busStop: 'OpenStreetMap (highway=bus_stop / public_transport=platform, 3,199 points) — all 15 districts',
  atm: 'OpenStreetMap (amenity=atm via Overpass API, 666 points) — all 15 districts',
  alcoholShop: 'OpenStreetMap (shop=alcohol via Overpass API, 50 points) — all 15 districts',
  surveillance: 'OpenStreetMap (man_made=surveillance via Overpass API, 433 points) — all 15 districts',
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
        '<div style="font-size:10.5px;color:var(--text-dim);text-transform:uppercase;font-weight:700;">' + (corrCoeffMode === 'spearman' ? 'Spearman ρ' : 'Pearson r') + ' vs. ' + esc(m.label) + ' (' + activeYear + ')</div>' +
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

  const tableHeader = '<thead><tr style="border-bottom:1px solid var(--border);">' +
    '<th style="text-align:left;padding:8px 12px;color:var(--text-dim);">Metric (' + year + ')</th>' +
    infraKeys.map(inf => '<th style="text-align:center;padding:8px 10px;color:var(--text-dim);">' + esc(inf.label) + '</th>').join('') +
  '</tr></thead>';

  const rows = metricKeys.map(m => {
    const yKey = yearField(m.key, year);
    const cells = infraKeys.map(inf => {
      const valid = DATA.filter(d => infraCovered(d, inf.key) && d[yKey] != null);
      const xs = valid.map(d => getInfraVal(d, inf));
      const ys = valid.map(d => getRateVal(d[yKey], d));
      const r = valid.length >= 2 ? pearson(xs, ys) : 0;
      const rho = valid.length >= 2 ? spearmanRank(xs, ys) : 0;
      const val = corrCoeffMode === 'spearman' ? rho : r;
      const pObj = getCorrelationPValue(val, valid.length);

      const bg = val >= 0.4 ? 'rgba(231,76,60,0.18)' : val <= -0.4 ? 'rgba(46,204,113,0.18)' : 'rgba(255,255,255,0.04)';
      const color = val >= 0.4 ? 'var(--rust)' : val <= -0.4 ? 'var(--good)' : 'var(--text)';
      const sigBadge = pObj.isSig ? '<span style="color:var(--amber);margin-left:2px;font-size:11px;">*</span>' : '<span style="color:var(--text-dim);font-size:9px;margin-left:2px;opacity:0.7;">(ns)</span>';

      const ttBody = (corrCoeffMode === 'spearman' ? 'Spearman ρ' : 'Pearson r') + ' = ' + (val >= 0 ? '+' : '') + val.toFixed(3) +
        '<br>' + (corrCoeffMode === 'spearman' ? 'Pearson r' : 'Spearman ρ') + ' = ' + (corrCoeffMode === 'spearman' ? (r>=0?'+':'')+r.toFixed(3) : (rho>=0?'+':'')+rho.toFixed(3)) +
        '<br>t-statistic = ' + pObj.t.toFixed(2) + ', df = ' + pObj.df + ', p-value = ' + pObj.p.toFixed(4) + ' (' + (pObj.isSig ? 'significant p<0.05' : 'not significant p≥0.05') + ')' +
        '<br>Calculation Mode: ' + (rateMode === 'perCapita' ? 'Per-Capita Rate (per 100k)' : 'Spatial Density (per km²)') +
        '<br>Sample n = ' + valid.length + ' covered districts (' + year + ')';

      return '<td style="text-align:center;padding:8px 10px;background:' + bg + ';color:' + color + ';font-weight:700;font-family:monospace;"' + tt(m.label + ' vs ' + inf.label, ttBody) + '>' +
        (val >= 0 ? '+' : '') + val.toFixed(3) + sigBadge +
      '</td>';
    }).join('');

    return '<tr style="border-bottom:1px solid var(--border);">' +
      '<td style="font-weight:700;padding:8px 12px;">' + esc(m.label) + '</td>' +
      cells +
    '</tr>';
  }).join('');

  container.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">' +
      '<h3 style="font-size:20px;font-weight:800;margin:0;color:var(--text);">Dynamic Correlation Matrix (' + year + ')</h3>' +
      '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
        '<div class="metric-tabs" id="corrCoeffToggle">' +
          '<button class="metric-tab' + (corrCoeffMode === 'pearson' ? ' active' : '') + '" data-coeff="pearson" aria-pressed="' + (corrCoeffMode === 'pearson') + '">Pearson r (Linear)</button>' +
          '<button class="metric-tab' + (corrCoeffMode === 'spearman' ? ' active' : '') + '" data-coeff="spearman" aria-pressed="' + (corrCoeffMode === 'spearman') + '">Spearman ρ (Rank)</button>' +
        '</div>' +
        '<span style="font-size:11px;color:var(--text-dim);font-family:monospace;background:var(--bg);padding:4px 8px;border-radius:4px;border:1px solid var(--border);">' + (rateMode === 'perCapita' ? 'Per 100k Residents' : 'Per km² Density') + '</span>' +
      '</div>' +
    '</div>' +
    '<div style="overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        tableHeader +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>' +
    '<div style="font-size:11.5px;color:var(--text-dim);margin-top:12px;line-height:1.5;background:var(--bg);padding:10px 14px;border-radius:6px;border:1px solid var(--border);">' +
      '<b>Statistical Notes &amp; Rigor</b>: <span style="color:var(--amber);font-weight:700;">*</span> indicates statistically significant correlation (two-tailed Student’s t-test <i>p</i> &lt; 0.05). <span style="opacity:0.7;">(ns)</span> indicates non-significant correlation (<i>p</i> ≥ 0.05). Spearman ρ evaluates monotonic rank alignment, mitigating linear outlier skew.' +
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
}

function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for (let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
  return num/Math.sqrt(dx2*dy2);
}

function buildScatterTabs() {
  const el = document.getElementById('scatterTabs');
  el.innerHTML = INFRA.map(inf => '<button class="metric-tab' + (inf.key===scatterType?' active':'') + '" data-key="' + inf.key + '" aria-pressed="' + (inf.key===scatterType) + '">' + inf.label + '</button>').join('');
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

  const covered = DATA.filter(d => infraCovered(d, inf.key) && d[yMetric.key] != null);
  const pts = covered.map(d => ({ x: getInfraVal(d, inf), y: getRateVal(d[yMetric.key], d), name: d.name }));
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
  document.getElementById('trendsRead').textContent = 'Both crashes and fatalities fell sharply through 2020 (the COVID lockdown year, ' + minYear.year + ' was the low point at ' + fmtNum(minYear.fatalities) + ' deaths) and have partly rebounded since — 2023 fatalities are still ' + Math.round(((last.fatalities - minYear.fatalities)/minYear.fatalities)*100) + '% above that low.';

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
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = textDim;
  for (let i=0;i<n;i++) {
    const gx = px(i);
    ctx.beginPath(); ctx.moveTo(gx,PAD.t); ctx.lineTo(gx,H-PAD.b); ctx.stroke();
    if (i % 2 === 0) ctx.fillText(TRENDS[i].year, gx-12, H-PAD.b+14);
  }
  ctx.beginPath(); ctx.moveTo(PAD.l, py(100)); ctx.lineTo(W-PAD.r, py(100)); ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillText('2014 = 100', PAD.l+4, py(100)-4);

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
  ctx.font = '10px -apple-system, sans-serif';
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
    ctx.fillStyle = text; ctx.font = '10px -apple-system, sans-serif';
    ctx.fillText(v.year, cx-10, H-PAD.b+14);
  });

  let ly = PAD.t;
  [...groups, { key:'other', label:'Slow-moving / animal-driven / other', color: textDim }].forEach(g => {
    ctx.fillStyle = g.color.startsWith('var') ? styles.getPropertyValue(g.color.slice(4,-1)).trim() : g.color;
    ctx.fillRect(W-PAD.r+8, ly, 10, 10);
    ctx.fillStyle = text; ctx.font = '10px -apple-system, sans-serif';
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

function render() {
  buildMetricTabs();
  renderMap();
  renderList();
  renderDetail();
  renderMethod();
  renderCorrelationMatrix();
  renderTrends();
  renderVictimsByMode();
  renderZones();
  if (compareMode) renderCompareCard();
}

function heatColor(t) {
  return [255, 244, 168, Math.min(0.6, 0.08 + t * 0.52)];
}
let heatDrawn = false;
function drawHeat() {
  if (heatDrawn) return;
  heatDrawn = true;
  const canvas = document.getElementById('heat');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d');
  octx.globalCompositeOperation = 'lighter';
  const maxCount = Math.max(...GRID.points.map(p => p[2]));
  GRID.points.forEach(([gx, gy, count]) => {
    const x = gx * GRID.cell, y = gy * GRID.cell;
    const alpha = Math.min(1, 0.3 + 0.7 * (count / maxCount));
    const radius = 5 + Math.sqrt(count) * 1.4;
    const grad = octx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, 'rgba(255,0,0,' + alpha + ')');
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    octx.fillStyle = grad;
    octx.beginPath(); octx.arc(x, y, radius, 0, Math.PI*2); octx.fill();
  });
  const src = octx.getImageData(0,0,W,H);
  const out = ctx.createImageData(W,H);
  for (let i=0;i<src.data.length;i+=4){
    const density = src.data[i]/255;
    if (density < 0.02) continue;
    const [r,g,b,a] = heatColor(Math.min(1,density));
    out.data[i]=r; out.data[i+1]=g; out.data[i+2]=b; out.data[i+3]=Math.round(a*255);
  }
  ctx.putImageData(out,0,0);
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
    if (id === 'lightToggle') {
      document.getElementById('heat').classList.toggle('on', newVal);
      if (newVal) drawHeat();
    }
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

setupToggleControl('lightToggle', () => showLights, v => { showLights = v; });
setupToggleControl('policeToggle', () => showPolice, v => { showPolice = v; });
setupToggleControl('zonesToggle', () => showZones, v => { showZones = v; });
setupToggleControl('bivariateToggle', () => isBivariateMode, v => { isBivariateMode = v; });

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
        '<h3>' + d1.name + ' District</h3>' +
        compRow('District Area', d1.areaSqKm, d2.areaSqKm, 'km²') +
        compRow('Total IPC Crime (' + year + ')', yearFieldVal(d1,'totalIPC'), yearFieldVal(d2,'totalIPC')) +
        compRow('Theft Offences (' + year + ')', yearFieldVal(d1,'theft'), yearFieldVal(d2,'theft')) +
        compRow('Robbery (' + year + ')', yearFieldVal(d1,'robbery'), yearFieldVal(d2,'robbery')) +
        compRow('Burglary (' + year + ')', yearFieldVal(d1,'burglary'), yearFieldVal(d2,'burglary')) +
        compRow('Crime Against Women (' + year + ')', yearFieldVal(d1,'crimeAgainstWomen'), yearFieldVal(d2,'crimeAgainstWomen')) +
        compRow('Streetlight Density', d1.lightDensityPerKm2, d2.lightDensityPerKm2, '/km²') +
        compRow('Police Stations & Chowkis', d1.policeInfraCount, d2.policeInfraCount) +
        compRow('Fatal Crashes (2023)', d1.fatalCrashes2023, d2.fatalCrashes2023) +
      '</div>' +
      '<div class="compare-col">' +
        '<h3>' + d2.name + ' District</h3>' +
        compRow('District Area', d2.areaSqKm, d1.areaSqKm, 'km²') +
        compRow('Total IPC Crime (' + year + ')', yearFieldVal(d2,'totalIPC'), yearFieldVal(d1,'totalIPC')) +
        compRow('Theft Offences (' + year + ')', yearFieldVal(d2,'theft'), yearFieldVal(d1,'theft')) +
        compRow('Robbery (' + year + ')', yearFieldVal(d2,'robbery'), yearFieldVal(d1,'robbery')) +
        compRow('Burglary (' + year + ')', yearFieldVal(d2,'burglary'), yearFieldVal(d1,'burglary')) +
        compRow('Crime Against Women (' + year + ')', yearFieldVal(d2,'crimeAgainstWomen'), yearFieldVal(d1,'crimeAgainstWomen')) +
        compRow('Streetlight Density', d2.lightDensityPerKm2, d1.lightDensityPerKm2, '/km²') +
        compRow('Police Stations & Chowkis', d2.policeInfraCount, d1.policeInfraCount) +
        compRow('Fatal Crashes (2023)', d2.fatalCrashes2023, d1.fatalCrashes2023) +
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

document.getElementById('dlCorrDownload').addEventListener('click', () => {
  const headers = ['Infrastructure type', 'Crime/road-safety metric', 'Metric year', 'Pearson r', 'Districts included (n)', 'Coverage note'];
  const rows = [];
  INFRA.forEach(inf => {
    METRICS.forEach(m => {
      const covered = DATA.filter(d => infraCovered(d, inf.key) && d[m.key] != null);
      const xs = covered.map(d => d[inf.densityKey]);
      const ys = covered.map(d => d[m.key] / d.areaSqKm);
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
  triggerDownload('gaitway_delhi_road_safety_trends_2014_2023.csv', toCSV(headers, rows));
});

document.getElementById('dlVictimsDownload').addEventListener('click', () => {
  const headers = ['Year','Pedestrian Killed','Pedestrian Injured','Cyclists Killed','Cyclists Injured','Car Occupants Killed','Car Occupants Injured','Scooter/Motorcycle Riders Killed','Scooter/Motorcycle Riders Injured','Bus Passengers Killed','Bus Passengers Injured','Slow Moving Vehicles Killed','Slow Moving Vehicles Injured','Animal Driven Vehicles Killed','Animal Driven Vehicles Injured','Other Killed','Other Injured','Total Killed','Total Injured'];
  const rows = VICTIMS.map(v => [v.year, v.pedestrianKilled, v.pedestrianInjured, v.cyclistKilled, v.cyclistInjured, v.carKilled, v.carInjured, v.twoWheelerKilled, v.twoWheelerInjured, v.busPassengerKilled, v.busPassengerInjured, v.slowMovingKilled, v.slowMovingInjured, v.animalDrivenKilled, v.animalDrivenInjured, v.otherKilled, v.otherInjured, v.totalKilled, v.totalInjured]);
  triggerDownload('gaitway_delhi_road_deaths_by_mode_2019_2023.csv', toCSV(headers, rows));
});

document.getElementById('dlZonesDownload').addEventListener('click', () => {
  const headers = ['Rank (fatal descending)', 'Crash-Prone Zone', 'Road Name', 'Simple Crashes', 'Fatal Crashes', 'Total Crashes'];
  const rows = ACCIDENT_ZONES.map(z => [z.rank, z.name, z.road, z.simple, z.fatal, z.total]);
  triggerDownload('gaitway_delhi_crash_prone_zones_2023.csv', toCSV(headers, rows));
});

function updateVersusLabel() {
  const inf = INFRA.find(i => i.key === scatterType);
  const m = METRICS.find(x => x.key === scatterYMetric);
  document.getElementById('dlVersusLabel').textContent = inf.label + ' density vs. ' + m.short + ' density';
}
document.getElementById('dlVersusDownload').addEventListener('click', () => {
  const inf = INFRA.find(i => i.key === scatterType);
  const m = METRICS.find(x => x.key === scatterYMetric);
  const headers = ['District', inf.label + ' density (per km²)', m.label + ' density (per km²)', inf.label + ' (count)', m.label + ' (raw count)'];
  const rows = DATA.filter(d => infraCovered(d, inf.key) && d[m.key] != null)
    .map(d => [d.district, d[inf.densityKey], Math.round((d[m.key]/d.areaSqKm)*100)/100, d[inf.countKey], d[m.key]]);
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
      const covered = DATA.filter(d => infraCovered(d, inf.key) && d[m.key] != null);
      const xs = covered.map(d => d[inf.densityKey]);
      const ys = covered.map(d => d[m.key] / d.areaSqKm);
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
  const rows = DATA.filter(d => infraCovered(d, inf.key) && d[m.key] != null)
    .map(d => [d.district, d[inf.densityKey], Math.round((d[m.key]/d.areaSqKm)*100)/100, d[inf.countKey], d[m.key]]);
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
    underpasses: 'PAPL underpass survey', underpassDensity: 'PAPL underpass survey (derived)',
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
    ['Citywide road crashes/fatalities, 2014-2023', 'Delhi Traffic Police annual road crash data', 'No single public URL — citywide totals, not district-level', 'Not broken down by district, so not merged into the per-district metrics above. Used only in the standalone "Citywide road safety trends" chart.'],
    ['Road deaths by mode of travel, 2019-2023', 'Delhi Traffic Police annual road crash data', 'No single public URL — citywide totals, not district-level', 'Pedestrian, cyclist, car occupant, two-wheeler rider, bus passenger, slow-moving/animal-driven, and other categories. Citywide only, same caveat as above.'],
    ['Crash-prone zones, fatal/simple/total crash counts (2023)', 'Delhi Traffic Police, Delhi Road Crash Report 2023 — Table 6.29', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2023', '107 zones with real 2023 crash counts (not just names). Cross-validated: the sum of per-district crash-prone-zone counts (Table 6.31) equals exactly 107, matching this table.'],
    ['District-wise crash-prone zones and crashes (2023)', 'Delhi Traffic Police, Delhi Road Crash Report 2023 — Table 6.31', 'https://traffic.delhipolice.gov.in/delhi-crash-report-2023', 'All 15 Delhi Police districts — this table uses the same 15-district geography as the rest of this page, unlike the 2022 report above which only covers 11.'],
    ['Crash-prone zone map coordinates', 'Latitude/longitude for the 107 named zones above', 'Provided coordinate set, cross-validated programmatically against the source table (rank and fatal-crash count matched exactly for all 107, zero mismatches) and spot-checked against known Delhi landmarks', '105 of 107 fall inside one of the 15 district polygons and are plotted on the map, sized/shaded by fatal crash count. The remaining 2 (Surya Nagar Red Light, Seelampur T Point) sit just outside every simplified district boundary and are listed by name with their real severity numbers rather than force-placed.'],
    ['District center markers', 'Computed from the district boundary polygons already used for the choropleth', 'n/a — derived, not a separate source', 'Geometric centroid of each simplified district polygon, not a specific administrative headquarters address. Labeled "district center" on the map for that reason.'],
    ['Streetlights', 'PAPL streetlight survey', 'https://otd.delhi.gov.in/ — Delhi Transport Stack Open Transit Data, agency=paplilabs', '9 of 15 districts — the survey vehicle only physically drove through part of Delhi. Zero elsewhere means unsurveyed, not unlit.'],
    ['Pedestrian underpasses', 'PAPL underpass survey', 'https://otd.delhi.gov.in/ — Delhi Transport Stack Open Transit Data, same agency', 'Same 9 districts as streetlights — identical survey vehicle, identical gap.'],
    ['Metro station gates', 'OpenStreetMap, railway=subway_entrance tag', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — thorough community mapping citywide.'],
    ['Bus stops', 'OpenStreetMap, highway=bus_stop / public_transport=platform tags (3,199 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — 48 of 3,199 points fell outside every district polygon (likely just across the Delhi border) and are excluded from the district counts.'],
    ['ATMs', 'OpenStreetMap, amenity=atm tag, queried via Overpass API (666 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — 17 of 666 points fell outside every district polygon and are excluded from the district counts.'],
    ['Liquor Shops', 'OpenStreetMap, shop=alcohol tag, queried via Overpass API (50 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — mapped cleanly into district polygons via spatial point-in-polygon.'],
    ['CCTV & Guards', 'OpenStreetMap, man_made=surveillance tag, queried via Overpass API (433 points)', 'https://www.openstreetmap.org/copyright — ODbL license', 'All 15 districts — includes fixed/dome CCTV cameras, ALPR systems, and security guard posts.'],
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
    ['Compiled for', 'GaitWay walkability project — Delhi District Safety Index dashboard', '', 'Cite the individual source rows above, not this workbook, in academic or official work.'],
  ];
  return xlSheet('Sources & Methodology', headers, rows, [false,false,false,false]);
}

document.getElementById('dlExcelDownload').addEventListener('click', () => {
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
  { key: 'trends', label: 'Trends, 2014-2023' },
  { key: 'victims', label: 'By Mode of Travel' },
  { key: 'zones', label: 'Crash-Prone Zones (2023)' },
];
let activeRoadSafetyTab = 'trends';
function renderRoadSafetyTabs() {
  document.getElementById('roadSafetyTabs').innerHTML = ROAD_SAFETY_TABS.map(t =>
    '<button class="metric-tab' + (t.key===activeRoadSafetyTab ? ' active' : '') + '" data-key="' + t.key + '" aria-pressed="' + (t.key===activeRoadSafetyTab) + '">' + t.label + '</button>'
  ).join('');
  document.getElementById('rsTrendsPanel').classList.toggle('active', activeRoadSafetyTab === 'trends');
  document.getElementById('rsVictimsPanel').classList.toggle('active', activeRoadSafetyTab === 'victims');
  document.getElementById('rsZonesPanel').classList.toggle('active', activeRoadSafetyTab === 'zones');
}

const DOWNLOAD_TABS = [
  { key: 'all', label: 'All District Data' },
  { key: 'corr', label: 'Correlation Matrix' },
  { key: 'versus', label: 'Current Comparison' },
  { key: 'excel', label: 'Excel Workbook' },
];
let activeDownloadTab = 'all';
function renderDownloadTabs() {
  document.getElementById('downloadTabs').innerHTML = DOWNLOAD_TABS.map(t =>
    '<button class="metric-tab' + (t.key===activeDownloadTab ? ' active' : '') + '" data-key="' + t.key + '" aria-pressed="' + (t.key===activeDownloadTab) + '">' + t.label + '</button>'
  ).join('');
  document.querySelectorAll('#downloadTabs .metric-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeDownloadTab = btn.dataset.key;
      renderDownloadTabs();
      document.getElementById('dlAllPanel').style.display = activeDownloadTab === 'all' ? '' : 'none';
      document.getElementById('dlCorrPanel').style.display = activeDownloadTab === 'corr' ? '' : 'none';
      document.getElementById('dlVersusPanel').style.display = activeDownloadTab === 'versus' ? '' : 'none';
      document.getElementById('dlExcelPanel').style.display = activeDownloadTab === 'excel' ? '' : 'none';
    });
  });
}

buildScatterTabs();
renderScatter();
render();
renderRoadSafetyTabs();
renderDownloadTabs();
renderDownloadFields();
</script>
`;

fs.writeFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), html);
console.log('Written. Size:', (html.length/1024).toFixed(1), 'KB');
