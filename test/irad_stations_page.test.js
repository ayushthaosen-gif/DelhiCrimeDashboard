// Structural guard for the district iRAD explorer page (irad_stations.html).
//
//   node --test test/irad_stations_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'irad_stations.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

test('the page script parses', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('every element the script looks up by id exists in the page', () => {
  const ids = [...new Set([...script.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length > 10);
  assert.deepEqual(ids.filter(id => !html.includes('id="' + id + '"')), []);
});

test('the columns the page reads exist in both staged CSVs', () => {
  const head = f => fs.readFileSync(path.join(ROOT, 'data', 'derived', 'irad_monthly', f), 'utf8').split(/\r?\n/)[0].split(',');
  const m = head('irad_monthly_by_district.csv'), s = head('irad_station_by_period.csv');
  ['district', 'year', 'month', 'fatal', 'killed', 'total_accidents', 'report_period_to', 'extraction_method'].forEach(c => assert.ok(m.includes(c), c));
  ['district', 'police_station', 'period_from', 'period_to', 'fatal', 'killed', 'total_accidents'].forEach(c => assert.ok(s.includes(c), c));
});

test('the page keeps its caveat, a Home link and no external scripts', () => {
  assert.ok(html.includes('Read before comparing'));
  assert.ok(html.includes('href="delhi_safety_dashboard.html"'));
  assert.ok(!/<script[^>]+src=/.test(html));
});

test('the coverage caveat is built from the data files, not typed into the page', () => {
  for (const f of ['manifest.json', 'unstaged_published_reports.csv', 'coverage_notes.json']) assert.ok(html.includes('data/derived/irad_monthly/' + f), f + ' is not read by the page');
  assert.ok(html.includes('id="coverageDyn"'));
  assert.ok(!/is not loaded/.test(html) && !/None? and Shahdara have none/.test(html), 'a hard-coded coverage statement is back in the page');
  const notes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'derived', 'irad_monthly', 'coverage_notes.json'), 'utf8'));
  assert.deepEqual(notes.no_accident_series_found.map(d => d.district), ['North', 'Shahdara']);
});
