// Phase 2 visitor clarity on Road safety: one year for every section, each section says what it measures and which year it shows, a year with
// no figure says so instead of showing another year, and the share link carries the year, the district measure and the trend choice.
//
//   node --test test/year_context.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { render } = require('../scripts/build_site');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const files = render();
const src = read('assets/page-road.js');
const DATA = (() => { const ctx = vm.createContext({ window: {} }); vm.runInContext(files['assets/site-data.js'], ctx); return JSON.parse(JSON.stringify(ctx.window.DSO_DATA)); })();
const R = DATA.ROADS, V = DATA.SITE.victims;

test('one shared year: the page keeps a single year, every section picker sets it, and nothing keeps its own', () => {
  assert.match(src, /var st = \{ measure: 'killed', index: false, hy: null, year: 2024,/);
  for (const old of ['modeYear', 'roadYear', 'zoneYear', 'stretchYear', 'hs.year']) assert.ok(!src.includes(old), old + ' is gone');
  assert.ok(src.includes('function setYear(y)') && src.includes('function renderAll()'));
  assert.equal(src.split('setYear(').length - 1 >= 7, true, 'the bar and the section pickers all call setYear');
  assert.ok(src.includes('YEARS_PAGE = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]'));
  assert.ok(files['road-safety.html'].includes('id="yearBar"') && files['road-safety.html'].indexOf('id="yearBar"') < files['road-safety.html'].indexOf('id="trend"'));
  assert.ok(src.includes('The headline figures above are always the latest year, 2024'));
});

test('what each section can show for each year is what the page says: modes 2019 to 2024, zones 2013 to 2024, roads, stretches 2011, 2012 and 2014, districts 2016 to 2024', () => {
  assert.deepEqual(Object.keys(V).map(Number), [2019, 2020, 2021, 2022, 2023, 2024]);
  const zoneYears = [], roadYears = [];
  for (let y = 2011; y <= 2024; y++) { if ((R['zones' + y] || []).length) zoneYears.push(y); if (R.roads[y]) roadYears.push(y); }
  assert.deepEqual(zoneYears, [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.deepEqual(roadYears, [2014, 2015, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024], '2011 to 2013 and 2016 have no road table');
  assert.deepEqual(Object.keys(R.stretches).map(Number), [2011, 2012, 2014]);
  assert.deepEqual(Object.keys(DATA.ROADS.history.zones).map(Number), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  // each missing case has words
  for (const t of ['Deaths by mode of travel are held for 2019 to 2024 only', 'No zone list was found for 2011 or 2012 (source not found)', 'The district tables start in 2016', 'Stretch statistics were recovered for 2011, 2012 and 2014 only', 'the table starts in 2019', 'No zone list is held for this year']) assert.ok(src.includes(t), t);
  assert.ok(src.includes('The 2013 compilation prints no road-wise summary (not printed)'));
});

test('every section carries a scope line: measure, unit, geography and the year it shows', () => {
  const lines = src.match(/scopeLine\(/g).length;
  assert.ok(lines >= 9, 'scope lines in the trend, modes, enforcement, districts, zones, roads and stretches');
  for (const t of ['counts, not rates', 'Persons killed by mode of travel · Delhi as a whole', 'Counts per year · Delhi as a whole · 2019 to 2024', 'traffic districts as printed in the', 'Crashes within the named crash-prone zones of the', 'counts within zones, not whole-road counts', 'whole-stretch counts, not selected zones']) assert.ok(src.includes(t), t);
  assert.ok(src.includes("'yr-col'") && /\.tbl th\.yr-col, \.tbl td\.yr-col/.test(read('assets/site.css')), 'the enforcement column of the year in view is highlighted');
});

test('the share link carries year, district measure and trend choice; an old district-only link still works; the hash drops empty values', () => {
  assert.ok(src.includes("D.hashOf({ y: st.year, dm: hs.measure, tm: st.measure === 'killed' ? null : st.measure, ti: st.index ? '1' : null })"));
  assert.ok(src.includes('var y = +(p.y || p.dy);') && src.includes("if (p.tm === 'crashes' || p.tm === 'fatalCrashes') st.measure = p.tm;") && src.includes("if (p.ti === '1') st.index = true;"));
  assert.ok(!/history\.replaceState\(null, '', D\.hashOf\(\{ dm: m, dy: y \}\)\)/.test(src), 'the old district-only link is gone');
  assert.equal((src.match(/syncHash\(\)/g) || []).length >= 3, true);
  const noop = () => {}, el = () => ({ setAttribute: noop, appendChild: noop, addEventListener: noop });
  const ctx = vm.createContext({ window: {}, document: { addEventListener: noop, getElementById: () => null, createElement: el, documentElement: { getAttribute: () => 'light' } }, localStorage: { getItem: () => null }, location: { hash: '' }, setTimeout });
  ctx.window.window = ctx.window;
  vm.runInContext(read('assets/site.js'), ctx);
  const D = ctx.window.DSO;
  assert.equal(D.hashOf({ y: 2024, dm: 'zones', tm: null, ti: null }), '#y=2024&dm=zones');
  assert.equal(D.hashOf({ y: 2019, dm: 'whole', tm: 'fatalCrashes', ti: '1' }), '#y=2019&dm=whole&tm=fatalCrashes&ti=1');
});
