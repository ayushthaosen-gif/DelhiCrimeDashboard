// For each 2024 crash-prone zone, count how much of the nearby road network is mapped with sidewalk
// tags in OpenStreetMap, plus separate footways, pedestrian crossings and traffic signals.
//
//   node scripts/build_crash_zone_sidewalks.js [--cache DIR]
//
// Per-zone Overpass responses are cached in DIR (default: data/source/osm_zone_sidewalks_cache is NOT
// committed; pass --cache to keep it elsewhere). Output: data/derived/crash_zone_sidewalks_2024.json/.csv.
//
// Honest limits: zone centres are approximate landmark centres (about 250 m to 1 km off), "no sidewalk
// tag" means unmapped, not absent, and OSM tagging of sidewalks in Delhi is sparse.

const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const cacheDir = args.includes('--cache') ? args[args.indexOf('--cache') + 1] : path.join(ROOT, 'scratch', 'osm_zone_sidewalks_cache');
const SRC = path.join(ROOT, 'data', 'delhi_crash_prone_zones_2024_all_named_approx.geojson');
const OUT = path.join(ROOT, 'data', 'derived');
const R_FETCH = 500, RADII = [250, 500];
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const ROAD = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function post(endpoint, query) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query);
    const req = https.request(endpoint, { method: 'POST', timeout: 120000, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'DelhiCrimeDashboard/1.0 (https://github.com/ayushthaosen-gif/DelhiCrimeDashboard; crash-zone sidewalk audit)', Accept: '*/*' } }, res => {
      let d = ''; res.on('data', c => { d += c; });
      res.on('end', () => res.statusCode === 200 ? resolve(d) : reject(new Error(res.statusCode + ' ' + d.slice(0, 120))));
    });
    req.on('timeout', () => req.destroy(new Error('timeout'))); req.on('error', reject); req.end(body);
  });
}
async function fetchZone(id, lat, lon) {
  const file = path.join(cacheDir, id + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const q = `[out:json][timeout:90];(way(around:${R_FETCH},${lat},${lon})["highway"];node(around:${R_FETCH},${lat},${lon})["highway"~"^(crossing|traffic_signals)$"];);out tags geom;`;
  let err;
  for (let a = 0; a < 6; a++) {
    try { const t = await post(ENDPOINTS[a % 2], q); const j = JSON.parse(t); fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(j)); return j; }
    catch (e) { err = e; await sleep(4000 * (a + 1)); }
  }
  throw new Error(id + ': ' + err.message);
}
function metres(a, b, c, d) { const k = Math.PI / 180, x = (d - b) * k * Math.cos((a + c) / 2 * k), y = (c - a) * k; return Math.hypot(x, y) * 6371008.8; }
function sidewalkState(t) {
  const vals = [t.sidewalk, t['sidewalk:both'], t['sidewalk:left'], t['sidewalk:right']].filter(v => v != null);
  if (!vals.length) return 'untagged';
  if (vals.some(v => v !== 'no' && v !== 'none' && v !== 'separate')) return 'sidewalk';
  if (vals.some(v => v === 'separate')) return 'separate';
  return 'none';
}
function summarise(j, lat, lon, R) {
  const s = { road_km: 0, road_sidewalk_km: 0, road_separate_km: 0, road_none_km: 0, road_untagged_km: 0, footway_km: 0, crossings: 0, signals: 0 };
  for (const e of j.elements) {
    if (e.type === 'node') {
      if (metres(lat, lon, e.lat, e.lon) <= R) { if (e.tags.highway === 'crossing') s.crossings++; else s.signals++; }
      continue;
    }
    const g = e.geometry || [], t = e.tags || {};
    for (let i = 1; i < g.length; i++) {
      const mx = (g[i].lat + g[i - 1].lat) / 2, my = (g[i].lon + g[i - 1].lon) / 2;
      if (metres(lat, lon, mx, my) > R) continue;
      const km = metres(g[i - 1].lat, g[i - 1].lon, g[i].lat, g[i].lon) / 1000;
      if (ROAD.has(t.highway)) {
        s.road_km += km;
        const st = sidewalkState(t);
        if (st === 'sidewalk') s.road_sidewalk_km += km; else if (st === 'separate') s.road_separate_km += km; else if (st === 'none') s.road_none_km += km; else s.road_untagged_km += km;
      } else if ((t.highway === 'footway' && t.footway !== 'crossing') || t.highway === 'pedestrian') s.footway_km += km;
    }
  }
  Object.keys(s).forEach(k => { if (k.endsWith('_km')) s[k] = Math.round(s[k] * 1000) / 1000; });
  const covered = s.road_sidewalk_km + s.road_separate_km;
  s.road_with_pedestrian_mapping_pct = s.road_km > 0 ? Math.round(covered / s.road_km * 1000) / 10 : null;
  return s;
}
(async () => {
  const zones = JSON.parse(fs.readFileSync(SRC, 'utf8')).features;
  const rows = [], failed = [];
  for (const f of zones) {
    const [lon, lat] = f.geometry.coordinates, p = f.properties;
    let j; const cached = fs.existsSync(path.join(cacheDir, p.feature_id + '.json'));
    try { j = await fetchZone(p.feature_id, lat, lon); } catch (e) { failed.push(p.feature_id); process.stdout.write('x'); continue; }
    const row = { feature_id: p.feature_id, location_name: p.location_name, rank: p.table_6_29_rank, pedestrian_fatal_crashes: p.pedestrian_fatal_crashes, pedestrian_total_crashes: p.pedestrian_total_crashes, all_fatal_crashes: p.all_fatal_crashes, coordinate_confidence: p.coordinate_confidence, estimated_accuracy_m: p.estimated_accuracy_m };
    for (const R of RADII) Object.entries(summarise(j, lat, lon, R)).forEach(([k, v]) => { row[k + '_' + R + 'm'] = v; });
    rows.push(row); process.stdout.write('.');
    if (!cached) await sleep(1200);
  }
  if (failed.length) { console.error('\nfetch failed for ' + failed.length + ' zones (rerun to retry, cached zones are kept): ' + failed.join(', ')); process.exit(2); }
  fs.mkdirSync(OUT, { recursive: true });
  const meta = { generated: new Date().toISOString().slice(0, 10), source: 'OpenStreetMap contributors (ODbL) via Overpass; zones from data/delhi_crash_prone_zones_2024_all_named_approx.geojson', radii_m: RADII, caveats: ['Zone centres are approximate landmark centres, not police geotags.', 'untagged means no sidewalk tag in OSM, not that there is no pavement.', 'road_with_pedestrian_mapping_pct = (sidewalk + separate) / road length; roads are trunk..residential and their links, segment midpoints within the radius.', 'Delhi sidewalk tagging in OSM is sparse; a low value mostly reflects mapping, not safety.'], zones: rows };
  fs.writeFileSync(path.join(OUT, 'crash_zone_sidewalks_2024.json'), JSON.stringify(meta, null, 1));
  const cols = Object.keys(rows[0]);
  fs.writeFileSync(path.join(OUT, 'crash_zone_sidewalks_2024.csv'), [cols.join(',')].concat(rows.map(r => cols.map(c => { const v = r[c]; return v == null ? '' : /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v; }).join(','))).join('\n') + '\n');
  console.log('\n' + rows.length + ' zones');
})().catch(e => { console.error(e.message); process.exit(1); });
