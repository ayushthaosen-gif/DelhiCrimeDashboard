const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { canonicalBytes, sha256, canonicalSize, parseCsv } = require('./lib/release_utils');
const { RULE_VERSION, disposition, sourceIdentity, coverageMatrix } = require('./lib/irad_release_logic');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'data/derived/irad_monthly/';
const METADATA_DATE = '2026-10-19'; // Human-maintained release metadata date; never the build time.
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const write = (file, content) => { fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true }); fs.writeFileSync(path.join(ROOT, file), content); };
const json = (file, value) => write(file, JSON.stringify(value, null, 2) + '\n');
function build() {
  const names = { month_wise: 'irad_monthly_by_district.csv', station: 'irad_station_by_period.csv' };
  const tables = Object.fromEntries(Object.entries(names).map(([type, name]) => [type, parseCsv(canonicalBytes(path.join(ROOT, BASE + name)).toString())]));
  const inventory = read(BASE + 'manifest.json').files, issues = read(BASE + 'issues.json'), links = read(BASE + 'source_links.json');
  const inputPaths = [...Object.values(names).map(name => BASE + name), BASE + 'manifest.json', BASE + 'issues.json', BASE + 'source_links.json', 'data/reference/irad_known_issues.json'];
  const inputs = inputPaths.map(file => ({ path: file, sha256: sha256(path.join(ROOT, file)), selectionRuleVersion: RULE_VERSION }));
  const summary = {}, dispositions = {};
  for (const [type, table] of Object.entries(tables)) {
    sourceIdentity(table.rows, inventory, links.files);
    dispositions[type] = table.rows.map((r, i) => disposition(r, type, `${names[type]} row ${i + 2}`));
    const counts = {};
    for (const key of dispositions[type]) counts[key] = (counts[key] || 0) + 1;
    assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), table.rows.length);
    summary[type] = { inputRows: table.rows.length, counts };
  }
  assert.deepEqual(summary.month_wise.counts, { release_2025: 60, historical_single_year: 231, release_2026: 5 });
  assert.deepEqual(summary.station.counts, { multi_year_window: 72, undated_no_year: 23, release_2025: 603, historical_single_year: 348, release_2026: 229 });
  // Keep excluded rows once, globally, with source row identity and unaltered values.
  const excludedRows = Object.fromEntries(Object.entries(tables).map(([type, table]) => [type, table.rows.flatMap((row, i) => dispositions[type][i].startsWith('release_') ? [] : [{ sourceRow: i + 2, disposition: dispositions[type][i], row }])]));
  json('data/releases/irad_dispositions.json', { schemaVersion: '1.0.0', generatedAt: null, releaseMetadataDate: METADATA_DATE, selectionRuleVersion: RULE_VERSION, derivedFrom: inputs, dispositionSummary: summary, excludedRows });
  const stray = inventory.filter(item => item.out_of_range_months && Object.keys(item.out_of_range_months).length);
  const outliers = stray.flatMap(item => Object.values(item.out_of_range_months));
  const known = [{ id: 'north-east-historical-stray-months', summary: 'Historical reporting-date tables include out-of-period months in printed totals; retained monthly CSV rows exclude them.', affectedSources: stray.map(item => item.file), affectedPeriods: [...new Set(stray.map(item => item.report_year || item.period_from?.slice(0, 4)))].filter(Boolean).sort(), counts: { rows: outliers.length, accidents: outliers.reduce((n, r) => n + Number(r.total_accidents || 0), 0), reports: stray.length }, printedTotals: stray.map(item => ({ sourceFile: item.file, printedTotal: item.printed_total })), releaseYears: [] }];
  for (const [index, conflict] of issues.conflicts.entries()) known.push({ id: `collection-conflict-${index + 1}`, summary: 'Conflicting source values retained at collection level.', affectedSources: conflict.values.map(item => item.file), affectedPeriods: [conflict.period], details: conflict, releaseYears: [Number(conflict.period.slice(0, 4))] });
  for (const issue of issues.listed_under_wrong_district) {
    const periods = issue.period.filter(Boolean);
    const sourceRows = [...tables.month_wise.rows, ...tables.station.rows].filter(r => r.source_file === issue.file);
    const releaseYears = [2025, 2026].filter(year => sourceRows.some(r => disposition(r, 'police_station' in r ? 'station' : 'month_wise') === `release_${year}`));
    known.push({ id: 'collection-listing-' + issue.file.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase(), summary: `Listed under ${issue.listed_on}; report header says ${issue.report_says}. Source rows retain the report header district.`, affectedSources: [issue.file], affectedPeriods: periods.length ? periods : ['undated or year-only; see source rows'], details: issue, releaseYears });
  }
  const issueInput = read('data/reference/irad_known_issues.json');
  for (const item of issueInput.issues) {
    const annual = inventory.find(source => source.file === item.annualSource);
    assert.ok(annual?.printed_total, item.annualSource + ': missing printed_total');
    const rows = tables.station.rows.filter(r => r.district === item.district && r.period_from.startsWith('2025-') && r.period_from.slice(0, 7) === r.period_to.slice(0, 7));
    const monthlyTotals = Object.fromEntries(['total_accidents', 'fatal', 'killed', 'pending', 'completed'].map(key => [key, rows.reduce((n, r) => n + Number(r[key] || 0), 0)]));
    known.push({ id: item.id, summary: item.summary, affectedSources: [item.annualSource, ...new Set(rows.map(r => r.source_file))], affectedPeriods: ['2025'], printedAnnual: annual.printed_total, monthlyStationTotals: monthlyTotals, availableMonthlyPeriods: [...new Set(rows.map(r => r.period_from.slice(0, 7)))].sort(), explanatoryEvidence: 'docs/IRAD_DISTRICT_REPORTS.md', releaseYears: [2025] });
  }
  const districts = [...new Set([...tables.month_wise.rows, ...tables.station.rows].map(r => r.district))].sort();
  for (const year of [2025, 2026]) {
    const dir = `data/releases/${year}/irad/`, selected = {}, files = [], schemas = {};
    for (const [type, table] of Object.entries(tables)) {
      const indices = dispositions[type].flatMap((d, i) => d === `release_${year}` ? [i] : []);
      selected[type] = indices.map(i => table.rows[i]);
      const file = names[type].replace('.csv', `_${year}.csv`);
      write(dir + file, [table.header, ...indices.map(i => table.records[i])].join('\n') + '\n');
      schemas[type] = table.columns;
      files.push({ path: file, datasetId: `delhi_irad_${type}_${year}`, mediaType: 'text/csv', sha256: sha256(path.join(ROOT, dir + file)), bytes: canonicalSize(path.join(ROOT, dir + file)), rows: indices.length, derivedFrom: inputs.filter(i => i.path === BASE + names[type]) });
    }
    const contributed = new Set([...selected.month_wise, ...selected.station].map(r => r.source_file));
    // Include collection-level conflict/exclusion evidence as evidence_only; never imply that
    // all collected PDFs supply rows in this release.
    const sources = inventory.map(item => {
      const link = links.files[item.file];
      assert.ok(link && link.sha256 === item.sha256, `${item.file}: missing or mismatched source metadata`);
      return { filename: item.file, sha256: item.sha256, publicPdfUrl: link.public_url, landingPageUrl: link.page_url, linkText: link.link_text, verifiedOn: link.retrieved_on, role: contributed.has(item.file) ? 'contributes_rows' : 'evidence_only' };
    });
    const coverage = { monthlyRows: selected.month_wise.length, stationRows: selected.station.length, districts: new Set([...selected.month_wise, ...selected.station].map(r => r.district)).size, perTable: Object.fromEntries(Object.entries(selected).map(([type, rows]) => [type, { rows: rows.length, districts: new Set(rows.map(r => r.district)).size }])) };
    const manifest = { schemaVersion: '1.0.0', releaseYear: year, jurisdiction: 'Delhi', generatedBy: 'scripts/build_irad_releases.js', generatedAt: null, releaseMetadataDate: METADATA_DATE, releaseStatus: year === 2025 ? 'staged' : 'provisional', temporalType: year === 2025 ? 'multi_period' : 'year_to_date', productionReady: false, coverageComplete: false, dashboardIntegrated: false, seriesId: year === 2025 ? 'irad_2025_release' : 'irad_2026_year_to_date', nullPolicy: 'Blank remains null/unknown, never zero. Blank scope is unspecified.', comparability: 'iRAD is a different series from the Delhi Traffic Police crash report and NCRB. Reporting districts are not the 15 police districts. Coverage differs by district. Annual/cumulative station windows overlap monthly windows and are not twelve independent observations.' + (year === 2026 ? ' The 2026 release is a partial year; never compare with a full year.' : ''), sourceLinkCaveat: links.note, coverage, schemas, files, derivedFrom: inputs, sources, knownIssues: known.map(({ releaseYears, ...item }) => ({ ...item, relevantToThisRelease: releaseYears.includes(year) })), coverageMatrix: coverageMatrix(year, selected.month_wise, selected.station, districts), dispositionRef: 'data/releases/irad_dispositions.json' };
    json(dir + 'manifest.json', manifest);
    write(dir + 'README.md', `# Delhi iRAD ${year}: ${manifest.releaseStatus}\n\nGenerated by scripts/build_irad_releases.js. Read manifest.json for authoritative coverage, source identity, issues and checksums.\n\n${manifest.comparability}\n\n${manifest.nullPolicy} Coverage is incomplete; productionReady, coverageComplete and dashboardIntegrated are false.\n\nMonthly rows: ${coverage.monthlyRows}; station source-table rows: ${coverage.stationRows}; reporting districts: ${coverage.districts}. Rows include overlapping periods; do not sum across windows. Year-only reports contribute no covered months. Release metadata date: ${METADATA_DATE}; generatedAt is null. PDF generation and retrieval/verification dates are separate source dates.\n`);
  }
  console.log('Generated staged/provisional iRAD releases; dispositions: ' + JSON.stringify(summary));
}
if (require.main === module) build();
module.exports = { build };
