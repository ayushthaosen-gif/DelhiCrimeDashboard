// Guards the ward-geography registry (data/geography_registry.json): every ward-level file names its geography, counts are
// computed from the data (not typed), the legacy 290 geography is labelled wherever it is shown, and nothing claims the
// current 250-ward geography exists. Cross-geography joins stay blocked.
//
//   node --test test/geography_registry.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const registry = JSON.parse(read('data/geography_registry.json'));
const status = JSON.parse(read('data/series_status.json'));
const legacy = registry.geographies.find(g => g.id === 'legacy_290_wards');
const current = registry.geographies.find(g => g.id === 'mcd_2022_250_wards');

test('both geographies are registered, with the legacy one marked legacy and the current one marked not implemented', () => {
  assert.equal(legacy.status, 'legacy');
  assert.equal(current.status, 'not_implemented');
  assert.deepEqual(current.files, [], 'no file may claim the 250-ward geography until a boundary layer exists');
  assert.match(registry.joinPolicy, /never joined/i);
});

test('the legacy ward count is computed from the boundary file, and every registered file exists', () => {
  const boundaries = JSON.parse(read('data/source/delhi_wards_boundaries.geojson'));
  assert.equal(boundaries.features.length, legacy.wardCount);
  const nos = boundaries.features.map(f => String(f.properties.Ward_No));
  assert.equal(nos.filter(n => /^CANT/.test(n)).length, 8);
  assert.equal(nos.filter(n => /^NDMC/.test(n)).length, 9);
  for (const f of legacy.files) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
});

test('every ward-level data file in the repository is registered under a geography', () => {
  const registered = new Set(registry.geographies.flatMap(g => g.files));
  const wardFiles = fs.readdirSync(path.join(ROOT, 'data')).filter(f => /ward/i.test(f) && /\.(csv|json|geojson)$/.test(f)).map(f => 'data/' + f);
  assert.deepEqual(wardFiles.filter(f => !registered.has(f)), [], 'ward-level file without a registered geography');
  assert.ok(registered.has('data/source/delhi_wards_boundaries.geojson'));
});

test('series that use wards point at a registered geography, and the 250-ward note states the restriction and that no request was sent', () => {
  const ids = new Set(registry.geographies.map(g => g.id));
  for (const s of status.series.filter(s => s.geography_id)) assert.ok(ids.has(s.geography_id), s.id);
  const w250 = status.series.find(s => s.id === 'wards_mcd_2022_250');
  assert.equal(w250.geography_id, 'mcd_2022_250_wards');
  assert.match(w250.note, /GSDL/); assert.match(w250.note, /restricted/i); assert.match(w250.note, /no request has been sent/i);
  assert.equal(status.series.find(s => s.id === 'wards_legacy_290').geography_id, 'legacy_290_wards');
  assert.equal(status.series.find(s => s.id === 'mpd2047_comparison').geography_id, 'legacy_290_wards');
});

test('every page that shows wards says they are the legacy 290, not the current 250', () => {
  for (const f of ['map_3d.html', 'map_3d_mpd.html']) assert.match(read(f), /Legacy ward geography/, f);
  const map = read('scripts/build_interactive_map.js');
  assert.ok(map.includes('290 legacy wards') && !/Ward level \(290 wards\)/.test(map));
  assert.match(read('delhi_safety_dashboard.html'), /legacy 290-ward geography/);
});

test('the shared release manifest lists the geographies and the join policy', () => {
  const shared = JSON.parse(read('data/releases/shared/manifest.json'));
  assert.deepEqual(shared.geographies.map(g => g.id).sort(), ['legacy_290_wards', 'mcd_2022_250_wards']);
  assert.match(shared.joinPolicy, /never joined/i);
});

test('the dashboard coverage table lists every series with its status, and the iRAD page marks 2026 as year to date', () => {
  const html = read('delhi_safety_dashboard.html');
  assert.ok(html.includes('id="coverage"'));
  for (const s of status.series) assert.ok(html.includes(s.name.replace(/&/g, '&amp;')) || html.includes(s.name), 'coverage table is missing ' + s.id);
  const irad = read('irad_stations.html');
  assert.ok(irad.includes("'2026' ? ', year to date'") && irad.includes('do not compare its total with a full year'));
});
