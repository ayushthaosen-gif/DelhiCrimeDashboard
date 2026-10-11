// Four-layer comparison and regression for the approximate 2024 crash-zone coordinates.
//
// The report publishes no coordinates, so the stored points are hand-placed. There is NO ground truth for where
// the crashes happened. This script estimates the most plausible position from independent evidence and measures how
// well each layer helps. It never overwrites the original file.
//
//   Layer 1  street network (OpenStreetMap): candidate points every ~40 m on major roads, junctions, flyover tags,
//            and whether the OSM road name matches the report's road.
//   Layer 2  traffic-exposure proxy (OpenStreetMap-derived, not measured traffic): road class, lanes, speed limit,
//            traffic signals, bus stops.
//   Layer 3  crash-type compatibility (local OSM data): the report says what kind of crashes each zone had. Pedestrian-
//            prone zones should have crossings and footbridges nearby; heavy-vehicle zones sit in industrial or
//            commercial land use; night-prone zones can be checked against street-lamp density.
//   Layer 4  independent coordinate sources for the named place: OSM geocoders (Nominatim, Photon), GeoNames,
//            Wikidata, and the 2023 report placements. Each source is weighted by how much it disagrees with the others.
//
//   Regression: a conditional logit over each zone's candidate points. Weights are learned on "anchor" zones whose OSM
//   geocode lies on a road candidate, using only layer 1-3 features. The stored point and layer 4 sources then enter as
//   Gaussian evidence terms with data-estimated spreads. A leave-one-source-out cross-validation compares
//   (a) the stored point, (b) layers 1-2, (c) layers 1-3, (d) layers 1-4, and the best layer set by median error is used.
//
//   node scripts/refine_crash_zone_coordinates.js
//   node scripts/refine_crash_zone_coordinates.js --offline  # cache only
//
// Needs data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json (audit_crash_zone_coordinates.js) and
// crash_zone_independent_sources_2024.json (fetch_crash_zone_independent_sources.js).
// Outputs data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.json and .csv

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
const indep = JSON.parse(fs.readFileSync(P('data/audits/crash_zones_2024/crash_zone_independent_sources_2024.json'), 'utf8')).zones;
const prior2023 = JSON.parse(fs.readFileSync(P('data/crash_zones_2023_geocoded.json'), 'utf8'));
const extras = JSON.parse(fs.readFileSync(P('data/poi_markers_infra_extras.json'), 'utf8'));
const overbridgeGeo = JSON.parse(fs.readFileSync(P('data/delhi_pedestrian_overpasses_osm.geojson'), 'utf8')).features;
const landuseGeo = JSON.parse(fs.readFileSync(P('data/delhi_landuse_simplified.geojson'), 'utf8')).features;
const normName = (n) => String(n || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const prior2023By = new Map(prior2023.filter(x => isFinite(x.lat)).map(x => [normName(x.name), x]));
const toPt = (a) => ({ lat: Number(a[0]), lng: Number(a[1]) });
const crossings = new Grid(extras.pedestrianCrossings.map(toPt));
const lamps = new Grid(extras.streetLamps.map(toPt));
const overbridges = new Grid(overbridgeGeo.filter(f => f.geometry && f.geometry.type === 'Point').map(f => ({ lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] })));

// industrial / commercial land use lookup (point in polygon, coarse grid on polygon bounding boxes)
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const LU_CELL = 0.01, luGrid = new Map();
landuseGeo.filter(f => ['industrial', 'commercial'].includes(f.properties.category)).forEach(f => {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  polys.forEach(poly => {
    const xs = poly[0].map(c => c[0]), ys = poly[0].map(c => c[1]);
    for (let i = Math.floor(Math.min(...ys) / LU_CELL); i <= Math.floor(Math.max(...ys) / LU_CELL); i++)
      for (let j = Math.floor(Math.min(...xs) / LU_CELL); j <= Math.floor(Math.max(...xs) / LU_CELL); j++) {
        const k = i + ',' + j; (luGrid.get(k) || luGrid.set(k, []).get(k)).push(poly);
      }
  });
});
const inIndustrialOrCommercial = (lat, lng) => (luGrid.get(Math.floor(lat / LU_CELL) + ',' + Math.floor(lng / LU_CELL)) || []).some(poly => inRing(lng, lat, poly[0]));

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
  const first = (keyPrefix) => { for (const q of qs) { const h = (geocache[keyPrefix + q] || [])[0]; if (h) return h; } return null; };
  // Layer 4 sources. Fixed order for the OSM geocoders (never 'whichever is closest to the stored point').
  // A source more than 3 km from the stored point is a different place with the same name (another 'SGT Nagar'); ignore it.
  const raw = [
    ['osm_geocoder', first('') || first('photon|')],
    ['geonames', indep[name] && indep[name].geonames],
    ['wikidata', indep[name] && indep[name].wikidata],
    ['report_2023_placement', prior2023By.get(normName(name))]
  ];
  const sources = raw.filter(([, h]) => h && isFinite(h.lat) && hav(lat, lng, h.lat, h.lng) <= GEO_IMPLAUSIBLE_M)
    .map(([key, h]) => ({ key, lat: Number(h.lat), lng: Number(h.lng), name: h.name || h.label || '' }));
  const geo = sources.find(x => x.key === 'osm_geocoder') || null;
  return { z, p, lat, lng, name, road, tokens: roadTokens(road), sources, geo: geo && Object.assign({ d: hav(lat, lng, geo.lat, geo.lng) }, geo),
    sigmaPrior: Math.max(250, (p.estimated_accuracy_m || 500) * 1.5),
    isBridge: BRIDGE_NAME.test(name), isHub: HUB_NAME.test(name), isJunction: JUNCTION_NAME.test(name),
    ped: !!p.pedestrian_crash_prone, htv: !!p.htv_crash_prone, night: !!p.night_time_crash_prone };
}

function candidates(info) {
  // Candidates are points on ANY major road near the stored point or the geocode, plus points on the named road out to
  // 2.5 km. Whether the road's name matches the report is a feature the regression weighs, not a hard filter (OSM often
  // names a road differently from the traffic-police report, e.g. Ring Road vs Mahatma Gandhi Marg).
  const out = [];
  const anchorsPts = [{ lat: info.lat, lng: info.lng, r: NEAR_ANY_M }].concat(info.sources.map(x => ({ lat: x.lat, lng: x.lng, r: 400 })));
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
    jterm,                                   // 0 L1 distance to a junction of two different major roads
    info.isJunction ? jterm : 0,             // 1 L1 same, extra weight when the zone is named as a junction/chowk
    Math.log1p(sig),                         // 2 L2 traffic signals within 150 m
    c.ex / 4,                                // 3 L2 road class + lanes + speed limit exposure proxy
    info.isBridge ? c.onBridge : 0,          // 4 L1 on a flyover/bridge/tunnel when the name says so
    info.isHub ? Math.log1p(bus) : 0,        // 5 L2 bus stops within 200 m for bus stands, ISBTs, depots, metro
    c.matched,                               // 6 L1 the OSM road name matches the road named in the report
    info.ped ? Math.log1p(crossings.within(c.lat, c.lng, 150).length + 2 * overbridges.within(c.lat, c.lng, 300).length) : 0, // 7 L3 pedestrian-prone: crossings and footbridges
    info.htv && inIndustrialOrCommercial(c.lat, c.lng) ? 1 : 0, // 8 L3 heavy-vehicle-prone: industrial or commercial land use
    info.night ? Math.log1p(lamps.within(c.lat, c.lng, 150).length) : 0 // 9 L3 night-prone: street lamps within 150 m
  ];
}
const FEATURE_NAMES = ['junction_distance', 'junction_distance_if_named_junction', 'traffic_signals_150m', 'road_exposure_proxy', 'on_flyover_if_named_flyover',
  'bus_stops_200m_if_hub', 'road_name_matches_report', 'pedestrian_crossings_footbridges_if_pedestrian_prone', 'industrial_commercial_if_heavy_vehicle_prone', 'street_lamps_150m_if_night_prone'];
const LAYER_OF_FEATURE = [1, 1, 2, 2, 1, 2, 1, 3, 3, 3];
const CONFIGS = [
  { id: 'layers_1_2', label: 'Layers 1-2 (street network + traffic proxy)', maxLayer: 2, useSources: false },
  { id: 'layers_1_3', label: 'Layers 1-3 (+ crash-type compatibility)', maxLayer: 3, useSources: false },
  { id: 'layers_1_4', label: 'Layers 1-4 (+ independent coordinate sources)', maxLayer: 3, useSources: true }
];
const maskOf = (cfg) => FEATURE_NAMES.map((_, i) => LAYER_OF_FEATURE[i] <= cfg.maxLayer ? 1 : 0);

// ---- conditional logit (multinomial over each zone's candidates), L2-regularised gradient ascent ---------------
function fitLogit(sets, mask, lambda, iters) {
  const k = FEATURE_NAMES.length; const w = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const g = new Array(k).fill(0);
    for (const s of sets) {
      const sc = s.X.map(x => { let a = 0; for (let i = 0; i < k; i++) a += x[i] * w[i] * mask[i]; return a; }), mx = Math.max(...sc), ex = sc.map(v => Math.exp(v - mx)), Z = ex.reduce((a, b) => a + b, 0);
      for (let i = 0; i < k; i++) { if (!mask[i]) continue; let e = 0; s.X.forEach((x, ci) => { e += (ex[ci] / Z) * x[i]; }); g[i] += s.X[s.y][i] - e; }
    }
    for (let i = 0; i < k; i++) if (mask[i]) w[i] += 0.05 * (g[i] / Math.max(1, sets.length) - lambda * w[i]);
  }
  return w;
}

// evidence = list of { lat, lng, sigma }; the stored point is always evidence with its stated accuracy
function posterior(info, set, w, mask, evidence) {
  const sc = set.cands.map((c, i) => {
    let s = 0; for (let j = 0; j < w.length; j++) s += set.X[i][j] * w[j] * mask[j];
    s += -0.5 * (hav(info.lat, info.lng, c.lat, c.lng) / info.sigmaPrior) ** 2;
    for (const e of evidence) s += -0.5 * (hav(e.lat, e.lng, c.lat, c.lng) / e.sigma) ** 2;
    return s;
  });
  const mx = Math.max(...sc), ex = sc.map(v => Math.exp(v - mx)), Z = ex.reduce((a, b) => a + b, 0);
  return ex.map(v => v / Z);
}

function summarise(set, post) {
  let bi = 0; post.forEach((p, i) => { if (p > post[bi]) bi = i; });
  const best = set.cands[bi];
  const byDist = post.map((p, i) => ({ p, d: hav(best.lat, best.lng, set.cands[i].lat, set.cands[i].lng) })).sort((a, b) => a.d - b.d);
  let acc = 0, r68 = byDist[byDist.length - 1].d; for (const x of byDist) { acc += x.p; if (acc >= 0.68) { r68 = x.d; break; } }
  return { best, r68, pBest: post[bi] };
}
const median = (a) => a.length ? a.slice().sort((x, y) => x - y)[a.length >> 1] : null;

function main() {
  const infos = zones.map(zoneInfo);

  // layer 4 reliability: spread of each source around the OSM geocoder (median pair distance), clamped
  const sigmaBySource = { osm_geocoder: 250 }, reliability = {};
  ['geonames', 'wikidata', 'report_2023_placement'].forEach(key => {
    const ds = infos.map(i => { const a = i.sources.find(x => x.key === 'osm_geocoder'), b = i.sources.find(x => x.key === key); return a && b ? hav(a.lat, a.lng, b.lat, b.lng) : null; }).filter(v => v !== null);
    const m = median(ds);
    sigmaBySource[key] = ds.length >= 5 ? Math.min(800, Math.max(200, Math.round(1.5 * m))) : 500;
    reliability[key] = { zones_with_source: infos.filter(i => i.sources.some(x => x.key === key)).length, pairs_with_osm_geocoder: ds.length, median_distance_to_osm_geocoder_m: m === null ? null : Math.round(m), sigma_m: sigmaBySource[key] };
  });
  reliability.osm_geocoder = { zones_with_source: infos.filter(i => i.geo).length, sigma_m: 250 };
  const evidenceOf = (info, excludeKey) => info.sources.filter(x => x.key !== excludeKey).map(x => ({ key: x.key, lat: x.lat, lng: x.lng, sigma: sigmaBySource[x.key] }));

  const sets = infos.map(info => { const { cands, mode } = candidates(info); return { info, cands, mode, X: cands.map(c => features(info, c)) }; });

  // anchors: OSM geocode within 600 m of the stored point, medium/high stated confidence, a road candidate within 250 m of the geocode
  const anchors = [];
  sets.forEach((s, idx) => {
    const i = s.info; if (!i.geo || i.geo.d > 600 || !['high', 'medium'].includes(i.p.coordinate_confidence) || !s.cands.length) return;
    let y = 0, bd = Infinity; s.cands.forEach((c, ci) => { const d = hav(c.lat, c.lng, i.geo.lat, i.geo.lng); if (d < bd) { bd = d; y = ci; } });
    if (bd <= 250) anchors.push({ idx, s, y });
  });
  const LAMBDA = 0.5, ITERS = 200;
  const fullW = {}, looW = {};
  CONFIGS.forEach(cfg => { fullW[cfg.id] = anchors.length >= 5 ? fitLogit(anchors.map(a => ({ X: a.s.X, y: a.y })), maskOf(cfg), LAMBDA, ITERS) : new Array(FEATURE_NAMES.length).fill(0); });
  const weightsFor = (cfg, zoneIdx) => {
    const a = anchors.findIndex(x => x.idx === zoneIdx);
    if (a < 0) return fullW[cfg.id];
    const key = cfg.id + ':' + zoneIdx;
    if (!looW[key]) looW[key] = fitLogit(anchors.filter((_, j) => j !== a).map(x => ({ X: x.s.X, y: x.y })), maskOf(cfg), LAMBDA, ITERS);
    return looW[key];
  };

  // leave-one-source-out cross-validation: hide one independent source, estimate the position from everything else,
  // and measure the distance to the hidden source. Compared across the stored point and the three layer sets.
  const pairs = [];
  sets.forEach((s, idx) => {
    if (!s.cands.length) return;
    s.info.sources.forEach(t => {
      const row = { zone: s.info.name, target: t.key, stored: hav(s.info.lat, s.info.lng, t.lat, t.lng) };
      CONFIGS.forEach(cfg => {
        const ev = cfg.useSources ? evidenceOf(s.info, t.key) : [];
        const post = posterior(s.info, s, weightsFor(cfg, idx), maskOf(cfg), ev), sm = summarise(s, post);
        row[cfg.id] = hav(sm.best.lat, sm.best.lng, t.lat, t.lng);
      });
      pairs.push(row);
    });
  });
  const cvFor = (rows) => {
    const out = { pairs: rows.length, stored_point_median_m: rows.length ? Math.round(median(rows.map(r => r.stored))) : null };
    CONFIGS.forEach(cfg => { out[cfg.id] = { median_error_m: rows.length ? Math.round(median(rows.map(r => r[cfg.id]))) : null, better_than_stored: rows.filter(r => r[cfg.id] < r.stored).length + ' of ' + rows.length }; });
    return out;
  };
  const cvAll = cvFor(pairs), cvBySource = {};
  [...new Set(pairs.map(r => r.target))].forEach(k => { cvBySource[k] = cvFor(pairs.filter(r => r.target === k)); });
  // best layer set = lowest median error; it must also beat the stored point by 15 m and 20% to count as helping
  const ranked = CONFIGS.map(cfg => ({ cfg, m: cvAll[cfg.id].median_error_m })).filter(x => x.m !== null).sort((a, b) => a.m - b.m);
  const chosen = ranked.length ? ranked[0].cfg : CONFIGS[0];
  const mS = cvAll.stored_point_median_m, mC = cvAll[chosen.id].median_error_m;
  const modelHelps = anchors.length >= 5 && mS !== null && mS - mC >= 15 && mC <= 0.8 * mS;
  const validation = {
    method: 'Leave-one-source-out: one independent coordinate source is hidden, the position is estimated from the stored point, the layers and the remaining sources, and the distance to the hidden source is measured. Weights are re-fitted without the zone when it is a training anchor.',
    anchors: anchors.length, anchor_zones: anchors.map(a => a.s.info.name),
    pairs_tested: pairs.length, overall: cvAll, by_hidden_source: cvBySource,
    chosen_layer_set: chosen.id, chosen_layer_set_label: chosen.label, model_helps: modelHelps,
    caveat: 'The hidden sources are coordinates of the NAMED PLACE (geocoders, gazetteers, the 2023 placements), not true crash positions, and the OSM-based sources are not fully independent of the OSM road layer. This shows which layers help recover the named place, not where crashes occurred.'
  };
  const finalMask = maskOf(chosen);
  const loowMedian = mC || 120;

  const rows = sets.map((s, idx) => {
    const i = s.info;
    const base = { rank: i.p.table_6_29_rank || null, location_name: i.name, road_name: i.road, original: { lat: i.lat, lng: i.lng } };
    if (!s.cands.length) return Object.assign(base, { refined: null, mode: s.mode, recommendation: 'keep_original', reason: 'no OSM road candidates found' });
    const ev = chosen.useSources ? evidenceOf(i, null) : [];
    const post = posterior(i, s, fullW[chosen.id], finalMask, ev), sm = summarise(s, post);
    const moved = hav(i.lat, i.lng, sm.best.lat, sm.best.lng);
    const srcDist = i.sources.map(x => ({ key: x.key, d: hav(sm.best.lat, sm.best.lng, x.lat, x.lng), orig: hav(i.lat, i.lng, x.lat, x.lng) }));
    const nearestSrc = srcDist.length ? Math.min(...srcDist.map(x => x.d)) : null;
    const agrees = nearestSrc !== null && nearestSrc <= 300, conflict = nearestSrc !== null && nearestSrc > 600;
    const unc = Math.hypot(sm.r68, loowMedian, s.mode === 'matched_road' ? 0 : 400);
    const conf = conflict ? 'low' : unc <= 250 ? 'high' : unc <= 500 ? 'medium' : 'low';
    let rec = 'keep_original', reason = 'moved less than 150 m';
    if (moved >= 150) {
      if (conflict) { rec = 'review'; reason = 'the refined point is more than 600 m from every independent source'; }
      else if (agrees && moved > 1500) { rec = 'review'; reason = 'agrees with an independent source but moves the point more than 1.5 km, so a person should look first'; }
      else if (agrees && conf === 'low') { rec = 'review'; reason = 'agrees with an independent source but overall uncertainty is too large to recommend a move'; }
      else if (agrees && !modelHelps) { rec = 'review'; reason = 'an independent source is near the refined point, but validation shows the layers do not beat the stored point, so no move is recommended automatically'; }
      else if (agrees) { rec = 'use_refined'; reason = 'refined point is on a major road and within 300 m of an independent source'; }
      else { rec = 'review'; reason = s.mode === 'matched_road' ? 'moves along the named road but no independent source confirms it' : 'no OSM road with the reported name nearby; position stays uncertain'; }
    }
    // How well do the independent sources and the stored point agree with each other? (Independent of the regression.)
    const pts = [{ lat: i.lat, lng: i.lng }].concat(i.sources), spread = Math.max(...pts.flatMap((a, x) => pts.slice(x + 1).map(b => hav(a.lat, a.lng, b.lat, b.lng))), 0);
    const agreement = !i.sources.length ? 'stored_point_only' : spread <= 300 ? 'consistent' : spread <= 1000 ? 'partial' : 'conflicting';
    return Object.assign(base, {
      evidence_agreement: agreement, evidence_spread_m: Math.round(spread),
      refined: { lat: +sm.best.lat.toFixed(6), lng: +sm.best.lng.toFixed(6), on_road: sm.best.road },
      moved_m: Math.round(moved), model_spread_68pct_m: Math.round(sm.r68), uncertainty_m: Math.round(unc), confidence: conf, mode: s.mode, candidates: s.cands.length,
      sources: i.sources.map((x, k) => ({ source: x.key, lat: +x.lat.toFixed(6), lng: +x.lng.toFixed(6), distance_to_original_m: Math.round(srcDist[k].orig), distance_to_refined_m: Math.round(srcDist[k].d) })),
      recommendation: rec, reason
    });
  });

  const summary = rows.reduce((a, r) => (a[r.recommendation] = (a[r.recommendation] || 0) + 1, a), {});
  const agreementCounts = rows.reduce((a, r) => (a[r.evidence_agreement || 'no_road_candidates'] = (a[r.evidence_agreement || 'no_road_candidates'] || 0) + 1, a), {});
  const out = {
    generated: new Date().toISOString().slice(0, 10),
    method: 'Conditional-logit regression over candidate points on major OSM roads. Layer 1 street network, layer 2 OSM-derived traffic-exposure proxy (no measured traffic), layer 3 crash-type compatibility, layer 4 independent coordinate sources (OSM geocoders, GeoNames, Wikidata, 2023 report placements) with data-estimated spreads. The best layer set is chosen by leave-one-source-out validation.',
    layers: { 1: 'street network', 2: 'traffic-exposure proxy', 3: 'crash-type compatibility', 4: 'independent coordinate sources' },
    source_reliability: reliability,
    weights: Object.fromEntries(FEATURE_NAMES.map((n, k) => [n, +(fullW[chosen.id][k] * finalMask[k]).toFixed(3)])),
    validation, summary, evidence_agreement_counts: agreementCounts, zones: rows
  };
  fs.writeFileSync(P('data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.json'), JSON.stringify(out, null, 1));
  const cols = ['rank', 'location_name', 'road_name', 'recommendation', 'reason', 'evidence_agreement', 'evidence_spread_m', 'moved_m', 'uncertainty_m', 'model_spread_68pct_m', 'confidence', 'mode'];
  const q = (v) => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"';
  const header = cols.concat(['orig_lat', 'orig_lng', 'refined_lat', 'refined_lng', 'sources_used']);
  fs.writeFileSync(P('data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.csv'), [header.join(',')].concat(rows.map(r => cols.map(c => q(r[c])).concat([
    r.original.lat, r.original.lng, r.refined ? r.refined.lat : '', r.refined ? r.refined.lng : '', (r.sources || []).map(x => x.source).join(';')].map(v => q(v))).join(','))).join('\n') + '\n');
  console.log('source reliability', JSON.stringify(reliability));
  console.log('cross-validation overall', JSON.stringify(cvAll, null, 1));
  console.log('by hidden source', JSON.stringify(cvBySource));
  console.log('chosen', chosen.id, '| model_helps', modelHelps, '| anchors', anchors.length);
  console.log('weights', out.weights);
  console.log('summary', summary, 'agreement', agreementCounts);
}
main();
