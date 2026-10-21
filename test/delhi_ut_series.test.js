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
const printed = read('data/staged/delhi_ut_series/printed_totals_2021_2024.json');
const continuity = read('data/continuity.json');
const byYear = Object.fromEntries(rows.map(r => [r.year, r]));
const MEASURES = ['theft', 'robbery', 'burglary_old_head', 'criminal_trespass_burglary_revised_head', 'burglary', 'total_ipc_bns', 'total_sll', 'total_crimes_against_women', 'total_crimes_in_which_women_was_victim'];

test('one row per year 2011 to 2024; 2016 to 2020 carry printed totals only, with the head-wise figures blank (never zero) and the reason stated', () => {
  assert.deepEqual(rows.map(r => r.year), [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  for (let y = 2016; y <= 2020; y++) {
    assert.equal(byYear[y].status, 'printed_totals_only');
    for (const m of ['theft', 'robbery', 'burglary_old_head', 'criminal_trespass_burglary_revised_head', 'burglary', 'total_crimes_in_which_women_was_victim']) assert.equal(byYear[y][m], null, y + ' ' + m);
    for (const m of ['total_ipc_bns', 'total_sll', 'total_crimes_against_women']) assert.ok(byYear[y][m] > 0, y + ' ' + m);
    assert.ok(/have not been extracted/.test(byYear[y].note));
  }
  assert.deepEqual(manifest.coverage.totalsOnlyYears, [2016, 2017, 2018, 2019, 2020]);
  assert.deepEqual(manifest.coverage.notCollectedYears, []);
  assert.deepEqual(manifest.coverage.printedYears, [2011, 2012, 2013, 2014, 2015, 2021, 2022, 2023, 2024]);
});

test('2016 to 2020 totals equal the State/UT tables, every edition that prints a year agrees, and IPC plus SLL equals the printed combined total', () => {
  const state = read('data/staged/delhi_ut_series/state_tables_2015_2021.json');
  const expected = { 2016: [209519, 7401, 15310], 2017: [232066, 12648, 13076], 2018: [249012, 13600, 13640], 2019: [299475, 16786, 13395], 2020: [249192, 16878, 10093] };
  for (const [y, [ipc, sll, women]] of Object.entries(expected)) {
    assert.deepEqual([byYear[y].total_ipc_bns, byYear[y].total_sll, byYear[y].total_crimes_against_women], [ipc, sll, women], y);
    for (const m of ['ipc', 'sll', 'women']) assert.equal(state.years[y][m].agree, true, y + ' ' + m);
  }
  for (const y of [2017, 2018, 2019]) assert.ok(state.years[y].ipc.editions.length >= 2, y + ' is printed in at least two editions');
  assert.ok(Object.values(state.ipcPlusSllCheck).length >= 5 && Object.values(state.ipcPlusSllCheck).every(c => c.ipcPlusSllEqualsCombined));
  assert.equal(state.years[2021].ipc.value, byYear[2021].total_ipc_bns, '2021 state table equals the district workbook total');
  assert.deepEqual(state.singleEditionYears.ipc, [2015, 2016, 2020, 2021], 'the years that rest on one edition are listed, not hidden');
  // 2015 cross-check against the original-year table: IPC and SLL agree; the women head differs and is documented
  assert.equal(state.years[2015].ipc.value, byYear[2015].total_ipc_bns);
  assert.equal(state.years[2015].sll.value, byYear[2015].total_sll);
  assert.equal(state.years[2015].women.value, 17222);
  assert.equal(byYear[2015].total_crimes_against_women, 17104);
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

test('2021 to 2024 are the printed Total Districts rows, equal to the staged extraction, and the archived workbooks still match their hashes', () => {
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
    assert.ok([2021, 2022, 2023, 2024].includes(v.year));
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
  assert.equal(state('totalIPC', 2015, 2016), 'comparable');
  assert.equal(state('totalIPC', 2016, 2017), 'comparable');
  assert.equal(state('theft', 2015, 2016), 'unavailable', 'head-wise figures for 2016-2020 are not extracted');
  assert.equal(state('theft', 2020, 2021), 'unavailable');
  assert.equal(state('theft', 2021, 2022), 'comparable');
  assert.equal(state('burglary', 2021, 2022), 'caution', 'burglary jumps 2.3 times with no explanation');
  assert.equal(state('crimeAgainstWomen', 2015, 2016), 'caution', 'the 2015 women head differs between editions');
  assert.equal(state('theft', 2022, 2023), 'comparable');
  assert.equal(state('theft', 2023, 2024), 'caution');
  assert.equal(state('totalSLL', 2012, 2013), 'unavailable');
  assert.deepEqual(continuity.utSeries.printedYears, [...manifest.coverage.printedYears, ...manifest.coverage.totalsOnlyYears].sort((a, b) => a - b), 'continuity and the release must agree on which years have figures');
});
