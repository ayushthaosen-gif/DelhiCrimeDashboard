// Guards the five-page site (index, explore, road-safety, 3d-map, data-methods) and the generated data file the pages read:
// the committed files are current, every local link and script exists, the data is the repository's data (null never becomes zero),
// the comparison rules injected into the page behave like the ones the tests run, and the page scripts keep their structural promises
// (every id they look up exists, no innerHTML, pinned CDN versions, metric keys that exist in the ward data).
//
//   node --test test/site_pages.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));
const { render, PAGES } = require('../scripts/build_site');
const files = render();

const siteData = (() => {
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(files['assets/site-data.js'], ctx);
  const raw = ctx.window.DSO_DATA;
  // plain objects from this realm, so deepStrictEqual compares values; the injected functions are kept as they are
  return Object.assign(JSON.parse(JSON.stringify(raw)), { compareYears: raw.compareYears, segmentOf: raw.segmentOf, changeBetween: raw.changeBetween });
})();

test('the committed pages and data file are exactly what the build produces', () => {
  for (const f of Object.keys(files)) assert.equal(read(f).replace(/\r\n/g, '\n'), files[f], f + ' is stale: run node scripts/build_site.js');
});

test('every page has the shared shell: skip link, one current page in the section nav, theme button, language, viewport, title', () => {
  assert.deepEqual(PAGES.map(p => p.file), ['index.html', 'explore.html', 'road-safety.html', 'planning.html', '3d-map.html', 'data-methods.html']);
  for (const p of PAGES) {
    const html = files[p.file];
    assert.match(html, /^<!doctype html>\n<html lang="en"/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(html, /<title>[^<]{5,}<\/title>/);
    assert.match(html, /<a class="skip" href="#main">/);
    assert.ok(html.includes('id="main"'), p.file + ' needs a #main target for the skip link');
    assert.match(html, /id="themeBtn"/);
    const nav = html.slice(html.indexOf('<nav class="site-nav"'), html.indexOf('</nav>', html.indexOf('<nav class="site-nav"')));
    const links = [...nav.matchAll(/<a href="([^"]+)"( aria-current="page")?>([^<]+)<\/a>/g)];
    assert.deepEqual(links.map(m => m[1]), PAGES.map(q => q.file), p.file + ' nav order');
    assert.deepEqual(links.filter(m => m[2]).map(m => m[1]), [p.file], p.file + ': exactly this page is current');
    assert.ok(nav.includes('Official figures up to 2024 · version ' + siteData.updated));
  }
});

test('the dark-theme choice is read before first paint and shared through the same key on every page', () => {
  for (const p of PAGES) assert.ok(files[p.file].includes('localStorage.getItem("dso-theme")'), p.file);
  assert.ok(read('assets/site.js').includes("localStorage.setItem('dso-theme'"));
  assert.match(read('assets/site.css'), /:root\[data-theme="dark"\]/);
});

test('every local link, script and stylesheet resolves to a file; no absolute-root or machine-specific paths', () => {
  for (const f of [...PAGES.map(p => p.file), 'assets/site.css']) {
    const text = files[f] || read(f);
    assert.ok(!/[A-Za-z]:\\|\/Users\/|\/home\//.test(text), f + ' contains a machine-specific path');
    const refs = [...text.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).concat([...text.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]));
    for (const r of refs) {
      if (/^(https?:|mailto:|#|data:)/.test(r)) continue;
      assert.ok(!r.startsWith('/'), f + ': root-relative path ' + r + ' breaks when the site is served from a subpath');
      const target = path.join(path.dirname(path.join(ROOT, f)), r.split('#')[0].split('?')[0]);
      assert.ok(fs.existsSync(target), f + ' points to a missing file: ' + r);
    }
  }
});

test('external scripts and styles are pinned to an exact version', () => {
  for (const p of PAGES) {
    for (const m of files[p.file].matchAll(/(?:src|href)="(https:\/\/unpkg\.com\/[^"]+)"/g)) assert.match(m[1], /@\d+\.\d+\.\d+\//, m[1]);
  }
});

test('the generated data is the repository data: districts, nulls and zeros, road figures, series', () => {
  const src = json('data/dashboard_final.json');
  assert.equal(siteData.DELHI.districts.length, 15);
  assert.equal(siteData.DELHI.viewBox, src.viewBox);
  const field = (key, y) => (y === 2023 ? key : key + y);
  for (const d of siteData.DELHI.districts) {
    const o = src.districts.find(x => x.name === d.name);
    assert.equal(d.path, o.path);
    assert.equal(d.area, o.areaSqKm);
    assert.equal(d.pop, o.population);
    for (const key of ['theft', 'robbery', 'burglary', 'totalIPC', 'crimeAgainstWomen', 'totalSLL']) {
      for (let y = 2016; y <= 2024; y++) {
        const v = d.s[key][y];
        assert.ok(v === null || (typeof v === 'number' && v >= 0), d.name + ' ' + key + ' ' + y);
        // a figure the page shows must be the source figure; a zero must be a source zero, never a missing value turned into 0
        if (v !== null) assert.equal(v, o[field(key, y)], d.name + ' ' + key + ' ' + y);
        if (v === 0) assert.equal(o[field(key, y)], 0);
      }
    }
    for (const key of ['totalCrashes', 'fatalCrashes', 'personsKilled', 'crashProneZones']) for (const y of [2023, 2024]) assert.equal(d.s[key][y], o[key + y] == null ? null : o[key + y], d.name + ' ' + key + ' ' + y);
  }
  const dwarka = siteData.DELHI.districts.find(d => d.name === 'Dwarka');
  assert.equal(dwarka.s.theft[2016], null, 'Dwarka did not exist in 2016: no figure, not zero');
  assert.equal(siteData.DELHI.districts.find(d => d.name === 'Outer North').s.theft[2018], null);
  for (const d of siteData.DELHI.districts) assert.equal(d.s.burglary[2016], null, 'burglary 2016 is not published');
});

test('citywide road data equals the road files; the zone list has 107 zones; the top roads are ordered by fatal crashes', () => {
  const trends = json('data/road_safety_trends.json'), extra = json('data/road_safety_extra_2023_2024.json');
  assert.deepEqual(siteData.SITE.trends.map(t => [t.year, t.crashes, t.fatalCrashes, t.killed]), trends.trends.map(t => [t.year, t.crashes, t.fatalCrashes, t.fatalities]));
  assert.equal(siteData.SITE.trends.length, 14);
  for (const v of trends.victims) assert.equal(siteData.SITE.victims[v.year].pedestrian, v.pedestrianKilled);
  for (const y of ['2023', '2024']) {
    assert.equal(siteData.SITE.enforcement[y].hitAndRunFatal, extra.enforcement[y].hitAndRunFatalCrashes);
    assert.equal(siteData.SITE.enforcement[y].overspeed, extra.enforcement[y].overspeedNotices);
  }
  assert.equal(siteData.ROADS.zones2023.length, 107);
  for (const y of ['2023', '2024']) {
    const roads = siteData.ROADS.roads[y];
    assert.equal(roads.length, 12);
    for (let i = 1; i < roads.length; i++) assert.ok(roads[i - 1][2] >= roads[i][2], y + ' roads are sorted by fatal crashes');
  }
  const status = json('data/series_status.json');
  assert.equal(siteData.SITE.series.length, status.series.length, 'every series in series_status.json is listed');
  for (const s of siteData.SITE.series) assert.ok(Object.keys(status.status_values).includes(s.status.replace(/ /g, '_')), s.status);
  assert.equal(siteData.updated, status.updated);
});

test('2022 road tables are on the site: selected-zone counts by district, 117 named zones, roads; people killed stays null; scope and caution are stated', () => {
  const rel = 'data/releases/road_crash_report_2022/';
  const dz = json(rel + 'district_selected_zones.json');
  assert.equal(dz.length, 15);
  assert.equal(siteData.ROADS.zones2022.length, 117);
  assert.equal(siteData.ROADS.roads['2022'].length, 12);
  assert.deepEqual(Object.keys(siteData.ROADS.roads), ['2014', '2015', '2017', '2018', '2019', '2020', '2021', '2022', '2023', '2024']);
  const originals = json(rel + 'crash_prone_zones.json');
  const overlay = json(rel + 'zones_2022_roads_from_later_reports.json');
  let filled = 0;
  siteData.ROADS.zones2022.forEach(([name, road, fatal, total, derived], i) => {
    const original = originals.find(r => r.rank === i + 1 && r.name_as_printed === name);
    const e = overlay.find(r => r.rank === i + 1 && r.name_as_printed === name);
    assert.ok(original && e, name);
    assert.equal(original.road, null, 'printed source stays untouched');
    assert.equal(fatal, original.fatal_crashes); assert.equal(total, original.total_crashes);
    if (road != null) {
      filled++;
      assert.equal(derived, 1); assert.equal(e.road_match_status, 'exact_name_later_report');
      assert.equal(road, e.road); assert.ok(e.road_evidence.length > 0);
    } else { assert.equal(derived, 0); }
  });
  assert.equal(filled, 67);
  const alias = { 'North-East': 'North East', 'North-West': 'North West', 'South-East': 'South East', 'South-West': 'South West' };
  let totals = 0, fatalSum = 0;
  for (const d of siteData.DELHI.districts) {
    const r = dz.find(x => x.reporting_unit_as_printed === (alias[d.name] || d.name));
    assert.ok(r, d.name);
    assert.equal(d.s.totalCrashes[2022], r.total_crashes); assert.equal(d.s.fatalCrashes[2022], r.fatal_crashes); assert.equal(d.s.crashProneZones[2022], r.crash_prone_zones);
    assert.equal(d.s.personsKilled[2022], null, d.name + ': people killed is not in the 2022 tables');
    totals += d.s.totalCrashes[2022]; fatalSum += d.s.fatalCrashes[2022];
  }
  assert.equal(totals, 1209); assert.equal(fatalSum, 427);
  assert.equal(siteData.ROADS.zones2022.reduce((a, z) => a + z[3], 0), 1209, 'the zone list sums to the district selected-zone table');
  const c = siteData.CONTINUITY, cmp = (...a) => siteData.compareYears(c, ...a);
  assert.equal(cmp('totalCrashes', 2022, 2023, 'Central').state, 'caution');
  assert.equal(cmp('totalCrashes', 2023, 2024, 'Central').state, 'caution', 'zone-scoped counts always carry the zone-list caution');
  assert.equal(cmp('personsKilled', 2022, 2023, 'Central').state, 'not_comparable');
  const explore = read('assets/page-explore.js');
  assert.ok(explore.includes('road: [2022, 2023, 2024]'));
  assert.ok(!explore.includes('All road crashes recorded by Delhi Traffic Police in the district'), 'district crash counts are zone-scoped and must not be described as all crashes');
  assert.ok(explore.includes('identified crash-prone zones of the district only'));
  assert.ok(files['road-safety.html'].includes('within the crash-prone zones of each district'));
});

test('the 2024 zone list is the named-zone file: 93 zones, ranked ones first, unranked counts null', () => {
  const z = siteData.ROADS.zones2024;
  assert.equal(z.length, 93);
  const ranked = z.filter(r => r[3] != null);
  assert.equal(ranked.length, 88);
  assert.ok(z.slice(0, 88).every(r => r[3] != null) && z.slice(88).every(r => r[2] == null && r[3] == null), 'ranked zones come first; the rest keep null counts');
  for (let i = 1; i < 88; i++) assert.ok(z[i - 1][2] >= z[i][2], 'sorted by fatal crashes as in Table 6.29');
  assert.ok(read('assets/page-road.js').includes('YEARS_ZONES.map') && read('assets/page-road.js').includes('2023, 2024]'), 'the zone table offers every year from 2013 to 2024');
});

test('historical district tables: every year has its printed geography, rows add up to the printed totals, omissions are named, nothing is zero by default', () => {
  const H = siteData.ROADS.history, trends = json('data/road_safety_trends.json').trends;
  assert.deepEqual(Object.keys(H.whole).map(Number), [2016, 2017, 2018, 2019, 2020, 2021, 2022], 'whole-district crashes exist for 2016 to 2022 only');
  const geo = { 2016: 11, 2017: 11, 2018: 12, 2019: 12, 2020: 12, 2021: 12, 2022: 15 };
  for (const [y, w] of Object.entries(H.whole)) {
    assert.equal(w.rows.length, geo[y], y + ' printed districts');
    assert.equal(w.geography, geo[y] + ' traffic districts');
    assert.ok(w.rowsAddUp, y + ': fatal + injury + non-injury = total in every row');
    assert.ok(w.rowsMatchTotal, y + ': rows add up to the printed total');
    assert.ok(w.rows.every(r => !/^total$/i.test(r[0])), y + ': the printed total is not a district row');
    const t = trends.find(x => x.year === Number(y));
    assert.equal(w.total[3], t.crashes, y + ' whole-district total equals the citywide crashes');
    assert.equal(w.total[0], t.fatalCrashes, y + ' fatal crashes equal the citywide fatal crashes');
    assert.ok(w.source.sha256 && w.source.url && w.source.review.includes('not independently reviewed'), y + ' source identity');
  }
  assert.deepEqual(Object.keys(H.zones).map(Number), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.ok(H.zones[2016].unavailable && H.zones[2016].rows.length === 0, '2016 has no district zone table');
  assert.deepEqual(H.zones[2016].total, [108, 907, 389, 1296], '2016 keeps its citywide zone total, separate from districts');
  for (let y = 2017; y <= 2022; y++) assert.equal(H.zones[y].rowsMatchTotal, true, y + ' zone rows add up to the printed total');
  const omitted = Object.fromEntries(Object.entries(H.zones).map(([y, z]) => [y, z.omitted]));
  assert.deepEqual(omitted, { 2016: [], 2017: [], 2018: [], 2019: ['NEW DELHI'], 2020: [], 2021: ['Central'], 2022: [], 2023: [], 2024: [] });
  assert.deepEqual([H.zones[2022].total, H.zones[2021].total, H.zones[2020].total[3]], [[117, 782, 427, 1209], [87, 538, 294, 832], 824]);
  // modern years are the production values, untouched
  const final = json('data/dashboard_final.json').districts;
  for (const y of [2023, 2024]) for (const d of final) {
    const r = H.zones[y].rows.find(x => x[0] === d.name);
    assert.deepEqual(r.slice(1), [d['crashProneZones' + y], d['simpleCrashes' + y], d['fatalCrashes' + y], d['totalCrashes' + y]], d.name + ' ' + y);
  }
  // the Dwarka zeroes of the 2020 retrospective table are not original observations: no Dwarka row before 2018
  for (const y of [2016, 2017]) assert.ok(!H.whole[y].rows.some(r => /dwarka/i.test(r[0])), y);
});

test('enforcement history: 2019 to 2022 are the release values with their sources, 2023 and 2024 are unchanged, camera counts stay blank', () => {
  const rel = 'data/releases/road_enforcement_2019_2022/';
  const obs = json(rel + 'enforcement.json'), E = siteData.SITE.enforcementHistory;
  assert.equal(obs.length, 16);
  assert.equal(E.length, 16);
  const get = (m, y) => obs.find(o => o.measure === m && o.reference_year === y);
  assert.deepEqual([2019, 2020, 2021, 2022].map(y => get('hit_and_run_fatal_crashes', y).value), [674, 579, 555, 668]);
  assert.deepEqual([2019, 2020, 2021, 2022].map(y => get('drink_driving_prosecutions', y).value), [36065, 3986, 2831, 2255]);
  assert.deepEqual([2019, 2020, 2021, 2022].map(y => get('overspeed_notices', y).value), [2531894, 7927515, 3529090, 2860073]);
  const trends = json('data/road_safety_trends.json').trends;
  const share22 = get('hit_and_run_share_of_fatal_crashes_percent', 2022);
  assert.equal(share22.value_kind, 'derived');
  assert.equal(share22.value, Math.round(668 / trends.find(t => t.year === 2022).fatalCrashes * 10000) / 100, 'the derived 2022 share is 668 of the citywide fatal crashes');
  const hashes = new Set(json(rel + 'manifest.json').sources.map(s => s.sha256));
  for (const o of obs) {
    assert.ok(hashes.has(o.source_sha256) && o.source_url && o.source_pdf_page > 0 && o.review_status.includes('not independently reviewed') || o.review_status.includes('checked visually'), o.measure + ' ' + o.reference_year + ' names its source and review status');
    assert.ok(o.value > 0 && o.value != null);
  }
  assert.ok(!obs.some(o => /camera|rlvd|osvd/.test(o.measure)), 'no camera counts before 2023: the reports are inconsistent');
  const csv = fs.readFileSync(path.join(ROOT, rel, 'enforcement.csv'), 'utf8').trim().split('\n');
  assert.equal(csv.length, 17, 'the CSV has one row per observation');
  const x = json('data/road_safety_extra_2023_2024.json').enforcement;
  assert.equal(siteData.SITE.enforcement[2023].drinkDriving, x['2023'].drinkingDrivingProsecutions);
  assert.equal(siteData.SITE.enforcement[2024].overspeed, x['2024'].overspeedNotices);
  const src = read('assets/page-road.js');
  assert.ok(src.includes('Enforcement, 2019 to 2024') && src.includes('delhi_road_enforcement_2019_2024.csv'));
  assert.ok(src.includes('do not read the jump as a change in drinking and driving'));
  assert.ok(src.includes('not zero'), 'a dash is explained as no figure, not zero');
});

test('named zones and roads 2016 to 2021: every year ties to its printed totals, ranks are sequential, the 2016 and 2021 gaps are explicit, the page offers every year', () => {
  const rel = 'data/releases/road_zones_roads_2016_2021/';
  const named = json(rel + 'named_zones_2016_2021.json'), roadsAll = json(rel + 'roads_selected_zones_2017_2021.json'), man = json(rel + 'manifest.json');
  const R = siteData.ROADS;
  assert.equal(named.length, 646);
  assert.equal(roadsAll.length, 163);
  for (let y = 2016; y <= 2021; y++) {
    const rows = named.filter(z => z.reference_year === y), t = man.printedTotals[String(y)];
    assert.equal(rows.length, t.zones, y + ' zone rows equal the printed zone count');
    assert.equal(rows.reduce((a, z) => a + z.simple_crashes, 0), t.simple);
    assert.equal(rows.reduce((a, z) => a + z.fatal_crashes, 0), t.fatal);
    assert.equal(rows.reduce((a, z) => a + z.total_crashes, 0), t.total);
    assert.ok(rows.every(z => z.simple_crashes + z.fatal_crashes === z.total_crashes), y + ' row arithmetic');
    assert.deepEqual(rows.map(z => z.serial), rows.map((z, i) => i + 1));
    assert.ok(rows.every(z => z.latitude === null && z.longitude === null && z.source_sha256 && z.source_pdf_page > 0 && /not independently reviewed/.test(z.review_status)), y + ' no invented coordinates; source and review stated');
    assert.equal(R['zones' + y].length, t.zones, 'the page data has every row for ' + y);
    if (y >= 2017) {
      const rr = roadsAll.filter(r => r.reference_year === y);
      assert.deepEqual([0, 1, 2, 3].map(k => rr.reduce((a, r) => a + [r.crash_prone_zones, r.simple_crashes, r.fatal_crashes, r.total_crashes][k], 0)), [t.zones, t.simple, t.fatal, t.total], y + ' road table adds up to the printed total');
      assert.equal(R.roadRows[y], rr.length);
      assert.equal(R.roads[y].length, 12);
      for (let i = 1; i < 12; i++) assert.ok(R.roads[y][i - 1][2] >= R.roads[y][i][2], y + ' roads sorted by fatal crashes');
    }
  }
  assert.ok(!R.roads[2016] && !roadsAll.some(r => r.reference_year === 2016), 'the 2016 report prints no road table');
  assert.ok(named.filter(z => z.reference_year === 2021).every(z => z.road_as_printed === null), 'the 2021 zone table prints no road');
  assert.ok(named.filter(z => z.reference_year >= 2016 && z.reference_year <= 2020).every(z => z.road_as_printed), 'zone tables 2016 to 2020 print a road');
  assert.equal(named.find(z => z.reference_year === 2016 && z.serial === 1).name_as_printed, 'AGGARWAL MILLENIUM TOWER', 'source spellings are kept');
  assert.equal(named.filter(z => z.reference_year === 2017).length, 145);
  assert.ok(man.discrepanciesInTheSource.some(d => /376/.test(d) && /398/.test(d)), 'the 2019 narrative discrepancy is recorded');
  const src = read('assets/page-road.js');
  assert.ok(src.includes('YEARS_ALL = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]'));
  assert.ok(src.includes('prints no road-wise table'), 'the 2016 roads gap is explained on the page');
  assert.ok(src.includes('listed alphabetically'), 'the 2016 list order is stated');
  assert.ok(src.includes("(z.road || '')"), 'a missing road is never searched as the word null');
});

test('the continuity file blocks district changes across the 2017-2018 and 2021-2022 breaks and asks for caution everywhere else', () => {
  const c = json('data/continuity.json').roadHistory;
  const state = (a, b) => (c.breaks.find(x => x.between[0] === a && x.between[1] === b) || {}).state;
  assert.equal(state(2017, 2018), 'not_comparable');
  assert.equal(state(2021, 2022), 'not_comparable');
  assert.equal(state(2022, 2023), 'caution');
  assert.deepEqual(c.pandemicYears, [2020, 2021]);
  assert.match(c.zoneReason, /not all crashes in the district or on the road/);
  assert.match(c.zoneReason, /selected locations can change each year/);
});

test('the district tables on Road safety keep scope, geography, nulls and exports honest', () => {
  const src = read('assets/page-road.js');
  for (const k of ['hm', 'hy-']) assert.ok(src.includes("'" + k + "'"), k);
  assert.ok(src.includes('dm: m, dy: y'), 'the share link carries measure and year');
  assert.ok(src.includes("'delhi_road_' + m + '_' + y + '.csv'"), 'the download name carries scope and year');
  for (const col of ['row_type', 'reporting_unit_as_printed', 'missing_reason', 'comparison_with_previous_year', 'comparison_reason', 'source_pdf_page', 'source_sha256', 'review_status', 'data_version', 'crash_prone_zones', 'simple_crashes_at_zones', 'fatal_crashes_at_zones', 'total_crashes_at_zones', 'injury_crashes', 'non_injury_crashes']) assert.ok(src.includes("'" + col + "'"), col);
  for (const t of ['district_not_in_table', 'printed_total', 'unreported, not zero', 'Printed total (not a district)']) assert.ok(src.includes(t), t);
  assert.ok(src.includes('These are crashes within the zones identified that year, not all crashes in the district or on the road. The selected locations can change each year.'));
  assert.ok(src.includes('not today'), 'the geography caveat is in the tooltip');
  assert.ok(src.includes('no change figures are calculated here') || src.includes('No change figures are calculated here'));
  assert.ok(files['road-safety.html'].includes('id="district-tables"'));
});

test('the comparison rules in the page are the ones the tests run (data/continuity.json through compareYears)', () => {
  const c = siteData.CONTINUITY, cmp = (...a) => siteData.compareYears(c, ...a);
  assert.equal(cmp('theft', 2022, 2023).state, 'comparable');
  assert.equal(cmp('theft', 2023, 2024).state, 'caution', 'BNS replaced the IPC in July 2024');
  assert.equal(cmp('theft', 2013, 2014).state, 'not_comparable');
  assert.equal(cmp('theft', 2018, 2019).state, 'not_comparable', 'Outer North was created in 2019');
  assert.equal(cmp('theft', 2016, 2017, 'Dwarka').state, 'unavailable', 'Dwarka did not exist as a district before 2017');
  assert.equal(cmp('totalIPC', 2016, 2017, 'Delhi UT').state, 'comparable', 'Delhi-wide printed totals exist for 2016 and 2017');
  assert.equal(cmp('theft', 2016, 2017, 'Delhi UT').state, 'unavailable', 'Delhi-wide head-wise 2016-2020 are not extracted: blank, not zero');
  assert.equal(cmp('crashProneZones2023', 2023, 2024).state, 'caution');
  assert.ok(cmp('theft', 2013, 2014).reasons.length > 0, 'a verdict always carries a reason');
  assert.deepEqual(Array.from(siteData.segmentOf(c, 'theft', 2024)), [2019, 2024]);
  assert.equal(siteData.changeBetween({ state: 'not_comparable' }, 10, 20), null);
  assert.equal(siteData.changeBetween({ state: 'comparable' }, 10, 20), 100);
  assert.ok(!JSON.stringify(c).includes('historical_2011_2015/'), 'evidence paths are stripped from the page copy');
});

test('page scripts parse, build their DOM with text nodes (no innerHTML), and every id they look up exists in the page', () => {
  const pages = { 'assets/page-overview.js': 'index.html', 'assets/page-explore.js': 'explore.html', 'assets/page-road.js': 'road-safety.html', 'assets/page-3d.js': '3d-map.html', 'assets/page-methods.js': 'data-methods.html', 'assets/page-planning.js': 'planning.html' };
  for (const [script, page] of Object.entries(pages)) {
    const src = read(script);
    assert.doesNotThrow(() => new vm.Script(src, { filename: script }), script);
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/.test(src), script + ' must not build markup from strings');
    assert.ok(!/console\.log/.test(src), script + ' leaves a debug log');
    assert.ok(files[page].includes('src="' + script + '?v='), page + ' loads ' + script + ' with a content-hash version');
    const ids = [...new Set([...src.matchAll(/\$\('#([^']+)'\)/g)].map(m => m[1]))];
    for (const id of ids) assert.ok(files[page].includes('id="' + id + '"'), script + ' looks up #' + id + ' but ' + page + ' has no such element');
  }
  assert.doesNotThrow(() => new vm.Script(read('assets/site.js')));
  // page scripts load after the shared helpers and the data
  for (const p of PAGES) {
    const html = files[p.file];
    assert.ok(html.indexOf('assets/site.js') < html.indexOf('assets/site-data.js') && html.indexOf('assets/site-data.js') < html.indexOf('assets/page-'), p.file + ' script order');
  }
});

test('Explore offers only measures and years that exist in the data, and passes shared-link state through the URL hash', () => {
  const src = read('assets/page-explore.js');
  const keys = [...src.matchAll(/\{ k: '([A-Za-z]+)', label:/g)].map(m => m[1]);
  assert.deepEqual(keys, ['theft', 'robbery', 'burglary', 'totalIPC', 'crimeAgainstWomen', 'totalSLL', 'totalCrashes', 'fatalCrashes', 'personsKilled', 'crashProneZones']);
  for (const k of keys) assert.ok(siteData.DELHI.districts.every(d => k in d.s), k + ' is in the district data');
  const years = key => [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].filter(y => siteData.DELHI.districts.some(d => d.s[key] && d.s[key][y] != null));
  assert.deepEqual(years('theft'), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.deepEqual(years('totalIPC'), [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024], '2016 has no all-crime total');
  assert.deepEqual(years('personsKilled'), [2023, 2024]);
  for (const k of ['topic', 'metric', 'year', 'calc', 'district']) assert.ok(src.includes(k + ': st.'), 'hash carries ' + k);
  assert.ok(src.includes("cmp(mk, y0, y1, name)"), 'comparisons go straight to the continuity rules');
});

test('the 3D map reads only ward fields that exist, loads its data by relative path, and keeps the legacy-ward and exploratory caveats', () => {
  const src = read('assets/page-3d.js'), wards = json('data/delhi_wards_infra.geojson');
  const props = new Set(); wards.features.forEach(f => Object.keys(f.properties).forEach(k => props.add(k)));
  const block = src.slice(src.indexOf('var METRICS = ['), src.indexOf('var GROUPS'));
  const entries = [...block.matchAll(/\{ key: '([^']+)'(?:, label: '[^']*')?(?:, kind: '([^']+)')?/g)];
  assert.equal(entries.length, 12);
  for (const [, key, kind] of entries) if (!kind) assert.ok(props.has(key), 'ward data has no field ' + key);
  for (const f of ['data/delhi_wards_infra.geojson', 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson', 'data/poi_markers_latlng.json', 'data/police_markers_latlng.json', 'data/delhi_liquor_vends_all_coordinates_approx.geojson']) {
    assert.ok(src.includes("'" + f + "'"), f);
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  }
  assert.ok(!/github\.io/.test(src), 'data must come from the same site, not a hard-coded domain');
  assert.match(src, /legacy 290-ward geography/);
  assert.match(src, /exploratory/);
  assert.match(src, /district's value|district\\'s value/);
});

test('Data & methods keeps its seven sections, the downloads exist, and the Overview keeps the caveats the original page carried', () => {
  const dm = files['data-methods.html'];
  for (const id of ['compare', 'coverage', 'geography', 'method', 'downloads', 'glossary', 'sources']) {
    assert.ok(dm.includes('id="' + id + '"') && dm.includes('href="#' + id + '"'), id);
  }
  for (const f of ['exports/districts.csv', 'exports/crash_prone_zones_2023.csv', 'data/continuity.json']) assert.ok(dm.includes('href="' + f + '"') && fs.existsSync(path.join(ROOT, f)), f);
  const ov = files['index.html'];
  for (const t of ['Registered cases are not crime levels.', 'Boundaries changed.', 'A zero can mean not surveyed.', 'Crash data uses other districts.', 'Read before comparing:']) assert.ok(ov.includes(t), t);
  assert.ok(ov.includes('href="delhi_safety_dashboard.html"'), 'the earlier dashboard stays reachable');
});
