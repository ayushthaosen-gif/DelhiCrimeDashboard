// Guards the MPD-2047 planned-vs-current land-use comparison.
//
// The failure modes these cover are ones that actually happened while building it, and every one
// of them looked like success: a paginated fetch that returned 864 of 4,722 polygons, and a
// de-duplication on a field that turned out not to be unique. Both produced a smaller, entirely
// plausible dataset. So these assert totals and provenance, not just shape.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');

const comparison = JSON.parse(fs.readFileSync('data/mpd2047_ward_comparison.json', 'utf8'));
const plan = JSON.parse(fs.readFileSync('data/source/mpd2047_landuse_raw.geojson', 'utf8'));

test('the plan snapshot holds every feature the service reported', () => {
  assert.strictEqual(plan.features.length, plan.metadata.feature_count);
  assert.strictEqual(plan.metadata.feature_count, plan.metadata.service_reported_count,
    'snapshot feature count must equal the count the DDA service reported');
  assert.ok(plan.features.length > 4000,
    'a truncated fetch is the main hazard here and it looks like valid data; got ' + plan.features.length);
  assert.strictEqual(plan.features.filter(f => !f.geometry || !f.geometry.coordinates).length, 0);
});

test('plan geometry is WGS84 lon/lat over Delhi, not unprojected UTM', () => {
  // UTM easting/northing would be in the hundreds of thousands and silently break every area.
  for (const f of plan.features.slice(0, 200)) {
    const c = JSON.stringify(f.geometry.coordinates).match(/-?\d+\.\d+/g).slice(0, 2).map(Number);
    assert.ok(c[0] > 76.5 && c[0] < 77.7, 'longitude out of Delhi range: ' + c[0]);
    assert.ok(c[1] > 28.2 && c[1] < 29.0, 'latitude out of Delhi range: ' + c[1]);
  }
});

test('every ward is present and no ward claims more plan area than it has', () => {
  assert.strictEqual(comparison.wards.length, 290);
  for (const w of comparison.wards) {
    // A statutory plan tiles without overlap, so summed intersections cannot exceed the ward.
    // Exceeding it would mean plan polygons overlap and areas are being double-counted.
    assert.ok(w.plan_coverage_pct <= 101,
      w.ward + ' has ' + w.plan_coverage_pct + '% plan coverage, which implies overlapping plan polygons');
    assert.ok(w.plan_covered_km2 >= 0);
  }
});

test('coverage denominators are carried on every ward, so a delta is never shown bare', () => {
  for (const w of comparison.wards) {
    assert.ok(Object.prototype.hasOwnProperty.call(w, 'plan_coverage_pct'));
    assert.ok(Object.prototype.hasOwnProperty.call(w, 'osm_mapped_pct'));
    assert.ok(w.comparison_confidence === 'ok' || /thin coverage/.test(w.comparison_confidence));
  }
  const flagged = comparison.wards.filter(w => w.comparison_confidence !== 'ok').length;
  assert.ok(flagged > 0, 'OSM land-use coverage averages ~23%, so some wards must be flagged thin');
});

test('only unambiguous categories are compared, and nulls stay null', () => {
  assert.deepStrictEqual(Object.keys(comparison.metadata.crosswalk).sort(),
    ['agriculture', 'green_open', 'industrial', 'residential']);
  for (const w of comparison.wards) {
    for (const cat of ['residential', 'industrial', 'green_open', 'agriculture']) {
      const d = w['delta_' + cat + '_pp'];
      const p = w['planned_' + cat + '_share_pct'];
      const c = w['current_' + cat + '_share_pct'];
      // Never coerce a missing side to zero: if either share is unknown the delta must be null.
      if (p == null || c == null) assert.strictEqual(d, null, w.ward + '/' + cat + ' delta must be null');
    }
  }
});

test('the land-use codebook comes from the source and undecoded codes stay undecoded', () => {
  assert.strictEqual(comparison.metadata.plan_legend_field, 'use_zones');
  const legend = comparison.metadata.plan_legend;
  assert.ok(Object.keys(legend).length > 20);
  // Guessing these would have been wrong: RF is a foreign mission, not a river front.
  assert.match(legend.RF, /FOREIGN MISSION/i);
  assert.match(legend.RD, /RESIDENTIAL/i);
  // A1 is ~209 km2 and has no renderer entry; it must be reported as undecoded, never inferred.
  assert.ok(comparison.metadata.codes_present_without_legend_entry.includes('A1'));
  assert.ok(!Object.prototype.hasOwnProperty.call(legend, 'A1'));
});

test('A1 is compared as agriculture, never counted as parks, and every plan area is in exactly one bucket', () => {
  const c = comparison.citywide;
  assert.ok(c.planned_agriculture_km2 > 100, 'A1 (agriculture) should be a large comparable category');
  // If A1 had leaked into the parks bucket, these would be close together.
  assert.notStrictEqual(c.planned_green_open_km2, c.planned_agriculture_km2);
  const comparable = c.planned_residential_km2 + c.planned_industrial_km2 + c.planned_green_open_km2 + c.planned_agriculture_km2;
  // Exact partition (to rounding). The old ">=" form let A1 be counted in two buckets unnoticed.
  assert.ok(Math.abs(comparable + c.planned_not_comparable_km2 - c.planned_total_km2) < 1,
    'buckets (' + (comparable + c.planned_not_comparable_km2).toFixed(1) + ') must equal plan total (' + c.planned_total_km2 + ')');
});

test('parks versus farmland: the OSM side is split without losing or double-counting area', () => {
  // Before 2026-10-03 OSM "green/open" included farmland (71% of it) and was compared with plan
  // parks only. Now parks = green_open - agriculture, and agriculture is its own comparable line.
  const lines = fs.readFileSync('data/landuse_by_ward.csv', 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const byNo = new Map(lines.slice(1).map(l => { const c = l.split(','); return [c[head.indexOf('ward_no')], { green: Number(c[head.indexOf('green_open_km2')]), agri: Number(c[head.indexOf('green_open_agriculture_km2')]) }]; }));
  let sumGreen = 0, sumParks = 0, sumAgri = 0;
  for (const w of comparison.wards) {
    const src = byNo.get(String(w.ward_no));
    assert.ok(src, w.ward + ' missing from landuse CSV');
    assert.ok(src.agri >= 0 && src.agri <= src.green + 0.0005, w.ward + ': agriculture must be a subset of green_open');
    assert.ok(Math.abs(w.current_green_open_km2 + w.current_agriculture_km2 - src.green) < 0.002, w.ward + ': parks + agriculture must equal OSM green_open');
    assert.ok(w.current_green_open_km2 >= -0.0005, w.ward + ': parks must not go negative');
    sumGreen += src.green; sumParks += w.current_green_open_km2; sumAgri += w.current_agriculture_km2;
  }
  assert.ok(Math.abs(sumParks + sumAgri - sumGreen) < 1, 'citywide parks + agriculture must equal OSM green_open');
  assert.ok(sumAgri > sumParks, 'farmland is the larger part of OSM green/open in Delhi (71% of raw area); if not, the split is wrong');
});

test('the comparison states what it is not', () => {
  assert.match(comparison.metadata.comparability_caveat, /not a measurement of change on the ground/i);
  assert.match(comparison.metadata.method, /own described area/i);
  assert.ok(plan.metadata.geography_caveat.includes('not the 15 Delhi Police districts'));
});
