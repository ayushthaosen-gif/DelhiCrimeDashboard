// Audits the approximate 2024 crash-zone coordinates (data/delhi_crash_prone_zones_2024_all_named_approx.geojson).
// The report does not publish coordinates, so every point is a hand-placed landmark centre. This script does
// NOT change them. It cross-checks each point three independent ways and writes a review list:
//
//   1. Geometry: is the point inside Delhi and inside a ward polygon; is it a near-duplicate of another zone.
//   2. Road: distance to the nearest OSM major road whose name or ref matches the report's road name
//      (local snapshot data/source/osm_major_roads_delhi_raw.json, no network needed).
//   3. Geocode: distance to what OpenStreetMap Nominatim returns for the zone name (1 request/second,
//      descriptive User-Agent; results cached in data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json).
//
//   node scripts/audit_crash_zone_coordinates.js            # uses the cache, fetches only missing queries
//   node scripts/audit_crash_zone_coordinates.js --offline  # cache only, never touches the network
//
// Outputs: data/audits/crash_zones_2024/crash_zone_coordinate_audit_2024_review.csv and .json

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OFFLINE = process.argv.includes('--offline');

const zonesFile = path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson');
const wardsFile = path.join(ROOT, 'data/delhi_wards_infra.geojson');
const roadsFile = path.join(ROOT, 'data/source/osm_major_roads_delhi_raw.json');
const cacheFile = path.join(ROOT, 'data/audits/crash_zones_2024/crash_zone_geocode_check_2024.json');
const outCsv = path.join(ROOT, 'data/audits/crash_zones_2024/crash_zone_coordinate_audit_2024_review.csv');
const outJson = path.join(ROOT, 'data/audits/crash_zones_2024/crash_zone_coordinate_audit_2024_review.json');

const BBOX = { minLat: 28.35, maxLat: 28.95, minLng: 76.7, maxLng: 77.45 };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const R = 6371000, RAD = Math.PI / 180;

function haversine(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * RAD, dLng = (lng2 - lng1) * RAD;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Nearest point on a polyline to (lat, lng), local flat-earth metres. Returns { d, lat, lng }.
function nearestOnLine(lat, lng, geom) {
  const kx = Math.cos(lat * RAD) * 111320, ky = 110540;
  let best = { d: Infinity };
  for (let i = 0; i < geom.length - 1; i++) {
    const ax = (geom[i].lon - lng) * kx, ay = (geom[i].lat - lat) * ky;
    const bx = (geom[i + 1].lon - lng) * kx, by = (geom[i + 1].lat - lat) * ky;
    const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy;
    let t = L2 === 0 ? 0 : -(ax * vx + ay * vy) / L2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * vx, py = ay + t * vy, d = Math.hypot(px, py);
    if (d < best.d) best = { d, lat: lat + py / ky, lng: lng + px / kx };
  }
  return best;
}

function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inGeometry(lng, lat, g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some(p => inRing(lng, lat, p[0]) && !p.slice(1).some(h => inRing(lng, lat, h)));
}

// ---- road-name matching: the report's road name vs OSM name / ref -------------------------------------------
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
  const rn = (roadName || '').toLowerCase();
  const tokens = new Set();
  for (const [re, list] of ALIASES) if (re.test(rn)) list.forEach(t => tokens.add(t));
  rn.replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w) && w !== 'nh').forEach(w => tokens.add(w));
  const nh = rn.match(/nh[-\s]?(\d+)/); if (nh) { tokens.add('nh' + nh[1]); tokens.add('nh ' + nh[1]); }
  return [...tokens];
}
function roadMatches(tags, tokens) {
  if (!tags || !tokens.length) return false;
  const hay = ((tags.name || '') + ' | ' + (tags.ref || '') + ' | ' + (tags['name:en'] || '') + ' | ' + (tags.alt_name || '')).toLowerCase();
  return tokens.some(t => hay.includes(t));
}

// ---- Nominatim ----------------------------------------------------------------------------------------------
async function nominatim(q) {
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&countrycodes=in&bounded=1' +
    '&viewbox=' + [BBOX.minLng, BBOX.maxLat, BBOX.maxLng, BBOX.minLat].join(',') + '&q=' + encodeURIComponent(q);
  const res = await fetch(url, { headers: { 'User-Agent': 'DelhiCrimeDashboard-CrashZoneAudit/1.0 (research audit; github.com/ayushthaosen-gif/DelhiCrimeDashboard)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return (await res.json()).map(r => ({ lat: Number(r.lat), lng: Number(r.lon), name: r.display_name, type: r.type, cls: r.category || r.class }));
}

async function main() {
  const zones = JSON.parse(fs.readFileSync(zonesFile, 'utf8')).features;
  const wards = JSON.parse(fs.readFileSync(wardsFile, 'utf8')).features;
  const roads = JSON.parse(fs.readFileSync(roadsFile, 'utf8')).elements.filter(e => e.geometry && e.tags);
  let cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};

  // 3. geocode (cached)
  if (!OFFLINE) {
    let n = 0;
    for (const z of zones) {
      const p = z.properties;
      const queries = [p.osm_search_query, p.location_name + ', Delhi, India'].filter((q, i, a) => q && a.indexOf(q) === i);
      for (const q of queries) {
        if (cache[q]) continue;
        try { cache[q] = await nominatim(q); } catch (e) { console.log('geocode error', q, e.message); continue; }
        n++;
        fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
        await sleep(1100);
      }
    }
    console.log('geocode queries fetched this run:', n);
  }

  const rows = zones.map((z) => {
    const p = z.properties, [lng, lat] = z.geometry.coordinates, acc = p.estimated_accuracy_m || 500;
    const flags = [];

    // 1. geometry
    const inBox = lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
    if (!inBox) flags.push('outside_delhi_bbox');
    const ward = wards.find(w => inGeometry(lng, lat, w.geometry));
    if (!ward) flags.push('not_in_any_ward');
    const dupes = zones.filter(o => o !== z && haversine(lat, lng, o.geometry.coordinates[1], o.geometry.coordinates[0]) < 100)
      .map(o => o.properties.location_name);
    if (dupes.length) flags.push('within_100m_of_other_zone');

    // 2. road
    const tokens = roadTokens(p.road_name);
    let nearestAny = { d: Infinity }, nearestMatch = { d: Infinity, road: null };
    for (const r of roads) {
      const b = r.bounds;
      if (b && (lat < b.minlat - 0.02 || lat > b.maxlat + 0.02 || lng < b.minlon - 0.02 || lng > b.maxlon + 0.02)) continue;
      const hit = nearestOnLine(lat, lng, r.geometry);
      if (hit.d < nearestAny.d) nearestAny = hit;
      if (hit.d < nearestMatch.d && roadMatches(r.tags, tokens)) nearestMatch = Object.assign(hit, { road: (r.tags.name || '') + (r.tags.ref ? ' [' + r.tags.ref + ']' : '') });
    }
    const roadLimit = Math.max(150, acc);
    if (!isFinite(nearestMatch.d)) flags.push('no_named_road_match_nearby');
    else if (nearestMatch.d > roadLimit) flags.push('matched_road_beyond_stated_accuracy');
    if (nearestAny.d > 250) flags.push('no_major_road_within_250m');

    // 3. geocode agreement
    const queries = [p.osm_search_query, p.location_name + ', Delhi, India'].filter(Boolean);
    const hits = [];
    queries.forEach(q => (cache[q] || []).slice(0, 1).forEach(h => hits.push(Object.assign({ q }, h, { d: haversine(lat, lng, h.lat, h.lng) }))));
    hits.sort((a, b) => a.d - b.d);
    const bestGeo = hits[0] || null;
    if (!bestGeo) flags.push('no_geocode_result');
    else if (bestGeo.d > Math.max(acc * 1.5, 400)) flags.push('geocode_disagrees');

    // verdict
    const hard = flags.filter(f => ['outside_delhi_bbox', 'not_in_any_ward'].includes(f)).length;
    const roadBad = flags.includes('matched_road_beyond_stated_accuracy') || flags.includes('no_named_road_match_nearby');
    const geoBad = flags.includes('geocode_disagrees');
    let verdict = 'ok';
    if (hard || (roadBad && geoBad)) verdict = 'suspect';
    else if (flags.some(f => f !== 'no_geocode_result') || (p.coordinate_confidence === 'low' || p.coordinate_confidence === 'very_low')) verdict = 'review';

    return {
      rank: p.table_6_29_rank || null, location_name: p.location_name, road_name: p.road_name,
      lat, lng, stated_method: p.coordinate_method, stated_confidence: p.coordinate_confidence, stated_accuracy_m: acc,
      ward: ward ? ward.properties.Ward_Name : null, district: ward ? ward.properties.assignedDistrict : null,
      nearest_major_road_m: round(nearestAny.d), matched_road: nearestMatch.road, matched_road_m: round(nearestMatch.d),
      snap_lat: isFinite(nearestMatch.d) && nearestMatch.d <= 800 ? round(nearestMatch.lat, 5) : null,
      snap_lng: isFinite(nearestMatch.d) && nearestMatch.d <= 800 ? round(nearestMatch.lng, 5) : null,
      geocode_best_m: bestGeo ? round(bestGeo.d) : null, geocode_name: bestGeo ? bestGeo.name : null,
      geocode_lat: bestGeo ? round(bestGeo.lat, 5) : null, geocode_lng: bestGeo ? round(bestGeo.lng, 5) : null,
      flags, verdict
    };
  });

  const counts = rows.reduce((a, r) => (a[r.verdict] = (a[r.verdict] || 0) + 1, a), {});
  fs.writeFileSync(outJson, JSON.stringify({
    generated: new Date().toISOString().slice(0, 10),
    note: 'Audit only. Coordinates in the main file are unchanged. "suspect" = fails a hard check or fails both road and geocode checks; "review" = at least one soft flag or low stated confidence. Geocode results come from OpenStreetMap Nominatim and can themselves be wrong for named places.',
    counts, zones: rows
  }, null, 1));
  const header = ['rank', 'location_name', 'road_name', 'verdict', 'flags', 'lat', 'lng', 'stated_confidence', 'stated_accuracy_m', 'ward', 'district',
    'nearest_major_road_m', 'matched_road', 'matched_road_m', 'snap_lat', 'snap_lng', 'geocode_best_m', 'geocode_lat', 'geocode_lng', 'geocode_name'];
  const q = (v) => v == null ? '' : '"' + String(Array.isArray(v) ? v.join(';') : v).replace(/"/g, '""') + '"';
  fs.writeFileSync(outCsv, [header.join(',')].concat(rows.map(r => header.map(h => q(r[h])).join(','))).join('\n') + '\n');
  console.log('zones audited:', rows.length, counts);
}
function round(v, d) { d = d == null ? 0 : d; return isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null; }

main().catch(e => { console.error(e); process.exit(1); });
