// Guards the crash-zone coordinate audit outputs: the production file stays untouched, every zone is covered exactly once,
// and refinement recommendations obey the rules documented in docs/CRASH_ZONE_COORDINATES.md.
//
//   node --test test/crash_zone_coordinates_audit.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const zones = read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features;
const audit = read('data/audits/crash_zones_2024/crash_zone_coordinate_audit_2024_review.json');
const refined = read('data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.json');

test('audit and refinement each cover every zone exactly once, in the production order', () => {
  const names = zones.map(f => f.properties.location_name);
  assert.deepEqual(audit.zones.map(z => z.location_name), names);
  assert.deepEqual(refined.zones.map(z => z.location_name), names);
});

test('refinement keeps the original coordinates identical to the production file', () => {
  refined.zones.forEach((z, i) => {
    const [lng, lat] = zones[i].geometry.coordinates;
    assert.equal(z.original.lat, lat);
    assert.equal(z.original.lng, lng);
  });
});

test('recommendations follow the documented rules', () => {
  const allowed = new Set(['use_refined', 'review', 'keep_original']);
  for (const z of refined.zones) {
    assert.ok(allowed.has(z.recommendation), z.location_name + ': unknown recommendation ' + z.recommendation);
    if (z.recommendation === 'use_refined') {
      assert.ok(z.moved_m >= 150 && z.moved_m <= 1500, z.location_name + ': use_refined must move 150 m to 1.5 km');
      assert.ok(z.geocode && z.geocode.distance_to_refined_m <= 300, z.location_name + ': use_refined needs an agreeing geocode');
      assert.notEqual(z.confidence, 'low');
    }
    if (z.refined) {
      assert.ok(z.refined.lat > 28.3 && z.refined.lat < 29 && z.refined.lng > 76.7 && z.refined.lng < 77.5, z.location_name + ': refined point outside Delhi');
      assert.ok(z.uncertainty_m >= 100, z.location_name + ': uncertainty must include the validated landmark error');
    }
  }
});

test('validation is reported honestly with its caveat', () => {
  assert.ok(refined.validation.anchors >= 5);
  assert.match(refined.validation.caveat, /not true crash positions/);
  const { stored_point, refined_leave_one_out } = refined.validation.median_error_vs_geocode_m;
  assert.equal(refined.validation.model_helps, stored_point - refined_leave_one_out >= 15 && refined_leave_one_out <= 0.8 * stored_point);
});

test('audit verdict counts add up', () => {
  const total = Object.values(audit.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, zones.length);
});
