// Automated validation for the liquor-vend/crash-zone spatial proximity analysis.
// Uses Node's built-in test runner (node --test) -- no new devDependency, since this repo has
// no test framework installed and the brief's own instruction was to reuse the existing stack.
//
//   node --test test/

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const vendsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
const zonesRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8'));
const vendProximity = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/liquor_vend_crash_proximity_2024.geojson'), 'utf8'));
const zoneProximity = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zone_liquor_proximity_2024.geojson'), 'utf8'));
const summary = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/liquor_crash_proximity_summary_2024.json'), 'utf8'));

test('1. GeoJSON coordinates are in [longitude, latitude] order (Delhi bbox sanity check)', () => {
  for (const f of vendsRaw.features) {
    const [lng, lat] = f.geometry.coordinates;
    assert.ok(lng > 70 && lng < 85, 'longitude ' + lng + ' out of plausible India range for ' + f.properties.name);
    assert.ok(lat > 20 && lat < 35, 'latitude ' + lat + ' out of plausible India range for ' + f.properties.name);
  }
});

test('2. Every loaded feature has valid Point geometry', () => {
  for (const f of [...vendsRaw.features, ...zonesRaw.features]) {
    assert.equal(f.geometry.type, 'Point');
    assert.equal(f.geometry.coordinates.length, 2);
    assert.ok(Number.isFinite(f.geometry.coordinates[0]));
    assert.ok(Number.isFinite(f.geometry.coordinates[1]));
  }
});

test('3. Official and OSM-only liquor records are counted separately', () => {
  const official = vendsRaw.features.filter(f => f.properties.record_source !== 'OpenStreetMap');
  const osmOnly = vendsRaw.features.filter(f => f.properties.record_source === 'OpenStreetMap');
  assert.equal(official.length + osmOnly.length, vendsRaw.features.length);
  assert.ok(official.length > 0 && osmOnly.length > 0);
});

test('4. The liquor file contains 387 total features and 374 official records', () => {
  assert.equal(vendsRaw.features.length, 387);
  const official = vendsRaw.features.filter(f => f.properties.record_source !== 'OpenStreetMap');
  assert.equal(official.length, 374);
});

test('5. The crash file contains 93 named features', () => {
  assert.equal(zonesRaw.features.length, 93);
});

test('6. Distance calculations return zero for identical coordinates', () => {
  const turf = require('@turf/turf');
  const p = turf.point([77.21, 28.6]);
  assert.equal(turf.distance(p, p, { units: 'meters' }), 0);
});

test('7. Radius counts are monotonic: 500m <= 1km <= 2km', () => {
  for (const f of vendProximity.features) {
    const p = f.properties;
    assert.ok(p.zonesWithin500m <= p.zonesWithin1km, p.name + ': 500m count exceeds 1km count');
    assert.ok(p.zonesWithin1km <= p.zonesWithin2km, p.name + ': 1km count exceeds 2km count');
  }
  for (const f of zoneProximity.features) {
    const p = f.properties;
    assert.ok(p.officialVendsWithin500m <= p.officialVendsWithin1km);
    assert.ok(p.officialVendsWithin1km <= p.officialVendsWithin2km);
  }
});

test('8. No negative crash counts or distances', () => {
  for (const f of vendProximity.features) {
    const p = f.properties;
    if (p.nearestCrashZoneDistanceM != null) assert.ok(p.nearestCrashZoneDistanceM >= 0);
    ['zonesWithin500m','zonesWithin1km','zonesWithin2km','fatalCrashesWithin500m','fatalCrashesWithin1km','fatalCrashesWithin2km'].forEach(k => {
      assert.ok(p[k] >= 0, k + ' negative for ' + p.name);
    });
  }
  for (const f of zonesRaw.features) {
    const p = f.properties;
    ['all_simple_crashes','all_fatal_crashes','all_total_crashes'].forEach(k => {
      if (p[k] != null) assert.ok(p[k] >= 0, k + ' negative for ' + p.location_name);
    });
  }
});

test('9. Null crash counts are treated as unknown, not silently coerced to zero in the raw source', () => {
  // Zones not listed in the main table (listed_in_table_6_29: false) carry null crash counts in
  // the source data -- confirm they remain null through normalization rather than becoming 0,
  // which would misrepresent "not individually tabulated" as "zero crashes here".
  const unlisted = zonesRaw.features.filter(f => f.properties.listed_in_table_6_29 === false);
  assert.ok(unlisted.length > 0, 'expected at least one zone not listed in the main table to exercise this case');
  for (const f of unlisted) {
    assert.equal(f.properties.all_fatal_crashes, null);
  }
});

test('10. No UI/build text uses banned causal phrases', () => {
  const bannedPhrases = ['caused by liquor', 'alcohol-related crash', 'vend risk probability', 'risk probability'];
  const htmlPath = path.join(ROOT, 'liquor_crash_analysis.html');
  assert.ok(fs.existsSync(htmlPath), 'liquor_crash_analysis.html must be built before running this test (node build_liquor_crash_analysis.js)');
  const html = fs.readFileSync(htmlPath, 'utf8').toLowerCase();
  for (const phrase of bannedPhrases) {
    assert.ok(!html.includes(phrase), 'banned causal phrase found in built page: "' + phrase + '"');
  }
});

test('11. Exported derived datasets preserve source identifiers and original properties', () => {
  const officialNames = new Set(vendsRaw.features.filter(f => f.properties.record_source !== 'OpenStreetMap').map(f => f.properties.name));
  for (const f of vendProximity.features) {
    assert.ok(officialNames.has(f.properties.name), 'derived vend record missing from source: ' + f.properties.name);
    assert.ok(f.properties.properties, 'original properties not preserved for ' + f.properties.name);
    assert.equal(f.properties.properties.name, f.properties.name);
  }
  const zoneNames = new Set(zonesRaw.features.map(f => f.properties.location_name));
  for (const f of zoneProximity.features) {
    assert.ok(zoneNames.has(f.properties.name));
    assert.ok(f.properties.properties);
  }
});

test('12. The application displays the incomplete-coverage warning', () => {
  const htmlPath = path.join(ROOT, 'liquor_crash_analysis.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('93') && (html.includes('111') || html.includes('crash_prone_zones_reported')), 'the 93-vs-111 completeness note is not present in the built page');
  assert.ok(summary.coverageWarning.includes('93'));
});

test('extra: proximity confidence is never "high" (crash-zone coordinates are never official geotags)', () => {
  for (const f of vendProximity.features) {
    assert.notEqual(f.properties.proximityConfidence, 'high');
  }
});

test('extra: summary counts are internally consistent (monotonic bands, no impossible shares)', () => {
  for (const band of ['500m', '1km', '2km']) {
    const s = summary.vendsWithinBand[band];
    assert.ok(s.count <= s.total);
    assert.ok(s.sharePercent >= 0 && s.sharePercent <= 100);
  }
});
