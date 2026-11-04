// Guards the staged Delhi UT 2001 to 2010 totals: every year is present once, and each row's printed rate follows from its incidence and population.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'staged', 'delhi_ut_total_2001_2010', 'delhi_ut_total_ipc_2001_2010.json'), 'utf8'));

test('one row for each year 2001 to 2010, each with a source and hash', () => {
  assert.deepEqual(data.rows.map(r => r.year), [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010]);
  for (const r of data.rows) {
    assert.match(r.source_url, /^https:\/\/www\.ncrb\.gov\.in\/uploads\/.*\.pdf$/, String(r.year));
    assert.match(r.sha256, /^[0-9a-f]{64}$/, String(r.year));
  }
});

test('the printed rate is incidence per lakh of the printed population, to one decimal', () => {
  for (const r of data.rows) {
    const computed = r.incidence / r.population_lakh;
    assert.ok(Math.abs(computed - r.rate) <= 0.06, r.year + ': ' + computed.toFixed(2) + ' vs printed ' + r.rate);
  }
});

test('the yearly change stays within a plausible band, so a column slip would show', () => {
  for (let i = 1; i < data.rows.length; i++) {
    const change = data.rows[i].incidence / data.rows[i - 1].incidence - 1;
    assert.ok(Math.abs(change) < 0.15, data.rows[i].year + ' changed by ' + (change * 100).toFixed(1) + '%');
  }
});

const dir = path.join(__dirname, '..', 'data', 'staged', 'delhi_ut_total_2001_2010');
const readJson = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const district = readJson('delhi_district_ipc_2001_2010.json');

test('district tables: for every year and column, the unit rows add to the printed TOTAL row', () => {
  assert.deepEqual(Object.keys(district.years).map(Number), [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010]);
  for (const [year, y] of Object.entries(district.years)) {
    assert.match(y.source_url, /^https:\/\/www\.ncrb\.gov\.in\/uploads\/.*\.pdf$/, year);
    assert.match(y.sha256, /^[0-9a-f]{64}$/, year);
    const cols = Object.keys(y.printed_total);
    assert.equal(cols.length, y.columns_printed, year);
    for (const c of cols) {
      const sum = y.units.reduce((a, u) => a + u.values[c], 0);
      assert.equal(sum, y.printed_total[c], year + ' ' + c);
    }
  }
});

test('district tables: 2002 to 2010 print all 30 columns and 2001 only the first ten, and the total IPC column equals the Delhi UT total read from the page images', () => {
  const ut = Object.fromEntries(data.rows.map(r => [r.year, r.incidence]));
  assert.equal(district.years['2001'].columns_printed, 10);
  for (let year = 2002; year <= 2010; year++) {
    const y = district.years[year];
    assert.equal(y.columns_printed, 30, String(year));
    assert.equal(y.printed_total.total_cognizable_ipc, ut[year], String(year));
  }
});

test('theft, rape and kidnapping sub-columns add up inside each unit and year', () => {
  for (const [year, y] of Object.entries(district.years)) {
    for (const u of y.units) {
      const v = u.values;
      assert.equal(v.rape_custodial + v.rape_other, v.rape_total, year + ' ' + u.unit + ' rape');
      assert.equal(v.kidnapping_of_women_girls + v.kidnapping_others, v.kidnapping_abduction_total, year + ' ' + u.unit + ' kidnapping');
      if (v.theft_total !== undefined) assert.equal(v.theft_auto + v.theft_other, v.theft_total, year + ' ' + u.unit + ' theft');
    }
  }
});

test('reporting units: nine territorial districts to 2006, Outer from 2007, South-East from 2008, eleven by 2010', () => {
  const count = y => district.years[y].territorial_districts;
  for (const y of [2001, 2002, 2003, 2004, 2005, 2006]) assert.equal(count(y), 9, String(y));
  assert.equal(count(2007), 10);
  for (const y of [2008, 2009, 2010]) assert.equal(count(y), 11, String(y));
  const ru = readJson('reporting_units_by_year.json');
  assert.equal(ru.first_printed_in_run['OUTER'], 2007);
  assert.equal(ru.first_printed_in_run['SOUTH-EAST'], 2008);
  for (const y of Object.keys(district.years)) assert.equal(ru.years[y].territorial_districts.length, district.years[y].territorial_districts, y);
});

test('Delhi (City): incidence over the common population reproduces each printed rate', () => {
  const city = readJson('delhi_city_total_ipc_2001_2010.json');
  assert.deepEqual(city.rows.map(r => r.year), [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010]);
  for (const r of city.rows) assert.ok(Math.abs(r.incidence / r.population_lakh - r.rate) <= 0.06, String(r.year));
});

test('citywide road counts 2008 to 2010 add up and match the Table 3.1 totals already held', () => {
  const road = readJson('road_citywide_2008_2010.json');
  const t31 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'releases', 'road_victims_by_mode_2004_2018', 'victims_by_mode.json'), 'utf8'));
  for (const r of road.rows) {
    assert.equal(r.non_injury + r.simple + r.fatal, r.total, String(r.year));
    const t = t31.find(x => x.year === r.year);
    assert.equal(r.persons_killed, t.total_killed, r.year + ' killed');
    if (r.year !== 2008) assert.equal(r.persons_injured, t.total_injured, r.year + ' injured');
  }
});

test('the Road safety page carries a 2004 to 2010 deaths-by-mode table built from the release', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', 'assets', 'page-road.js'), 'utf8');
  assert.ok(page.includes('Earlier years: 2004 to 2010') && page.includes('S.victimsEarlier'));
  const site = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'lib', 'site_data.js'), 'utf8');
  assert.ok(site.includes('victimsEarlier'));
});

const earlyCounts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'historical_reporting', 'counts_2001_2010.json'), 'utf8'));
const pageHtml = fs.readFileSync(path.join(__dirname, '..', 'historical_crime.html'), 'utf8');

test('Historical crime view: 2001 to 2010 counts carry each year\'s own units, no map, no allocation, and match the staged tables', () => {
  assert.deepEqual(earlyCounts.years.map(y => y.year), [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010]);
  assert.equal(earlyCounts.policy.currentDistrictAllocation, false);
  for (const y of earlyCounts.years) {
    const src = district.years[y.year];
    assert.equal(y.map.status, 'boundary_unverified', String(y.year));
    assert.equal(y.units.length, src.units.length, String(y.year));
    assert.equal(y.units.filter(u => u.territorial).length, y.territorialCount, String(y.year));
    assert.equal(y.citywide.values.total_ipc, data.rows.find(r => r.year === y.year).incidence, String(y.year));
    for (const u of y.units) {
      for (const e of u.evidence) assert.ok(fs.existsSync(path.join(__dirname, '..', e.path)), e.path);
      for (const v of Object.values(u.values)) assert.ok(v === null || v >= 0);
    }
    const central = y.units.find(u => u.label === 'Central').values;
    assert.equal(central.murder, src.units.find(u => u.unit === 'CENTRAL').values.murder, y.year + ' Central murder');
  }
  assert.equal(earlyCounts.years[0].units.find(u => u.label === 'Central').values.total_ipc, null, '2001 has no per-unit total: unavailable, not zero');
});

test('Historical crime page offers 2001 to 2018, and the manifest lists the earlier counts with hashes', () => {
  assert.match(pageHtml, /Delhi historical crime · 2001–2018/);
  assert.ok(pageHtml.includes('counts_2001_2010.json'));
  assert.ok(pageHtml.includes('REPORTING.years='), 'the early years are merged into the page data');
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'historical_reporting', 'manifest.json'), 'utf8'));
  assert.deepEqual(m.earlierCounts.referenceYears, [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010]);
  for (const i of m.earlierCounts.sourceInputs) assert.match(i.sha256, /^[0-9a-f]{64}$/);
});

test('2001 crime heads (Table 6): each figure reproduces its printed rate, and theft is auto plus other', () => {
  const t = JSON.parse(fs.readFileSync(path.join(dir, 'delhi_ut_crime_heads_2001_table6.json'), 'utf8'));
  assert.match(t.source.sha256, /^[0-9a-f]{64}$/);
  for (const [k, h] of Object.entries(t.heads)) assert.equal(Math.round(h.incidence / t.population_lakh * 10) / 10, h.rate, k);
  assert.equal(t.heads.theft_total.incidence, t.heads.theft_auto.incidence + t.heads.theft_other.incidence);
});
