// Guards the 2011 to 2018 Traffic Police enforcement figures and the 2011 to 2015 whole-district tables added to the Road safety page:
// values as printed, agreement between editions and with the citywide series, and the printed inconsistencies recorded cell by cell.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildAll } = require('../scripts/lib/site_data.js');
const roadHistory = require('../scripts/lib/road_history.js');

const ROOT = path.join(__dirname, '..');
const json = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const enf = json('data/staged/tp_enforcement_2011_2018/enforcement_2011_2018.json');
const rel = json('data/releases/road_enforcement_2019_2022/enforcement.json');
const S = buildAll().SITE;
const trends = {};
S.trendsEarlier.concat(S.trends).forEach(r => { trends[r.year] = r; });
const get = (m, y) => enf.rows.find(r => r.measure === m && r.reference_year === y);
const years = (m) => enf.rows.filter(r => r.measure === m).map(r => r.reference_year);

test('every staged enforcement row names its report, file hash and review status, and the files are the ones recorded', () => {
  const hashes = new Set(enf.sources.map(s => s.sha256));
  assert.equal(enf.rows.length, 25);
  for (const r of enf.rows) {
    assert.match(r.source_sha256, /^[0-9a-f]{64}$/, r.measure + ' ' + r.reference_year);
    assert.ok(hashes.has(r.source_sha256) && /^https:\/\/traffic\.delhipolice\.gov\.in\//.test(r.source_url), r.measure + ' ' + r.reference_year);
    assert.ok(r.source_pdf_page > 0 && r.source_printed_page > 0 && /not independently reviewed/.test(r.review_status), r.measure + ' ' + r.reference_year);
  }
});

test('drink-driving prosecutions and over-speed challans 2011 to 2018 are the values printed in Table 9.3', () => {
  assert.deepEqual(years('drink_driving_prosecutions'), [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  assert.deepEqual(years('overspeed_challans_on_the_spot'), [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018]);
  assert.deepEqual(years('drink_driving_prosecutions').map(y => get('drink_driving_prosecutions', y).value), [18073, 25678, 26633, 29584, 25958, 28006, 33343, 39240]);
  assert.deepEqual(years('overspeed_challans_on_the_spot').map(y => get('overspeed_challans_on_the_spot', y).value), [44618, 30611, 29045, 132814, 240954, 86771, 139985, 141052]);
});

test('over-speed challans (to 2018) and camera notices (from 2019) are two measures that never share a year', () => {
  const eh = S.enforcementHistory;
  const yrs = m => eh.filter(r => r.measure === m).map(r => r.year);
  assert.equal(Math.max(...yrs('overspeed_challans_on_the_spot')), 2018);
  assert.equal(Math.min(...yrs('overspeed_notices')), 2019);
  assert.ok(Math.min(...rel.filter(r => r.measure === 'overspeed_notices').map(r => r.value)) > 10 * Math.max(...enf.rows.filter(r => r.measure === 'overspeed_challans_on_the_spot').map(r => r.value)), 'camera notices run to millions, challans to hundreds of thousands: not one series');
});

test('hit-and-run: counts for 2015 to 2018 follow from the fatal crashes the same reports print, and 2018 matches what the 2019 report says', () => {
  assert.deepEqual(years('hit_and_run_fatal_crashes'), [2015, 2016, 2017, 2018]);
  assert.deepEqual(years('hit_and_run_fatal_crashes').map(y => get('hit_and_run_fatal_crashes', y).value), [623, 647, 700, 765]);
  for (const y of [2015, 2016, 2017, 2018]) {
    const calc = get('hit_and_run_fatal_crashes', y).value / trends[y].fatalCrashes * 100;
    const sh = get('hit_and_run_share_of_fatal_crashes_percent', y);
    assert.ok(Math.abs(calc - sh.value) < 0.06, y + ' share ' + sh.value + ' vs ' + calc.toFixed(2));
  }
  assert.equal(get('hit_and_run_share_of_fatal_crashes_percent', 2017).value_kind, 'derived', 'the 2017 share is computed: the report prints 41.8, a repeat of 2016');
  assert.match(get('hit_and_run_share_of_fatal_crashes_percent', 2017).note, /41\.8%/);
  assert.match(rel.find(r => r.measure === 'hit_and_run_fatal_crashes' && r.reference_year === 2019).note, /765 in 2018/);
  assert.equal(get('hit_and_run_share_of_fatal_crashes_percent', 2014).value, 40.6);
  assert.equal(get('hit_and_run_fatal_crashes', 2014), undefined, 'no 2014 count is printed in any report held');
});

test('whole-district tables 2011 to 2015: fatal and total crashes equal the citywide series, Outer is omitted (not zero) before 2014', () => {
  const H = roadHistory.build().whole;
  for (let y = 2011; y <= 2015; y++) {
    const w = H[y];
    assert.equal(w.total[0], trends[y].fatalCrashes, y + ' fatal');
    assert.equal(w.total[3], trends[y].crashes, y + ' total');
    assert.equal(w.rows.reduce((a, r) => a + r[1], 0), w.total[0], y + ' fatal rows add to the printed total');
    assert.ok(w.source.sha256 && /CHAPTER-6/.test(w.source.url) && w.source.printedPage === 38, y);
    assert.deepEqual(w.omitted, y <= 2013 ? ['OUTER'] : [], y);
    assert.equal(w.rows.length, y <= 2013 ? 10 : 11, y);
  }
});

test('the 2014 rows equal the separately audited 2014 retrospective district rows already in the repo', () => {
  const H = roadHistory.build().whole;
  const audited = json('data/inputs/road_history_2011_2015/supplement_2014/traffic_districts_2014_retrospective.json');
  assert.equal(audited.length, 11);
  for (const a of audited) {
    const row = H[2014].rows.find(r => r[0] === a.traffic_district_label);
    assert.deepEqual(row.slice(1), [a.fatal_accidents, a.injury_accidents, a.non_injury_accidents, a.total_accidents], a.traffic_district_label);
  }
});

test('2013 to 2015 add up exactly; the gaps in the printed 2011 and 2012 tables are listed as printed and no value is corrected', () => {
  const H = roadHistory.build().whole;
  for (const y of [2013, 2014, 2015]) assert.deepEqual(H[y].printedInconsistencies, [], String(y));
  const g = y => H[y].printedInconsistencies.join(' | ');
  assert.equal(H[2011].printedInconsistencies.length, 3);
  assert.match(g(2011), /NORTH WEST: the printed total is 1584, but .* add to 1548/);
  assert.match(g(2011), /gives 45 non-injury accidents, but the district rows above add to 71/);
  assert.match(g(2011), /gives 7280 total accidents, but the district rows above add to 7316/);
  assert.equal(H[2012].printedInconsistencies.length, 5);
  assert.match(g(2012), /EAST: the printed total is 696, but .* add to 716/);
  assert.match(g(2012), /NORTH: the printed total is 446, but .* add to 234/);
  assert.match(g(2012), /WEST: the printed total is 549, but .* add to 661/);
  assert.match(g(2012), /gives 5000 injury accidents, but the district rows above add to 4788/);
  assert.match(g(2012), /gives 6937 total accidents, but the district rows above add to 6805/);
  // as printed, not corrected
  assert.deepEqual(H[2011].rows.find(r => r[0] === 'NORTH WEST'), ['NORTH WEST', 490, 1050, 8, 1584]);
  assert.deepEqual(H[2012].rows.find(r => r[0] === 'NORTH'), ['NORTH', 115, 115, 4, 446]);
});

test('the page offers 2011 as the first district and enforcement year and shows the printed gaps', () => {
  const src = fs.readFileSync(path.join(ROOT, 'assets', 'page-road.js'), 'utf8');
  assert.ok(src.includes('var HYEARS = [2011, 2012, 2013, 2014, 2015, 2016'));
  assert.ok(src.includes('EYEARS = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019'));
  assert.ok(src.includes('This printed table does not add up.'));
  assert.ok(src.includes("key: 'overspeed_challans_on_the_spot'"));
});
