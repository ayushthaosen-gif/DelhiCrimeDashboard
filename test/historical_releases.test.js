const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { parseCsv } = require('../scripts/lib/release_utils');
const ROOT = path.resolve(__dirname, '..');
const STAGE = 'data/staged/history_2011_2015/';
const HIST = 'data/releases/historical_2011_2015/';
const ROAD = 'data/releases/citywide_road_trend/';
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const json = file => JSON.parse(read(file));
const csv = file => parseCsv(read(file)).rows;
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
const road = json('data/road_safety_trends.json');
const html = read('delhi_safety_dashboard.html');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

test('road extension adds only three source-verified years and preserves every later observation and victim row', () => {
  const baseline = json(STAGE + 'inputs/production_road_safety_baseline.json').data;
  assert.deepEqual(road.trends.slice(0, 3), [
    { year: 2011, crashes: 7280, fatalities: 2110, fatalCrashes: 2047 },
    { year: 2012, crashes: 6937, fatalities: 1866, fatalCrashes: 1822 },
    { year: 2013, crashes: 7566, fatalities: 1820, fatalCrashes: 1778 }
  ]);
  assert.deepEqual(road.trends.slice(3), baseline.trends);
  assert.deepEqual(road.victims, baseline.victims);
  assert.equal(road.trends.length, 14);
  for (const edition of json(STAGE + 'generated/traffic_archived_statistics_editions.json').editions) for (const r of edition.rows) {
    const actual = road.trends.find(t => t.year === r.reference_year);
    assert.deepEqual([actual.crashes, actual.fatalities, actual.fatalCrashes], [r.values[4], r.values[6], r.values[3]]);
  }
  assert.deepEqual(json(ROAD + 'citywide_road_trend.json'), road.trends);
  assert.deepEqual(csv(ROAD + 'citywide_road_trend.csv').map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Number(v)]))), road.trends);
});

test('road chart uses the same 2011 baseline, end year, counts and caveats; crime years stay separate', () => {
  const embedded = JSON.parse(script.match(/const TRENDS = (\[[^\n]+\]);/)[1]);
  assert.deepEqual(embedded, road.trends);
  assert.match(html, /Trends, 2011–2024/);
  assert.match(html, /Road crashes, 2011→2024/);
  assert.match(html, /Counts, not rates/);
  assert.match(html, /not a population- or travel-adjusted risk rate/);
  assert.match(html, /30-day fatality definition could not be confirmed/);
  assert.match(html, /injury and simple\/non-injury figures differ by source edition/);
  assert.doesNotMatch(html, /2014 = 100|2014→2023|Trends, 2014-2024/);
  assert.doesNotMatch(html, /<option value="201[1-5]"/);
  assert.doesNotMatch(html, /historical_2011_2015\/|const HISTORICAL/);
  const table = html.match(/<table class="cov-table" id="roadTrendCounts">([\s\S]*?)<\/table>/)[1];
  assert.equal((table.match(/scope="row"/g) || []).length, 14);
  assert.match(table, /2011<\/th><td>7,280<\/td><td>2,047<\/td><td>2,110/);
});

test('rendered chart baseline and download filename are computed from the extended series', () => {
  const texts = [], nodes = {};
  const context = vm.createContext({ TRENDS: road.trends, Math, fmtNum: n => n.toLocaleString('en-IN'),
    document: { body: {}, getElementById: id => nodes[id] ||= { style: {} } },
    getComputedStyle: () => ({ getPropertyValue: () => '#555555' }),
    setupHighDPICanvas: () => ({ W: 640, H: 320, ctx: new Proxy({}, { get: (_, key) => (...args) => { if (key === 'fillText') texts.push(args[0]); }, set: () => true }) })
  });
  vm.runInContext(script.slice(script.indexOf('function renderTrends()'), script.indexOf('function renderVictimsByMode()')) + '\nrenderTrends();', context);
  assert.ok(texts.includes('2011 = 100'));
  assert.ok(texts.includes(2011) && texts.includes(2024));
  assert.equal(nodes.trendsCrashesChange.textContent, '-22%');
  assert.equal(nodes.trendsFatalitiesChange.textContent, '-26%');
  let downloaded;
  vm.runInNewContext(script.slice(script.indexOf("document.getElementById('dlTrendsDownload')"), script.indexOf("document.getElementById('dlVictimsDownload')")), {
    TRENDS: road.trends,
    document: { getElementById: () => ({ addEventListener: (_, fn) => fn() }) },
    toCSV: (headers, rows) => ({ headers, rows }), triggerDownload: (name, content) => { downloaded = { name, content }; }
  });
  assert.equal(downloaded.name, 'gaitway_delhi_road_safety_trends_2011_2024.csv');
  assert.equal(downloaded.content.rows.length, 14);
  assert.deepEqual(Array.from(downloaded.content.rows[0]), [2011, 7280, 2110, 2047]);
});

test('historical release retains original units and all summary cells, outside the 2016-2024 district years', () => {
  const manifest = json(HIST + 'manifest.json');
  assert.equal(manifest.status, 'production');
  assert.equal(manifest.productionReady, true);
  assert.equal(manifest.dashboardIntegrated, true);
  assert.equal(manifest.districtMapping, null);
  const city = json(HIST + 'citywide_crime.json');
  assert.deepEqual(city.map(r => r.source_reporting_units), [17, 17, 18, 19, 19]);
  assert.equal(city[0].total_ipc, 53353);
  assert.equal(city[1].total_ipc, 54287);
  for (const row of city.slice(0, 3)) {
    assert.equal(row.total_sll, null); assert.equal(row.total_crimes_against_women, null);
    assert.equal(row.criminal_trespass_burglary_revised_definition, null);
    assert.ok(row.null_reasons.total_sll);
  }
  for (const row of city.slice(3)) assert.equal(row.burglary_old_definition, null);
  const index = json('data/releases/manifest.json');
  assert.deepEqual(index.years.map(y => y.year), [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);
  assert.equal(index.historicalReleases[0].dashboardIntegrated, true);
  assert.equal(index.citywideRoadTrend.coverageStart, 2011);
  for (const input of manifest.inputs) {
    const original = json(input.path);
    const copy = HIST + 'as_printed/' + path.basename(input.path);
    assert.equal(hash(copy), hash(input.path));
    const summary = json(HIST + 'citywide_totals_as_printed.json').find(t => t.reference_year === original.reference_year && t.table === original.table);
    assert.deepEqual(summary.printed_summary, original.printed_summary);
    assert.deepEqual(summary.column_headers, original.column_headers);
  }
});

test('historical offence CSVs retain source labels, zeros and positions; null aggregates are empty cells', () => {
  const rows = csv(HIST + 'district_offence_counts_as_printed.csv');
  const summaries = csv(HIST + 'citywide_offence_counts_as_printed.csv');
  assert.equal(rows.length, json(HIST + 'manifest.json').coverage.districtOffenceRows);
  assert.ok(rows.every(r => r.current_district_id === '' && !['TOTAL', 'Total District(s)'].includes(r.reporting_unit_label_as_printed)));
  const caw = rows.find(r => r.reference_year === '2011' && r.reporting_unit_label_as_printed === 'CAW' && r.source_column === '3');
  assert.equal(caw.cases, '0');
  assert.equal(caw.source_printed_pages, '296;297;298');
  assert.ok(rows.some(r => r.reference_year === '2013' && r.reporting_unit_label_as_printed === 'METRO RAIL'));
  const city = csv(HIST + 'citywide_crime.csv');
  assert.equal(city[0].total_sll, ''); assert.equal(city[0].total_crimes_against_women, '');
  assert.equal(city[4].burglary_old_definition, '');
  for (const input of json(HIST + 'manifest.json').inputs) {
    const table = json(input.path);
    for (let column = table.table === '1.14' ? 0 : 3; column < table.column_headers.length; column++) {
      if (table.column_headers[column] === null) continue;
      const printedColumn = String(column + (table.table === '1.14' ? 3 : 1));
      const selected = rows.filter(r => r.source_path === STAGE + table.source && r.source_column === printedColumn);
      assert.equal(selected.length, table.reporting_units.length);
      assert.equal(selected[0].offence_label_as_printed, table.column_headers[column]);
      assert.equal(Number(summaries.find(r => r.source_path === STAGE + table.source && r.source_column === printedColumn).cases), table.printed_summary.values[column]);
    }
  }
});

test('both releases hash every data artifact and cite verified source bytes and publication gaps', () => {
  for (const dir of [HIST, ROAD]) {
    const manifest = json(dir + 'manifest.json');
    for (const f of manifest.files) { assert.equal(hash(dir + f.path), f.sha256); assert.equal(fs.statSync(path.join(ROOT, dir + f.path)).size, f.bytes); }
    for (const source of manifest.sources) assert.equal(hash(source.path), source.sha256);
  }
  const manifest = json(HIST + 'manifest.json');
  assert.equal(manifest.publicationEvidence['2014'].publication_date, null);
  assert.equal(manifest.publicationEvidence['2015'].publication_date, '2016-08-30');
  assert.match(manifest.comparability['2014'].join(' '), /revised proformae|revised.*proformae/i);
  assert.equal(manifest.reuseTerms[0].open_licence_verified, false);
});
