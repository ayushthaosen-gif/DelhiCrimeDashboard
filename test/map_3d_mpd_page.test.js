// Structural guard for the Master Plan 2047 3D comparison page (map_3d_mpd.html): markup ids, pinned CDN versions,
// data fields it reads from the MPD comparison file, the ward join, and the honesty caveats the page must keep.
//
//   node --test test/map_3d_mpd_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'map_3d_mpd.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const cmp = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'mpd2047_ward_comparison.json'), 'utf8'));
const wards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_wards_infra.geojson'), 'utf8'));

test('the page script parses and has no debug handle', () => {
  assert.doesNotThrow(() => new Function(script));
  assert.ok(!script.includes('window.__'));
});

test('every element the script looks up by id exists in the page', () => {
  const ids = [...new Set([...script.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length > 12, 'expected the id lookups, found ' + ids.length);
  assert.deepEqual(ids.filter(id => !html.includes('id="' + id + '"')), []);
});

test('external scripts and styles are pinned to an exact version', () => {
  const urls = [...html.matchAll(/(?:src|href)="(https:\/\/unpkg\.com\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.length >= 2);
  for (const u of urls) assert.match(u, /@\d+\.\d+\.\d+\//, 'unpinned CDN url: ' + u);
});

const sat = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'derived', 'mpd2047_worldcover_comparison.json'), 'utf8'));
const classesOf = (basis) => {
  const block = script.slice(script.indexOf('    ' + basis + ': {'), script.indexOf('classes: [', script.indexOf('    ' + basis + ': {')));
  const from = script.indexOf('classes: [', script.indexOf('    ' + basis + ': {'));
  const to = script.indexOf(']', from);
  return [...script.slice(from, to).matchAll(/\{ key: '([a-z_]+)', label: '[^']+', color:/g)].map(m => m[1]);
};

test('every land-use class the page offers has planned, current and delta fields in its data file', () => {
  assert.deepEqual(classesOf('sat'), ['built', 'green_open', 'agriculture']);
  assert.deepEqual(classesOf('osm'), ['residential', 'industrial', 'green_open', 'agriculture']);
  for (const k of classesOf('osm')) {
    for (const f of ['planned_' + k + '_share_pct', 'current_' + k + '_share_pct', 'delta_' + k + '_pp']) assert.ok(f in cmp.wards[0], f + ' missing from the OSM comparison');
    assert.ok(('planned_' + k + '_km2') in cmp.citywide && ('current_' + k + '_km2') in cmp.citywide, k + ' citywide totals missing');
  }
  for (const k of classesOf('sat')) {
    for (const f of ['planned_' + k + '_share_pct', 'satellite_' + k + '_share_pct', 'delta_' + k + '_pp']) assert.ok(f in sat.wards[0], f + ' missing from the satellite comparison');
    assert.ok(('planned_' + k) in sat.citywide.plan_group_by_satellite_group_km2, k + ' confusion row missing');
  }
  for (const f of ['plan_coverage_pct', 'comparable_km2', 'comparison_confidence', 'district', 'area_sq_km', 'planned_green_open_seen_as_built_pct', 'planned_agriculture_seen_as_built_pct', 'planned_built_seen_as_green_or_crop_pct']) assert.ok(f in sat.wards[0], f);
  for (const f of ['plan_coverage_pct', 'osm_mapped_pct', 'planned_not_comparable_km2', 'comparison_confidence', 'district', 'area_sq_km']) assert.ok(f in cmp.wards[0], f);
});

test('every ward joins to exactly one row in each comparison file, so no ward is silently dropped', () => {
  const ids = wards.features.map(f => f.properties.Ward_No);
  assert.equal(new Set(ids).size, ids.length, 'ward ids must be unique');
  for (const [name, file] of [['osm', cmp], ['satellite', sat]]) {
    const rows = new Map(file.wards.map(r => [r.ward_no, r]));
    assert.equal(rows.size, file.wards.length, name + ': duplicate ward rows');
    for (const id of ids) assert.ok(rows.has(id), name + ': no comparison row for ward ' + id);
  }
});

test('thin-coverage wards are flagged from the data, not hard-coded', () => {
  assert.ok(script.includes("r.comparison_confidence !== 'ok'"));
  for (const file of [cmp, sat]) assert.equal(file.wards.filter(r => r.comparison_confidence !== 'ok').length, file.citywide.wards_low_confidence);
});

test('satellite comparison: shares are valid percentages and the confusion matrix covers the comparable area', () => {
  for (const r of sat.wards) {
    for (const k of ['built', 'green_open', 'agriculture']) {
      assert.ok(r['planned_' + k + '_share_pct'] >= 0 && r['planned_' + k + '_share_pct'] <= 100.1, r.ward + ' planned ' + k);
      assert.ok(r['satellite_' + k + '_share_pct'] >= 0 && r['satellite_' + k + '_share_pct'] <= 100.1, r.ward + ' satellite ' + k);
    }
    const planned = r.planned_built_share_pct + r.planned_green_open_share_pct + r.planned_agriculture_share_pct;
    if (r.comparable_km2 > 0) assert.ok(Math.abs(planned - 100) < 0.5, r.ward + ': planned shares must sum to 100, got ' + planned);
  }
  const total = Object.values(sat.citywide.plan_group_by_satellite_group_km2).flatMap(o => Object.values(o)).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - sat.citywide.comparable_km2) < 1, 'confusion matrix total must equal the comparable area');
  assert.match(sat.metadata.satellite_source, /CC BY 4\.0/);
  assert.match(sat.metadata.what_it_can_and_cannot_say, /not what the land is used for/);
});

test('the page keeps its honesty caveats', () => {
  assert.ok(html.includes('not a measurement of change on the ground'));
  assert.ok(script.includes('comparability_caveat'));
  assert.ok(script.includes('what_it_can_and_cannot_say'));
  assert.ok(script.includes('ESA WorldCover 2021'));
  assert.ok(html.includes('Master Plan for Delhi 2047 GIS portal'));
  assert.ok(html.includes('OpenStreetMap contributors'));
  assert.ok(script.includes('has not tagged it'));
});

test('share-link values are validated against known lists before use', () => {
  const read = script.slice(script.indexOf('function readUrl()'), script.indexOf('// ---------- events ----------'));
  for (const guard of ["x.key === c", "sb === 'sat'", "v === 'sbs'", "b === 'osm'", 'p.every(isFinite)']) assert.ok(read.includes(guard), 'readUrl lost its check: ' + guard);
});

test('built-up by planned use: tag shares add up and the page shows unknown instead of guessing', () => {
  const uses = ['residential', 'commercial', 'industrial', 'public'];
  for (const u of uses) assert.ok(u in sat.citywide.built_up_by_planned_use, u + ' missing from the citywide use check');
  for (const r of sat.wards) {
    assert.ok(r.use_check, r.ward + ': use_check missing');
    for (const u of uses) {
      const c = r.use_check[u];
      if (c.built_tagged_as_pct) {
        const sum = Object.values(c.built_tagged_as_pct).reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 100) < 0.7, r.ward + ' ' + u + ': tag shares must sum to 100, got ' + sum);
        assert.ok(Math.abs((100 - c.built_tagged_as_pct.untagged) - c.tagged_pct) < 0.2, r.ward + ' ' + u + ': tagged_pct must equal 100 minus untagged');
      }
      assert.ok(c.built_km2 <= c.planned_km2 + 1e-6, r.ward + ' ' + u + ': built area cannot exceed planned area');
    }
  }
  assert.ok(script.includes('No use tag (unknown)'), 'the page must label untagged built-up land as unknown');
  assert.ok(script.includes('use_check') && script.includes('built_up_by_planned_use'));
  assert.match(sat.metadata.what_it_can_and_cannot_say, /untagged remainder as unknown|remainder as unknown/);
});

test('satellite comparison: plan coverage never exceeds 100% of a ward', () => {
  for (const r of sat.wards) assert.ok(r.plan_coverage_pct <= 100.001, r.ward + ': plan coverage ' + r.plan_coverage_pct);
});

test('DDA settlement layers are present, used only where OSM is silent, and shown as their own category', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'source', 'dda_settlements', 'manifest.json'), 'utf8'));
  assert.equal(manifest.layers.length, 4);
  for (const l of manifest.layers) {
    const gj = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'source', 'dda_settlements', l.name + '.geojson'), 'utf8'));
    assert.equal(gj.features.length, l.features, l.name + ' feature count must match the manifest');
    assert.ok(gj.features.length > 100, l.name);
  }
  assert.match(sat.metadata.use_check_sources, /DDA settlement layers/);
  for (const u of ['residential', 'commercial', 'industrial', 'public']) assert.ok('dda_settlement' in sat.citywide.built_up_by_planned_use[u].built_tagged_as_pct, u);
  assert.ok(script.includes("'dda_settlement'"), 'the page must show DDA settlements as their own category');
});

test('swipe slider is keyboard accessible and its position is validated from the share link', () => {
  assert.ok(html.includes('role="slider"') && html.includes('aria-valuenow'));
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) assert.ok(script.includes("'" + key + "'"), 'swipe lost keyboard key ' + key);
  assert.ok(script.includes('xs >= 5 && xs <= 95'), 'the swipe position from the URL must be range-checked');
  assert.ok(script.includes('clip-path') || html.includes('clip-path'), 'the planned map is clipped to the right of the divider');
});

test('ranked list: biggest gaps by area, thin-coverage and tiny wards excluded, and the list is derived from the data', () => {
  assert.ok(script.includes('function gapRows()') && script.includes('isLow(r)') && script.includes('area >= 0.3'));
  assert.ok(script.includes('r.comparable_km2') && script.includes('r.plan_covered_km2'));
  // same rule applied here: the page must be able to produce ten ranked wards from the satellite file for every class
  for (const k of ['built', 'green_open', 'agriculture']) {
    const rows = sat.wards.filter(r => r.comparison_confidence === 'ok' && r.comparable_km2 >= 0.3)
      .map(r => ({ r, km: r['delta_' + k + '_pp'] / 100 * r.comparable_km2 })).sort((a, b) => Math.abs(b.km) - Math.abs(a.km)).slice(0, 10);
    assert.equal(rows.length, 10, k + ': expected ten ranked wards');
    assert.ok(Math.abs(rows[0].km) >= Math.abs(rows[9].km));
    assert.ok(Math.abs(rows[0].km) > 0.5, k + ': the top gap should be a real area');
  }
});


test('a Home button leads back to the dashboard home page', () => {
  assert.match(html, /<a class="homebtn" href="delhi_safety_dashboard\.html"[^>]*>[^<]*Home<\/a>/);
  assert.ok(fs.existsSync(path.join(ROOT, 'delhi_safety_dashboard.html')));
});

test('the view class is set on the page before the maps are created, and the maps are resized after layout', () => {
  const classAt = script.indexOf("document.body.classList.toggle('swipe', view === 'swipe')");
  const mapsAt = script.indexOf("maps.A = makeMap('A', 'mapA')");
  assert.ok(classAt > 0 && mapsAt > 0 && classAt < mapsAt, 'body view class must be set before makeMap, or phones size the maps for the stacked layout');
  assert.ok(script.includes('maps.A.resize()') && script.includes('visualViewport'));
});
