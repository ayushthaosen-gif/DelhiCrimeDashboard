// Structural guard for the 3D ward explorer prototype (map_3d.html). Like the other page tests it
// protects against silent breakage that `node --check` cannot see: a getElementById that points at
// nothing, a metric whose data field was renamed, or a data file the page fetches that moved.
//
//   node --test test/map_3d_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'map_3d.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const wards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_wards_infra.geojson'), 'utf8'));

test('the page script parses', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('every element the script looks up by id exists in the page', () => {
  const ids = [...new Set([...script.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length > 15, 'expected to find the script\'s id lookups, found ' + ids.length);
  const missing = ids.filter(id => !html.includes('id="' + id + '"'));
  assert.deepEqual(missing, [], 'script references ids that are not in the markup: ' + missing.join(', '));
});

test('external scripts and styles are pinned to an exact version', () => {
  const urls = [...html.matchAll(/(?:src|href)="(https:\/\/unpkg\.com\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.length >= 2);
  for (const u of urls) assert.match(u, /@\d+\.\d+\.\d+\//, 'unpinned CDN url: ' + u);
});

test('no leftover debug handle on window', () => {
  assert.ok(!script.includes('window.__map'));
});

test('ward metrics read fields that exist in the ward data', () => {
  const metricBlock = script.slice(script.indexOf('var METRICS = ['), script.indexOf('var BASEMAPS'));
  const entries = [...metricBlock.matchAll(/\{ key: '([^']+)'[^}]*\}/g)];
  assert.ok(entries.length >= 10, 'expected the metric list, found ' + entries.length);
  const props = wards.features[0].properties;
  for (const [entry, key] of entries) {
    if (/kind: 'year'|kind: 'gap'/.test(entry)) continue;
    assert.ok(key in props, 'ward metric "' + key + '" is not a property of delhi_wards_infra.geojson');
  }
});

test('gap index inputs and tour fields exist in the ward data', () => {
  const props = wards.features[0].properties;
  for (const k of ['crashZones2024Density', 'surveillanceDensity', 'highInjuryNetworkRank', 'assignedDistrict', 'areaSqKm', 'Ward_Name']) {
    assert.ok(k in props, k + ' missing from ward properties');
  }
});

test('year metrics read fields that exist in every yearly district_crime release', () => {
  const years = [...script.matchAll(/var YEARS = \[([^\]]+)\]/g)][0][1].split(',').map(s => s.trim());
  const keys = [...script.matchAll(/\{ key: '([^']+)'[^}]*kind: 'year'[^}]*\}/g)].map(m => m[1]);
  assert.deepEqual(keys.sort(), ['burglary', 'robbery', 'theft']);
  const wardDistricts = new Set(wards.features.map(f => f.properties.assignedDistrict).filter(Boolean));
  for (const y of years) {
    const file = path.join(ROOT, 'data', 'releases', y, 'district_crime.json');
    assert.ok(fs.existsSync(file), 'missing ' + file);
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const names = new Set(rows.map(r => r.district));
    for (const d of wardDistricts) assert.ok(names.has(d), y + ' release has no district "' + d + '"');
    for (const k of keys) assert.ok(k in rows[0], y + ' release has no field "' + k + '"');
    assert.ok('district_existed_as_separate_reporting_zone' in rows[0]);
  }
});

test('year metrics never render a missing value as zero', () => {
  assert.match(script, /return null;[\s\S]*?return row\[m\.key\] \/ area/);
  assert.match(script, /if \(v === null\) \{ anyNull = true;/);
});

test('share-link values are validated against known lists before use', () => {
  const read = script.slice(script.indexOf('function readUrl()'), script.indexOf('// ---------- map ----------'));
  for (const guard of ['METRICS.findIndex', 'YEARS.indexOf', "b === 'osm'", 'v.every(isFinite)']) {
    assert.ok(read.includes(guard), 'readUrl lost its check: ' + guard);
  }
});
