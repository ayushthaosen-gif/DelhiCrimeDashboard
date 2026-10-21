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
  assert.deepEqual(PAGES.map(p => p.file), ['index.html', 'explore.html', 'road-safety.html', '3d-map.html', 'data-methods.html']);
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
  const pages = { 'assets/page-overview.js': 'index.html', 'assets/page-explore.js': 'explore.html', 'assets/page-road.js': 'road-safety.html', 'assets/page-3d.js': '3d-map.html', 'assets/page-methods.js': 'data-methods.html' };
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
  assert.ok(src.includes("'crashProneZones2023'"), 'the zone list is compared with its own continuity key');
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
