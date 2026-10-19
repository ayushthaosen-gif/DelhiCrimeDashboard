const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalBytes, canonicalSize, sha256, parseCsv } = require('../scripts/lib/release_utils');
const { disposition, coverageMatrix, sourceIdentity } = require('../scripts/lib/irad_release_logic');
const ROOT = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const csv = file => parseCsv(canonicalBytes(path.join(ROOT, file)).toString());
const fixture = require('./fixtures/irad_logic.json');
test('date validation and mutually exclusive dispositions include inferred, undated and multiyear rows', () => {
  for (const row of fixture.station) {
    if (row.error) assert.throws(() => disposition(row, 'station', 'fixture row 2'), new RegExp(`fixture row 2:.*${row.error}`));
    else assert.equal(disposition(row, 'station'), row.expected);
  }
  assert.throws(() => disposition({ ...fixture.monthly[0], month: '13' }, 'month_wise'), /year\/month/);
  assert.throws(() => disposition({ ...fixture.monthly[0], year: '2026' }, 'month_wise'), /inconsistent/);
});
test('coverage uses dated observations, retains partial endpoints and distinguishes windows', () => {
  const c = coverageMatrix(2025, fixture.monthly, [fixture.annual], ['Central'])[0];
  assert.deepEqual(c.month_wise.coveredMonths, ['2025-01']);
  assert.deepEqual(c.month_wise.partialEndpoints, ['2025-12']);
  assert.equal(c.month_wise.gaps.length, 10);
  assert.equal(c.month_wise.partial, true);
  assert.equal(c.month_wise.reports[0].scope, 'unspecified');
  assert.equal(c.month_wise.reports[1].scope, 'fir_registered_only');
  assert.deepEqual(c.station.coveredMonths, []);
  assert.equal(c.station.windows[0].kind, 'annual');
  const inferred = coverageMatrix(2025, [{ ...fixture.monthly[1], period_inferred: 'true' }], [], ['Central'])[0];
  assert.deepEqual(inferred.month_wise.coveredMonths, []);
  const months = Array.from({ length: 12 }, (_, i) => ({ ...fixture.monthly[0], month: String(i + 1), report_period_to: '2025-12-31' }));
  months[0].date_basis = 'reporting';
  assert.equal(coverageMatrix(2025, months, [], ['Central'])[0].month_wise.partial, true);
  months[0].date_basis = 'accident'; months[0].scope = 'fir_registered_only';
  assert.equal(coverageMatrix(2025, months, [], ['Central'])[0].month_wise.partial, true);
});
test('source filename and SHA-256 mismatches fail explicitly', () => {
  const rows = [{ source_file: 'a.pdf', sha256: 'abc' }];
  assert.throws(() => sourceIdentity(rows, [], {}), /missing metadata.*a.pdf/);
  assert.throws(() => sourceIdentity(rows, [{ file: 'a.pdf', sha256: 'bad' }], { 'a.pdf': { sha256: 'abc' } }), /SHA-256 mismatch.*a.pdf/);
});
test('real releases are exact ordered multiset subsets, with unchanged columns and raw records', () => {
  for (const [type, name, expected] of [['month_wise', 'irad_monthly_by_district', [60, 5]], ['station', 'irad_station_by_period', [603, 229]]]) {
    const source = csv(`data/derived/irad_monthly/${name}.csv`);
    for (const [i, year] of [2025, 2026].entries()) {
      const actual = csv(`data/releases/${year}/irad/${name}_${year}.csv`);
      assert.equal(actual.header, source.header);
      assert.deepEqual(actual.records, source.records.filter((r, j) => disposition(source.rows[j], type) === `release_${year}`));
      assert.equal(actual.rows.length, expected[i]);
    }
  }
  const d = json('data/releases/irad_dispositions.json');
  assert.deepEqual(d.dispositionSummary.month_wise, { inputRows: 296, counts: { release_2025: 60, historical_single_year: 231, release_2026: 5 } });
  assert.deepEqual(d.dispositionSummary.station, { inputRows: 1275, counts: { multi_year_window: 72, undated_no_year: 23, release_2025: 603, historical_single_year: 348, release_2026: 229 } });
  for (const [type, summary] of Object.entries(d.dispositionSummary)) {
    assert.equal(Object.values(summary.counts).reduce((a, b) => a + b), summary.inputRows);
    assert.ok(d.excludedRows[type].every(r => !r.disposition.startsWith('release_')));
  }
});
test('manifest schema, coverage, issue provenance, input and output hashes and statuses are complete', () => {
  const collection = json('data/derived/irad_monthly/manifest.json').files;
  const issues = json('data/derived/irad_monthly/issues.json');
  const links = json('data/derived/irad_monthly/source_links.json').files;
  const mandatory = ['schemaVersion','releaseYear','jurisdiction','generatedBy','generatedAt','releaseMetadataDate','releaseStatus','temporalType','productionReady','coverageComplete','dashboardIntegrated','seriesId','nullPolicy','comparability','coverage','schemas','files','derivedFrom','sources','knownIssues','coverageMatrix','dispositionRef'];
  for (const year of [2025, 2026]) {
    const dir = `data/releases/${year}/irad/`, m = json(dir + 'manifest.json');
    for (const key of mandatory) assert.ok(key in m, key);
    assert.equal(m.schemaVersion, '1.0.0'); assert.equal(m.jurisdiction, 'Delhi');
    assert.equal(m.releaseYear, year); assert.equal(m.generatedAt, null);
    assert.equal(m.releaseMetadataDate, '2026-10-19');
    assert.equal(m.releaseStatus, year === 2025 ? 'staged' : 'provisional');
    assert.equal(m.temporalType, year === 2025 ? 'multi_period' : 'year_to_date');
    for (const key of ['productionReady', 'coverageComplete', 'dashboardIntegrated']) assert.equal(m[key], false);
    for (const input of m.derivedFrom) { assert.equal(sha256(path.join(ROOT, input.path)), input.sha256); assert.ok(input.selectionRuleVersion); }
    for (const f of m.files) {
      assert.equal(sha256(path.join(ROOT, dir + f.path)), f.sha256);
      assert.equal(canonicalSize(path.join(ROOT, dir + f.path)), f.bytes);
      assert.equal(csv(dir + f.path).rows.length, f.rows);
      for (const key of ['datasetId', 'mediaType', 'derivedFrom']) assert.ok(f[key]);
    }
    const monthly = csv(dir + `irad_monthly_by_district_${year}.csv`).rows, stations = csv(dir + `irad_station_by_period_${year}.csv`).rows;
    const districts = csv('data/derived/irad_monthly/irad_station_by_period.csv').rows.map(r => r.district);
    assert.deepEqual(m.coverageMatrix, coverageMatrix(year, monthly, stations, [...new Set(districts)].sort()));
    if (year === 2025) assert.ok(m.coverageMatrix.find(r => r.district === 'Central').month_wise.partialEndpoints.includes('2025-12'));
    else { assert.match(m.comparability, /never compare with a full year/i); assert.ok(m.coverageMatrix.every(r => r.month_wise.partial && r.station.partial)); }
    const relevantFiles = new Set([...monthly, ...stations].map(r => r.source_file));
    for (const source of m.sources) {
      const original = links[source.filename]; assert.equal(source.sha256, original.sha256);
      assert.equal(source.publicPdfUrl, original.public_url); assert.equal(source.landingPageUrl, original.page_url); assert.equal(source.verifiedOn, original.retrieved_on);
      assert.equal(source.role, relevantFiles.has(source.filename) ? 'contributes_rows' : 'evidence_only');
    }
    const stray = m.knownIssues.find(i => i.id === 'north-east-historical-stray-months');
    const reports = collection.filter(r => r.out_of_range_months && Object.keys(r.out_of_range_months).length);
    const dropped = reports.flatMap(r => Object.values(r.out_of_range_months));
    assert.deepEqual(stray.counts, { rows: dropped.length, reports: reports.length, accidents: dropped.reduce((n, r) => n + Number(r.total_accidents || 0), 0) });
    assert.deepEqual(stray.counts, { rows: 38, reports: 23, accidents: 71 }); assert.equal(stray.relevantToThisRelease, false);
    assert.deepEqual(m.knownIssues.find(i => i.id === 'collection-conflict-1').details, issues.conflicts[0]);
    assert.equal(m.knownIssues.filter(i => i.id.startsWith('collection-listing-')).length, issues.listed_under_wrong_district.length);
    const se = m.knownIssues.find(i => i.id === 'south-east-2025-annual-monthly-conflict');
    assert.equal(se.printedAnnual.total_accidents, 485); assert.equal(se.monthlyStationTotals.total_accidents, 486);
    assert.equal(se.printedAnnual.fatal, 118); assert.equal(se.monthlyStationTotals.fatal, 119);
    assert.equal(se.printedAnnual.killed, 123); assert.equal(se.monthlyStationTotals.killed, 124);
    assert.equal(se.relevantToThisRelease, year === 2025);
    const west = m.knownIssues.find(i => i.id === 'west-2025-annual-unreconciled');
    assert.equal(west.printedAnnual.total_accidents, 461); assert.equal(west.availableMonthlyPeriods.length, 8);
  }
});
test('index, npm orchestration and README status table describe staged releases consistently', () => {
  const index = json('data/releases/manifest.json'); assert.equal(index.years.length, 9); assert.equal(index.staged2025, '2025/README.md');
  assert.deepEqual(index.stagedReleases.map(r => r.year), [2025, 2026]);
  for (const r of index.stagedReleases) { assert.equal(r.productionReady, false); assert.equal(r.coverageComplete, false); assert.ok(fs.existsSync(path.join(ROOT, 'data/releases', r.path))); }
  const pkg = json('package.json');
  assert.equal(pkg.scripts['build:releases'], 'node scripts/build_all_releases.js');
  assert.ok(pkg.scripts['build:interactive-map'].endsWith(pkg.scripts['build:releases']));
  assert.ok(!pkg.scripts['build:interactive-map'].includes('build_yearly_releases.js'));
  const statuses = json('data/series_status.json').series;
  for (const [id, status, file] of [['irad_district_reports','staged','data/derived/irad_monthly/manifest.json'], ['irad_2025_release','staged','data/releases/2025/irad/manifest.json'], ['irad_2026_year_to_date','provisional','data/releases/2026/irad/manifest.json'], ['police_station_crosswalk','staged','data/reference/police_station_crosswalk.csv']]) {
    const entry = statuses.find(r => r.id === id); assert.equal(entry.status, status); assert.equal(entry.where, file);
    const line = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').split('\n').find(line => line.includes('`' + id + '`'));
    const cells = line.split('|').map(c => c.trim());
    assert.equal(cells.length, 7); assert.equal(cells[4], status);
  }
  assert.ok(fs.statSync(path.join(ROOT, 'README.md')).size < 12000);
});
test('protected production releases and all derived collection files equal the pinned baseline', () => {
  const baseline = require('./fixtures/phase1_protected_hashes.json');
  assert.equal(baseline.startingSha, '576c023895378f0bf93ba07ddefe2f0d6405813d');
  for (const [file, hash] of Object.entries(baseline.files)) assert.equal(sha256(path.join(ROOT, file)), hash, 'Protected file changed: ' + file);
});
