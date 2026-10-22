// Phase 1 data trust: every road export traces to its evidence, the historical release rebuilds from committed inputs, published data is not
// described as staged, the kinds of gap are named, and the CI check and the README list every build step.
//
//   node --test test/data_trust.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256, parseCsv } = require('../scripts/lib/release_utils');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));

test('2023 and 2024 district and zone exports carry source URL, checksum, table and page on every row, in JSON and CSV, and the manifest says where', () => {
  for (const y of [2023, 2024]) {
    const dist = json('data/releases/' + y + '/district_road_safety.json'), zones = json('data/releases/' + y + '/crash_prone_zones.json'), man = json('data/releases/' + y + '/manifest.json');
    assert.ok(dist.length === 15 && dist.every(r => /^https:\/\/traffic\.delhipolice\.gov\.in\/delhi-crash-report-/.test(r.source_url) && /^[0-9a-f]{64}$/.test(r.source_sha256) && /^Table 6\.31, PDF page \d+$/.test(r.zone_counts_source) && /Tables 6\.13 to 6\.27/.test(r.persons_source)), y + ' district rows');
    assert.ok(zones.length > 90 && zones.every(r => /^[0-9a-f]{64}$/.test(r.source_sha256) && r.source_table === 'Table 6.29' && Number.isInteger(r.source_pdf_page) && r.source_url), y + ' zone rows');
    const src = man.sources.find(s => s.id === 'delhi_crash_report_' + y);
    assert.equal(src.sha256, dist[0].source_sha256);
    assert.ok(src.zoneListPdfPage && src.zoneCountsPdfPage && src.personsPdfPages && /not re-downloaded/.test(src.hashNote));
    for (const f of ['district_road_safety.csv', 'crash_prone_zones.csv']) {
      const csv = parseCsv(read('data/releases/' + y + '/' + f));
      assert.ok(csv.columns.includes('source_url') && csv.columns.includes('source_sha256'), f);
      assert.ok(csv.rows.every(r => r.source_sha256.length === 64), f + ' rows');
    }
  }
  assert.equal(json('data/releases/2024/district_road_safety.json')[0].zone_counts_source, 'Table 6.31, PDF page 117');
  assert.equal(json('data/releases/2023/district_road_safety.json')[0].zone_counts_source, 'Table 6.31, PDF page 125');
});

test('the 2011 to 2015 release rebuilds from committed inputs: hashes match, sources are listed without local paths, and the builder needs no argument', () => {
  const D = 'data/inputs/road_history_2011_2015/', man = json('data/releases/road_zones_roads_2011_2015/manifest.json');
  assert.ok(man.inputPackages.length >= 12);
  for (const f of man.inputPackages) assert.equal(f.sha256, sha256(path.join(ROOT, D + f.file)), f.file);
  const sources = json(D + 'sources.json');
  assert.ok(sources.documents.length >= 4 && sources.documents.every(d => /^https:\/\//.test(d.url) && /^[0-9a-f]{64}$/.test(d.sha256) && d.id));
  assert.match(sources.purpose, /A file whose hash differs is a different file/);
  for (const f of fs.readdirSync(path.join(ROOT, D), { recursive: true })) {
    const p = path.join(ROOT, D, f);
    if (fs.statSync(p).isFile() && /\.(json|md)$/.test(f)) assert.ok(!/[A-Za-z]:\\|\/Users\/|\/home\//.test(fs.readFileSync(p, 'utf8')), 'no machine-specific path in ' + f);
  }
  const builder = read('scripts/build_road_history_2011_2015.js');
  assert.ok(builder.includes("data', 'inputs', 'road_history_2011_2015'") && !/process\.exit\(1\)/.test(builder), 'defaults to the committed inputs');
  assert.ok(read('package.json').includes('"build:road-history"'));
});

test('published road data is not described as staged; only the staged_2014 files are', () => {
  assert.equal(json('data/releases/road_zones_roads_2016_2021/manifest.json').status, 'production');
  assert.equal(json('data/releases/road_zones_roads_2011_2015/manifest.json').status, 'production');
  const r1621 = read('data/releases/road_zones_roads_2016_2021/README.md');
  assert.ok(!/not wired into the page/.test(r1621) && /Status: published/.test(r1621));
  assert.ok(/Only the files under `staged_2014\/` are staged/.test(read('data/releases/road_zones_roads_2011_2015/README.md')));
  assert.ok(!/digitized, reconciled, staged/.test(read('data/staged/road_districts_2016_2020/FINDINGS.md')));
  const status = Object.fromEntries(json('data/series_status.json').series.map(s => [s.id, s.status]));
  for (const id of ['crash_zones_roads_2016_2021', 'crash_zones_roads_2011_2015', 'traffic_districts_2016_2020', 'road_crash_report_2022', 'road_enforcement_2019_2022']) assert.equal(status[id], 'production', id);
});

test('gaps are named by cause: not printed, not extracted, source not found, not matched', () => {
  const cov = read('docs/COVERAGE.md');
  for (const k of ['**Not printed**', '**Not extracted**', '**Source not found**', '**Not matched**']) assert.ok(cov.includes(k), k);
  assert.match(cov, /Delhi-wide theft for 2016 to 2020|Theft, robbery, burglary for 2016 to 2020: not extracted/);
  assert.match(cov, /zone lists for 2011 and 2012: source not found/);
  const lim = read('docs/LIMITATIONS.md');
  assert.match(lim, /Not extracted \(source exists\)/);
  assert.match(lim, /Source not found: named zones for 2011 and 2012/);
});

test('the CI reproducibility check covers every tracked file, runs every build step the README lists, and the README lists them all', () => {
  const ci = read('.github/workflows/js-build-test.yml'), readme = read('README.md');
  const steps = [...ci.matchAll(/- run: (npm [^\n]+)/g)].map(m => m[1]);
  for (const s of ['npm test', 'npm run build', 'npm run build:site', 'npm run build:profiles', 'npm run build:interactive-map', 'npm run build:road-history']) {
    assert.ok(steps.includes(s), 'CI runs ' + s);
    assert.ok(readme.includes(s + '\n'), 'README lists ' + s);
  }
  const check = ci.slice(ci.indexOf('Verify generated output is reproducible'));
  assert.ok(/git diff --exit-code --stat \|\|/.test(check) && !/-- delhi_safety_dashboard\.html/.test(check), 'compares every tracked file, not a fixed list');
  assert.ok(/git ls-files --others --exclude-standard/.test(check), 'also reports new untracked generated files');
});
