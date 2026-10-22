// Guards deaths by mode of travel for 2011 to 2018 (Table 3.1 of the annual Traffic Police reports): every year adds up, the killed totals equal the citywide
// trend, the 2001 to 2003 rows that do not add up stay out, the release rebuilds from committed inputs, and the page keeps the older series apart and says so.
//
//   node --test test/victims_by_mode.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sha256 } = require('../scripts/lib/release_utils');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const REL = 'data/releases/road_victims_by_mode_2004_2018/', IN = 'data/inputs/road_victims_by_mode/';
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));
const rows = json(REL + 'victims_by_mode.json'), man = json(REL + 'manifest.json'), trans = json(IN + 'table_3_1_transcription.json');
const files = render();
const DATA = (() => { const ctx = vm.createContext({ window: {} }); vm.runInContext(files['assets/site-data.js'], ctx); return JSON.parse(JSON.stringify(ctx.window.DSO_DATA)); })();

test('2004 to 2018: every year\'s eight categories add up to the printed total, killed and injured; killed totals from 2011 equal the citywide trend', () => {
  assert.deepEqual(rows.map(r => r.year), [2004, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  const cats = ['pedestrians', 'cyclists', 'car_occupants', 'scooter_motorcycle_riders', 'bus_passengers', 'slow_moving_vehicles', 'animal_driven_vehicle_drivers', 'other_drivers'];
  const trend = json('data/road_safety_trends.json').trends;
  for (const r of rows) {
    assert.equal(cats.reduce((a, c) => a + r[c + '_killed'], 0), r.total_killed, r.year + ' killed');
    assert.equal(cats.reduce((a, c) => a + r[c + '_injured'], 0), r.total_injured, r.year + ' injured');
    const t = trend.find(x => x.year === r.year);
    if (t) assert.equal(t.fatalities, r.total_killed, r.year + ' matches the citywide trend');
    assert.ok(/^[0-9a-f]{64}$/.test(r.source_sha256) && r.source_table === '3.1' && r.source_printed_page === 22 && /^https:\/\//.test(r.source_url));
  }
  const r18 = rows.find(r => r.year === 2018);
  assert.deepEqual([r18.pedestrians_killed, r18.scooter_motorcycle_riders_killed, r18.total_killed, r18.total_injured], [775, 570, 1690, 6086]);
  const r11 = rows.find(r => r.year === 2011);
  assert.deepEqual([r11.pedestrians_killed, r11.total_killed], [961, 2110]);
});

test('2001 to 2003 are left out because their categories do not add up, and the reason is on record', () => {
  assert.ok(!rows.some(r => r.year < 2004) && !Object.keys(trans.rows).some(y => +y < 2004));
  assert.match(trans.note, /2001 to 2003; those rows were read but their eight categories do not add up/);
  assert.ok(man.caveats.some(c => /2001 to 2003 are printed in the 2015 report but their categories do not add up/.test(c)));
});

test('the release rebuilds from committed inputs: hashes match, sources have URL and hash, the manifest and README state the caveats, no local paths', () => {
  for (const f of man.inputs.concat(man.outputs.map(o => ({ file: REL + o.file, sha256: o.sha256 })))) assert.equal(f.sha256, sha256(path.join(ROOT, f.file)), f.file);
  const src = json(IN + 'sources.json');
  assert.ok(src.documents.length === 2 && src.documents.every(d => /^https:\/\/traffic\.delhipolice\.gov\.in/.test(d.url) && /^[0-9a-f]{64}$/.test(d.sha256)));
  assert.match(src.purpose, /A file whose hash differs is a different file/);
  for (const f of ['victims_by_mode.json', 'manifest.json', 'README.md']) assert.ok(!/[A-Za-z]:\\|\/Users\/|\/home\//.test(read(REL + f)), f);
  assert.match(man.scope, /persons \(not crashes\)/);
  assert.ok(man.caveats.some(c => /compare|caution/i.test(c)) && man.caveats.some(c => /not independently reviewed/.test(c)));
  assert.ok(read('package.json').includes('node scripts/build_victims_by_mode.js'));
  const status = json('data/series_status.json').series.find(s => s.id === 'road_victims_by_mode_2004_2018');
  assert.ok(status && status.status === 'production' && /compare 2018 with 2019 with caution/.test(status.note));
  assert.ok(read('README.md').includes('`road_victims_by_mode_2004_2018`'));
});

test('the site: 2011 to 2018 sit beside the unchanged 2019 to 2024 series, the Overview keeps 2019 to 2024, and the page says where each year comes from', () => {
  const E = DATA.SITE.victimsEarly, V = DATA.SITE.victims;
  assert.deepEqual(Object.keys(E).map(Number), [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  assert.deepEqual(Object.keys(V).map(Number), [2019, 2020, 2021, 2022, 2023, 2024]);
  assert.deepEqual(E[2018], { pedestrian: 775, twoWheeler: 570, cyclist: 53, car: 66, bus: 9, slowMoving: 17, animal: 4, other: 196, total: 1690 });
  assert.equal(Object.values(E[2015]).slice(0, 8).reduce((a, b) => a + b, 0), E[2015].total);
  const src = read('assets/page-road.js'), ov = read('assets/page-overview.js');
  assert.ok(src.includes('V = Object.assign({}, S.victimsEarly, S.victims)'));
  assert.ok(!ov.includes('victimsEarly'), 'the Overview sparkline does not join the two series');
  for (const t of ['Older report series.', 'compare 2018 with 2019 with caution', 'Download 2004 to 2018 (CSV)', 'Deaths by mode of travel are held for 2011 to 2024']) assert.ok(src.includes(t), t);
});
