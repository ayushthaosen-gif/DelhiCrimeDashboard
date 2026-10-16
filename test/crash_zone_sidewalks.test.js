// Guard for data/derived/crash_zone_sidewalks_2024.json (OSM sidewalk tagging near each crash zone).
//
//   node --test test/crash_zone_sidewalks.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const out = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'derived', 'crash_zone_sidewalks_2024.json'), 'utf8'));
const zones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8')).features;

test('every crash zone has a row, once', () => {
  assert.equal(out.zones.length, zones.length);
  assert.deepEqual(out.zones.map(r => r.feature_id).sort(), zones.map(f => f.properties.feature_id).sort());
});

test('road length buckets add up to the road total and the 250 m set sits inside the 500 m set', () => {
  for (const r of out.zones) {
    for (const R of [250, 500]) {
      const sum = r['road_sidewalk_km_' + R + 'm'] + r['road_separate_km_' + R + 'm'] + r['road_none_km_' + R + 'm'] + r['road_untagged_km_' + R + 'm'];
      assert.ok(Math.abs(sum - r['road_km_' + R + 'm']) < 0.01, r.feature_id + ' ' + R);
      const pct = r['road_with_pedestrian_mapping_pct_' + R + 'm'];
      assert.ok(pct === null || (pct >= 0 && pct <= 100));
    }
    assert.ok(r.road_km_250m <= r.road_km_500m + 1e-9 && r.crossings_250m <= r.crossings_500m);
  }
});

test('the file carries the honesty caveats and the network was actually read', () => {
  assert.ok(out.caveats.some(c => /not that there is no pavement/.test(c)));
  assert.ok(out.zones.reduce((a, r) => a + r.road_km_500m, 0) > 100, 'distance bug guard: roads must be found');
});
