// Guards the historical crime view (historical_crime.html) and its data (data/historical_reporting/): eight years, original reporting
// units only, no modern district shapes, no allocation or joins, a map only where a dated reference exists, links from both main pages.
//
//   node --test test/historical_crime_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const counts = JSON.parse(read('data/historical_reporting/counts_2011_2018.json'));
const manifest = JSON.parse(read('data/historical_reporting/manifest.json'));
const html = read('historical_crime.html');

test('the data covers 2011 to 2018 in order, with the unit counts the sources print', () => {
  assert.deepEqual(counts.years.map(y => y.year), [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  const territorial = Object.fromEntries(counts.years.map(y => [y.year, y.units.filter(u => u.territorial).length]));
  assert.deepEqual(territorial, { 2011: 11, 2012: 11, 2013: 11, 2014: 11, 2015: 11, 2016: 11, 2017: 14, 2018: 14 });
  for (const y of counts.years) assert.equal(y.territorialCount, territorial[y.year], 'year ' + y.year);
  for (const y of counts.years.filter(y => y.year >= 2016)) assert.equal(y.units.filter(u => !u.territorial).length, 0, 'no special units, and no synthetic empty rows, after 2015');
});

test('the policy forbids allocation to current districts and infrastructure joins, and says no annual boundary is verified', () => {
  assert.deepEqual(counts.policy, { countsOnly: true, currentDistrictAllocation: false, currentInfrastructureJoin: false, annualBoundariesVerified: false, nullMeans: counts.policy.nullMeans });
  assert.match(counts.policy.nullMeans, /never zero/i);
  assert.equal(manifest.productionReady, false);
  assert.equal(manifest.currentDistrictMapIntegrated, false);
});

test('every unit cites evidence that exists, and no value is negative', () => {
  for (const y of counts.years) for (const u of y.units) {
    for (const e of u.evidence || []) assert.ok(fs.existsSync(path.join(ROOT, e.path)), e.path);
    for (const v of Object.values(u.values || {})) assert.ok(v === null || v >= 0, y.year + ' ' + u.label);
  }
});

test('a map is offered only where a dated reference exists (2014), and it is marked reference only', () => {
  const withPath = counts.years.filter(y => y.map && y.map.path).map(y => y.year);
  assert.deepEqual(withPath, [2014]);
  assert.equal(counts.years.find(y => y.year === 2014).map.status, 'reference_only');
  assert.ok(fs.existsSync(path.join(ROOT, counts.years.find(y => y.year === 2014).map.path)));
});

test('the page never loads modern district or ward shapes and carries the boundary caveats', () => {
  assert.ok(!/dashboard_boundaries|delhi_wards|police_markers/.test(html), 'a modern geography is referenced');
  assert.ok(!/fetch\(/.test(html), 'the page must use its embedded data only');
  assert.match(html, /historical boundaries not yet verified/);
  assert.match(html, /historical reference map/);
  for (const id of ['year', 'metric', 'territorialRows', 'specialRows']) assert.ok(html.includes('id="' + id + '"'), id);
  assert.ok(html.includes('4124'), 'the 2014 Central theft count is on the page');
});

test('the dashboard and the interactive map link to the view, and so do their build scripts', () => {
  for (const f of ['delhi_safety_dashboard.html', 'interactive_map.html', 'scripts/build.js', 'scripts/build_interactive_map.js']) assert.ok(read(f).includes('historical_crime.html'), f);
});
