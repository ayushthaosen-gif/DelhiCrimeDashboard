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
const DISTRICTS = new Set(['Central', 'East', 'New Delhi', 'North', 'North East', 'North West', 'South', 'South East', 'South West', 'West', 'Shahdara', 'Rohini']);

test('month-wise rows satisfy the report arithmetic, with unique district-month keys', () => {
  assert.ok(months.length >= 140);
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

test('New Delhi 2022 to 2025 come from scanned PDFs and are labelled as transcribed, with totals matching the printed TOTAL rows', () => {
  const expected = { 2022: [233, 54, 58], 2023: [201, 33, 34], 2024: [229, 37, 37], 2025: [238, 37, 41] };
  for (const [year, [acc, fatal, killed]] of Object.entries(expected)) {
    const rows = months.filter(r => r.district === 'New Delhi' && r.year === year);
    assert.equal(rows.length, 12, year);
    for (const r of rows) assert.equal(r.extraction_method, 'image_transcription');
    const sum = (k) => rows.reduce((a, r) => a + n(r[k]), 0);
    assert.equal(sum('total_accidents'), acc); assert.equal(sum('fatal'), fatal); assert.equal(sum('killed'), killed);
  }
  const t = JSON.parse(fs.readFileSync(path.join(DIR, 'transcribed_image_tables.json'), 'utf8'));
  assert.match(t.note, /should still spot-check/);
  for (const f of t.files) {
    const cols = Object.keys(f.printed_total_row);
    for (const c of cols) assert.equal(Object.values(f.months).reduce((a, m) => a + m[c], 0), f.printed_total_row[c], f.file + ' ' + c);
  }
  for (const r of months.filter(r => r.extraction_method !== 'image_transcription')) assert.equal(r.extraction_method, 'pdf_table');
});


test('FIR counts are read with the format named in the column header: percentage(count) in the 2026 South East reports, never bigger than the accidents', () => {
  for (const r of stations) assert.ok(n(r.fir_filed) <= n(r.total_accidents), r.source_file + ' ' + r.police_station + ': FIR ' + r.fir_filed + ' > accidents ' + r.total_accidents);
  const se = (file, name) => stations.find(r => r.source_file === file && r.police_station === name);
  assert.equal(se('South_East__17881699603394.pdf', 'Jait Pur').fir_filed, '5');       // printed 71.4(5)
  assert.equal(se('South_East__17881699603394.pdf', 'Govind Puri').fir_filed, '2');    // printed 100(2)
  assert.equal(se('South_East__17881706536659.pdf', 'Okhla Industrial Area').fir_filed, '14'); // printed 93.3(14)
  const fmt = new Set(manifest.filter(f => f.kind === 'by_station' && f.report_district === 'South East' && f.period_from >= '2026-01-01').map(f => f.fir_format));
  assert.deepEqual([...fmt], ['percentage(count)']);
});

test('station rows add up to the TOTAL printed in each report, and no report names a district the script does not know', () => {
  assert.deepEqual(issues.station_totals, []);
  assert.deepEqual(issues.unknown_district, []);
});

test('the report that names ROHINI is staged as Rohini, not North West', () => {
  const rows = stations.filter(r => r.source_file === 'North_West__2025041579.pdf');
  assert.equal(rows.length, 10);
  assert.ok(rows.every(r => r.district === 'Rohini'));
  assert.equal(manifest.find(f => f.file === 'North_West__2025041579.pdf').report_district, 'Rohini');
});

test('scanned New Delhi files carry their transcribed metadata in the manifest, and row counts exclude the TOTAL line', () => {
  for (const f of manifest.filter(f => /^New_Delhi__20250415(82|20|33)\.pdf$|^New_Delhi__17809011041267\.pdf$/.test(f.file))) {
    assert.equal(f.report_district, 'New Delhi'); assert.equal(f.kind, 'month_wise'); assert.equal(f.rows, 12); assert.ok(f.period_from && f.period_to);
  }
  assert.equal(manifest.find(f => f.file === 'West__2025041795.pdf').rows, 12);
  assert.equal(manifest.find(f => f.file === 'Central__jan_2025.pdf').rows, 1);
});

test('every staged PDF has a recovered public link, and the unstaged-report inventory is complete and unique', () => {
  for (const f of manifest) {
    assert.match(f.source_url, /^https:\/\/(cdn\.s3waas\.gov\.in|[a-z]+\.delhi\.gov\.in)\//, f.file + ' has no public URL');
    assert.ok(f.source_page && f.source_note, f.file);
  }
  const inv = readCsv('unstaged_published_reports.csv');
  assert.equal(inv.length, 113);
  assert.equal(new Set(inv.map(r => r.sha256)).size, 113);
  const have = new Set(manifest.map(f => f.sha256));
  for (const r of inv) { assert.match(r.sha256, /^[0-9a-f]{64}$/); assert.ok(!have.has(r.sha256), r.ref + ' is actually staged'); assert.match(r.public_url, /^https:\/\//); }
});

test('scanned New Delhi rows record that the header prints accident date, and the 2025 interval is marked as inferred', () => {
  const scans = months.filter(r => r.extraction_method === 'image_transcription');
  assert.ok(scans.length >= 48);
  assert.ok(scans.every(r => r.date_basis === 'accident'));
  assert.equal(manifest.find(f => f.file === 'New_Delhi__17809011041267.pdf').period_inferred, true);
  assert.equal(manifest.find(f => f.file === 'New_Delhi__2025041582.pdf').period_inferred, false);
});
