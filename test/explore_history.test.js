// Guards the earlier-districts view on Explore (2008 to 2018): counts as printed, drawn on the districts of each year, never joined to today's
// 15 districts, with every district shaped and every Delhi total taken from the printed series.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/lib/history_data');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const H = build(ROOT);
const source = {
  years: JSON.parse(read('data/historical_reporting/counts_2001_2010.json')).years.filter(y => y.year >= 2002)
    .concat(JSON.parse(read('data/historical_reporting/counts_2011_2018.json')).years)
};
const ut = Object.fromEntries(JSON.parse(read('data/releases/delhi_ut_series/delhi_ut_crime.json')).map(r => [r.year, r]));

test('2002 to 2018: 9 districts to 2006, 10 in 2007, 11 to 2016, 14 from 2017, each with a shape of that year; counts only', () => {
  assert.deepEqual(H.years.map(y => y.year), [2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  assert.equal(H.policy.countsOnly, true);
  assert.equal(H.policy.currentDistrictAllocation, false);
  assert.equal(H.policy.currentInfrastructureJoin, false);
  for (const y of H.years) {
    const terr = y.units.filter(u => u.territorial);
    assert.equal(terr.length, y.year <= 2006 ? 9 : y.year === 2007 ? 10 : y.year <= 2016 ? 11 : 14, String(y.year));
    assert.equal(y.mapKey, y.year <= 2006 ? '2001' : y.year === 2007 ? '2007' : y.year <= 2016 ? '2014' : '2017');
    const names = H.maps[y.mapKey].map(m => m.name.toLowerCase());
    for (const u of terr) assert.ok(names.includes(u.label.toLowerCase()), y.year + ' ' + u.label + ' has a shape');
    assert.ok(/not certified|Inferred|Derived/i.test(y.mapNote), 'the map is labelled as a reference, not a boundary');
  }
  assert.equal(H.maps['2014'].length, 11);
  assert.equal(H.maps['2017'].length, 14);
  assert.equal(H.maps['2001'].length, 9);
  assert.equal(H.maps['2007'].length, 10);
  assert.ok(!H.maps['2001'].some(m => m.name === 'Outer' || m.name === 'South-East') && H.maps['2007'].some(m => m.name === 'Outer') && !H.maps['2007'].some(m => m.name === 'South-East'), 'Outer exists from 2007, South-East from 2008');
  assert.ok(!H.maps['2014'].some(m => m.name === 'Dwarka') && H.maps['2017'].some(m => m.name === 'Dwarka'), 'Dwarka exists only on the 2017 map');
});

test('district values are the printed counts, untouched; nothing is turned into zero', () => {
  for (const y of H.years) {
    const src = source.years.find(s => s.year === y.year);
    assert.equal(y.units.length, src.units.length);
    src.units.forEach((u, i) => assert.deepEqual(y.units[i].values, u.values, y.year + ' ' + u.label));
  }
  const east = H.years.find(y => y.year === 2012).units.find(u => /^east$/i.test(u.label));
  assert.ok(east.values.theft > 0);
  // a measure that the source table does not carry stays null
  assert.equal(H.years.find(y => y.year === 2016).units[0].values.total_ipc, null);
});

test('the Delhi total is the printed Delhi UT figure in every year from 2011, including 2016 to 2018', () => {
  for (const y of H.years) {
    const c = y.citywide.values, row = ut[y.year];
    if (!row) continue; // 2002 to 2010: the Delhi total is checked against NCRB Table 1.6 in delhi_ut_2001_2010.test.js
    assert.equal(c.theft, row.theft, y.year + ' theft');
    assert.equal(c.robbery, row.robbery, y.year + ' robbery');
    assert.equal(c.total_ipc, row.total_ipc_bns, y.year + ' total');
  }
  assert.equal(H.years.find(y => y.year === 2016).citywide.values.theft, 130928);
});

test('2017 and 2018 district values equal the district releases the modern Explore data is built from', () => {
  for (const year of [2017, 2018]) {
    const rel = JSON.parse(read('data/releases/' + year + '/district_crime.json'));
    const y = H.years.find(r => r.year === year);
    let checked = 0;
    for (const d of rel) {
      const u = y.units.find(x => x.label.toLowerCase() === d.district.toLowerCase());
      if (!u) continue;
      if (d.theft != null) { assert.equal(u.values.theft, d.theft, year + ' ' + d.district + ' theft'); checked++; }
      if (d.robbery != null) { assert.equal(u.values.robbery, d.robbery, year + ' ' + d.district + ' robbery'); checked++; }
    }
    assert.ok(checked >= 20, 'checked ' + checked);
  }
});

test('Explore loads the history data before its script, offers 2001 to 2024, shows counts only for the earlier years, and builds no HTML from strings', () => {
  const html = read('explore.html');
  assert.ok(html.indexOf('assets/history-data.js') > 0 && html.indexOf('assets/history-data.js') < html.indexOf('assets/page-explore.js'));
  const js = read('assets/page-explore.js');
  assert.match(js, /crime: HX \? \[2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019/);
  assert.match(js, /function isHist\(\)/);
  assert.match(js, /isHist\(\) \? seg\(\[\['count', 'Count'\]\]/);
  assert.ok(!/innerHTML/.test(js));
  const data = read('assets/history-data.js');
  assert.match(data, /^\/\* Generated by scripts\/build_site\.js/);
  assert.match(data, /window\.DSO_HISTORY = /);
});

test('the limits are stated on the page: districts differ, counts only, no cross-year change', () => {
  const js = read('assets/page-explore.js');
  assert.match(js, /not today\\'s 15/);
  assert.match(js, /Counts only\. Area and population of these districts are not held/);
  assert.match(js, /no trend is drawn/);
  assert.match(js, /NCRB changed its format in 2014/);
});

test('where the listed units do not add to the printed Delhi total (2016 to 2018), the page says so; before that they add exactly', () => {
  const js = read('assets/page-explore.js');
  assert.match(js, /is not in this year.{1,2}s district table/);
  for (const y of H.years) {
    const sum = y.units.reduce((a, u) => a + (u.values.theft || 0), 0);
    if (y.year <= 2015) assert.equal(sum, y.citywide.values.theft, String(y.year));
    else assert.ok(sum < y.citywide.values.theft, String(y.year));
  }
});

test('2002 to 2007 maps come from the 2004 Rajya Sabha station list on the archived station polygons', () => {
  const r04 = JSON.parse(read('data/staged/police_geography_history/roster_2004.json'));
  const counts = Object.fromEntries(Object.entries(r04.districts).map(([d, l]) => [d, l.length]));
  assert.deepEqual(counts, { East: 13, 'New Delhi': 6, 'North-East': 11, Central: 12, North: 13, 'North-West': 17, South: 18, 'South-West': 13, West: 13 });
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 116);
  assert.match(r04.source.sha256, /^[0-9a-f]{64}$/);
  const shapes = require('../scripts/lib/historical_map_shapes');
  const n = shapes.notes(ROOT);
  assert.match(n.inferredNine, /112 of them are matched/);
  assert.match(n.inferredNine, /49 stations that opened after 2004/);
  assert.match(n.inferredNine, /5 September 2007/);
  assert.match(n.inferredTen, /1 October 2008/);
  const ev = JSON.parse(read('data/staged/police_geography_history/structure_evidence_2007_2010.json'));
  assert.ok(ev.sources.some(s => /Rajya Sabha/.test(s.source)) && ev.sources.some(s => /MHA Annual Report 2008-09/.test(s.source)));
});
