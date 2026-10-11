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
      assert.ok(z.sources && z.sources.some(x => x.distance_to_refined_m <= 300), z.location_name + ': use_refined needs an agreeing independent source');
      assert.notEqual(z.confidence, 'low');
    }
    if (z.refined) {
      assert.ok(z.refined.lat > 28.3 && z.refined.lat < 29 && z.refined.lng > 76.7 && z.refined.lng < 77.5, z.location_name + ': refined point outside Delhi');
      assert.ok(z.uncertainty_m >= 100, z.location_name + ': uncertainty must include the validated landmark error');
    }
  }
});

test('validation is a leave-one-source-out comparison and is reported honestly', () => {
  const v = refined.validation;
  assert.ok(v.anchors >= 5 && v.pairs_tested >= 50);
  assert.match(v.caveat, /NAMED PLACE/);
  assert.match(v.caveat, /not where crashes occurred/);
  const o = v.overall;
  for (const id of ['layers_1_2', 'layers_1_3', 'layers_1_4']) assert.ok(o[id] && o[id].median_error_m > 0, id + ' missing from the comparison');
  assert.ok(['layers_1_2', 'layers_1_3', 'layers_1_4'].includes(v.chosen_layer_set));
  const best = Math.min(...['layers_1_2', 'layers_1_3', 'layers_1_4'].map(id => o[id].median_error_m));
  assert.equal(o[v.chosen_layer_set].median_error_m, best, 'the chosen layer set must have the lowest median error');
  assert.equal(v.model_helps, v.anchors >= 5 && o.stored_point_median_m - best >= 15 && best <= 0.8 * o.stored_point_median_m);
});

test('no automatic move is recommended when validation shows the layers do not beat the stored point', () => {
  if (!refined.validation.model_helps) assert.equal(refined.zones.filter(z => z.recommendation === 'use_refined').length, 0);
});

test('every zone reports how well the independent sources agree', () => {
  const allowed = new Set(['consistent', 'partial', 'conflicting', 'stored_point_only']);
  for (const z of refined.zones) {
    if (z.refined === null) continue;
    assert.ok(allowed.has(z.evidence_agreement), z.location_name + ': ' + z.evidence_agreement);
    assert.ok(z.evidence_spread_m >= 0);
    if (z.evidence_agreement === 'consistent') assert.ok(z.evidence_spread_m <= 300);
    if (z.evidence_agreement === 'conflicting') assert.ok(z.evidence_spread_m > 1000);
  }
});

test('audit verdict counts add up', () => {
  const total = Object.values(audit.counts).reduce((a, b) => a + b, 0);
  assert.equal(total, zones.length);
});
