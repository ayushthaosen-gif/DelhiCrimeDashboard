// Validates the real, committed output of the four data pipelines added on 2026-08-06/08:
// scripts/build_infra_extras.js (street lamps + combined PAPL/OSM streetlights + footway
// coverage), scripts/build_road_footway_sizes_csv.js, and scripts/build_landuse_wards_csv.js.
// Follows the same convention as test/yearly_releases.test.js: read the actual files these
// scripts write to data/, not a re-implementation of their internal logic, so a regression in the
// real output is what fails, not a copy of the code that could silently drift from it.
//
//   node --test test/infra_data.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const DISTRICTS = new Set([
  'Central', 'Dwarka', 'East', 'New Delhi', 'North', 'North-East', 'North-West', 'Outer',
  'Outer North', 'Rohini', 'Shahdara', 'South', 'South-East', 'South-West', 'West',
]);
function readJson(file) { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
function readCsv(file) {
  const text = fs.readFileSync(path.join(DATA, file), 'utf8');
  const lines = text.split(/\r\n|\n/).filter(l => l.length > 0);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}
function parseCsvLine(line) {
  const cells = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else cur += c;
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { cells.push(cur); cur = ''; }
    else cur += c;
  }
  cells.push(cur);
  return cells;
}

test('combined streetlight figure is always attributed to exactly one real source, never blended', () => {
  const rows = readJson('streetlights_combined_by_district.json');
  assert.equal(rows.length, 15);
  assert.equal(new Set(rows.map(r => r.district)).size, 15);
  for (const r of rows) {
    assert.equal(DISTRICTS.has(r.district), true, r.district + ' is not a known district');
    assert.equal(['PAPL survey', 'OSM (PAPL not surveyed)', 'no data'].includes(r.combined_source), true, r.district + ' has an unrecognized combined_source: ' + r.combined_source);
    if (r.combined_source === 'PAPL survey') {
      assert.equal(r.combined_count, r.papl_total_lights, r.district + ': PAPL-sourced combined_count must equal papl_total_lights exactly');
      assert.ok(r.papl_survey_points >= 10, r.district + ': claimed PAPL survey but survey_points < 10');
    } else if (r.combined_source === 'OSM (PAPL not surveyed)') {
      assert.equal(r.combined_count, r.osm_street_lamp_count, r.district + ': OSM-fallback combined_count must equal osm_street_lamp_count exactly');
      assert.ok(r.papl_total_lights == null, r.district + ': OSM-fallback row must not also carry a PAPL total');
    } else {
      assert.equal(r.combined_count, null, r.district + ': "no data" must mean combined_count is null, never a fabricated 0');
    }
  }
  // Real, known fact this project already verified once (see docs/AGENT_CHANGELOG.md): PAPL's
  // survey is far more complete than OSM tagging where it actually covers a district.
  const central = rows.find(r => r.district === 'Central');
  assert.equal(central.combined_source, 'PAPL survey');
  assert.ok(central.papl_total_lights > central.osm_street_lamp_count * 10, 'Central PAPL total should dwarf its OSM count, as previously verified');
});

test('streetlights CSV and JSON agree row-for-row', () => {
  const jsonRows = readJson('streetlights_combined_by_district.json');
  const csvRows = readCsv('streetlights_combined_by_district.csv');
  assert.equal(csvRows.length, jsonRows.length);
  const byDistrict = Object.fromEntries(jsonRows.map(r => [r.district, r]));
  for (const row of csvRows) {
    const j = byDistrict[row.district];
    assert.ok(j, row.district + ' present in CSV but not JSON');
    assert.equal(row.combined_source, j.combined_source);
    assert.equal(row.combined_count === '' ? null : Number(row.combined_count), j.combined_count);
  }
});

test('footway coverage covers all 15 districts with non-negative, never-fabricated figures', () => {
  const rows = readJson('delhi_footway_coverage.json');
  assert.equal(rows.length, 15);
  assert.equal(new Set(rows.map(r => r.district)).size, 15);
  for (const r of rows) {
    assert.equal(DISTRICTS.has(r.district), true);
    assert.ok(r.footwayLengthKm >= 0);
    assert.ok(r.footwaySegmentCount >= 0);
    if (r.footwayDensityKmPerKm2 != null) assert.ok(r.footwayDensityKmPerKm2 >= 0);
  }
});

test('road/footway size CSVs: every row belongs to a known district, and missing width/lanes stay blank, never zero', () => {
  for (const file of ['road_sizes.csv', 'footway_sizes.csv']) {
    const rows = readCsv(file);
    assert.ok(rows.length > 0, file + ' has no rows');
    for (const r of rows) {
      assert.equal(DISTRICTS.has(r.district), true, file + ': unrecognized district "' + r.district + '"');
      assert.notEqual(r.width_m, '0', file + ': width_m should never be a fabricated "0" -- either a real tagged value or blank');
      if (file === 'road_sizes.csv') assert.notEqual(r.lanes, '0', file + ': lanes should never be a fabricated "0" -- either a real tagged value or blank');
      assert.ok(Number(r.length_m) >= 0, file + ': computed length should never be negative');
    }
  }
});

test('ward land use: mapped_pct is always in [0,100] and category shares sum to it', () => {
  const rows = readCsv('landuse_by_ward.csv');
  assert.equal(rows.length, 290);
  const categories = ['residential', 'commercial', 'industrial', 'institutional', 'green_open', 'other'];
  for (const r of rows) {
    const mapped = Number(r.mapped_pct);
    assert.ok(mapped >= 0 && mapped <= 100, r.ward + ': mapped_pct ' + mapped + ' out of [0,100] range');
    const catSum = categories.reduce((a, c) => a + Number(r[c + '_pct']), 0);
    assert.ok(Math.abs(catSum - mapped) < 0.5, r.ward + ': category percentages (' + catSum + ') should sum to mapped_pct (' + mapped + ') within rounding tolerance');
  }
  // Real fact this project already verified (see docs/AGENT_CHANGELOG.md): Delhi Cantonment is a
  // military zone, which this pipeline correctly buckets under "other", not spread across
  // residential/commercial/etc.
  const cantt = rows.find(r => r.ward === 'DELHI CANTT CHARGE 1');
  assert.ok(cantt, 'DELHI CANTT CHARGE 1 ward not found');
  assert.ok(Number(cantt.other_pct) > Number(cantt.residential_pct), 'Delhi Cantonment should be predominantly "other" (military), not residential');
});

test('shared manifest inventory includes every data/ file these pipelines produce', () => {
  const shared = readJson(path.join('releases', 'shared', 'manifest.json'));
  const inventoried = new Set(shared.productionFileInventory.map(x => x.file));
  for (const f of [
    'data/streetlights_combined_by_district.csv', 'data/streetlights_combined_by_district.json',
    'data/delhi_footway_coverage.json', 'data/road_sizes.csv', 'data/footway_sizes.csv',
    'data/landuse_by_ward.csv', 'data/delhi_landuse_simplified.geojson', 'data/poi_markers_infra_extras.json',
  ]) {
    assert.ok(inventoried.has(f), f + ' missing from data/releases/shared/manifest.json -- run npm run build:releases');
  }
});
