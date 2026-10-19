const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = path.join(__dirname, '../data/staged/police_geography_history');
const read = name => JSON.parse(fs.readFileSync(path.join(base, name)));
test('historical reconstruction accounts for every station once and keeps airport separate', () => {
  const f = read('districts_2014_reference.geojson').features;
  assert.equal(f.filter(x => x.properties.territorial).length, 11);
  const names = f.flatMap(x => x.properties.stations);
  assert.equal(names.length, 163);
  assert.equal(new Set(names).size, 163);
  assert.equal(f.find(x => !x.properties.territorial).properties.name, 'IGI Airport');
  const sw = f.find(x => x.properties.name === 'South-West').properties.stations;
  assert(sw.includes('Dwarka North'));
  assert(sw.includes('Dwarka South'));
  assert(f.find(x => x.properties.name === 'West').properties.stations.includes('Uttam Nagar'));
  assert(!f.find(x => x.properties.name === 'South-East').properties.stations.includes('Dwarka North'));
});
test('reference preview joins original counts without reallocating or synthesizing rates', () => {
  const source = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/releases/historical_2011_2015/as_printed/ncrb_2014_ipc.json')));
  for (const f of read('districts_2014_reference.geojson').features) {
    const row = source.reporting_units.find(x => x.reporting_unit_label === f.properties.sourceLabel);
    assert(row);
    assert.equal(row.source_row, f.properties.sourceRow);
    assert.deepEqual(row.selected_metrics, f.properties.counts);
    assert.equal(f.properties.population, undefined);
  }
});
test('unverified years and production integration remain explicitly disabled', () => {
  const manifest = read('manifest.json');
  assert.equal(manifest.productionReady, false);
  assert.equal(manifest.dashboardIntegrated, false);
  assert.equal(manifest.annualBoundaryCertification, false);
  assert.deepEqual(manifest.approvedForOtherYears, []);
  assert.equal(manifest.validation.geometryQualityStatus, 'needs_review');
  assert(manifest.validation.sourceOverlapSqKm > 0);
  assert(manifest.validation.reconstructedDistrictOverlapSqKm > 0);
  assert(manifest.validation.dissolveFootprintDifferenceSqMetres < 1);
  for (const source of manifest.sources.filter(s => s.originalBinarySha256 === null)) assert(source.retrievalStatus);
  const html = fs.readFileSync(path.join(base, 'preview.html'), 'utf8');
  assert.match(html, /not enabled for other years/);
  assert.match(html, /Counts|counts/);
  assert.match(html, /contain overlaps/);
});
