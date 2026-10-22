// The official metro gate counts: derived only (the licence does not allow redistributing the gate file on its own), consistent with the profiles,
// attributed on the page, and the OpenStreetMap difference recorded.
//
//   node --test test/metro_gates_official.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));
const M = json('data/derived/metro_gates_official_2024.json');

test('the derived file records the source, the licence terms and the defects, and holds counts and distances only, never gate coordinates', () => {
  assert.equal(M.source.datasetId, 3);
  assert.match(M.source.sha256, /^[0-9a-f]{64}$/); assert.match(M.source.licence.sha256, /^[0-9a-f]{64}$/);
  assert.equal(M.source.lastUpdatedByPublisher, '2024-12-02');
  assert.match(M.source.licence.schedule1, /redistribution of the licensed work on its own is not allowed/);
  assert.match(M.source.attribution, /Delhi Metro Rail Corporation, via the Delhi Transport Stack/);
  assert.match(M.source.attribution, /not the original data/); assert.match(M.source.attribution, /without warranty/);
  assert.ok(M.caveats.some(c => /gate coordinates are not/.test(c)));
  const text = JSON.stringify(M);
  assert.ok(!/"lat"|"lng"|"latitude"|"longitude"/.test(text), 'no coordinates in the derived file');
  assert.deepEqual(Object.keys(M.zones[0]).sort(), ['accuracy_m', 'gates_within_250m', 'gates_within_500m', 'nearest_gate_m', 'zone']);
  assert.deepEqual([M.quality.rowsWithBlankStationCode, M.quality.rowsWithoutCoordinates, M.quality.exactDuplicateRowsNotCounted, M.quality.stationCodesNotInStationSheet], [61, 1, 6, 37]);
  const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n');
  assert.ok(!tracked.some(f => /gate_locations.*\.xlsx$/i.test(f) || /LicenceAgreement.*\.pdf$/i.test(f)), 'the raw gate file is not in the repository');
});

test('counts are consistent: wards add up to the gates in Delhi, districts to the same order, zones are the 93 of 2024', () => {
  assert.equal(Object.values(M.wards).reduce((a, b) => a + b, 0), M.summary.gatesInDelhiWards);
  assert.equal(Object.keys(M.wards).length, M.summary.wardsWithAGate);
  assert.equal(M.summary.distinctGates, M.summary.gatesInDelhiWards + M.summary.gatesOutsideDelhi);
  assert.equal(M.zones.length, 93);
  assert.equal(M.zones.filter(z => z.gates_within_250m > 0).length, M.summary.zonesWithAGateWithin250m);
  for (const z of M.zones) { assert.ok(z.nearest_gate_m >= 0 && z.gates_within_500m >= z.gates_within_250m); if (z.gates_within_250m > 0) assert.ok(z.nearest_gate_m <= 250); }
  assert.deepEqual(Object.keys(M.districts).length, 15);
});

test('the profiles carry the official counts: ward and district fields, density, zone distances, with the licence line in the manifest', () => {
  const wards = json('data/profiles/ward_profiles.json').rows, districts = json('data/profiles/district_profiles.json').rows, schema = json('data/profiles/schema.json');
  assert.equal(wards.reduce((a, r) => a + r.metro_gates_official, 0), M.summary.gatesInDelhiWards);
  for (const r of wards) assert.equal(r.metro_gates_official, M.wards[r.ward_no] || 0, r.ward_no);
  for (const d of districts) assert.equal(d.metro_gates_official, M.districts[d.district] || 0, d.district);
  assert.ok(schema.wardFields.some(f => f.id === 'metro_gates_official' && f.uncertainty === 'official_count') && schema.wardFields.some(f => f.id === 'metro_gates_official_per_km2'));
  assert.ok(schema.districtFields.some(f => f.id === 'metro_gates_official'));
  assert.deepEqual(schema.zoneFields.filter(f => /metro/.test(f.id)).map(f => f.id), ['nearest_metro_gate_m', 'metro_gates_250m', 'metro_gates_500m']);
  const z = wards.flatMap(r => r.zones).find(q => q.name === M.zones[0].zone);
  assert.equal(z.nearest_metro_gate_m, M.zones[0].nearest_gate_m);
  const man = json('data/profiles/manifest.json');
  assert.ok(man.licences.some(l => /Delhi Transport Stack Licence Agreement 1\.0/.test(l) && /not redistributed/.test(l)));
  assert.ok(man.inputs.some(i => i.path === 'data/derived/metro_gates_official_2024.json'));
  // the mapped district counts are recorded as unreliable against the official list
  const dd = json('data/dashboard_final.json').districts, byName = Object.fromEntries(dd.map(d => [d.district || d.name, d.metroGates]));
  assert.ok(Math.abs(byName['New Delhi'] - M.districts['New Delhi']) >= 20 && Math.abs(byName['Outer'] - M.districts['Outer']) >= 15);
  assert.match(read('docs/LIMITATIONS.md'), /New Delhi 49 mapped against 77 official/);
});

test('the page: a Metro gates layer with its attribution and no-warranty note, the Why panel shows gates and the nearest gate, the sources list credits DMRC and the Transport Stack', () => {
  const files = render(), src = read('assets/page-planning.js'), why = read('assets/why.js');
  assert.ok(src.includes("k: 'met', g: 'Transit', label: 'Metro gates (official DMRC list, 2024)'") && src.includes('metro_gates_official_per_km2'));
  assert.ok(src.includes('Delhi Metro gate locations: Delhi Metro Rail Corporation, via the Delhi Transport Stack') && src.includes('Provided without warranty'));
  assert.ok(why.includes("['metro_gates_official', 'metro_gates_official_per_km2']") && why.includes('Nearest metro gate') && why.includes('nearest_metro_gate_m'));
  const m = files['data-methods.html'];
  assert.ok(m.includes('Metro gates (official list)') && m.includes('datadetails/3') && m.includes('Licence Agreement 1.0'));
  assert.ok(read('docs/DATA_SOURCES.md').includes('redistribution of the licensed work on its own is **not** allowed'));
  assert.ok(read('docs/DTS_DEFECT_NOTE_DRAFT.md').includes('Nothing has been sent'));
});
