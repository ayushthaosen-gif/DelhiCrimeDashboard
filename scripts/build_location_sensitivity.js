// How far do approximate crash-zone positions change which ward a zone belongs to, and how the wards rank?
//
// Each 2024 zone was placed by hand with a stated accuracy (150 m to 5 km). For N = 2000 simulated placements, every zone is moved to a point drawn
// uniformly from the disc of its stated radius around the placed point; it is re-assigned to a legacy ward by point-in-polygon; ward totals of fatal
// crashes counted in zones and ward ranks are recomputed. Seeded, so it reproduces exactly.
//
// This tests sensitivity to the stated accuracy. The stated accuracy is the project's estimate, not a measured error: the true error may be larger,
// the error is not necessarily uniform inside the disc, and the ward boundaries (DataMeet, legacy 290 wards) have their own error.
//
//   node scripts/build_location_sensitivity.js      (npm run build:profiles runs it after the profile build)
//
// Writes data/profiles/location_sensitivity_2024.json, location_sensitivity_zones_2024.csv and location_sensitivity_wards_2024.csv.

const fs = require('fs');
const path = require('path');
const { sha256, toCsv } = require('./lib/release_utils');
const { indexPolygons, locate, mulberry32, inDisc } = require('./lib/geo');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'profiles');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const N = 2000, SEED = 20261022;
const round = (v, d) => Math.round(v * Math.pow(10, d)) / Math.pow(10, d);

const wards = read('data/delhi_wards_infra.geojson').features;
const zonesGeo = read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features;
const index = indexPolygons(wards);
const wardNo = i => String(wards[i].properties.Ward_No), wardName = i => wards[i].properties.Ward_Name, wardDistrict = i => wards[i].properties.assignedDistrict || null;

const zones = zonesGeo.map(f => {
  const p = f.properties;
  return { name: p.location_name, lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], acc: p.estimated_accuracy_m, fatal: p.all_fatal_crashes == null ? null : p.all_fatal_crashes, ped: p.pedestrian_fatal_crashes == null ? null : p.pedestrian_fatal_crashes, tableRank: p.table_6_29_rank == null ? null : p.table_6_29_rank };
});
zones.forEach(z => { z.base = locate(index, z.lng, z.lat); });

// competition ranking among wards with a total above zero (ties share the better rank); null when the ward has none
function ranksOf(totals) {
  const pos = totals.map((t, i) => [t, i]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]);
  const r = new Array(totals.length).fill(null);
  pos.forEach((x, k) => { r[x[1]] = k > 0 && pos[k - 1][0] === x[0] ? r[pos[k - 1][1]] : k + 1; });
  return r;
}
const totalsOf = assign => { const t = new Array(wards.length).fill(0); zones.forEach((z, k) => { if (z.fatal != null && assign[k] >= 0) t[assign[k]] += z.fatal; }); return t; };

const baseAssign = zones.map(z => z.base), baseTotals = totalsOf(baseAssign), baseRanks = ranksOf(baseTotals);
const rand = mulberry32(SEED);
const zoneHits = zones.map(() => new Map());            // ward index (or -1) -> simulations
const wardTotals = wards.map(() => new Int32Array(N));
const wardRanks = wards.map(() => new Int32Array(N));    // 0 = unranked
const top10 = new Int32Array(wards.length), top10Set = new Set(baseRanks.map((r, i) => [r, i]).filter(x => x[0] != null && x[0] <= 10).map(x => x[1]));
let jaccardSum = 0;
for (let s = 0; s < N; s++) {
  const assign = zones.map((z, k) => {
    const [lng, lat] = inDisc(rand, z.lng, z.lat, z.acc), w = locate(index, lng, lat);
    zoneHits[k].set(w, (zoneHits[k].get(w) || 0) + 1);
    return w;
  });
  const t = totalsOf(assign), r = ranksOf(t), set = new Set();
  wards.forEach((_, i) => { wardTotals[i][s] = t[i]; wardRanks[i][s] = r[i] == null ? 0 : r[i]; if (r[i] != null && r[i] <= 10) { top10[i]++; set.add(i); } });
  let inter = 0; set.forEach(i => { if (top10Set.has(i)) inter++; });
  jaccardSum += inter / (set.size + top10Set.size - inter);
}
const pct = (arr, q) => { const a = Array.from(arr).sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };

// ---- zones ----
const zoneRows = zones.map((z, k) => {
  const hits = [...zoneHits[k].entries()].sort((a, b) => b[1] - a[1]);
  const same = (zoneHits[k].get(z.base) || 0) / N, outside = (zoneHits[k].get(-1) || 0) / N;
  const alts = hits.filter(h => h[0] !== z.base && h[0] >= 0).slice(0, 4).map(h => ({ ward_no: wardNo(h[0]), ward_name: wardName(h[0]), p: round(h[1] / N, 3) }));
  return {
    zone: z.name, accuracy_m: z.acc, ward_no: z.base >= 0 ? wardNo(z.base) : null, ward_name: z.base >= 0 ? wardName(z.base) : null, district: z.base >= 0 ? wardDistrict(z.base) : null,
    fatal_crashes_2024: z.fatal, p_same_ward: round(same, 3), p_outside_all_wards: round(outside, 3), other_wards_possible: hits.filter(h => h[0] !== z.base && h[0] >= 0).length,
    alternatives: alts, stability: round(same, 3) >= 0.95 ? 'stable' : round(same, 3) >= 0.5 ? 'uncertain' : 'unstable'
  };
});

// ---- wards ----
const wardRows = [];
wards.forEach((_, i) => {
  const t = wardTotals[i], ranked = Array.from(wardRanks[i]).filter(r => r > 0);
  const pAny = Array.from(t).filter(v => v > 0).length / N;
  if (baseTotals[i] === 0 && pAny < 0.02) return;
  const row = {
    ward_no: wardNo(i), ward_name: wardName(i), district: wardDistrict(i),
    baseline_fatal_crashes_in_zones: baseTotals[i], baseline_rank: baseRanks[i],
    fatal_p05: pct(t, 0.05), fatal_median: pct(t, 0.5), fatal_p95: pct(t, 0.95),
    rank_p05: ranked.length ? pct(ranked, 0.05) : null, rank_median: ranked.length ? pct(ranked, 0.5) : null, rank_p95: ranked.length ? pct(ranked, 0.95) : null,
    p_ranked: round(ranked.length / N, 3), p_top10: round(top10[i] / N, 3), p_unchanged_total: round(Array.from(t).filter(v => v === baseTotals[i]).length / N, 3)
  };
  row.stability = baseRanks[i] != null && baseRanks[i] <= 10 ? (row.p_top10 >= 0.9 ? 'robust top 10' : row.p_top10 >= 0.5 ? 'likely top 10' : 'rank depends on position') : (baseTotals[i] === 0 ? 'could receive a zone' : (row.p_unchanged_total >= 0.9 ? 'stable' : 'total depends on position'));
  wardRows.push(row);
});
wardRows.sort((a, b) => (a.baseline_rank == null) - (b.baseline_rank == null) || a.baseline_rank - b.baseline_rank || b.p_ranked - a.p_ranked);

const count = (arr, f) => arr.filter(f).length;
const summary = {
  simulations: N, seed: SEED, zones: zones.length,
  zonesStable: count(zoneRows, z => z.stability === 'stable'), zonesUncertain: count(zoneRows, z => z.stability === 'uncertain'), zonesUnstable: count(zoneRows, z => z.stability === 'unstable'),
  zonesThatCanChangeWard: count(zoneRows, z => z.p_same_ward < 1),
  zonesWithin250m: count(zoneRows, z => z.accuracy_m <= 250),
  baselineTop10WardsRobust: count(wardRows, w => w.baseline_rank != null && w.baseline_rank <= 10 && w.p_top10 >= 0.9),
  baselineTop10Wards: baseRanks.filter(r => r != null && r <= 10).length,
  meanTop10Overlap: round(jaccardSum / N, 3),
  wardsWithZoneBaseline: count(wardRows, w => w.baseline_fatal_crashes_in_zones > 0),
  wardsWhoseTotalChangesOften: count(wardRows, w => w.baseline_fatal_crashes_in_zones > 0 && w.p_unchanged_total < 0.5),
  wardsThatCouldReceiveAZone: count(wardRows, w => w.baseline_fatal_crashes_in_zones === 0),
  zonesOutsideAllWardsSometimes: count(zoneRows, z => z.p_outside_all_wards > 0)
};
const inputFiles = ['data/delhi_wards_infra.geojson', 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson'];
const out = {
  schemaVersion: '1.0.0',
  title: 'How approximate 2024 crash-zone positions affect ward assignment and ward rankings',
  method: 'Each zone is moved to a point drawn uniformly from the disc of its stated accuracy around its placed point, re-assigned to a legacy ward by point-in-polygon, and the fatal crashes counted in zones, ward totals and ranks are recomputed. ' + N + ' simulations, seed ' + SEED + '. Ranks are competition ranks among wards with a total above zero (ties share the better rank). Counts per zone are fixed at the printed values; a zone that prints no count contributes nothing.',
  caveats: [
    'This tests sensitivity to the stated accuracy (150 m to 5 km). That accuracy is the project\'s estimate, not a measured error: the true error may be larger and need not be uniform within the disc.',
    'The ward boundaries are the legacy 290 (DataMeet), not the current 250, and have their own error; a zone near a boundary is sensitive to both.',
    'Only position is varied. The printed counts, the zone list itself (which changes every year) and the zones the report does not name are not.',
    'A ward rank is a range, not a point: read the 5th to 95th percentile columns, not the baseline rank alone.'
  ],
  summary,
  zones: zoneRows.sort((a, b) => a.p_same_ward - b.p_same_ward || (a.zone < b.zone ? -1 : 1)),
  wards: wardRows,
  inputs: inputFiles.map(f => ({ file: f, sha256: sha256(path.join(ROOT, f)) }))
};
fs.writeFileSync(path.join(OUT, 'location_sensitivity_2024.json'), JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'location_sensitivity_zones_2024.csv'), toCsv(['zone', 'accuracy_m', 'ward_no', 'ward_name', 'district', 'fatal_crashes_2024', 'p_same_ward', 'p_outside_all_wards', 'other_wards_possible', 'stability', 'alternatives'],
  out.zones.map(z => Object.assign({}, z, { alternatives: z.alternatives.map(a => a.ward_no + ' ' + a.ward_name + ' (' + a.p + ')').join('; ') }))));
fs.writeFileSync(path.join(OUT, 'location_sensitivity_wards_2024.csv'), toCsv(['ward_no', 'ward_name', 'district', 'baseline_fatal_crashes_in_zones', 'baseline_rank', 'fatal_p05', 'fatal_median', 'fatal_p95', 'rank_p05', 'rank_median', 'rank_p95', 'p_ranked', 'p_top10', 'p_unchanged_total', 'stability'], out.wards));
console.log('location sensitivity: ' + JSON.stringify(summary));
