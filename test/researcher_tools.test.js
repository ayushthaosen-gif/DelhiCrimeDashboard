// Phase 3 researcher tools: the year-by-year coverage matrix (every gap has a stated cause and agrees with the data), the comparison notes, and the
// versioned download bundles (paths, sizes and hashes match the files; the page builds a README, coverage, comparison notes and a verified manifest).
//
//   node --test test/researcher_tools.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256, canonicalSize, parseCsv } = require('../scripts/lib/release_utils');
const coverage = require('../scripts/lib/coverage');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));
const files = render();
const M = JSON.parse(files['data/coverage_matrix.json']), B = JSON.parse(files['data/bundles/manifest.json']);
const row = id => M.rows.find(r => r.id === id);
const states = id => M.years.map(y => row(id).cells[y].state);

test('the committed matrix, CSV and bundle manifest are what the build produces', () => {
  assert.equal(read('data/coverage_matrix.json'), files['data/coverage_matrix.json']);
  assert.equal(read('data/coverage_matrix.csv'), files['data/coverage_matrix.csv']);
  assert.equal(read('data/bundles/manifest.json'), files['data/bundles/manifest.json']);
  assert.deepEqual(M.years, [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  assert.equal(M.rows.length, 13);
});

test('every cell is a known state; every gap states a cause and evidence, and no gap hides data that is present', () => {
  for (const r of M.rows) for (const y of M.years) {
    const c = r.cells[y];
    assert.ok(M.states[c.state], r.id + ' ' + y);
    if (!['available', 'partial'].includes(c.state)) assert.ok(c.note && c.note.length > 10, r.id + ' ' + y + ' has a stated cause');
    if (['not_printed', 'not_extracted', 'source_not_found', 'not_published', 'staged', 'not_collected'].includes(c.state)) assert.ok(c.evidence, r.id + ' ' + y + ' names its evidence');
  }
  const gaps = json('data/coverage_gaps.json').gaps;
  for (const g of gaps) assert.ok(row(g.row), g.row);
  for (const f of gaps.map(g => g.evidence)) assert.ok(fs.existsSync(path.join(ROOT, f)), 'evidence path exists: ' + f);
});

test('the matrix agrees with the data: what is available is in the repository, what is a gap is not', () => {
  const A = 'available', P = 'partial';
  // named zones: PWD compilation 2013 and 2014 (qualified), annual reports 2015 to 2024, 2011 and 2012 not found
  assert.deepEqual(states('named_zones'), ['source_not_found', 'source_not_found', P, P, A, A, A, A, A, A, A, A, A, A, 'not_published', 'not_published']);
  for (const y of [2013, 2014, 2015]) assert.ok(json('data/releases/road_zones_roads_2011_2015/named_zones_2013_2015.json').some(r => r.reference_year === y));
  assert.ok(!json('data/releases/road_zones_roads_2011_2015/named_zones_2013_2015.json').some(r => r.reference_year < 2013));
  // roads: printed 2017 to 2024, calculated 2014 and 2015, not printed 2013 and 2016, not found 2011 and 2012
  assert.deepEqual(states('road_tables').slice(0, 14), ['source_not_found', 'source_not_found', 'not_printed', P, P, 'not_printed', A, A, A, A, A, A, A, A]);
  // crime
  assert.deepEqual(states('delhi_ut_theft').slice(0, 14), [A, A, A, A, A, 'not_extracted', 'not_extracted', 'not_extracted', 'not_extracted', 'not_extracted', A, A, A, A]);
  assert.deepEqual(states('ncrb_district_crime').slice(0, 5), ['staged', 'staged', 'staged', 'staged', 'staged']);
  assert.equal(row('ncrb_district_crime').cells[2016].state, P);
  assert.equal(row('ncrb_district_crime').cells[2024].state, P);
  for (let y = 2016; y <= 2024; y++) assert.ok(fs.existsSync(path.join(ROOT, 'data/releases/' + y + '/district_crime.json')), String(y));
  // deaths by mode: older series 2011 to 2018 qualified, later series available; enforcement only from 2019
  assert.deepEqual(states('victims_by_mode').slice(0, 14), [P, P, P, P, P, P, P, P, A, A, A, A, A, A]);
  assert.deepEqual(states('enforcement').slice(0, 14), ['not_collected', 'not_collected', 'not_collected', 'not_collected', 'not_collected', 'not_collected', 'not_collected', 'not_collected', A, A, A, A, A, A]);
  // stretches: 2011, 2012 and 2014 only
  assert.deepEqual(M.years.filter(y => ['available', 'partial'].includes(row('stretches').cells[y].state)), [2011, 2012, 2014]);
  // nothing for 2025 or 2026 is claimed as available
  for (const r of M.rows) for (const y of [2025, 2026]) assert.ok(!['available', 'partial'].includes(r.cells[y].state), r.id + ' ' + y);
  assert.equal(row('irad_district_reports').cells[2025].state, 'staged');
  assert.equal(row('irad_district_reports').cells[2026].state, 'provisional');
});

test('the long CSV has one row per series and year with the state, meaning, note and evidence', () => {
  const csv = parseCsv(read('data/coverage_matrix.csv'));
  assert.equal(csv.rows.length, M.rows.length * M.years.length);
  assert.deepEqual(csv.columns, ['group', 'series_id', 'series', 'unit', 'geography', 'year', 'state', 'meaning', 'note', 'evidence']);
  const r = csv.rows.find(x => x.series_id === 'named_zones' && x.year === '2012');
  assert.equal(r.state, 'source_not_found');
  assert.match(r.note, /not located/);
});

test('comparison notes come from the continuity rules and the new caveats, each with a reason', () => {
  assert.ok(M.comparison.length >= 14);
  for (const c of M.comparison) assert.ok(c.reason.length > 25 && c.between.length === 2 && ['not_comparable', 'caution', 'unavailable'].includes(c.state), c.applies_to);
  const c = json('data/continuity.json');
  assert.equal(M.comparison.filter(x => x.applies_to === 'Crime: definitions and sources').length, c.definitionBreaks.length);
  assert.ok(M.comparison.some(x => x.applies_to === 'Deaths by mode of travel' && x.between[0] === 2018));
  assert.ok(M.comparison.some(x => /Hurt or Grievous Hurt/.test(x.reason)));
});

test('bundles: every file exists with the recorded size and hash, series ids are real, the version tracks the content', () => {
  assert.deepEqual(B.bundles.map(b => b.id), ['crime', 'road', 'profiles']);
  const ids = new Set(M.rows.map(r => r.id));
  for (const b of B.bundles) {
    assert.ok(b.series.every(s => ids.has(s)) && b.geography.length > 40 && b.definitions.length >= 3 && b.description.length > 40, b.id);
    assert.match(b.version, new RegExp('^' + B.dataVersion + '-[0-9a-f]{8}$'));
    assert.ok(b.bytes < 2 * 1024 * 1024, b.id + ' stays small enough to zip in the browser');
    for (const f of b.files) {
      assert.ok(f.path.startsWith('data/') && !f.path.includes('..'), f.path);
      assert.equal(f.sha256, sha256(path.join(ROOT, f.path)), f.path);
      assert.equal(f.bytes, canonicalSize(path.join(ROOT, f.path)), f.path);
    }
    assert.equal(b.bytes, b.files.reduce((a, f) => a + f.bytes, 0));
    assert.ok(b.files.some(f => /manifest\.json$/.test(f.path)), b.id + ' carries release manifests');
  }
  const crime = B.bundles[0].files.map(f => f.path);
  assert.ok(crime.includes('data/releases/2024/district_crime.csv') && crime.includes('data/continuity.json') && crime.includes('data/releases/delhi_ut_series/delhi_ut_crime.csv'));
  const road = B.bundles[1].files.map(f => f.path);
  assert.ok(road.includes('data/releases/road_victims_by_mode_2004_2018/victims_by_mode.csv') && road.includes('data/releases/2024/district_road_safety.csv') && road.includes('data/releases/road_zones_roads_2011_2015/named_zones_2013_2015.csv'));
  const v = coverage.bundles('x'); assert.notEqual(v.bundles[0].version, B.bundles[0].version, 'a different data version gives a different bundle version');
});

test('Data & methods: the matrix, the breaks and the bundles are on the page, built in the browser with a README, coverage, comparison notes and a verified manifest', () => {
  const html = files['data-methods.html'], src = read('assets/page-methods.js'), css = read('assets/site.css');
  for (const id of ['matrix', 'matrixBox', 'breaks', 'breaksBox', 'bundles', 'bundleBox']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(html.includes('href="data/coverage_matrix.csv"') && html.includes('href="data/coverage_matrix.json"'));
  for (const t of ["fetch(path)", "crypto.subtle.digest('SHA-256'", 'D.zip(items)', 'BUNDLE_MANIFEST.json', 'COVERAGE.csv', 'COMPARABILITY.md', '## Geography', '## Definitions', '## Coverage and gaps', '## Provenance', '## Integrity check made when this bundle was built', 'expectedSha256', 'fetchedSha256', 'A blank is never a zero']) assert.ok(src.includes(t), t);
  assert.ok(!/innerHTML/.test(src));
  assert.ok(/aria-label': r\.series \+ ', ' \+ y/.test(src), 'every matrix cell has a text label (state is not shown by colour alone)');
  for (const k of Object.keys(M.states)) assert.ok(src.includes(k + ": '") || src.includes(k + ':'), 'glyph for ' + k);
  assert.ok(/\.cm-available/.test(css) && /table\.cm/.test(css));
  assert.ok(read('docs/COVERAGE.md').includes('coverage_matrix'), 'COVERAGE.md points to the generated matrix');
});
