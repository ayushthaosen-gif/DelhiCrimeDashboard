// Two-layer comparison and regression for the approximate 2024 crash-zone coordinates.
//
// The report publishes no coordinates, so the stored points are hand-placed. There is NO ground truth for where
// the crashes happened. This script therefore estimates the most plausible position from independent evidence and
// reports how well that estimate can be validated. It never overwrites the original file.
//
//   Layer 1, street network (OpenStreetMap, local snapshot): candidate points every ~40 m along the road named in
//            the report, plus junction positions.
//   Layer 2, traffic-exposure proxy (OpenStreetMap-derived, no live traffic): road class, lanes, traffic signals,
//            junction distance, flyover/bridge tags, bus stops. This measures how much traffic a place likely
//            carries, not measured traffic.
//
//   Regression: a conditional logit over each zone's candidate points. Its weights are learned on "anchor" zones whose
//   Nominatim geocode independently agrees with the stored point, using only layer 1 + layer 2 features. The
//   geocode and the stored point then enter as fixed Gaussian evidence terms (not learned, so the model cannot just
//   copy its own training label). Leave-one-out validation on the anchors compares the refined estimate with the
//   stored point; the result is written out either way.
//
//   node scripts/refine_crash_zone_coordinates.js            # fetches missing Photon geocodes (1 request/second)
//   node scripts/refine_crash_zone_coordinates.js --offline  # cache only
//
// Needs data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json (from audit_crash_zone_coordinates.js). Outputs
// data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.json and .csv

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const P = (f) => path.join(ROOT, f);
const OFFLINE = process.argv.includes('--offline');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const RAD = Math.PI / 180, R = 6371000;
const CAND_STEP_M = 40, SEARCH_M = 2500, NEAR_ANY_M = 700, SIGMA_GEO = 250, MAX_CANDIDATES = 900, GEO_IMPLAUSIBLE_M = 3000;

function hav(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * RAD, dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---- tiny grid index over points ---------------------------------------------------------------------------
class Grid {
  constructor(pts) { this.cell = 0.004; this.m = new Map(); pts.forEach(p => { const k = this.key(p.lat, p.lng); (this.m.get(k) || this.m.set(k, []).get(k)).push(p); }); }
  key(lat, lng) { return Math.floor(lat / this.cell) + ',' + Math.floor(lng / this.cell); }
  within(lat, lng, r) {
    const out = [], n = Math.ceil(r / (this.cell * 111000)) + 1, ci = Math.floor(lat / this.cell), cj = Math.floor(lng / this.cell);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const p of (this.m.get((ci + i) + ',' + (cj + j)) || [])) { const d = hav(lat, lng, p.lat, p.lng); if (d <= r) out.push(Object.assign({ d }, p)); }
    return out;
  }
  nearest(lat, lng, maxR) { let best = null; for (const p of this.within(lat, lng, maxR)) if (!best || p.d < best.d) best = p; return best; }
}

// ---- road-name matching (same rules as the audit script) ---------------------------------------------------
const STOP = new Set(['road', 'marg', 'rd', 'the', 'near', 'and', 'of', 'no', 'cut', 'chowk', 'flyover', 'bridge', 'underpass']);
const ALIASES = [
  [/\bgtk\b|g\.?\s?t\.?\s?karnal|grand trunk/i, ['grand trunk', 'g.t. karnal', 'g t karnal', 'gt karnal', 'karnal', 'gtk', 'nh44', 'nh 44', 'nh1', 'nh 1']],
  [/\bouter ring\b|\borr\b/i, ['outer ring']],
  [/\bring road\b/i, ['ring road']],
  [/\buer\b|urban extension/i, ['urban extension', 'uer', 'dwarka expressway', 'nh248bb', 'nh 248bb']],
  [/\bnh[-\s]?8\b/i, ['nh48', 'nh 48', 'nh8', 'nh 8', 'gurgaon', 'gurugram']],
  [/\bnh[-\s]?9\b|\bnh[-\s]?24\b/i, ['nh9', 'nh 9', 'nh24', 'nh 24', 'nh 09', 'ghaziabad', 'meerut', 'nizamuddin']],
  [/\bnh[-\s]?44\b/i, ['nh44', 'nh 44', 'nh1', 'nh 1', 'grand trunk']],
  [/\bnh[-\s]?48\b/i, ['nh48', 'nh 48', 'gurgaon', 'gurugram']]
];
function roadTokens(roadName) {
  const rn = (roadName || '').toLowerCase(), tokens = new Set();
  for (const [re, list] of ALIASES) if (re.test(rn)) list.forEach(t => tokens.add(t));
  rn.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w) && w !== 'nh').forEach(w => tokens.add(w));
  const nh = rn.match(/nh[-\s]?(\d+)/); if (nh) { tokens.add('nh' + nh[1]); tokens.add('nh ' + nh[1]); }
  return [...tokens];
}
const roadMatches = (tags, tokens) => tokens.length && tokens.some(t => (((tags.name || '') + '|' + (tags.ref || '') + '|' + (tags['name:en'] || '') + '|' + (tags.alt_name || '')).toLowerCase()).includes(t));

const CLASS_SCORE = { motorway: 4, motorway_link: 2.5, trunk: 3.2, trunk_link: 2, primary: 2.4, primary_link: 1.5, secondary: 1.6, secondary_link: 1 };
const DEFAULT_LANES = { motorway: 3, trunk: 3, primary: 2, secondary: 2 };
function exposure(tags) {
  const base = tags.highway.replace('_link', '');
  const lanes = Number(String(tags.lanes || '').split(';')[0]) || DEFAULT_LANES[base] || 2;
  const speed = parseInt(tags.maxspeed, 10) || 50;
  return (CLASS_SCORE[tags.highway] || 1) + 0.3 * Math.min(lanes, 6) + 0.01 * Math.min(speed, 100);
}

// ---- load data --------------------------------------------------------------------------------------------
const zones = JSON.parse(fs.readFileSync(P('data/delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8')).features;
const roads = JSON.parse(fs.readFileSync(P('data/source/osm_major_roads_delhi_raw.json'), 'utf8')).elements.filter(e => e.geometry && e.tags && e.tags.highway);
const signalsRaw = JSON.parse(fs.readFileSync(P('data/source/osm_traffic_signals_crossings_delhi_raw.json'), 'utf8')).elements;
const poi = JSON.parse(fs.readFileSync(P('data/poi_markers_latlng.json'), 'utf8'));
const geocache = JSON.parse(fs.readFileSync(P('data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json'), 'utf8'));

const signals = new Grid(signalsRaw.filter(e => e.tags && e.tags.highway === 'traffic_signals' && isFinite(e.lat ?? (e.center && e.center.lat)))
  .map(e => ({ lat: e.lat ?? e.center.lat, lng: e.lon ?? e.center.lon })));
const busStops = new Grid(poi.busStops.map(b => ({ lat: Number(b[0]), lng: Number(b[1]) })).filter(b => isFinite(b.lat)));

// Junctions: OSM nodes shared by two or more major-road ways that are not just consecutive pieces of one road.
const nodeWays = new Map();
roads.forEach((w, wi) => w.nodes.forEach((n, i) => { if (!w.geometry[i]) return; (nodeWays.get(n) || nodeWays.set(n, { ways: new Set(), lat: w.geometry[i].lat, lng: w.geometry[i].lon }).get(n)).ways.add(wi); }));
const junctionPts = [];
nodeWays.forEach(v => {
  if (v.ways.size < 2) return;
  const names = new Set([...v.ways].map(wi => (roads[wi].tags.name || roads[wi].tags.ref || '?').toLowerCase()));
  if (names.size >= 2) junctionPts.push({ lat: v.lat, lng: v.lng });
});
const junctions = new Grid(junctionPts);

// ---- zone evidence + candidates ----------------------------------------------------------------------------
const BRIDGE_NAME = /flyover|fly over|bridge|underpass|\bunder\b|elevated/i;
const HUB_NAME = /isbt|bus stand|bus depot|depot|terminal|metro|station/i;
const JUNCTION_NAME = /chowk|crossing|intersection|junction|\bmod\b|red light|circle|roundabout|\bcut\b|t-point|tri ?junction/i;

function zoneInfo(z) {
  const p = z.properties, [lng, lat] = z.geometry.coordinates;
  const name = p.location_name || '', road = p.road_name || '';
  const qs = [p.osm_search_query, name + ', Delhi, India'].filter(Boolean);
  const first = (keyPrefix, source) => { for (const q of qs) { const h = (geocache[keyPrefix + q] || [])[0]; if (h) return Object.assign({ source, d: hav(lat, lng, h.lat, h.lng) }, h); } return null; };
  // Fixed order, never 'whichever is closest to the stored point', so validation is not biased towards the stored point.
  // A geocode more than 3 km from the stored point is a different place with the same name (e.g. another 'SGT Nagar'); ignore it.
  const geoHits = [first('', 'nominatim') || first('photon|', 'photon')].filter(h => h && h.d <= GEO_IMPLAUSIBLE_M);
  return { z, p, lat, lng, name, road, tokens: roadTokens(road), geo: geoHits[0] || null,
    sigmaPrior: Math.max(250, (p.estimated_accuracy_m || 500) * 1.5),
    isBridge: BRIDGE_NAME.test(name), isHub: HUB_NAME.test(name), isJunction: JUNCTION_NAME.test(name) };
}

function candidates(info) {
  // Candidates are points on ANY major road near the stored point or the geocode, plus points on the named road out to
  // 2.5 km. Whether the road's name matches the report is a feature the regression weighs, not a hard filter (OSM often
  // names a road differently from the traffic-police report, e.g. Ring Road vs Mahatma Gandhi Marg).
  const out = [];
  const anchorsPts = [{ lat: info.lat, lng: info.lng, r: NEAR_ANY_M }].concat(info.geo ? [{ lat: info.geo.lat, lng: info.geo.lng, r: 400 }] : []);
  const matchedFlag = (w) => roadMatches(w.tags, info.tokens) ? 1 : 0;
  const addWay = (w, within) => {
    const g = w.geometry, onBridge = w.tags.bridge === 'yes' || Number(w.tags.layer) > 0 || w.tags.tunnel === 'yes' ? 1 : 0, ex = exposure(w.tags), m = matchedFlag(w);
    for (let i = 0; i < g.length - 1; i++) {
      const segLen = hav(g[i].lat, g[i].lon, g[i + 1].lat, g[i + 1].lon), steps = Math.max(1, Math.round(segLen / CAND_STEP_M));
      for (let s = 0; s < steps; s++) {
        const t = s / steps, lat = g[i].lat + (g[i + 1].lat - g[i].lat) * t, lng = g[i].lon + (g[i + 1].lon - g[i].lon) * t;
        if (within(lat, lng)) out.push({ lat, lng, onBridge, ex, matched: m, road: w.tags.name || w.tags.ref || '' });
      }
    }
  };
  const box = (w, lat, lng, r) => w.geometry.some(pt => Math.abs(pt.lat - lat) < r / 100000 + 0.02 && Math.abs(pt.lon - lng) < r / 100000 + 0.02);
  for (const w of roads) {
    const m = matchedFlag(w);
    const near = anchorsPts.some(a => box(w, a.lat, a.lng, a.r));
    if (!near && !(m && box(w, info.lat, info.lng, SEARCH_M))) continue;
    addWay(w, (lat, lng) => anchorsPts.some(a => hav(a.lat, a.lng, lat, lng) <= a.r) || (m && hav(info.lat, info.lng, lat, lng) <= SEARCH_M));
  }
  const matchedNear = out.some(c => c.matched && hav(info.lat, info.lng, c.lat, c.lng) <= 800);
  const mode = !out.length ? 'none' : matchedNear ? 'matched_road' : 'unmatched_nearby';
  let c = out;
  if (c.length > MAX_CANDIDATES) { const k = Math.ceil(c.length / MAX_CANDIDATES); c = c.filter((_, i) => i % k === 0); }
  return { cands: c, mode };
}

function features(info, c) {
  const dj = junctions.nearest(c.lat, c.lng, 600), jterm = Math.log1p((dj ? dj.d : 600) / 50);
  const sig = signals.within(c.lat, c.lng, 150).length, bus = busStops.within(c.lat, c.lng, 200).length;
  return [
    jterm,                                   // x1 distance to a junction of two different major roads (layer 1)
    info.isJunction ? jterm : 0,             // x2 same, extra weight when the zone is named as a junction/chowk
    Math.log1p(sig),                         // x3 traffic signals within 150 m (layer 2)
    c.ex / 4,                                // x4 road class + lanes + speed limit exposure proxy (layer 2)
    info.isBridge ? c.onBridge : 0,          // x5 on a flyover/bridge/tunnel when the name says so (layer 1)
    info.isHub ? Math.log1p(bus) : 0,        // x6 bus stops within 200 m for bus stands, ISBTs, depots, metro (layer 2)
    c.matched                                // x7 the OSM road name matches the road named in the report (layer 1)
  ];
}
const FEATURE_NAMES = ['junction_distance', 'junction_distance_if_named_junction', 'traffic_signals_150m', 'road_exposure_proxy', 'on_flyover_if_named_flyover', 'bus_stops_200m_if_hub', 'road_name_matches_report'];

// ---- conditional logit (multinomial over each zone's candidates), L2-regularised gradient ascent ---------------
function fitLogit(sets, lambda) {
  const k = FEATURE_NAMES.length; let w = new Array(k).fill(0);
  for (let it = 0; it < 400; it++) {
    const g = new Array(k).fill(0);
    for (const s of sets) {
      const sc = s.X.map(x => x.reduce((a, v, i) => a + v * w[i], 0)), mx = Math.max(...sc), ex = sc.map(v => Math.exp(v - mx)), Z = ex.reduce((a, b) => a + b, 0);
      for (let i = 0; i < k; i++) { let e = 0; s.X.forEach((x, ci) => { e += (ex[ci] / Z) * x[i]; }); g[i] += s.X[s.y][i] - e; }
    }
    for (let i = 0; i < k; i++) w[i] += 0.05 * (g[i] / Math.max(1, sets.length) - lambda * w[i]);
  }
  return w;
}

function posterior(info, set, w, useGeo) {
  const sc = set.cands.map((c, i) => {
    let s = set.X[i].reduce((a, v, j) => a + v * w[j], 0);
    s += -0.5 * (hav(info.lat, info.lng, c.lat, c.lng) / info.sigmaPrior) ** 2;
    if (useGeo && info.geo) s += -0.5 * (hav(info.geo.lat, info.geo.lng, c.lat, c.lng) / SIGMA_GEO) ** 2;
    return s;
  });
  const mx = Math.max(...sc), ex = sc.map(v => Math.exp(v - mx)), Z = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / Z);
}

function summarise(info, set, post) {
  let bi = 0; post.forEach((p, i) => { if (p > post[bi]) bi = i; });
  const best = set.cands[bi];
  const byDist = post.map((p, i) => ({ p, d: hav(best.lat, best.lng, set.cands[i].lat, set.cands[i].lng) })).sort((a, b) => a.d - b.d);
  let acc = 0, r68 = byDist[byDist.length - 1].d; for (const x of byDist) { acc += x.p; if (acc >= 0.68) { r68 = x.d; break; } }
  return { best, r68, pBest: post[bi] };
}

async function photon(q) {
  const url = 'https://photon.komoot.io/api/?limit=1&lat=28.65&lon=77.2&bbox=76.7,28.35,77.45,28.95&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': 'DelhiCrimeDashboard-CrashZoneAudit/1.0 (research audit; github.com/ayushthaosen-gif/DelhiCrimeDashboard)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return ((await res.json()).features || []).map(f => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], name: [f.properties.name, f.properties.street, f.properties.district].filter(Boolean).join(', '), type: f.properties.osm_value }));
}

async function fetchPhoton() {
  let n = 0;
  for (const z of zones) {
    const p = z.properties, qs = [p.osm_search_query, p.location_name + ', Delhi, India'].filter(Boolean);
    if (qs.some(q => (geocache[q] || []).length)) continue; // Nominatim already answered
    for (const q of qs) {
      if (geocache['photon|' + q]) continue;
      try { geocache['photon|' + q] = await photon(q); } catch (e) { console.log('photon error', q, e.message); continue; }
      n++; fs.writeFileSync(P('data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json'), JSON.stringify(geocache, null, 1)); await sleep(1100);
    }
  }
  console.log('photon queries fetched this run:', n);
}

async function main() {
  if (!OFFLINE) await fetchPhoton();
  const infos = zones.map(zoneInfo);
  const sets = infos.map(info => { const { cands, mode } = candidates(info); return { info, cands, mode, X: cands.map(c => features(info, c)) }; });

  // anchors: geocode within 500 m of the stored point, stated confidence high/medium, a candidate within 150 m of the geocode
  const anchors = [];
  sets.forEach(s => {
    const i = s.info; if (!i.geo || i.geo.d > 600 || !['high', 'medium'].includes(i.p.coordinate_confidence) || !s.cands.length) return;
    let y = 0, bd = Infinity; s.cands.forEach((c, ci) => { const d = hav(c.lat, c.lng, i.geo.lat, i.geo.lng); if (d < bd) { bd = d; y = ci; } });
    if (bd <= 250) anchors.push({ s, y });
  });
  const trainSets = anchors.map(a => ({ X: a.s.X, y: a.y }));
  const LAMBDA = 0.5;
  const weights = anchors.length >= 5 ? fitLogit(trainSets, LAMBDA) : new Array(FEATURE_NAMES.length).fill(0);

  // leave-one-out: infrastructure + stored-point evidence only (no geocode term, which defines the label)
  const loo = anchors.map((a, idx) => {
    const w = fitLogit(trainSets.filter((_, j) => j !== idx), LAMBDA);
    const post = posterior(a.s.info, a.s, w, false), sm = summarise(a.s.info, a.s, post), g = a.s.info.geo;
    return { name: a.s.info.name, priorErr: a.s.info.geo.d, modelErr: hav(sm.best.lat, sm.best.lng, g.lat, g.lng) };
  });
  const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null;
  const validation = {
    anchors: anchors.length, anchor_zones: anchors.map(a => a.s.info.name),
    median_error_vs_geocode_m: { stored_point: Math.round(med(loo.map(r => r.priorErr))), refined_leave_one_out: Math.round(med(loo.map(r => r.modelErr))) },
    refined_better_in: loo.filter(r => r.modelErr < r.priorErr).length + ' of ' + loo.length,
    caveat: 'Labels are Nominatim geocodes of the zone names, not true crash positions. This shows whether layers 1 and 2 help recover the landmark position, not whether the refined point is where crashes occurred.'
  };
  // 'Helps' must be a real gain, not noise: at least 15 m and 20% lower median error than the stored point.
  const mS = validation.median_error_vs_geocode_m.stored_point, mR = validation.median_error_vs_geocode_m.refined_leave_one_out;
  validation.model_helps = anchors.length >= 5 && mS - mR >= 15 && mR <= 0.8 * mS;

  const rows = sets.map(s => {
    const i = s.info;
    if (!s.cands.length) return { rank: i.p.table_6_29_rank || null, location_name: i.name, road_name: i.road, original: { lat: i.lat, lng: i.lng }, refined: null, mode: s.mode, recommendation: 'keep_original', reason: 'no OSM road candidates found' };
    const post = posterior(i, s, weights, true), sm = summarise(i, s, post);
    const moved = hav(i.lat, i.lng, sm.best.lat, sm.best.lng);
    const geoAgrees = i.geo && hav(sm.best.lat, sm.best.lng, i.geo.lat, i.geo.lng) <= 300;
    // The posterior spread only says how concentrated the model is. Real uncertainty also includes the validated landmark error
    // (~120 m) and, when no named road matched, the unknown offset from the road (~400 m).
    const unc = Math.hypot(sm.r68, validation.median_error_vs_geocode_m.refined_leave_one_out || 120, s.mode === 'matched_road' ? 0 : 400);
    const geoConflict = i.geo && hav(sm.best.lat, sm.best.lng, i.geo.lat, i.geo.lng) > 600;
    const conf = geoConflict ? 'low' : unc <= 250 ? 'high' : unc <= 500 ? 'medium' : 'low';
    let rec = 'keep_original', reason = 'moved less than 150 m';
    if (geoConflict && moved >= 150) { rec = 'review'; reason = 'the refined point is more than 600 m from the independent geocode'; }
    else if (moved >= 150) {
      // use_refined needs two independent sources to agree (OSM road geometry and an independent geocode); the regression
      // only picks the position along the road. Anything else is left for a human.
      if (geoAgrees && moved > 1500) { rec = 'review'; reason = 'agrees with the geocode but moves the point more than 1.5 km, so a person should look first'; }
      else if (geoAgrees && conf === 'low') { rec = 'review'; reason = 'agrees with the geocode but overall uncertainty is too large to recommend a move'; }
      else if (geoAgrees) { rec = 'use_refined'; reason = 'refined point is on a major road and within 300 m of an independent geocode'; }
      else { rec = 'review'; reason = s.mode === 'matched_road' ? 'moves along the named road but no independent geocode confirms it' : 'no OSM road with the reported name nearby; position stays uncertain'; }
    }
    return {
      rank: i.p.table_6_29_rank || null, location_name: i.name, road_name: i.road,
      original: { lat: i.lat, lng: i.lng }, refined: { lat: +sm.best.lat.toFixed(6), lng: +sm.best.lng.toFixed(6), on_road: sm.best.road },
      moved_m: Math.round(moved), model_spread_68pct_m: Math.round(sm.r68), uncertainty_m: Math.round(unc), confidence: conf, mode: s.mode, candidates: s.cands.length,
      geocode: i.geo ? { lat: +i.geo.lat.toFixed(6), lng: +i.geo.lng.toFixed(6), distance_to_original_m: Math.round(i.geo.d), distance_to_refined_m: Math.round(hav(sm.best.lat, sm.best.lng, i.geo.lat, i.geo.lng)) } : null,
      recommendation: rec, reason
    };
  });

  const summary = rows.reduce((a, r) => (a[r.recommendation] = (a[r.recommendation] || 0) + 1, a), {});
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    method: 'Conditional-logit regression over candidate points on the named OSM road (layer 1 street network, layer 2 OSM-derived traffic-exposure proxy), plus fixed Gaussian evidence from the stored point and the Nominatim geocode. No live or measured traffic data is used.',
    weights: Object.fromEntries(FEATURE_NAMES.map((n, i) => [n, +weights[i].toFixed(3)])),
    validation, summary, zones: rows
  };
  fs.writeFileSync(P('data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.json'), JSON.stringify(out, null, 1));
  const cols = ['rank', 'location_name', 'road_name', 'recommendation', 'reason', 'moved_m', 'uncertainty_m', 'model_spread_68pct_m', 'confidence', 'mode'];
  const q = (v) => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"';
  const header = cols.concat(['orig_lat', 'orig_lng', 'refined_lat', 'refined_lng', 'geocode_lat', 'geocode_lng']);
  fs.writeFileSync(P('data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.csv'), [header.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).concat([
    r.original.lat, r.original.lng, r.refined ? r.refined.lat : '', r.refined ? r.refined.lng : '', r.geocode ? r.geocode.lat : '', r.geocode ? r.geocode.lng : ''].map(v => q(v))).join(','))).join('\n') + '\n');
  console.log('weights', out.weights);
  console.log('validation', JSON.stringify(validation, null, 1));
  console.log('summary', summary);
}
main().catch(e => { console.error(e); process.exit(1); });
