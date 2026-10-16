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

const mapCheck = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/audits/crash_zones_2024/crash_zone_report_map_check_2024.json'), 'utf8'));

test('report map check covers every zone, states its limits, and the counts add up', () => {
  assert.deepEqual(mapCheck.zones.map(z => z.location_name), zones.map(f => f.properties.location_name));
  assert.equal(Object.values(mapCheck.counts).reduce((a, b) => a + b, 0), zones.length);
  assert.ok(mapCheck.dots_detected >= 60 && mapCheck.dots_detected <= 111, 'dots detected ' + mapCheck.dots_detected);
  assert.ok(mapCheck.georeference.metres_per_pixel > 100 && mapCheck.georeference.metres_per_pixel < 250);
  assert.match(mapCheck.caveat, /Kilometre-scale check only/);
  for (const z of mapCheck.zones) {
    if (z.nearest_dot_m <= 1500) assert.equal(z.map_check, 'near_a_dot');
    else if (z.nearest_dot_m <= 2500) assert.equal(z.map_check, 'far_from_dots');
    else assert.equal(z.map_check, 'no_dot_within_2500m');
  }
});

test('the zone definition matches what the report says: a 500 m diameter, so a 250 m radius', () => {
  for (const f of zones) assert.equal(f.properties.zone_radius_m, 250);
  const readme = fs.readFileSync(path.join(ROOT, 'data/source/crash_report_2024/README.md'), 'utf8');
  assert.match(readme, /diameter of 500 meters/);
});

test('road summary (Table 6.33) is consistent with the 111 zones in the report', () => {
  const csv = fs.readFileSync(path.join(ROOT, 'data/source/crash_report_2024/delhi_crash_road_summary_2024.csv'), 'utf8');
  const rows = csv.trim().split(String.fromCharCode(10)).slice(1)
    .map(l => l.match(/^(\d+),(.+?),(\d+),(\d+),(\d+),(\d+),/)).filter(Boolean);
  assert.ok(rows.length >= 8);
  const zonesOnTopRoads = rows.reduce((a, m) => a + Number(m[3]), 0);
  assert.ok(zonesOnTopRoads <= 111, 'zones on the listed roads cannot exceed the 111 total: ' + zonesOnTopRoads);
  for (const m of rows) assert.equal(Number(m[4]) + Number(m[5]), Number(m[6]), m[2] + ': simple + fatal must equal total');
});

