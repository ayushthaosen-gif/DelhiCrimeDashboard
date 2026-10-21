// Guards the ward and district profile export bundle (data/profiles/): the field contract describes every column and no more, the figures equal
// their sources, blanks stay blank, the geography is labelled, the manifest hashes are current, and the GeoJSON carries the same rows as the CSV.
//
//   node --test test/profiles.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256, parseCsv } = require('../scripts/lib/release_utils');

const ROOT = path.join(__dirname, '..');
const P = f => path.join(ROOT, 'data/profiles', f);
const json = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const schema = json('data/profiles/schema.json');
const wards = json('data/profiles/ward_profiles.json');
const districts = json('data/profiles/district_profiles.json');
const manifest = json('data/profiles/manifest.json');
const csvRows = f => { const t = parseCsv(fs.readFileSync(P(f), 'utf8')); return t; };

test('the field contract describes every exported column and nothing else, with source, year, uncertainty class and what a blank means', () => {
  const classes = Object.keys(schema.uncertaintyClasses);
  for (const [fields, file] of [[schema.wardFields, 'ward_profiles.csv'], [schema.districtFields, 'district_profiles.csv']]) {
    const header = fs.readFileSync(P(file), 'utf8').split('\n')[0].split(',');
    assert.deepEqual(header, fields.map(f => f.id), file + ' header equals the contract, in order');
    assert.equal(new Set(header).size, header.length, 'no duplicate column');
    for (const f of fields) {
      for (const k of ['id', 'label', 'group', 'uncertainty', 'source', 'dataYear', 'blankMeans']) assert.ok(f[k] !== undefined && f[k] !== null, f.id + ' lacks ' + k);
      assert.ok(classes.includes(f.uncertainty), f.id + ' has an unknown uncertainty class');
      assert.ok(f.source.length > 5, f.id + ' names its source');
    }
  }
  assert.ok(schema.cannotEstablish.general.length >= 6);
  assert.ok(schema.cannotEstablish.general.some(s => /250 MCD wards/.test(s)));
  for (const c of ['approximate_position', 'mapped_osm', 'district_inherited']) assert.ok(schema.cannotEstablish.byClass[c], c);
  assert.ok(schema.zoneFields.every(z => classes.includes(z.uncertainty)));
});

test('ward profiles: 290 legacy wards with unique numbers, the geography labelled, counts equal to the committed ward file, zones accounted for', () => {
  assert.equal(wards.rows.length, 290);
  assert.equal(new Set(wards.rows.map(r => r.ward_no)).size, 290, 'ward number is the key');
  assert.ok(wards.rows.every(r => r.geography === 'legacy_290_wards'));
  assert.match(wards.note, /Legacy 290-ward geography/);
  assert.match(wards.note, /not the current 250 MCD wards/);
  const infra = json('data/delhi_wards_infra.geojson').features;
  for (const f of infra) {
    const r = wards.rows.find(x => x.ward_no === String(f.properties.Ward_No));
    assert.ok(r, f.properties.Ward_No);
    assert.equal(r.bus_stops, f.properties.busStops);
    assert.equal(r.surveillance_points_mapped, f.properties.surveillance);
    assert.equal(r.crash_zones_2024, f.properties.crashZones2024);
    assert.equal(r.official_liquor_vends, f.properties.officialLiquorVends);
    assert.equal(r.high_injury_network, f.properties.highInjuryNetwork === true);
    assert.equal(r.zones.length, r.crash_zones_2024);
  }
  const placed = wards.rows.reduce((a, r) => a + r.crash_zones_2024, 0);
  assert.ok(placed <= 93 && placed >= 85, 'most of the 93 zone positions fall inside a ward: ' + placed);
  assert.equal(wards.rows.reduce((a, r) => a + (r.crash_zone_fatal_crashes_2024 || 0), 0), infra.reduce((a, f) => a + f.properties.crashZones2024FatalSum, 0), 'zone fatal crashes agree with the ward file');
});

test('blank means unknown and is never zero: unranked zones, unsurveyed districts, and the CSV leaves nulls empty', () => {
  const z24 = json('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features.filter(f => f.properties.all_total_crashes == null).map(f => f.properties.location_name);
  assert.ok(z24.length > 0);
  for (const r of wards.rows) {
    const known = r.zones.filter(z => z.total_crashes != null);
    if (r.zones.length > 0 && known.length === 0) assert.equal(r.crash_zone_total_crashes_2024, null, r.ward_no + ': zones with no printed count give a blank total, not zero');
    if (r.zones.length === 0) assert.equal(r.crash_zone_total_crashes_2024, 0);
    assert.equal(r.crash_zones_without_printed_counts_2024, r.zones.filter(z => z.total_crashes == null).length);
  }
  assert.ok(wards.rows.some(r => r.crash_zones_without_printed_counts_2024 > 0 && r.crash_zone_total_crashes_2024 === null), 'at least one ward shows the blank case');
  const unsurveyed = ['Dwarka', 'North-East', 'North-West', 'Outer', 'Outer North', 'Rohini'];
  for (const d of districts.rows) {
    if (unsurveyed.includes(d.district)) { assert.equal(d.streetlights_per_km2, null, d.district); assert.equal(d.underpasses, null); assert.equal(d.papl_surveyed, false); }
    else { assert.ok(d.streetlights_per_km2 > 0, d.district); assert.equal(d.papl_surveyed, true); }
  }
  const t = fs.readFileSync(P('district_profiles.csv'), 'utf8').split('\n');
  const dwarka = t.find(l => l.startsWith('Dwarka,')).split(',');
  const col = schema.districtFields.map(f => f.id).indexOf('streetlights_per_km2');
  assert.equal(dwarka[col], '', 'the CSV cell for an unsurveyed district is empty');
});

test('district profiles equal the dashboard data, carry the comparability state, and calculate no change figure', () => {
  const src = json('data/dashboard_final.json').districts;
  assert.equal(districts.rows.length, 15);
  for (const d of src) {
    const r = districts.rows.find(x => x.district === d.name);
    assert.equal(r.theft_2024, d.theft2024); assert.equal(r.total_ipc_bns_2024, d.totalIPC2024); assert.equal(r.persons_killed_2024, d.personsKilled2024);
    assert.equal(r.crashes_in_zones_2024, d.totalCrashes2024); assert.equal(r.fatal_crashes_in_zones_2023, d.fatalCrashes2023); assert.equal(r.population, d.population);
    assert.equal(r.crime_comparison_2023_2024, 'caution', 'BNS replaced the IPC in July 2024');
    assert.equal(r.road_comparison_2023_2024, 'caution', 'zone-scoped counts carry the zone-list caution');
  }
  assert.ok(!schema.districtFields.some(f => /change|pct_change|percent_change/.test(f.id)), 'no change figure is calculated');
  const z = schema.districtFields.filter(f => /in_zones/.test(f.id));
  assert.ok(z.every(f => /zones only/.test(f.blankMeans)), 'zone-scoped counts say so');
});

test('the GeoJSON carries the same rows as the CSV and JSON, with geometry', () => {
  const wg = json('data/profiles/ward_profiles.geojson'), dg = json('data/profiles/district_profiles.geojson');
  assert.equal(wg.features.length, 290); assert.equal(dg.features.length, 15);
  const cols = schema.wardFields.map(f => f.id);
  const csvLines = fs.readFileSync(P('ward_profiles.csv'), 'utf8').trim().split(String.fromCharCode(10));
  assert.equal(csvLines.length, 291, 'CSV has a header and one row per ward');
  wg.features.forEach((f, i) => {
    assert.equal(f.geometry.type, 'Polygon');
    assert.deepEqual(Object.keys(f.properties), cols);
    assert.equal(f.properties.ward_no, wards.rows[i].ward_no);
  });
  assert.equal(wg.properties.geography, 'legacy_290_wards');
  dg.features.forEach(f => assert.ok(districts.rows.some(r => r.district === f.properties.district)));
});

test('the manifest lists every file and input with its current hash, the licences, the null policy and the caveats; no machine-specific path anywhere', () => {
  for (const f of manifest.files) assert.equal(f.sha256, sha256(path.join(ROOT, f.path)), f.path + ' hash is current');
  for (const f of manifest.inputs) { assert.ok(fs.existsSync(path.join(ROOT, f.path)), f.path); assert.equal(f.sha256, sha256(path.join(ROOT, f.path)), f.path + ' input hash is current'); }
  assert.deepEqual(manifest.files.map(f => path.basename(f.path)).sort(), ['district_profiles.csv', 'district_profiles.geojson', 'district_profiles.json', 'ward_profiles.csv', 'ward_profiles.geojson', 'ward_profiles.json', 'schema.json'].sort());
  assert.match(manifest.nullPolicy, /never zero/);
  assert.ok(manifest.licences.some(l => /ODbL/.test(l)) && manifest.licences.some(l => /CC-BY-SA/.test(l)));
  assert.ok(manifest.cannotEstablish.length >= 6);
  for (const f of ['schema.json', 'manifest.json', 'README.md', 'ward_profiles.json', 'district_profiles.json']) {
    const text = fs.readFileSync(P(f), 'utf8');
    assert.ok(!/[A-Za-z]:\\\\|\/Users\/|\/home\//.test(text), f + ' contains a machine-specific path');
  }
  const registry = json('data/geography_registry.json').geographies.find(g => g.id === 'legacy_290_wards');
  for (const f of ['data/profiles/ward_profiles.csv', 'data/profiles/ward_profiles.geojson', 'data/profiles/ward_profiles.json']) assert.ok(registry.files.includes(f), f + ' is registered under the legacy ward geography');
});
