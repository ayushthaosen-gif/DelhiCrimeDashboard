// Phase 4 planning confidence: the simulation of approximate zone positions is reproducible, its numbers are internally consistent and agree with the
// ward assignment used everywhere else, and the Planning page, the Why panel and the evidence pack carry the resulting ranges and warnings.
//
//   node --test test/location_sensitivity.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { sha256 } = require('../scripts/lib/release_utils');
const { mulberry32, inDisc, indexPolygons, locate } = require('../scripts/lib/geo');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));
const S = json('data/profiles/location_sensitivity_2024.json');
const files = render();

test('the simulation reproduces exactly: the same seed gives byte-identical files, and the inputs are the ones hashed', () => {
  const names = ['location_sensitivity_2024.json', 'location_sensitivity_zones_2024.csv', 'location_sensitivity_wards_2024.csv'];
  const before = names.map(n => read('data/profiles/' + n));
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/build_location_sensitivity.js')], { encoding: 'utf8' });
  names.forEach((n, i) => assert.equal(read('data/profiles/' + n), before[i], n + ' is deterministic'));
  assert.equal(S.summary.simulations, 2000);
  assert.equal(S.summary.seed, 20261022);
  for (const f of S.inputs) assert.equal(f.sha256, sha256(path.join(ROOT, f.file)), f.file);
  const a = mulberry32(7), b = mulberry32(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  const r = mulberry32(1);
  for (let i = 0; i < 200; i++) { const [lng, lat] = inDisc(r, 77.2, 28.6, 500); const dm = Math.hypot((lng - 77.2) * 111320 * Math.cos(28.6 * Math.PI / 180), (lat - 28.6) * 111320); assert.ok(dm <= 500.5, 'inside the stated radius'); }
});

test('zone results: 93 zones, the classes add up and follow the thresholds, probabilities are valid, small accuracy stays stable', () => {
  const z = S.zones;
  assert.equal(z.length, 93);
  assert.equal(S.summary.zonesStable + S.summary.zonesUncertain + S.summary.zonesUnstable, 93);
  for (const q of z) {
    assert.ok(q.p_same_ward >= 0 && q.p_same_ward <= 1 && q.p_outside_all_wards >= 0 && q.accuracy_m >= 150 && q.accuracy_m <= 5000, q.zone);
    assert.equal(q.stability, q.p_same_ward >= 0.95 ? 'stable' : q.p_same_ward >= 0.5 ? 'uncertain' : 'unstable', q.zone);
    const alt = q.alternatives.reduce((a, x) => a + x.p, 0);
    assert.ok(q.p_same_ward + (q.ward_no === null ? 0 : q.p_outside_all_wards) + alt <= 1.01, q.zone + ': probabilities do not exceed 1');
    assert.ok(q.alternatives.every(x => x.ward_no !== q.ward_no && x.p > 0));
    if (q.p_same_ward < 1) assert.ok(q.other_wards_possible >= 1 || q.p_outside_all_wards > 0, q.zone);
  }
  assert.equal(S.summary.zonesStable, z.filter(q => q.stability === 'stable').length);
  const wide = z.filter(q => q.accuracy_m >= 1200), tight = z.filter(q => q.accuracy_m <= 250);
  const mean = a => a.reduce((x, y) => x + y.p_same_ward, 0) / a.length;
  assert.ok(mean(tight) > mean(wide) + 0.3, 'tighter stated accuracy keeps a zone in its ward more often');
});

test('ward results: the baseline matches the ward profiles, ranges bracket the baseline, probabilities are valid', () => {
  const prof = json('data/profiles/ward_profiles.json').rows;
  const base = new Map(S.wards.filter(w => w.baseline_fatal_crashes_in_zones > 0).map(w => [w.ward_no, w.baseline_fatal_crashes_in_zones]));
  for (const r of prof) if (r.crash_zone_fatal_crashes_2024 != null && r.crash_zone_fatal_crashes_2024 > 0) assert.equal(base.get(r.ward_no), r.crash_zone_fatal_crashes_2024, 'ward ' + r.ward_no + ' agrees with the profile');
  // the zone-to-ward assignment is the one the profiles use
  const wardsGeo = json('data/delhi_wards_infra.geojson').features, idx = indexPolygons(wardsGeo), zones = json('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features;
  const profByNo = new Map(prof.map(r => [r.ward_no, r]));
  for (const f of zones) {
    const i = locate(idx, f.geometry.coordinates[0], f.geometry.coordinates[1]);
    if (i < 0) continue;
    const row = profByNo.get(String(wardsGeo[i].properties.Ward_No));
    assert.ok(row.zones.some(q => q.name === f.properties.location_name), f.properties.location_name + ' is in its ward in the profiles');
  }
  for (const w of S.wards) {
    assert.ok(w.fatal_p05 <= w.fatal_median && w.fatal_median <= w.fatal_p95, w.ward_no);
    if (w.baseline_rank != null) { assert.ok(w.rank_p05 <= w.rank_p95); assert.ok(w.p_top10 >= 0 && w.p_top10 <= 1); }
  }
  assert.equal(S.summary.baselineTop10Wards, 10);
  assert.ok(S.summary.baselineTop10WardsRobust < 10 && S.summary.meanTop10Overlap > 0 && S.summary.meanTop10Overlap < 1, 'the ranking is not perfectly stable under the stated accuracy');
  assert.ok(S.caveats.some(c => /not a measured error/.test(c)) && /competition ranks/.test(S.method));
});

test('the page: the Planning data carries the results, the views have a Location uncertainty tab, ranked rows mark unstable ranks, the panel and Markdown explain the ranges', () => {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(files['assets/planning-data.js'], ctx);
  const PLAN = JSON.parse(JSON.stringify(ctx.window.DSO_PLAN));
  assert.deepEqual(PLAN.sens.summary, S.summary);
  assert.equal(PLAN.sens.zones.length, 93);
  assert.equal(Object.keys(PLAN.sens.wards).length, S.wards.length);
  assert.ok(files['assets/planning-data.js'].length < 400 * 1024, 'the ward data stays small enough to load on a phone');
  const src = read('assets/page-planning.js'), why = read('assets/why.js');
  for (const t of ["['loc', 'Location uncertainty']", 'Treat ward figures as ranges.', 'function approxMark', 'pl-approx', 'Rank range (5th–95th)', 'Each zone: how often it stays in its ward', 'Seeded, so it reproduces exactly', "loc: locFor(w)"]) assert.ok(src.includes(t), t);
  for (const t of ['How much the zone positions matter', 'W.locLines', 'The stated accuracy is an estimate, not a measured error', 'Because positions are approximate, the ward totals and rank here are ranges']) assert.ok(why.includes(t), t);
  assert.ok(!/innerHTML/.test(src + why));
  // run the real sentence builder
  const noop = () => {}, el = () => ({ setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { toggle: noop }, style: {} });
  const document = { addEventListener: noop, getElementById: () => null, createElement: el, createElementNS: el, createTextNode: () => ({}), documentElement: { getAttribute: () => 'light' }, querySelector: () => null };
  const c2 = vm.createContext({ window: { DSO_PROFILES: JSON.parse(JSON.stringify((() => { const x = vm.createContext({ window: {} }); vm.runInContext(files['assets/profiles-data.js'], x); return x.window.DSO_PROFILES; })())) }, document, localStorage: { getItem: () => null }, CustomEvent: function () {}, Blob: function () {}, TextEncoder, URL: { createObjectURL: () => '' }, setTimeout });
  c2.window.window = c2.window;
  vm.runInContext(read('assets/site.js'), c2); vm.runInContext(read('assets/why.js'), c2);
  const W = c2.window.DSO.why;
  const lines = W.locLines({ ward: { baselineRank: 1, rank05: 1, rank95: 23, pTop10: 0.86, baselineFatal: 19, fatal05: 4, fatal95: 27, pUnchanged: 0.07 }, zones: [{ name: 'Z', accuracy: 700, pSame: 0.47, stability: 'unstable', alts: [['1', 'A', 0.27], ['2', 'B', 0.004]] }], incoming: [{ name: 'Y', accuracy: 800, p: 0.41, fromWard: 'C' }, { name: 'X', accuracy: 100, p: 0.004, fromWard: 'D' }] });
  assert.match(lines[0], /ranks 1st .* between 1st and 23rd .* top 10 in 86%/);
  assert.match(lines[1], /between 4 and 27/);
  assert.match(lines[2], /stays in this ward in 47% .*\(unstable\)\. Otherwise: A \(27%\)\./);
  assert.ok(!/B \(/.test(lines[2]), 'a placement under 1% is not listed');
  assert.equal(lines.length, 4, 'an incoming zone under 2% is not listed');
  assert.match(lines[3], /Y \(placed in C, accuracy 800 m\) falls in this ward in 41%/);
});

test('docs and the profile bundle describe the sensitivity analysis and its limits', () => {
  assert.ok(read('data/profiles/README.md').includes('location_sensitivity_2024.json'));
  assert.ok(read('package.json').includes('node scripts/build_location_sensitivity.js'));
  assert.ok(read('docs/METHODOLOGY.md').includes('location_sensitivity_2024'));
  assert.match(read('docs/LIMITATIONS.md'), /only \d+ of 93 zones keep their ward/i);
  assert.ok(read('docs/CRASH_ZONE_COORDINATES.md').includes('location_sensitivity_2024'));
});
