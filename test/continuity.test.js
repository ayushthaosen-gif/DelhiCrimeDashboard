// Guards data/continuity.json and the comparability logic built on it: documented breaks interrupt comparisons, change figures
// are suppressed where a comparison is not valid, and the dashboard carries the same rules the tests exercise.
//
//   node --test test/continuity.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compareYears, segmentOf, changeBetween } = require('../scripts/lib/continuity');

const ROOT = path.join(__dirname, '..');
const c = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'continuity.json'), 'utf8'));
const districts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dashboard_final.json'), 'utf8')).districts;
const html = fs.readFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), 'utf8');
const state = (...args) => compareYears(c, ...args).state;

test('every state, measure, year range and evidence path in the continuity file is valid', () => {
  assert.deepEqual(Object.keys(c.states), ['comparable', 'caution', 'not_comparable', 'unavailable']);
  const [first, last] = c.yearRange;
  const inRange = y => Number.isInteger(y) && y >= first && y <= last;
  for (const a of c.availability) { assert.ok(a.years.every(inRange)); assert.ok(a.reason.length > 30); assert.ok(a.measures.every(m => c.crimeMeasures.includes(m))); }
  for (const b of c.definitionBreaks) { assert.ok(b.between.every(inRange)); assert.ok(b.state in c.states); assert.ok(b.reason.length > 30); assert.ok(b.measures.every(m => c.crimeMeasures.includes(m))); }
  for (const g of c.geography.breaks) {
    assert.ok(g.between.every(inRange));
    const names = new Set(districts.map(d => d.name));
    for (const n of [...g.affected, ...g.unaffected, ...g.newDistricts]) assert.ok(names.has(n), n + ' is not a dashboard district');
    assert.equal(new Set([...g.affected, ...g.unaffected, ...g.newDistricts]).size, g.affected.length + g.unaffected.length + g.newDistricts.length, 'a district is listed twice in one break');
  }
  const evidence = [...c.definitionBreaks.map(b => b.evidence), ...c.geography.breaks.map(g => g.evidence), c.series.roadTrend.evidence];
  for (const e of evidence.filter(Boolean)) assert.ok(/^https?:/.test(e) || fs.existsSync(path.join(ROOT, e)), 'missing evidence: ' + e);
});

test('the documented breaks interrupt comparisons for the right measures and districts', () => {
  assert.equal(state('theft', 2013, 2014), 'not_comparable');
  assert.equal(state('burglary', 2013, 2014), 'not_comparable');
  assert.equal(state('totalSLL', 2012, 2013), 'unavailable');
  assert.equal(state('crimeAgainstWomen', 2011, 2012), 'unavailable');
  assert.equal(state('totalIPC', 2015, 2016), 'unavailable');
  assert.equal(state('theft', 2015, 2016), 'caution');
  assert.equal(state('burglary', 2016, 2017), 'unavailable');
  assert.equal(state('theft', 2012, 2013), 'caution', 'same district names, but no roster for these years');
  // a district split must interrupt the comparison, district by district
  assert.equal(state('theft', 2016, 2017, 'South-West'), 'not_comparable');
  assert.equal(state('theft', 2016, 2017, 'Outer'), 'not_comparable');
  assert.equal(state('theft', 2016, 2017, 'Central'), 'comparable');
  assert.equal(state('theft', 2016, 2017, 'Dwarka'), 'unavailable');
  assert.equal(state('theft', 2016, 2017), 'not_comparable');
  assert.equal(state('theft', 2018, 2019, 'Rohini'), 'not_comparable');
  assert.equal(state('theft', 2018, 2019, 'North-West'), 'not_comparable');
  assert.equal(state('theft', 2018, 2019, 'Outer North'), 'unavailable');
  assert.equal(state('theft', 2018, 2019, 'East'), 'caution');
  // comparable and cautioned years
  assert.equal(state('theft', 2017, 2018), 'comparable');
  assert.equal(state('theft', 2019, 2020), 'comparable');
  assert.equal(state('theft', 2021, 2022), 'caution');
  assert.equal(state('theft', 2022, 2023), 'comparable');
  assert.equal(state('theft', 2023, 2024), 'caution');
  // road measures
  assert.equal(state('fatalRoadCrashes2022', 2022, 2023), 'not_comparable');
  assert.equal(state('totalCrashes2023', 2023, 2024), 'caution', 'counts within selected zones change with the zone list');
  assert.equal(state('totalCrashes', 2022, 2023), 'caution', 'the 2022 zone tables are usable beside 2023, with caution');
  assert.equal(state('fatalCrashes', 2022, 2023), 'caution');
  assert.equal(state('personsKilled', 2022, 2023), 'not_comparable', 'full-district 2022 figures stay a separate series');
  assert.equal(state('personsKilled', 2023, 2024), 'comparable');
  assert.equal(state('crashProneZones2023', 2023, 2024), 'caution');
});

test('every reason shown is one of the documented sentences, and a worse state hides milder ones', () => {
  const all = new Set([...c.availability.map(a => a.reason), ...c.definitionBreaks.map(b => b.reason), ...c.geography.epochs.map(e => e.reason), c.roadDistrict.reason2022, c.roadDistrict.zoneReason2022, c.roadDistrict.cautionReason]);
  const r = compareYears(c, 'totalSLL', 2012, 2013);
  assert.equal(r.state, 'unavailable');
  assert.deepEqual(r.reasons, [c.availability[0].reason]);
  assert.ok(compareYears(c, 'theft', 2013, 2014).reasons.every(x => all.has(x)));
  assert.equal(compareYears(c, 'theft', 2013, 2014).reasons.length, 1, 'the not-comparable reason replaces the milder caution');
});

test('change figures are suppressed unless a comparison is valid, and blanks are never turned into zeros', () => {
  const ok = compareYears(c, 'theft', 2019, 2020), caution = compareYears(c, 'theft', 2012, 2013);
  assert.equal(changeBetween(ok, 100, 110), 10);
  assert.ok(Math.abs(changeBetween(caution, 100, 150) - 50) < 1e-9);
  assert.equal(changeBetween(compareYears(c, 'theft', 2013, 2014), 100, 200), null);
  assert.equal(changeBetween(compareYears(c, 'theft', 2016, 2017, 'Dwarka'), null, 5), null);
  assert.equal(changeBetween(ok, null, 110), null);
  assert.equal(changeBetween(ok, 100, null), null);
  assert.equal(changeBetween(ok, 0, 10), null, 'no percentage change from zero');
});

test('colour-scale segments never straddle a break', () => {
  const seg = (k, y) => segmentOf(c, k, y).join('-');
  assert.deepEqual(['2011', '2013', '2014', '2016', '2017', '2018', '2019', '2024'].map(y => seg('theft', Number(y))), ['2011-2013', '2011-2013', '2014-2016', '2014-2016', '2017-2018', '2017-2018', '2019-2024', '2019-2024']);
  assert.equal(seg('totalCrashes2023', 2024), '2023-2024');
  assert.equal(seg('fatalRoadCrashes2022', 2022), '2022-2022');
  for (const k of c.crimeMeasures) for (let y = 2011; y < 2024; y++) {
    const [a, b] = segmentOf(c, k, y);
    if (a < y) assert.notEqual(state(k, y - 1, y), 'not_comparable', k + ' ' + y + ' starts a new segment');
  }
});

test('the source data already flags non-comparable years; the continuity rules agree with every one from 2017 on', () => {
  const measures = c.crimeMeasures;
  let checked = 0;
  for (const d of districts) for (const m of measures) for (let y = 2017; y <= 2021; y++) {
    const flag = d[m + 'PreviousYearComparable' + y];
    if (flag === false) {
      assert.ok(['not_comparable', 'unavailable'].includes(state(m, y - 1, y, d.name)), m + ' ' + y + ' ' + d.name + ' is flagged in the data but not here');
      checked++;
    }
  }
  assert.ok(checked > 40, 'expected many flagged cases, checked ' + checked);
});

test('the dashboard carries the same rules: injected functions, indicator, suppressed changes, no evidence paths', () => {
  const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
  assert.ok(script.includes('const compareYears = ' + compareYears.toString()), 'injected compareYears differs from scripts/lib/continuity.js');
  assert.ok(script.includes('const segmentOf = ' + segmentOf.toString()));
  assert.ok(script.includes('const changeBetween = ' + changeBetween.toString()));
  const page = JSON.parse(script.slice(script.indexOf('const CONTINUITY = ') + 'const CONTINUITY = '.length, script.indexOf(';\n', script.indexOf('const CONTINUITY = '))));
  assert.deepEqual(page.states, c.states);
  assert.ok(!JSON.stringify(page).includes('"evidence"'));
  assert.ok(script.includes('Can I compare these years?'));
  assert.match(script, /changeBetween\(info\.cmp, info\.from, info\.to\)/);
  assert.match(html, /id="scaleToggle"/);
  assert.match(html, /data-scale="fixed"/);
});
