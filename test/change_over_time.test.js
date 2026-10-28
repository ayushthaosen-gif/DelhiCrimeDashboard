// Step 7, change over time only where comparable: the rules for a "change between two years" view (shared with the other pages through
// data/continuity.json), the numbers it produces, and the page that shows them. Constituency overlays stay unbuilt; the reason is on record.
//
//   node --test test/change_over_time.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const cont = require('../scripts/lib/continuity');
const patterns = require('../scripts/lib/patterns');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const c = JSON.parse(read('data/continuity.json'));
const files = render();
const P = patterns.build();
const utValues = key => { const S = P.crime.series[key], v = {}; P.crime.years.forEach((y, i) => { if (S.values[i] != null) v[y] = S.values[i]; }); return v; };

test('crime, Delhi as a whole: a comparable pair gets a change figure from the printed values; a pair across the 2013 to 2014 break gets none and says why', () => {
  const spec = { kind: 'crime', key: 'totalIPC', scope: c.utSeries.scopeName, values: utValues('totalIPC') };
  const ok = cont.changeView(c, spec, 2016, 2023);
  assert.equal(ok.state, 'comparable');
  assert.equal(ok.abs, 324257 - 209519);
  assert.ok(Math.abs(ok.pct - (324257 / 209519 - 1) * 100) < 1e-9);
  const swapped = cont.changeView(c, spec, 2023, 2016);
  assert.deepEqual([swapped.from, swapped.to, swapped.pct], [2016, 2023, ok.pct], 'order does not matter');
  const bad = cont.changeView(c, spec, 2013, 2019);
  assert.equal(bad.state, 'not_comparable');
  assert.deepEqual([bad.abs, bad.pct], [null, null], 'no change is made across a break');
  assert.ok(bad.fromValue === 80184 && bad.toValue === 299475, 'both values stay visible');
  assert.ok(bad.steps.some(s => s.from === 2013 && s.state === 'not_comparable') && bad.reasons.some(r => /reporting format/.test(r)));
  const caution = cont.changeView(c, spec, 2023, 2024);
  assert.equal(caution.state, 'caution');
  assert.ok(caution.pct < 0 && /Bharatiya Nyaya Sanhita/.test(caution.reasons.join(' ')), 'shown with the BNS reason beside it');
  assert.ok(bad.ranges.some(r => r.from === 2014 && r.to === 2024) && bad.ranges.some(r => r.from === 2011 && r.to === 2013), 'the ranges that can be read together are named');
});

test('blank years give no figure, never zero: crimes against women have no value for 2011 to 2013', () => {
  const spec = { kind: 'crime', key: 'crimeAgainstWomen', scope: c.utSeries.scopeName, values: utValues('crimeAgainstWomen') };
  assert.ok(!(2012 in spec.values));
  const v = cont.changeView(c, spec, 2012, 2016);
  assert.equal(v.fromValue, null);
  assert.equal(v.pct, null);
  assert.equal(v.state, 'unavailable');
  const zero = cont.changeView(c, { kind: 'trend', values: { 2011: 0, 2012: 5 } }, 2011, 2012);
  assert.equal(zero.pct, null, 'no percentage from a zero base');
});

test('road series are counts, not rates: always caution for a pair, with the specific reasons for 2018 to 2019 (deaths by mode) and the pandemic years', () => {
  const vals = {}; for (let y = 2011; y <= 2024; y++) vals[y] = 1000 + y;
  const trend = cont.changeView(c, { kind: 'trend', key: 'killed', values: vals }, 2011, 2016);
  assert.equal(trend.state, 'caution');
  assert.deepEqual(trend.reasons, [c.series.roadTrend.reasons[0]]);
  assert.ok(trend.steps.every(s => s.state === 'comparable'), 'no specific reason in 2011 to 2016');
  const mode = cont.changeView(c, { kind: 'mode', key: 'pedestrian', values: vals }, 2017, 2020);
  assert.equal(mode.state, 'caution');
  assert.ok(mode.reasons.includes(c.series.modeOfTravel.reason) && mode.reasons.includes(c.roadHistory.pandemicReason));
  assert.deepEqual(mode.steps.map(s => [s.from, s.state]), [[2017, 'comparable'], [2018, 'caution'], [2019, 'caution']]);
  assert.ok(!cont.changeView(c, { kind: 'trend', values: vals }, 2011, 2016).reasons.includes(c.roadHistory.pandemicReason));
  assert.ok(cont.changeView(c, { kind: 'trend', values: vals }, 2019, 2022).reasons.includes(c.roadHistory.pandemicReason));
  assert.ok(Math.abs(mode.pct - (3020 / 3017 - 1) * 100) < 1e-9, 'a change figure is given, with the reasons beside it');
  assert.deepEqual(cont.compareRoadSeries(c, 'mode', 2020, 2017).from, 2017);
});

test('the page and Node agree: the injected rules give the same answers, and the mode-of-travel rule is the one the coverage notes use', () => {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(files['assets/site-data.js'], ctx);
  const D = ctx.window.DSO_DATA;
  assert.equal(typeof D.changeView, 'function');
  const spec = { kind: 'crime', key: 'totalIPC', scope: c.utSeries.scopeName, values: utValues('totalIPC') };
  const a = JSON.parse(JSON.stringify(D.changeView(D.CONTINUITY, spec, 2013, 2024))), b = JSON.parse(JSON.stringify(cont.changeView(c, spec, 2013, 2024)));
  assert.equal(a.state, b.state);
  assert.deepEqual(a.steps.map(s => s.state), b.steps.map(s => s.state));
  assert.equal(D.CONTINUITY.series.modeOfTravel.break[0], 2018);
  const M = JSON.parse(files['data/coverage_matrix.json']);
  const note = M.comparison.find(x => x.applies_to === 'Deaths by mode of travel');
  assert.equal(note.reason, c.series.modeOfTravel.reason);
  assert.deepEqual(note.between, c.series.modeOfTravel.break);
});

test('the Patterns page has the change view with the right series, no innerHTML, a stated rule, and states the unbuilt constituency overlay', () => {
  const html = files['patterns.html'], src = read('assets/page-patterns.js');
  assert.ok(html.includes('id="ptChange"') && html.indexOf('id="ptChange"') < html.indexOf('id="ptDistricts"'));
  for (const t of ["'c-' + k", "'t-' + m[0]", "'m-' + m[0]", 'Change between two years', 'A change figure is made only where the two years can be compared', 'Not turned into a change:', 'Read with caution:', 'Years of this series that can be read together', 'CD.changeView(CONT, it.spec, cs.a, cs.b)', 'Counts, not rates']) assert.ok(src.includes(t), t);
  assert.ok(!/innerHTML/.test(src));
  assert.match(read('docs/LIMITATIONS.md'), /Constituency overlays are not built/);
  assert.match(read('docs/COVERAGE.md'), /Constituencies \| Not built/);
});
