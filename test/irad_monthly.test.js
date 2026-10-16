// Guards the staged district iRAD tables (data/derived/irad_monthly/): every row must satisfy the report's own arithmetic, trace to a staged PDF,
// and the Central Delhi 2025 totals must still match the monthly reports they came from.
//
//   node --test test/irad_monthly.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'data', 'derived', 'irad_monthly');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8')).files;
const issues = JSON.parse(fs.readFileSync(path.join(DIR, 'issues.json'), 'utf8'));

function readCsv(file) {
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map(l => {
    const cells = []; let cur = '', q = false;
    for (const ch of l) { if (ch === '"') q = !q; else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch; }
    cells.push(cur);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}
const months = readCsv('irad_monthly_by_district.csv');
const stations = readCsv('irad_station_by_period.csv');
const n = (v) => Number(v || 0);
const DISTRICTS = new Set(['Central', 'East', 'New Delhi', 'North', 'North East', 'North West', 'South', 'South East', 'South West', 'West', 'Shahdara']);

test('month-wise rows satisfy the report arithmetic, with unique district-month keys', () => {
  assert.ok(months.length >= 90);
  const seen = new Set();
  for (const r of months) {
    assert.ok(DISTRICTS.has(r.district), 'unknown district ' + r.district);
    assert.equal(r.check, 'ok', r.district + ' ' + r.year + '-' + r.month + ': ' + r.check);
    assert.equal(n(r.fatal) + n(r.total_non_fatal), n(r.total_accidents));
    assert.equal(n(r.grievous) + n(r.minor_hospitalised) + n(r.minor_non_hospitalised) + n(r.no_injury), n(r.total_non_fatal));
    assert.equal(n(r.killed) + n(r.persons_grievous) + n(r.persons_minor) + n(r.persons_no_injury), n(r.persons_total));
    const key = r.district + '|' + r.year + '|' + r.month;
    assert.ok(!seen.has(key), 'duplicate ' + key); seen.add(key);
  }
});

test('station rows satisfy the arithmetic and are unique per station and period', () => {
  assert.ok(stations.length >= 500);
  const seen = new Set();
  for (const r of stations) {
    assert.ok(DISTRICTS.has(r.district), 'unknown district ' + r.district);
    assert.equal(r.check, 'ok', r.district + ' ' + r.police_station + ': ' + r.check);
    const key = [r.district, r.period_from, r.period_to, r.code, r.police_station].join('|');
    assert.ok(!seen.has(key), 'duplicate ' + key); seen.add(key);
  }
});

test('every row traces to a staged PDF by checksum, and no arithmetic issues or disagreeing duplicates are hidden', () => {
  const hashes = new Set(manifest.map(f => f.sha256));
  for (const r of months.concat(stations)) assert.ok(hashes.has(r.sha256), r.source_file + ' is not in the manifest');
  assert.equal(issues.arithmetic.length, 0);
  assert.equal(issues.conflicts.length, 0, 'files that disagree must be reviewed: ' + JSON.stringify(issues.conflicts).slice(0, 300));
  for (const f of manifest) assert.match(f.sha256, /^[0-9a-f]{64}$/);
});

test('the report district comes from the report header, and files listed under another district are flagged', () => {
  const wrong = manifest.filter(f => f.listed_under_wrong_district);
  for (const f of wrong) assert.notEqual(f.listed_on_site, f.report_district);
  assert.equal(issues.listed_under_wrong_district.length, wrong.length);
});

test('Central Delhi 2025: monthly reports add up to 226 accidents, 49 fatal and 51 killed (to 10 December)', () => {
  const c = months.filter(r => r.district === 'Central' && r.year === '2025');
  assert.equal(c.length, 12);
  const sum = (k) => c.reduce((a, r) => a + n(r[k]), 0);
  assert.equal(sum('total_accidents'), 226);
  assert.equal(sum('fatal'), 49);
  assert.equal(sum('killed'), 51);
});
