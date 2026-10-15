// Structural guard for the Master Plan 2047 3D comparison page (map_3d_mpd.html): markup ids, pinned CDN versions,
// data fields it reads from the MPD comparison file, the ward join, and the honesty caveats the page must keep.
//
//   node --test test/map_3d_mpd_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'map_3d_mpd.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const cmp = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mpd2047_ward_comparison.json'), 'utf8'));
const wards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_wards_infra.geojson'), 'utf8'));

test('the page script parses and has no debug handle', () => {
  assert.doesNotThrow(() => new Function(script));
  assert.ok(!script.includes('window.__'));
});

test('every element the script looks up by id exists in the page', () => {
  const ids = [...new Set([...script.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length > 12, 'expected the id lookups, found ' + ids.length);
  assert.deepEqual(ids.filter(id => !html.includes('id="' + id + '"')), []);
});

test('external scripts and styles are pinned to an exact version', () => {
  const urls = [...html.matchAll(/(?:src|href)="(https:\/\/unpkg\.com\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.length >= 2);
  for (const u of urls) assert.match(u, /@\d+\.\d+\.\d+\//, 'unpinned CDN url: ' + u);
});

test('every land-use class the page offers has planned, current and delta fields in the comparison data', () => {
  const keys = [...script.matchAll(/\{ key: '([a-z_]+)', label: '[^']+', color:/g)].map(m => m[1]);
  assert.deepEqual(keys, ['residential', 'industrial', 'green_open', 'agriculture']);
  const row = cmp.wards[0];
  for (const k of keys) {
    for (const f of ['planned_' + k + '_share_pct', 'current_' + k + '_share_pct', 'delta_' + k + '_pp']) assert.ok(f in row, f + ' missing from the comparison data');
    assert.ok(('planned_' + k + '_km2') in cmp.citywide && ('current_' + k + '_km2') in cmp.citywide, k + ' citywide totals missing');
  }
  for (const f of ['plan_coverage_pct', 'osm_mapped_pct', 'planned_not_comparable_km2', 'comparison_confidence', 'district', 'area_sq_km']) assert.ok(f in row, f);
});

test('every ward joins to exactly one comparison row, so no ward is silently dropped', () => {
  const ids = wards.features.map(f => f.properties.Ward_No);
  assert.equal(new Set(ids).size, ids.length, 'ward ids must be unique');
  const rows = new Map(cmp.wards.map(r => [r.ward_no, r]));
  assert.equal(rows.size, cmp.wards.length);
  for (const id of ids) assert.ok(rows.has(id), 'no comparison row for ward ' + id);
});

test('thin-coverage wards are flagged from the data, not hard-coded', () => {
  assert.ok(script.includes("comparison_confidence !== 'ok'"));
  const low = cmp.wards.filter(r => r.comparison_confidence !== 'ok').length;
  assert.equal(low, cmp.citywide.wards_low_confidence, 'citywide low-confidence count must match the rows');
});

test('the page keeps its honesty caveats', () => {
  assert.ok(html.includes('not a measurement of change on the ground'));
  assert.ok(script.includes('comparability_caveat'));
  assert.ok(html.includes('Master Plan for Delhi 2047 GIS portal'));
  assert.ok(html.includes('OpenStreetMap contributors'));
  assert.ok(script.includes('has not tagged it'));
});

test('share-link values are validated against known lists before use', () => {
  const read = script.slice(script.indexOf('function readUrl()'), script.indexOf('// ---------- events ----------'));
  for (const guard of ["x.key === c", "v === 'sbs'", "b === 'osm'", 'p.every(isFinite)']) assert.ok(read.includes(guard), 'readUrl lost its check: ' + guard);
});
