// Structural guard for the 3D ward explorer prototype (map_3d.html). Like the other page tests it
// protects against silent breakage that `node --check` cannot see: a getElementById that points at
// nothing, a metric whose data field was renamed, or a data file the page fetches that moved.
//
//   node --test test/map_3d_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'map_3d.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const wards = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_wards_infra.geojson'), 'utf8'));

test('the page script parses', () => {
  assert.doesNotThrow(() => new Function(script));
});

test('every element the script looks up by id exists in the page', () => {
  const ids = [...new Set([...script.matchAll(/\$\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length > 15, 'expected to find the script\'s id lookups, found ' + ids.length);
  const missing = ids.filter(id => !html.includes('id="' + id + '"'));
  assert.deepEqual(missing, [], 'script references ids that are not in the markup: ' + missing.join(', '));
});

test('external scripts and styles are pinned to an exact version', () => {
  const urls = [...html.matchAll(/(?:src|href)="(https:\/\/unpkg\.com\/[^"]+)"/g)].map(m => m[1]);
  assert.ok(urls.length >= 2);
  for (const u of urls) assert.match(u, /@\d+\.\d+\.\d+\//, 'unpinned CDN url: ' + u);
});

test('no leftover debug handle on window', () => {
  assert.ok(!script.includes('window.__map'));
});

test('ward metrics read fields that exist in the ward data', () => {
  const metricBlock = script.slice(script.indexOf('var METRICS = ['), script.indexOf('var BASEMAPS'));
  const entries = [...metricBlock.matchAll(/\{ key: '([^']+)'[^}]*\}/g)];
  assert.ok(entries.length >= 10, 'expected the metric list, found ' + entries.length);
  const props = wards.features[0].properties;
  for (const [entry, key] of entries) {
    if (/kind: 'year'|kind: 'gap'/.test(entry)) continue;
    assert.ok(key in props, 'ward metric "' + key + '" is not a property of delhi_wards_infra.geojson');
  }
});

test('gap index inputs and tour fields exist in the ward data', () => {
  const props = wards.features[0].properties;
  for (const k of ['crashZones2024Density', 'surveillanceDensity', 'highInjuryNetworkRank', 'assignedDistrict', 'areaSqKm', 'Ward_Name']) {
    assert.ok(k in props, k + ' missing from ward properties');
  }
});

test('year metrics read fields that exist in every yearly district_crime release', () => {
  const years = [...script.matchAll(/var YEARS = \[([^\]]+)\]/g)][0][1].split(',').map(s => s.trim());
  const keys = [...script.matchAll(/\{ key: '([^']+)'[^}]*kind: 'year'[^}]*\}/g)].map(m => m[1]);
  assert.deepEqual(keys.sort(), ['burglary', 'robbery', 'theft']);
  const wardDistricts = new Set(wards.features.map(f => f.properties.assignedDistrict).filter(Boolean));
  for (const y of years) {
    const file = path.join(ROOT, 'data', 'releases', y, 'district_crime.json');
    assert.ok(fs.existsSync(file), 'missing ' + file);
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const names = new Set(rows.map(r => r.district));
    for (const d of wardDistricts) assert.ok(names.has(d), y + ' release has no district "' + d + '"');
    for (const k of keys) assert.ok(k in rows[0], y + ' release has no field "' + k + '"');
    assert.ok('district_existed_as_separate_reporting_zone' in rows[0]);
  }
});

test('year metrics never render a missing value as zero', () => {
  assert.match(script, /return null;[\s\S]*?return row\[m\.key\] \/ area/);
  assert.match(script, /if \(v === null\) \{ anyNull = true;/);
});

test('share-link values are validated against known lists before use', () => {
  const read = script.slice(script.indexOf('function readUrl()'), script.indexOf('// ---------- map ----------'));
  for (const guard of ['METRICS.findIndex', 'YEARS.indexOf', "b === 'osm'", 'v.every(isFinite)']) {
    assert.ok(read.includes(guard), 'readUrl lost its check: ' + guard);
  }
});

test('tour reads fields that exist in the crash zone data and has ten ranked points', () => {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8'));
  assert.ok(script.includes('data/delhi_crash_prone_zones_2024_all_named_approx.geojson'));
  const pts = g.features.filter(f => f.properties.table_6_29_rank && f.geometry.type === 'Point');
  assert.ok(pts.length >= 10, 'need at least 10 ranked crash zones with coordinates');
  const props = pts[0].properties;
  const used = [...new Set([...script.matchAll(/\bp\.([a-z_0-9]+)/g)].map(m => m[1]))]
    .filter(k => /crash|killed|injured|location_name|road_name|table_6_29_rank|cctv|zone_radius_m/.test(k));
  assert.ok(used.length >= 15, 'expected the caption fields, found ' + used.length);
  for (const k of used) assert.ok(k in props, 'tour caption reads "' + k + '" which is not in the crash zone data');
  for (const f of pts.slice(0, 10)) assert.equal(f.properties.coordinate_is_approximate, true, 'tour copy says positions are approximate');
});

test('camera layer reads the OSM surveillance points: numeric Delhi coordinates, no video', () => {
  assert.ok(script.includes('data/poi_markers_latlng.json'));
  const poi = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'poi_markers_latlng.json'), 'utf8'));
  assert.ok(Array.isArray(poi.surveillance) && poi.surveillance.length > 1000, 'expected the surveillance point list');
  for (const [lat, lng] of poi.surveillance) {
    assert.ok(lat > 28.3 && lat < 29.0 && lng > 76.7 && lng < 77.5, 'camera point outside Delhi: ' + lat + ',' + lng);
  }
  assert.ok(!/\.m3u8|<video|\.mjpg|getUserMedia/i.test(script), 'the page must not embed live video or camera streams');
  assert.ok(html.includes('no video'), 'the camera checkbox must say that no video is shown');
});

test('tour card links out to street view with an approximate-location label', () => {
  assert.ok(script.includes('map_action=pano'));
  assert.ok(script.includes('rel="noopener"'));
});

test('tour uses refined crash-zone positions only where the audit recommends use_refined', () => {
  const file = 'data/audits/crash_zones_2024/crash_zone_coordinates_refined_2024.json';
  assert.ok(script.includes(file), 'tour must read the refinement review file');
  assert.ok(script.includes("z.recommendation === 'use_refined'"), 'only use_refined positions may replace the originals');
  const refined = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  for (const z of refined.zones.filter(r => r.recommendation === 'use_refined')) {
    assert.ok(z.refined.lat > 28.3 && z.refined.lat < 29 && z.refined.lng > 76.7 && z.refined.lng < 77.5, z.location_name);
  }
  assert.ok(script.includes('refined from OpenStreetMap roads'), 'a refined stop must say it is refined and not surveyed');
});

test('tour shows how well independent sources agree on each position', () => {
  assert.ok(script.includes('Position evidence'));
  for (const label of ['sources agree', 'sources differ', 'sources disagree', 'unverified estimate']) assert.ok(script.includes(label), label);
});

test('tour shows the report map check and states the zone definition', () => {
  assert.ok(script.includes('crash_zone_report_map_check_2024.json'));
  assert.ok(script.includes('Report map dot'));
  assert.ok(script.includes('500 m diameter'));
});


test('a Home button leads back to the site home page', () => {
  assert.match(html, /<a class="homebtn" href="index\.html"[^>]*>[^<]*Home<\/a>/);
  assert.ok(fs.existsSync(path.join(ROOT, 'index.html')));
});

test('police stations and liquor vends: data files exist with usable points, and the page is honest about the liquor list', () => {
  const police = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'police_markers_latlng.json'), 'utf8'));
  assert.ok(police.stations.length >= 100 && police.posts.length >= 50);
  for (const [lat, lng] of police.stations.concat(police.posts)) assert.ok(lat > 28.3 && lat < 29 && lng > 76.7 && lng < 77.5, 'police point outside Delhi');
  const liq = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
  assert.ok(liq.features.length >= 300);
  assert.ok(liq.features.filter(f => f.properties.coordinate_is_approximate === true).length / liq.features.length > 0.9, 'almost every liquor vend position is approximate (the rest are exact OSM points)');
  assert.ok(script.includes('data/police_markers_latlng.json') && script.includes('data/delhi_liquor_vends_all_coordinates_approx.geojson'));
  assert.ok(html.includes('positions mostly approximate, list incomplete'));
  assert.ok(script.includes('Liquor vends within 250 m / 500 m (approximate)') && script.includes('Nearest police station'));
  for (const id of ['pol', 'liq']) assert.ok(html.includes('id="' + id + '"'));
});
