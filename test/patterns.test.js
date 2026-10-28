// Guards the "Trends and patterns" page and the planner brief: every figure is computed from committed data, gaps are not drawn as lines,
// the correlations are honest about 15 districts, wording does not claim causes, and the brief is generated from the same numbers.
//
//   node --test test/patterns.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const patterns = require('../scripts/lib/patterns');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const files = render();
const P = patterns.build();

test('crime series: Delhi-wide printed values, comparison states from the continuity engine, gaps stay null', () => {
  const t = P.crime.series.totalIPC;
  assert.equal(t.values.length, 14);
  assert.equal(t.values[P.crime.years.indexOf(2016)], 209519);
  assert.equal(t.values[P.crime.years.indexOf(2023)], 324257);
  const pair = (S, a) => S.pairs.find(p => p.from === a);
  assert.equal(pair(t, 2013).state, 'not_comparable', 'the 2013 to 2014 format change breaks the line');
  assert.equal(pair(t, 2023).state, 'caution');
  assert.match(pair(t, 2023).reason, /Bharatiya Nyaya Sanhita/);
  const theft = P.crime.series.theft;
  for (const y of [2016, 2017, 2018, 2019, 2020]) assert.equal(theft.values[P.crime.years.indexOf(y)], null, 'theft 2016 to 2020 is blank, not zero');
  assert.equal(pair(theft, 2015).state, 'unavailable');
  assert.ok(P.crime.series.crimeAgainstWomen.values.slice(0, 3).every(v => v === null));
  assert.equal(P.crime.facts.theftShare2023, Math.round(228537 / 324257 * 100));
});

test('districts: 15 districts ranked by registered cases per lakh residents; the rank correlations are recomputed and small', () => {
  assert.equal(P.districts.ranked.length, 15);
  for (let i = 1; i < 15; i++) assert.ok(P.districts.ranked[i - 1].perLakh >= P.districts.ranked[i].perLakh);
  assert.equal(P.districts.ranked[0].district, 'North');
  assert.equal(P.districts.ranked[14].district, 'South-West');
  assert.ok(P.districts.ranked.every(r => Math.abs(r.perLakh - Math.round(r.count / r.population * 1e5)) <= 1));
  assert.equal(P.districts.correlations, undefined, 'the small rank table was replaced by the full matrix');
  // spearman: perfect, inverse and tied cases
  assert.equal(patterns.spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(patterns.spearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  assert.ok(Math.abs(patterns.spearman([1, 2, 2, 3], [1, 2, 3, 4]) - 0.9487) < 0.001);
});

test('roads: persistent places by printed road, 2023 fatal crashes by road, 2024 concentration, all tied to the committed files', () => {
  const rec = JSON.parse(read('data/profiles/recurring_locations.json')).places;
  assert.equal(P.roads.totalPlaces, rec.length);
  assert.equal(P.roads.placesInFiveOrMoreLists, rec.filter(p => p.reports_listed_of_9 >= 5).length);
  assert.equal(P.roads.byRoad.reduce((a, r) => a + r.places, 0) <= P.roads.placesInFiveOrMoreLists, true);
  assert.deepEqual(P.roads.byRoad.slice(0, 3).map(r => r.road), ['Ring Road', 'Outer Ring Road', 'GTK Road']);
  const rawZ = JSON.parse(read('data/crash_zones_2023_raw.json')), byLabel = {}; rawZ.forEach(z => { byLabel[z.road] = (byLabel[z.road] || 0) + z.fatal; });
  assert.deepEqual(P.roads.fatal2023.byRoad.map(r => r.fatal), [byLabel['Ring Road'], byLabel['Outer Ring Road'], byLabel['GTK Road']], 'G.T. Road is a different printed label and is not counted as GTK Road');
  assert.deepEqual(P.roads.fatal2023.byRoad.map(r => r.fatal), [69, 64, 55]);
  assert.equal(P.roads.fatal2023.top3, 188);
  const raw = JSON.parse(read('data/crash_zones_2023_raw.json'));
  assert.equal(P.roads.fatal2023.total, raw.reduce((a, z) => a + z.fatal, 0));
  assert.ok(P.roads.fatal2023.top3 < P.roads.fatal2023.total && P.roads.fatal2023.top3 === P.roads.fatal2023.byRoad.reduce((a, r) => a + r.fatal, 0));
  const aud = JSON.parse(read('data/profiles/audit_candidates_2024.json')).rows;
  const A = P.roads.areas2024;
  assert.deepEqual([A.zones, A.tier1or2, A.sparselyMapped], [93, aud.filter(z => z.evidence_tier <= 2).length, aud.filter(z => z.sparsely_mapped_surroundings).length]);
  assert.ok(A.fatalTier1or2 <= A.fatalAll);
  assert.equal(P.roads.firstAreas.length, 8);
  assert.ok(P.roads.firstAreas.every(z => z.lists >= 5));
});

test('the page: seven pages in the nav, scripts in order, the chart leaves gaps, every claim carries its limit, no innerHTML', () => {
  const html = files['patterns.html'], src = read('assets/page-patterns.js');
  assert.ok(html.includes('id="ptCrime"') && html.includes('id="ptDistricts"') && html.includes('id="ptRoads"') && html.includes('id="ptHelp"'));
  assert.ok(html.indexOf('assets/patterns-data.js') > 0 && html.indexOf('assets/patterns-data.js') < html.indexOf('assets/page-patterns.js'));
  assert.ok(/aria-current="page">Patterns</.test(html));
  assert.ok(src.includes("p.state === 'not_comparable' || p.state === 'unavailable'") && src.includes("p.state === 'caution' ? '5 4'"), 'not-comparable steps are not drawn; caution is dashed');
  for (const t of ['this data cannot show whether that is a real fall', 'Hurt is counted under different heads', 'a new change of cognisability is not supported', 'the hurt change does not cover theft', 'cannot be told apart from chance', 'does not show that any of them drives crime', 'not a finding from this data', 'Measure before and after at the same locations', 'shows where to look first, not why']) assert.ok(src.includes(t), t);
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(/.test(src));
  assert.ok(!/\bcauses? (crime|crashes)\b/i.test(src.replace(/does not show that any of them drives crime|crash causes/g, '')), 'no causal claim');
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(files['assets/patterns-data.js'], ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.window.DSO_PATTERNS)), JSON.parse(JSON.stringify(P)));
});

test('the planner brief is generated from the same numbers, lists eight tier-1 areas, and states what it cannot tell', () => {
  const b = files['planner-brief.html'];
  assert.ok(b.includes('Delhi road safety: where to look first'));
  assert.equal((b.match(/<tr><td>/g) || []).length, 8);
  assert.ok(b.includes(String(P.roads.placesInFiveOrMoreLists)) && b.includes(String(P.roads.areas2024.tier1or2)));
  for (const t of ['does not say why a crash happens or what should be built', 'there are no traffic or pedestrian counts', 'a repeated name is not a proven identical footprint'.replace('a repeated', 'A repeated')]) assert.ok(b.includes(t), t);
  assert.ok(/Ward \(legacy\)/.test(b) && /not the current 250/.test(b));
  assert.ok(files['patterns.html'].includes('href="planner-brief.html"'));
  assert.ok(/@media print/.test(read('assets/site.css')));
});

test('hurt reclassification: Delhi figures are recomputed from the archived workbooks, the national figures are marked as reported, and the page and continuity rule carry them', () => {
  const { sha256 } = require('../scripts/lib/release_utils');
  const hurt = JSON.parse(read('data/derived/bns_hurt_2023_2024.json'));
  for (const f of hurt.inputs) assert.equal(f.sha256, sha256(path.join(ROOT, f.file)), f.file);
  const d = hurt.delhi;
  assert.deepEqual([d.hurt2023, d.hurt2024, d.hurtChange], [6045, 2028, -4017]);
  assert.equal(d.hurt2023Header, 'Hurt');
  assert.equal(d.hurt2024Header, 'Hurt or Grievous Hurt');
  assert.equal(d.totalChange, d.totalIpcBns2024 - d.totalIpcBns2023);
  assert.equal(d.totalIpcBns2023, P.crime.facts.ipc2023);
  assert.equal(d.totalIpcBns2024, P.crime.facts.ipc2024, 'the 2024 workbook block sums to the Delhi-wide total the site prints');
  assert.equal(d.hurtShareOfTotalFallPct, Math.round(d.hurtChange / d.totalChange * 1000) / 10);
  assert.ok(d.hurtShareOfTotalFallPct < 10 && d.theftShareOfTotalFallPct > 90, 'hurt explains a small part, theft most of it');
  assert.match(hurt.national.status, /not re-derived/);
  assert.deepEqual([hurt.national.hurtCases2023, hurt.national.hurtCases2024, hurt.national.hurtChangePct], [636000, 441000, -30.58]);
  assert.ok(hurt.national.sources.length >= 2 && hurt.national.sources.every(u => /^https:\/\//.test(u)));
  assert.deepEqual(P.crime.bnsHurt, hurt);
  const c = JSON.parse(read('data/continuity.json'));
  const br = c.definitionBreaks.find(b => /Bharatiya Nyaya Sanhita/.test(b.reason));
  assert.match(br.reason, /Hurt or Grievous Hurt/);
  assert.match(br.reason, /the mechanism is not confirmed \(simple hurt was already non-cognisable under IPC section 323\)/);
  assert.ok(!/simple hurt became non-cognisable/.test(br.reason + read('assets/page-patterns.js') + JSON.stringify(hurt)), 'the unsupported explanation is gone');
  assert.ok(hurt.classificationCheck.sources.length === 2 && /not read them itself|has not read/.test(hurt.classificationCheck.checkedBy));
  assert.match(br.reason, /theft accounts for most of it/);
});

test('matrix: 13 metrics x 9 infrastructure layers, adjusted for the number of tests, with the districts used in every cell', () => {
  const M = P.matrix;
  assert.equal(M.metrics.length, 13);
  assert.equal(M.infra.length, 9);
  for (const mode of ['density', 'perCapita']) {
    const X = M.modes[mode];
    assert.equal(X.tests, 117);
    let sawPartial = false;
    X.cells.forEach(row => row.forEach(c => {
      assert.ok(c.n >= 3 && c.n <= 15);
      assert.equal(c.idx.length, c.n);
      assert.equal(c.x.length, c.n);
      for (const k of ['pearson', 'spearman']) {
        assert.ok(c[k].p >= 0 && c[k].p <= 1);
        assert.ok(c[k].q >= c[k].p - 1e-9, 'adjusted value is never below the raw p');
        if (c[k].partial != null) sawPartial = true;
      }
    }));
    assert.ok(sawPartial);
    assert.ok(X.adjusted.pearson <= X.raw.pearson && X.adjusted.spearman <= X.raw.spearman);
  }
  // partly surveyed layers keep only the surveyed districts
  const sl = M.infra.findIndex(i => i.key === 'streetlight');
  assert.ok(M.modes.density.cells[0][sl].n <= 9);
});

test('matrix cells reproduce a hand-checked value: persons killed (zones, 2024) against police posts per km2', () => {
  const M = P.matrix, mi = M.metrics.findIndex(x => x.key === 'personsKilled2024'), ii = M.infra.findIndex(x => x.key === 'policeInfra');
  const c = M.modes.density.cells[mi][ii];
  assert.equal(c.n, 14);
  assert.ok(Math.abs(c.pearson.r - 0.692) < 0.002);
  assert.ok(Math.abs(c.pearson.p - 0.0061) < 0.0003);
});
