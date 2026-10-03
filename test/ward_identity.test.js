// Ward identity: every ward-keyed output must have a non-empty, unique key. Guards the two source
// defects handled by scripts/lib/ward_identity.js (one identity-less polygon; two wards named
// RAM NAGAR) against reappearing in any downstream file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { applyWardIdentity, UNWARDED_NO } = require('../scripts/lib/ward_identity');

const DATA = path.join(__dirname, '..', 'data');
function csvRows(file) {
  const lines = fs.readFileSync(path.join(DATA, file), 'utf8').split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(',');
  return lines.slice(1).map(l => Object.fromEntries(head.map((h, i) => [h, l.split(',')[i]])));
}

test('ward infra geojson: 290 wards, every Ward_No and Ward_Name present and unique', () => {
  const g = JSON.parse(fs.readFileSync(path.join(DATA, 'delhi_wards_infra.geojson'), 'utf8'));
  assert.equal(g.features.length, 290);
  const nos = g.features.map(f => f.properties.Ward_No);
  const names = g.features.map(f => f.properties.Ward_Name);
  assert.ok(nos.every(Boolean), 'a ward has no Ward_No');
  assert.ok(names.every(Boolean), 'a ward has no Ward_Name');
  assert.equal(new Set(nos).size, 290);
  assert.equal(new Set(names).size, 290, 'Ward_Name is still not unique');
});

test('the unwarded polygon keeps its real data instead of being dropped', () => {
  const g = JSON.parse(fs.readFileSync(path.join(DATA, 'delhi_wards_infra.geojson'), 'utf8'));
  const u = g.features.find(f => f.properties.Ward_No === UNWARDED_NO);
  assert.ok(u, 'unwarded polygon missing');
  assert.ok(u.properties.areaSqKm > 30);
  assert.equal(u.properties.crashZones2024, 3);
  assert.equal(u.properties.crashZones2024FatalSum, 11);
});

test('both RAM NAGAR wards are individually addressable', () => {
  const g = JSON.parse(fs.readFileSync(path.join(DATA, 'delhi_wards_infra.geojson'), 'utf8'));
  const rn = g.features.filter(f => /^RAM NAGAR/.test(f.properties.Ward_Name)).map(f => f.properties.Ward_Name).sort();
  assert.deepEqual(rn, ['RAM NAGAR (247)', 'RAM NAGAR (87)']);
});

test('landuse and MPD-2047 ward CSVs agree with the ward set, with no blank keys', () => {
  for (const file of ['landuse_by_ward.csv', 'mpd2047_ward_comparison.csv']) {
    const rows = csvRows(file);
    assert.equal(rows.length, 290, file);
    assert.ok(rows.every(r => r.ward && r.ward_no), file + ' has a blank ward or ward_no');
    assert.equal(new Set(rows.map(r => r.ward_no)).size, 290, file);
  }
});

test('applyWardIdentity refuses to guess when more than one polygon lacks identity', () => {
  const fc = { features: [{ properties: { Ward_Name: null, Ward_No: null } }, { properties: { Ward_Name: null, Ward_No: null } }] };
  assert.throws(() => applyWardIdentity(fc), /at most one/);
});
