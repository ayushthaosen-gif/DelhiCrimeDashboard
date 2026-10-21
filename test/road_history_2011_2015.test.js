// Guards the 2013 to 2015 named zones and the 2011 and 2012 road stretches: counts tie to the recovered sums and to the report's own cross-checks,
// 2014 comes from one source, blanks stay null, the 2015 road groups are labelled as calculated, and the page offers the years it has data for.
//
//   node --test test/road_history_2011_2015.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { sha256 } = require('../scripts/lib/release_utils');

const ROOT = path.join(__dirname, '..');
const REL = 'data/releases/road_zones_roads_2011_2015/';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));
const named = json(REL + 'named_zones_2013_2015.json'), r15 = json(REL + 'roads_2015_derived_exact_labels.json'), r11 = json(REL + 'roads_2011_2012_retrospective.json'), man = json(REL + 'manifest.json');
const siteData = require('../scripts/lib/site_data').buildAll();
const R = siteData.ROADS;

test('the release validates (hashes, row arithmetic, derived totals, printed cross-checks, blank roads)', () => {
  const out = execFileSync(process.execPath, [path.join(ROOT, REL, 'validate.cjs')], { encoding: 'utf8' });
  assert.match(out, /441 rows validated/);
  for (const f of man.outputs) assert.equal(f.sha256, sha256(path.join(ROOT, REL, f.file)), f.file);
});

test('2013, 2014 and 2015 tie to the recovered sums; 2014 has one source; nothing is joined by serial; no coordinates', () => {
  const t = y => { const rows = named.filter(r => r.reference_year === y); return [rows.length, ...['simple_crashes', 'fatal_crashes', 'total_crashes'].map(k => rows.reduce((a, r) => a + r[k], 0))]; };
  assert.deepEqual(t(2013), [128, 1094, 544, 1638]);
  assert.deepEqual(t(2014), [137, 1616, 505, 2121]);
  assert.deepEqual(t(2015), [176, 1572, 552, 2124]);
  assert.equal(named.length, 441);
  assert.ok(named.every(r => r.latitude === null && r.longitude === null));
  assert.deepEqual(named.filter(r => r.reference_year === 2013 && !r.road_as_printed).map(r => r.serial), [40, 108]);
  assert.deepEqual(named.filter(r => r.reference_year === 2014 && !r.road_as_printed).map(r => r.serial), [93]);
  const urls14 = new Set(named.filter(r => r.reference_year === 2014).map(r => r.source_url));
  assert.equal(urls14.size, 1);
  assert.ok(named.filter(r => r.reference_year === 2014).every(r => r.fatal_crashes != null && r.total_crashes != null), 'no null-count rows from the superseded name-only list');
  assert.match(man.supersession, /never joined|never joined across/);
  assert.match(man.sources[0].note, /not a recovered annual report/);
});

test('2015 road groups are derived (not a printed table) and cover every 2015 zone once; 2011 and 2012 stretches are 13 per year and add up', () => {
  assert.equal(r15.length, 45);
  assert.equal(r15.reduce((a, r) => a + r.crash_prone_zones, 0), 176);
  assert.equal(r15.reduce((a, r) => a + r.fatal_crashes, 0), 552);
  assert.ok(r15.every(r => /not a printed road-summary table/.test(r.derivation)));
  assert.match(man.roads2015.derivation, /not necessarily 45 unique roads|Not a printed road-summary table/);
  assert.equal(r11.length, 26);
  for (const y of [2011, 2012]) assert.equal(r11.filter(r => r.reference_year === y).length, 13);
  assert.ok(r11.every(r => r.fatal_crashes + r.simple_crashes + r.noninjury_crashes === r.total_crashes));
  assert.match(man.roads2011to2012.note, /Not selected-zone sums/);
});

test('the site data carries the new years: zones 2013 to 2015, derived 2015 roads, no 2013 or 2014 road table, stretches 2011 and 2012', () => {
  assert.equal(R.zones2013.length, 128);
  assert.equal(R.zones2014.length, 137);
  assert.equal(R.zones2015.length, 176);
  assert.ok(R.zones2013.every(z => z[4] === 0), 'no derived-road marks on printed rows');
  assert.equal(R.zones2013.filter(z => z[1] === null).length, 2);
  assert.equal(R.roads[2013], undefined);
  assert.equal(R.roads[2014], undefined);
  assert.equal(R.roads[2015].length, 12);
  assert.equal(R.roadRows[2015], 45);
  assert.deepEqual(R.roadsDerived, { 2015: true });
  assert.equal(R.stretches[2011].length, 13);
  assert.equal(R.stretches[2012].length, 13);
  const rohtak = R.stretches[2012][0];
  assert.deepEqual([rohtak[1], rohtak[2], rohtak[5]], ['ROHTAK ROAD (ONWARD NH-10)', 66, 160]);
  const block = JSON.stringify(R.roads);
  assert.ok(!/"2011"|"2012"/.test(block), 'the stretches are not mixed into the roads-of-zones table');
});

test('the Road safety page offers 2013 to 2024 for zones and roads, labels the 2015 groups as calculated, says 2013 and 2014 print no road table, and shows the 2011 to 2012 stretches', () => {
  const src = read('assets/page-road.js'), html = siteData && fs.readFileSync(path.join(ROOT, 'road-safety.html'), 'utf8');
  assert.ok(src.includes('YEARS_ZONES = [2013, 2014, 2015].concat(YEARS_ALL)'));
  assert.ok(src.includes('YEARS_ZONES.map') && src.split('YEARS_ZONES.map').length === 3, 'both pickers use the extended list');
  assert.ok(src.includes('Calculated, not printed.') && src.includes('prints no road-wise summary'));
  assert.ok(src.includes('Highway and ring-road stretches, 2011 and 2012') && src.includes('not comparable with the zone tables above'));
  assert.ok(src.includes('not a recovered annual report'));
  assert.ok(html.includes('id="stretches"'));
  assert.ok(!/innerHTML/.test(src));
  const status = json('data/series_status.json').series.find(s => s.id === 'crash_zones_roads_2011_2015');
  assert.ok(status && status.status === 'production' && /not independently reviewed/.test(status.note));
  assert.ok(read('README.md').includes('`crash_zones_roads_2011_2015`'));
});
