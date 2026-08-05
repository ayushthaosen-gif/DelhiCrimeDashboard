const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const RELEASES = path.join(ROOT, 'data', 'releases');
const YEARS = Array.from({ length: 9 }, (_, i) => 2016 + i);
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

test('2016-2024 each have an import-ready release and machine-readable manifest', () => {
  for (const year of YEARS) {
    const dir = path.join(RELEASES, String(year));
    const manifest = readJson(path.join(dir, 'manifest.json'));
    const rows = readJson(path.join(dir, 'district_crime.json'));
    assert.equal(manifest.releaseYear, year);
    assert.equal(manifest.nullPolicy.includes('never coerce null to zero'), true);
    assert.equal(rows.length, 15);
    assert.equal(new Set(rows.map(r => r.district)).size, 15);
    assert.equal(fs.existsSync(path.join(dir, 'district_crime.csv')), true);
    for (const item of manifest.files) {
      const file = path.join(dir, item.path);
      assert.equal(fs.existsSync(file), true, year + '/' + item.path);
      assert.equal(hash(file), item.sha256, year + '/' + item.path + ' checksum');
    }
  }
});

test('historical gaps remain null and carry explicit coverage reasons', () => {
  const rows = readJson(path.join(RELEASES, '2016', 'district_crime.json'));
  const dwarka = rows.find(r => r.district === 'Dwarka');
  assert.equal(dwarka.district_existed_as_separate_reporting_zone, false);
  assert.equal(dwarka.theft, null);
  assert.match(dwarka.null_reason, /did not exist/);
  assert.equal(rows.every(r => r.burglary === null), true);
  assert.equal(rows.every(r => r.total_sll === null), true);
});

test('2024 crime is complete and 2022 comparisons use available 2021 values', () => {
  const rows2024 = readJson(path.join(RELEASES, '2024', 'district_crime.json'));
  for (const row of rows2024) for (const field of ['theft','robbery','burglary','total_ipc_bns','crime_against_women','total_sll']) assert.notEqual(row[field], null);
  const rows2022 = readJson(path.join(RELEASES, '2022', 'district_crime.json'));
  assert.equal(rows2022.find(r => r.district === 'Central').theft_previous_year_comparable, true);
});

test('shared manifest inventories every root production data file', () => {
  const shared = readJson(path.join(RELEASES, 'shared', 'manifest.json'));
  const expected = fs.readdirSync(path.join(ROOT, 'data'), { withFileTypes: true })
    .filter(e => e.isFile() && /\.(json|geojson|csv)$/.test(e.name)).map(e => 'data/' + e.name).sort();
  const actual = shared.productionFileInventory.map(x => x.file).sort();
  assert.deepEqual(actual, expected);
  assert.equal(shared.datasets.some(d => d.id === 'pedestrian_overbridges'), true);
});

test('the audited 2025 release remains indexed, not rewritten as production', () => {
  const index = readJson(path.join(RELEASES, 'manifest.json'));
  assert.equal(index.years.length, 9);
  assert.equal(index.staged2025, '2025/README.md');
  assert.equal(fs.existsSync(path.join(RELEASES, '2025', 'audit', 'source_manifest_2025.json')), true);
});
