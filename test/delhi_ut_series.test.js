// Guards the Delhi-wide series (data/releases/delhi_ut_series): printed Delhi UT totals only, gaps left as gaps, burglary definitions
// kept apart, and every figure reconciled with the district releases and the archived workbooks.
//
//   node --test test/delhi_ut_series.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { compareYears } = require('../scripts/lib/continuity');

const ROOT = path.join(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const rows = read('data/releases/delhi_ut_series/delhi_ut_crime.json');
const manifest = read('data/releases/delhi_ut_series/manifest.json');
const printed = read('data/staged/delhi_ut_series/printed_totals_2022_2024.json');
const continuity = read('data/continuity.json');
const byYear = Object.fromEntries(rows.map(r => [r.year, r]));
const MEASURES = ['theft', 'robbery', 'burglary_old_head', 'criminal_trespass_burglary_revised_head', 'burglary', 'total_ipc_bns', 'total_sll', 'total_crimes_against_women', 'total_crimes_in_which_women_was_victim'];

test('one row per year 2011 to 2024; 2016 to 2021 are gaps with a reason, every figure null and never zero', () => {
  assert.deepEqual(rows.map(r => r.year), [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  for (let y = 2016; y <= 2021; y++) {
    assert.equal(byYear[y].status, 'not_collected');
    assert.ok(/Not collected yet/.test(byYear[y].note));
    for (const m of MEASURES) assert.equal(byYear[y][m], null, y + ' ' + m);
    assert.deepEqual(byYear[y].sources, []);
  }
  assert.deepEqual(manifest.coverage.notCollectedYears, [2016, 2017, 2018, 2019, 2020, 2021]);
  assert.deepEqual(manifest.coverage.printedYears, [2011, 2012, 2013, 2014, 2015, 2022, 2023, 2024]);
});

test('2011 to 2015 equal the printed Delhi UT summaries of the historical release, with blanks kept null', () => {
  const hist = read('data/releases/historical_2011_2015/citywide_crime.json');
  for (const h of hist) {
    const r = byYear[h.reference_year];
    assert.deepEqual([r.theft, r.robbery, r.total_ipc_bns, r.total_sll, r.total_crimes_against_women], [h.theft, h.robbery, h.total_ipc, h.total_sll, h.total_crimes_against_women]);
    assert.equal(r.burglary_old_head, h.burglary_old_definition);
    assert.equal(r.criminal_trespass_burglary_revised_head, h.criminal_trespass_burglary_revised_definition);
  }
  for (const y of [2011, 2012, 2013]) { assert.equal(byYear[y].total_sll, null); assert.equal(byYear[y].total_crimes_against_women, null); }
});

test('burglary stays three separate columns, one populated per era', () => {
  for (const y of [2011, 2012, 2013]) assert.deepEqual([byYear[y].burglary_old_head != null, byYear[y].criminal_trespass_burglary_revised_head, byYear[y].burglary], [true, null, null]);
  for (const y of [2014, 2015]) assert.deepEqual([byYear[y].burglary_old_head, byYear[y].criminal_trespass_burglary_revised_head != null, byYear[y].burglary], [null, true, null]);
  for (const y of [2022, 2023, 2024]) assert.deepEqual([byYear[y].burglary_old_head, byYear[y].criminal_trespass_burglary_revised_head, byYear[y].burglary != null], [null, null, true]);
});

test('2022 to 2024 are the printed Total Districts rows, equal to the staged extraction, and the archived workbooks still match their hashes', () => {
  for (const y of printed.years) {
    const r = byYear[y.year];
    assert.deepEqual([r.theft, r.robbery, r.burglary, r.total_ipc_bns, r.total_sll, r.total_crimes_against_women],
      [y.printedTotal.theft, y.printedTotal.robbery, y.printedTotal.burglary, y.printedTotal.total_ipc_bns, y.printedTotal.total_sll, y.printedTotal.total_crimes_against_women]);
    assert.equal(r.reporting_units, 23);
    for (const m of Object.keys(y.agreement)) assert.equal(y.agreement[m], true, y.year + ' ' + m);
    for (const s of y.sources) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, s.path))).digest('hex'), s.sha256, s.path);
  }
});

test('the printed Delhi total minus the 15 districts equals the specialised units, for every figure and year (a check of both releases)', () => {
  for (const v of manifest.verification) {
    assert.deepEqual(v.specialisedUnits, ['Crime Branch', 'EOW', 'IGI Airport', 'Metro', 'RAILWAY', 'Spl Cell', 'SPUWAC', 'Vigilance']);
    for (const [measure, x] of Object.entries(v.reconciliation)) {
      assert.equal(x.printedDelhiTotal - x.sumOfFifteenDistricts, x.specialisedUnits, v.year + ' ' + measure);
      assert.ok(x.specialisedUnits >= 0);
    }
  }
  const districts = read('data/releases/2024/district_crime.json');
  assert.ok(byYear[2024].total_ipc_bns > districts.reduce((n, d) => n + d.total_ipc_bns, 0), 'the Delhi-wide total is higher than the sum of the districts because it includes specialised units');
});

test('every source in the manifest exists and matches its recorded hash; the generated files match their recorded bytes', () => {
  for (const s of manifest.sources) {
    const bytes = fs.readFileSync(path.join(ROOT, s.path));
    const text = /\.(json|csv|md)$/i.test(s.path) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
    assert.equal(crypto.createHash('sha256').update(text).digest('hex'), s.sha256, s.path);
  }
  for (const f of manifest.files) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, 'data/releases/delhi_ut_series', f.path))).digest('hex'), f.sha256, f.path);
  assert.ok(/never zero/.test(manifest.nullPolicy));
});

test('comparability for the Delhi-wide series ignores district boundaries but not definitions or gaps', () => {
  const state = (k, a, b) => compareYears(continuity, k, a, b, 'Delhi UT').state;
  assert.equal(state('theft', 2012, 2013), 'comparable', 'no district-roster caution for Delhi-wide totals');
  assert.equal(state('theft', 2013, 2014), 'not_comparable');
  assert.equal(state('theft', 2014, 2015), 'comparable');
  assert.equal(state('theft', 2015, 2016), 'unavailable');
  assert.equal(state('theft', 2021, 2022), 'unavailable');
  assert.equal(state('theft', 2022, 2023), 'comparable');
  assert.equal(state('theft', 2023, 2024), 'caution');
  assert.equal(state('totalSLL', 2012, 2013), 'unavailable');
  assert.deepEqual(continuity.utSeries.printedYears, manifest.coverage.printedYears, 'continuity and the release must agree on which years exist');
});
