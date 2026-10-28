// Guards data/series_status.json, the single statement of what each data series is and whether it is current:
// every entry is complete, every path it names exists, and the README's status table lists every series.
//
//   node --test test/series_status.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const status = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'series_status.json'), 'utf8'));
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');

test('every series has the required fields, a known status and a known temporal type, and ids are unique', () => {
  const ids = new Set();
  for (const s of status.series) {
    for (const k of ['id', 'name', 'status', 'temporal_type', 'geography', 'where', 'note']) assert.ok(s[k], s.id + ' is missing ' + k);
    assert.ok(Object.keys(status.status_values).includes(s.status), s.id + ': unknown status ' + s.status);
    assert.ok(status.temporal_type_values.includes(s.temporal_type), s.id + ': unknown temporal type ' + s.temporal_type);
    assert.ok('latest_reference_period' in s, s.id);
    assert.ok(!ids.has(s.id), 'duplicate id ' + s.id); ids.add(s.id);
  }
});

test('every path a series points to exists in the repository', () => {
  for (const s of status.series) assert.ok(fs.existsSync(path.join(ROOT, s.where)), s.id + ' points to a missing path: ' + s.where);
});

test('series that are not published or not implemented carry no reference period, and partial-period series are provisional', () => {
  for (const s of status.series) {
    if (s.status === 'not_published') assert.equal(s.latest_reference_period, null, s.id);
    if (s.temporal_type === 'year_to_date') assert.equal(s.status, 'provisional', s.id + ': a year-to-date series must be provisional');
  }
});

test('the README status table lists every series by id and shows its status', () => {
  for (const s of status.series) {
    assert.ok(readme.includes('`' + s.id + '`'), 'README table is missing ' + s.id);
    const row = readme.split('\n').find(l => l.includes('`' + s.id + '`'));
    assert.ok(row.includes(s.status), 'README row for ' + s.id + ' does not show status ' + s.status);
  }
});

