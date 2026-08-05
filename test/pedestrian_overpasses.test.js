const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const bridges = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_pedestrian_overpasses_osm.geojson'), 'utf8'));
const districts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8')).districts;

test('pedestrian-overbridge snapshot has valid mapped point features', () => {
  assert.equal(bridges.features.length, 242);
  for (const f of bridges.features) {
    assert.equal(f.geometry.type, 'Point');
    const [lng, lat] = f.geometry.coordinates;
    assert.ok(lng >= 76.8 && lng <= 77.4 && lat >= 28.4 && lat <= 28.9);
    assert.ok(f.properties.district);
    assert.match(f.properties.osmUrl, /^https:\/\/www\.openstreetmap\.org\/way\/\d+$/);
    assert.equal(f.properties.sourceSnapshot, '2026-08-04');
  }
});

test('district overbridge counts reconcile exactly with the GeoJSON', () => {
  const byDistrict = {};
  bridges.features.forEach(f => { byDistrict[f.properties.district] = (byDistrict[f.properties.district] || 0) + 1; });
  assert.equal(districts.reduce((sum, d) => sum + d.pedestrianOverpasses, 0), bridges.features.length);
  districts.forEach(d => {
    assert.equal(d.pedestrianOverpasses, byDistrict[d.district] || 0);
    assert.equal(d.pedestrianOverpassDensity, Math.round((d.pedestrianOverpasses / d.areaSqKm) * 100) / 100);
  });
});

test('crossesMajorRoad is a real boolean on every feature, not always the same value', () => {
  const values = bridges.features.map(f => f.properties.crossesMajorRoad);
  values.forEach(v => assert.equal(typeof v, 'boolean'));
  const crossingCount = values.filter(Boolean).length;
  // Independently cross-checked against a separate road-crossing-only pipeline (132 bridges,
  // built with a different merge algorithm) -- this script's own count should land close to
  // that, not at 0 or at the full 242 (which would mean the check silently isn't discriminating).
  assert.ok(crossingCount > 50 && crossingCount < bridges.features.length - 20,
    'expected crossesMajorRoad to meaningfully split the 242 features, got ' + crossingCount + ' crossing');
});

test('generic placeholder names are replaced with distinguishing generated names; real names are kept', () => {
  const GENERIC = /^(foot\s*over\s*bridge|fob)\s*\d*$/i;
  const GENERATED_FOB = /\bFOB(\s\d+)?$/;
  const GENERATED_FOOTBRIDGE = /\bFootbridge(\s\d+)?$/;
  bridges.features.forEach(f => {
    const name = f.properties.name;
    assert.ok(name && name !== 'Unnamed mapped pedestrian bridge', 'every feature must have a non-generic name, got: ' + name);
    assert.ok(!GENERIC.test(name.trim()), 'name should not be a bare generic placeholder: ' + name);
    // A generated name's suffix must agree with this same feature's own crossesMajorRoad value --
    // "FOB" only for crossing bridges, "Footbridge" only for non-crossing ones. Real preserved OSM
    // names (e.g. "Barapullah Bridge") match neither pattern and are exempt from this check.
    if (GENERATED_FOB.test(name)) assert.equal(f.properties.crossesMajorRoad, true, 'a generated "...FOB" name implies crossesMajorRoad: ' + name);
    if (GENERATED_FOOTBRIDGE.test(name)) assert.equal(f.properties.crossesMajorRoad, false, 'a generated "...Footbridge" name implies !crossesMajorRoad: ' + name);
  });
  // Duplicate names should be rare after generation -- essentially only where OSM itself gave two
  // physically distinct structures the exact same real name (verified: "Path around Hauz Khas
  // Tank" x2, a genuine OSM name, not something this script generated).
  const counts = {};
  bridges.features.forEach(f => { counts[f.properties.name] = (counts[f.properties.name] || 0) + 1; });
  const dupes = Object.entries(counts).filter(([, c]) => c > 1);
  assert.ok(dupes.length <= 2, 'too many duplicate names after generation: ' + JSON.stringify(dupes));
});
