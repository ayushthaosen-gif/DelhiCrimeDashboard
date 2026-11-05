// Guards the staged Traffic Police Table 2.4 (road accident trends 1986 to 2015): every year once, rows consistent with the report's own printed columns, and equal to the series already on the site for 2008 to 2015.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildAll } = require('../scripts/lib/site_data.js');

const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'staged', 'tp_road_trend_1986_2015', 'road_accident_trends_1986_2015.json'), 'utf8'));
const byYear = {};
doc.rows.forEach(r => { byYear[r.year] = r; });
const unreliable = {};
doc.rates_not_reproduced.forEach(x => { unreliable[x.year] = x.printed_columns_not_reproduced_from_the_counts; });

test('one row for each year 1986 to 2015, with a source and hash', () => {
  assert.deepEqual(doc.rows.map(r => r.year), Array.from({ length: 30 }, (_, i) => 1986 + i));
  assert.match(doc.source.url, /^https:\/\/traffic\.delhipolice\.gov\.in\/.*\.pdf$/);
  assert.match(doc.source.sha256, /^[0-9a-f]{64}$/);
});

test('printed rates follow from the counts, except in the years listed as not reproduced', () => {
  for (const r of doc.rows) {
    const bad = [];
    if (Math.abs(r.road_deaths / r.population * 1e5 - r.printed_rate_per_lakh_population) > 0.011) bad.push('rate_per_lakh');
    if (Math.abs(r.road_deaths / r.motor_vehicles_cumulative * 1e4 - r.printed_rate_per_10000_vehicles) > 0.011) bad.push('rate_per_10000_vehicles');
    if (Math.abs(r.road_deaths / r.total_accidents_all_types * 100 - r.printed_accident_severity) > 0.021) bad.push('severity');
    assert.deepEqual(bad, unreliable[r.year] || [], String(r.year));
  }
});

test('a fatal accident is at least one death and at most one crash, except 2004 whose conflict is recorded', () => {
  for (const r of doc.rows) {
    assert.ok(r.fatal_accidents <= r.total_accidents_all_types, r.year + ' fatal > total');
    if (r.year === 2004) {
      assert.ok(r.fatal_accidents > r.road_deaths, '2004 conflict is still present');
      assert.equal(doc.known_conflict_2004.table_3_1_total_killed, 1977);
      assert.ok(doc.known_conflict_2004.table_3_1_total_killed >= r.fatal_accidents);
    } else assert.ok(r.fatal_accidents <= r.road_deaths, r.year + ' fatal > deaths');
  }
});

test('2008 to 2015 equal the Traffic Police series already on the site, so the two count the same thing', () => {
  const S = buildAll().SITE, T = {};
  S.trendsEarlier.concat(S.trends).forEach(r => { T[r.year] = r; });
  for (let y = 2008; y <= 2015; y++) {
    assert.equal(byYear[y].total_accidents_all_types, T[y].crashes, y + ' crashes');
    assert.equal(byYear[y].fatal_accidents, T[y].fatalCrashes, y + ' fatal');
    assert.equal(byYear[y].road_deaths, T[y].killed, y + ' killed');
  }
});

test('the site trend starts in 1986, uses Table 2.4 for 1986 to 2007, and uses the recorded choice for 2004', () => {
  const E = buildAll().SITE.trendsEarlier, M = {};
  E.forEach(r => { M[r.year] = r; });
  assert.deepEqual(E.map(r => r.year), Array.from({ length: 25 }, (_, i) => 1986 + i));
  for (let y = 1986; y <= 2007; y++) {
    assert.equal(M[y].crashes, byYear[y].total_accidents_all_types, y);
    assert.equal(M[y].fatalCrashes, byYear[y].fatal_accidents, y);
    assert.equal(M[y].killed, y === 2004 ? doc.site_choice['2004'].killed : byYear[y].road_deaths, y);
  }
});

test('2001 to 2003 killed totals agree with Table 2.4, and 2005 to 2007 with the Table 3.1 totals already held', () => {
  for (const t of doc.table_3_1_totals_2001_2003.rows) assert.equal(t.killed, byYear[t.year].road_deaths, String(t.year));
  const V = buildAll().SITE.victimsEarlier;
  for (const y of [2005, 2006, 2007]) assert.equal(V[y].total, byYear[y].road_deaths, String(y));
  assert.equal(V[2004].total, doc.site_choice['2004'].killed);
});

test('persons injured are held for 2001 to 2024 and for no earlier year, and 2019 to 2023 equal the figures the 2023 report reprints', () => {
  const S = buildAll().SITE, all = S.trendsEarlier.concat(S.trends), M = {};
  all.forEach(r => { M[r.year] = r; });
  for (let y = 1986; y <= 2000; y++) assert.equal(M[y].injured, null, String(y));
  for (let y = 2001; y <= 2024; y++) assert.ok(Number.isInteger(M[y].injured) && M[y].injured > 0, String(y));
  // Table 3.1 of Delhi Road Crash Report 2023 (printed page 47) prints the totals for 2019 to 2023
  const reprint = { 2019: 5152, 2020: 3662, 2021: 4273, 2022: 5201, 2023: 5470 };
  for (const y of Object.keys(reprint)) assert.equal(M[y].injured, reprint[y], y);
  for (const t of doc.table_3_1_totals_2001_2003.rows) assert.equal(M[t.year].injured, t.injured, String(t.year));
  assert.equal(M[2024].injured, 5224);
});
