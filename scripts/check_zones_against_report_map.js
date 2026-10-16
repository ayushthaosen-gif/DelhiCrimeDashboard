// Coarse check of the stored crash-zone points against the dots on the report's own Map 6.1 (see scripts/georeference_report_map.py).
// The map is a 96 ppi raster (about 150 m per pixel, dots about 1 km wide, outline registered to within roughly 1 km), so this is a
// sanity check at the kilometre scale, NOT a way to place a zone to a few hundred metres. It answers: does a point sit near any dot
// the report drew, or is it far from all of them (likely misplaced, or its dot was hidden inside a cluster)?
//
//   node scripts/check_zones_against_report_map.js
//
// Output: data/audits/crash_zones_2024/crash_zone_report_map_check_2024.json

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const A = path.join(ROOT, 'data/audits/crash_zones_2024');

const KX = 111320 * Math.cos(28.65 * Math.PI / 180), KY = 110574;
const dotsFile = JSON.parse(fs.readFileSync(path.join(A, 'crash_zone_report_map_dots_2024.json'), 'utf8'));
const dots = dotsFile.dots;
const zones = JSON.parse(fs.readFileSync(path.join(A, 'crash_zone_coordinates_refined_2024.json'), 'utf8')).zones;
const wards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_wards_infra.geojson'), 'utf8')).features;

const nearest = (lat, lng) => {
  let best = Infinity;
  for (const q of dots) { const d = Math.hypot((q.lon - lng) * KX, (q.lat - lat) * KY); if (d < best) best = d; }
  return best;
};
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };

// baseline: where would an arbitrary point in Delhi sit relative to the dots? (ward centroids, deterministic)
const centroids = wards.map(f => {
  const xs = [], ys = [];
  (function walk(c) { if (typeof c[0] === 'number') { xs.push(c[0]); ys.push(c[1]); } else c.forEach(walk); })(f.geometry.coordinates);
  return [(Math.min(...ys) + Math.max(...ys)) / 2, (Math.min(...xs) + Math.max(...xs)) / 2];
});
const baseline = centroids.map(([la, lo]) => nearest(la, lo));

const rows = zones.map(z => {
  const d = nearest(z.original.lat, z.original.lng);
  const srcs = (z.sources || []).map(s => ({ source: s.source, dot_distance_m: Math.round(nearest(s.lat, s.lng)) }));
  return {
    rank: z.rank, location_name: z.location_name, road_name: z.road_name,
    nearest_dot_m: Math.round(d), source_nearest_dot_m: srcs,
    map_check: d <= 1500 ? 'near_a_dot' : d <= 2500 ? 'far_from_dots' : 'no_dot_within_2500m'
  };
});
const counts = rows.reduce((a, r) => (a[r.map_check] = (a[r.map_check] || 0) + 1, a), {});
const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: dotsFile.source,
  georeference: dotsFile.georeference,
  dots_detected: dots.length, dots_in_report: 111,
  caveat: 'Kilometre-scale check only. The map is a low-resolution raster; ' + (111 - dots.length) + ' of the 111 dots could not be separated from clusters, so a zone near the crowded centre may match a hidden dot. "no_dot_within_2500m" means "look at this point", not "wrong".',
  stored_point_to_nearest_dot_m: { median: Math.round(median(rows.map(r => r.nearest_dot_m))), p90: Math.round(pct(rows.map(r => r.nearest_dot_m), 0.9)) },
  random_point_in_delhi_to_nearest_dot_m: { median: Math.round(median(baseline)), p90: Math.round(pct(baseline, 0.9)), method: 'centroids of the 290 wards' },
  counts, zones: rows
};
fs.writeFileSync(path.join(A, 'crash_zone_report_map_check_2024.json'), JSON.stringify(out, null, 1));
console.log('dots', dots.length, '| stored->dot median/p90', out.stored_point_to_nearest_dot_m, '| ward centroids->dot', out.random_point_in_delhi_to_nearest_dot_m, '|', counts);
