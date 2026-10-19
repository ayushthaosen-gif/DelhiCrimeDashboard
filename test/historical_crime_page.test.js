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
  assert.equal(manifest.productionReady, true);
  assert.equal(manifest.currentDistrictMapIntegrated, false);
});

test('every unit cites evidence that exists, and no value is negative', () => {
  for (const y of counts.years) for (const u of y.units) {
    for (const e of u.evidence || []) assert.ok(fs.existsSync(path.join(ROOT, e.path)), e.path);
    for (const v of Object.values(u.values || {})) assert.ok(v === null || v >= 0, y.year + ' ' + u.label);
  }
});

test('the 2014 map is the only verified-as-reference one; 2011-2013, 2015 and 2016 reuse it labelled inferred; 2017-2018 use the gazette-derived grouping', () => {
  const byYear = Object.fromEntries(counts.years.map(y => [y.year, y.map]));
  assert.equal(byYear[2014].status, 'reference_only');
  for (const y of [2011, 2012, 2013, 2015, 2016]) {
    assert.equal(byYear[y].status, 'inferred_reference', String(y));
    assert.equal(byYear[y].path, byYear[2014].path, 'inferred years reuse the 2014 file and nothing else');
    assert.match(byYear[y].basis, /no dated roster/i);
  }
  const g17 = 'data/staged/police_geography_history/districts_2017_reference.geojson';
  for (const y of [2017, 2018]) {
    assert.equal(byYear[y].status, 'derived_reference', String(y));
    assert.equal(byYear[y].path, g17);
  }
  const f17 = JSON.parse(read(g17)).features;
  assert.equal(f17.filter(f => f.properties.territorial).length, 14);
  assert.equal(f17.filter(f => f.properties.territorial).reduce((n, f) => n + f.properties.stationCount, 0), 163);
  assert.deepEqual(f17.find(f => f.properties.name === 'New Delhi').properties.stationsWithoutPolygon, ['North Avenue', 'South Avenue']);
  assert.ok(fs.existsSync(path.join(ROOT, byYear[2014].path)));
  assert.match(html, /Inferred, not verified/);
  assert.equal(counts.policy.annualBoundariesVerified, false);
});

test('the structure evidence behind the inferred years is on file and says what it cannot show', () => {
  const ev = JSON.parse(read('data/staged/police_geography_history/structure_evidence_2010_2016.json'));
  for (const r of ev.reports.filter(r => /^MHA Annual Report 20(10-11|11-12|12-13|13-14|14-15)$/.test(r.report))) {
    assert.equal(r.districts, 11, r.report);
    assert.equal(r.subDivisions, 54, r.report);
    assert.match(r.sha256, /^[0-9a-f]{64}$/, r.report);
  }
  assert.match(ev.readAs.join(' '), /cannot be ruled out/);
  assert.match(html, /every year from 2010-11 to 2014-15/);
});

test('the manifest records the hash of every shape, validation and evidence file the page is built from', () => {
  const lib = require('../scripts/lib/historical_map_shapes');
  const crypto = require('node:crypto');
  const recorded = Object.fromEntries(manifest.sourceInputs.map(i => [i.path, i.sha256]));
  for (const p of lib.INPUTS) {
    assert.ok(recorded[p], 'missing from sourceInputs: ' + p);
    assert.equal(recorded[p], crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex'), p);
  }
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
