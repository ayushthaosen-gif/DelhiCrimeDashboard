// Separate historical panel. Never reconstruct current districts or sum offence heads.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { toCsv } = require('./lib/release_utils');
const ROOT = path.resolve(__dirname, '..');
const STAGE = 'data/staged/history_2011_2015/';
const DIR = 'data/releases/historical_2011_2015/';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (file, bytes) => { fs.mkdirSync(path.dirname(path.join(ROOT, file)), { recursive: true }); fs.writeFileSync(path.join(ROOT, file), bytes); };
const jsonBytes = value => JSON.stringify(value, null, 2) + '\n';
const FIELDS = ['theft', 'robbery', 'burglary_old_definition', 'criminal_trespass_burglary_revised_definition', 'total_ipc', 'total_sll', 'total_crimes_against_women', 'total_crimes_in_which_women_was_victim'];

function selectedSummary(table) {
  const values = table.printed_summary.values;
  if (table.table === '1.14') return { theft: values[13], robbery: values[11], burglary_old_definition: values[12], total_ipc: values[29] };
  const named = Object.fromEntries(table.column_headers.map((name, i) => [name, values[i]]).filter(([name]) => name !== null));
  if (table.table === 'ipc') return { theft: named.Theft, robbery: named.Robbery, criminal_trespass_burglary_revised_definition: named['Criminal Trespass/Burglary'], total_ipc: named['Total Cognizable IPC crimes'] };
  if (table.table === 'sll') return { total_sll: named['Total Cognizable SLL crimes'] };
  return { total_crimes_against_women: named['Total Crimes against Women'], total_crimes_in_which_women_was_victim: named['Total Crimes in which Women was Victim'] };
}

function countColumns(table) {
  return table.column_headers.flatMap((header, index) => header !== null && (table.table === '1.14' || index >= 3) ? [{ header, index }] : []);
}

function build() {
  const staging = read(STAGE + 'manifest.json');
  const registry = read(STAGE + 'inputs/sources.json');
  const inputFiles = staging.files.filter(f => /^generated\/ncrb_/.test(f.path));
  assert.equal(inputFiles.length, 9, 'Require all original-year IPC and later SLL/women tables');
  const tables = inputFiles.map(file => {
    const bytes = fs.readFileSync(path.join(ROOT, STAGE + file.path));
    assert.equal(digest(bytes), file.sha256, file.path + ': staged extraction changed; rebuild its manifest');
    const table = JSON.parse(bytes);
    const source = registry.sources.find(s => s.path === table.source);
    assert.ok(source && source.role === 'primary_original_year_district_table');
    assert.equal(digest(fs.readFileSync(path.join(ROOT, STAGE + source.path))), source.sha256);
    assert.equal(table.geography_mapping, null);
    return { table, file, source };
  });
  const citywide = [], districtCounts = [], citywideCounts = [], asPrintedSummaries = [];
  for (const year of [2011, 2012, 2013, 2014, 2015]) {
    const yearTables = tables.filter(t => t.table.reference_year === year);
    const ipc = yearTables.find(t => ['1.14', 'ipc'].includes(t.table.table)).table;
    const row = { reference_year: year, jurisdiction: 'Delhi UT', geography_scope: 'NCRB state/UT aggregate as printed; not a mega-city table', source_reporting_units: ipc.reporting_units.length, ...Object.fromEntries(FIELDS.map(f => [f, null])) };
    const nullReasons = {};
    for (const { table } of yearTables) Object.assign(row, selectedSummary(table));
    for (const field of FIELDS) if (row[field] === null) nullReasons[field] = field === 'burglary_old_definition' ? 'Earlier definition not supplied by revised 2014-2015 table.' : field === 'criminal_trespass_burglary_revised_definition' ? 'Revised head not supplied by 2011-2013 table; old burglary is separate.' : 'Aggregate not supplied by the selected original-year table; not inferred from overlapping components.';
    row.null_reasons = nullReasons;
    row.source_paths = yearTables.map(t => STAGE + t.table.source);
    row.definition_notes = registry.comparability_notes[String(year)];
    row.publication = registry.publication_evidence[String(year)];
    citywide.push(row);
    for (const { table, source } of yearTables) {
      asPrintedSummaries.push({ reference_year: year, jurisdiction: 'Delhi UT', table: table.table, source: STAGE + table.source, source_sha256: source.sha256, column_headers: table.column_headers, printed_summary: table.printed_summary });
      for (const { header, index } of countColumns(table)) {
        const value = table.printed_summary.values[index];
        assert.ok(value === null || Number.isInteger(value) && value >= 0, header);
        // Printed PDF columns 1/2 are serial and district; its 30 offence columns are 3–32.
        const common = { reference_year: year, table: table.table, offence_label_as_printed: header, source_column: index + (table.table === '1.14' ? 3 : 1), unit: 'registered cases; counts, not rates', source_path: STAGE + table.source, source_sha256: source.sha256 };
        citywideCounts.push({ ...common, jurisdiction: 'Delhi UT', summary_label_as_printed: table.printed_summary.reporting_unit_label, cases: value });
        for (const unit of table.reporting_units) {
          assert.ok(unit.values[index] === null || Number.isInteger(unit.values[index]) && unit.values[index] >= 0);
          districtCounts.push({ ...common, reporting_unit_label_as_printed: unit.reporting_unit_label, source_serial: unit.source_serial, source_row: unit.source_row ?? null, source_pdf_pages: unit.source_pdf_pages?.join(';') ?? null, source_printed_pages: unit.source_printed_pages?.join(';') ?? null, cases: unit.values[index], current_district_id: null });
        }
      }
    }
  }
  const flatCity = citywide.map(({ null_reasons, source_paths, definition_notes, publication, ...row }) => ({ ...row, null_reasons: jsonBytes(null_reasons).trim(), source_paths: source_paths.join(';'), definition_notes: definition_notes.join(' '), publication_date: publication.publication_date, publication_date_basis: publication.basis }));
  const products = new Map([
    ['citywide_crime.json', jsonBytes(citywide)],
    ['citywide_crime.csv', toCsv(Object.keys(flatCity[0]), flatCity)],
    ['citywide_totals_as_printed.json', jsonBytes(asPrintedSummaries)],
    ['citywide_offence_counts_as_printed.csv', toCsv(Object.keys(citywideCounts[0]), citywideCounts)],
    ['district_offence_counts_as_printed.csv', toCsv(Object.keys(districtCounts[0]), districtCounts)],
    ['availability_comparability.json', fs.readFileSync(path.join(ROOT, STAGE + 'generated/availability_comparability.json'))]
  ]);
  for (const { file } of tables) products.set('as_printed/' + path.basename(file.path), fs.readFileSync(path.join(ROOT, STAGE + file.path)));
  const sources = tables.map(({ source }) => ({ ...source, path: STAGE + source.path }));
  const manifest = {
    schemaVersion: '1.0.0', title: 'Delhi NCRB historical panel, 2011 to 2015', status: 'production', productionReady: true, dashboardIntegrated: true,
    referenceYears: [2011, 2012, 2013, 2014, 2015], generatedBy: 'scripts/build_historical_crime_release.js', generatedAt: null,
    geography: 'Original Delhi UT reporting units, including specialised units: 17, 17, 18, 19, 19. Delhi UT printed summaries are separate, not another district.',
    districtMapping: null, joinKey: 'reference_year + source_path + source row/serial + source_column; labels are not timeless geographic identifiers',
    unit: 'Registered cases; counts, not rates. Not estimates of underlying prevalence.',
    nullPolicy: 'Source blanks/dashes and missing aggregates remain null (empty CSV cells); never coerce null to zero or allocate totals among later districts.',
    offencePolicy: 'Preserve original offence headers and source column positions. Rape/theft/kidnapping subheads and women categories overlap; do not sum all columns or add women totals to IPC/SLL.',
    comparability: registry.comparability_notes, publicationEvidence: registry.publication_evidence,
    citywidePolicy: 'Select Delhi UT TOTAL/Total District(s) as printed, not a sum of selected territorial districts and not the distinct NCRB mega-city geography.',
    sourceEditions: 'The 2011-2013 PDF headers are readable transcriptions with sections, as declared by the extraction. The full PDFs remain authoritative. Workbook headers/cells and all source rows are retained in as_printed/.',
    extensionPolicy: 'Separate historical panel; no append to the 2016-2024 current-district dashboard. Even identical labels or section numbers do not prove constant boundaries or definitions.',
    distributionStatus: 'Counts are published on the dashboard as printed. Direct-source redistribution terms are not established, and no new licence is granted by this compilation.',
    reuseTerms: registry.reuse_terms.filter(t => t.id === 'ncrb'), sources,
    inputs: inputFiles.map(f => ({ path: STAGE + f.path, sha256: f.sha256 })),
    evidenceInputs: ['inputs/sources.json', 'manifest.json'].map(file => ({ path: STAGE + file, sha256: digest(fs.readFileSync(path.join(ROOT, STAGE + file))) })),
    coverage: { citywideYears: citywide.length, sourceTables: tables.length, originalUnitRowsAcrossTables: tables.reduce((n, t) => n + t.table.reporting_units.length, 0), districtOffenceRows: districtCounts.length, citywideOffenceRows: citywideCounts.length },
    files: [...products].map(([file, content]) => { const bytes = Buffer.from(content); return { path: file, bytes: bytes.length, sha256: digest(bytes) }; })
  };
  for (const [file, bytes] of products) write(DIR + file, bytes);
  write(DIR + 'manifest.json', jsonBytes(manifest));
  write(DIR + '.gitattributes', '** -text\n');
  write(DIR + 'README.md', '# Delhi NCRB historical panel: 2011 to 2015\n\n**Production, as a separate historical panel shown on [historical_crime.html](../../../historical_crime.html); not merged into the 2016-2024 district series.** Original geography and offence definitions are retained. Start with [manifest.json](manifest.json).\n\n- [citywide_crime.csv](citywide_crime.csv) / [JSON](citywide_crime.json): five Delhi UT rows, selected original measures, explicit null reasons and source/publication evidence. Delhi UT is not a mega-city table.\n- [citywide_totals_as_printed.json](citywide_totals_as_printed.json) and [all offence counts](citywide_offence_counts_as_printed.csv): all original summary columns, stored separately from district rows.\n- [district_offence_counts_as_printed.csv](district_offence_counts_as_printed.csv): original units, offence heads and source positions. Never sum overlapping categories.\n- `as_printed/`: nine source-faithful Delhi table extracts, including printed summaries and auxiliary workbook cells.\n- [availability_comparability.json](availability_comparability.json): year-specific geography, definitions and gaps.\n\nDistrict geography is 17, 17, 18, 19 and 19 reporting units for 2011–2015, including specialised units. No current 15-district allocation is supplied. The 2013 legal-definition changes and 2014 revised reporting format/women basket break comparisons; early SLL/women aggregates remain null. Burglary and revised Criminal Trespass/Burglary are separate columns. Counts are registered cases, not rates or prevalence. See [the research report](../../staged/history_2011_2015/AVAILABILITY_AND_COMPARABILITY.md) for source quality findings and exact publication-date gaps.\n\nRegenerate offline with `node scripts/build_historical_crime_release.js`, after rebuilding/checking extraction with `python tools/history_2011_2015/build.py --check`. The normal `npm run build:releases` also regenerates this staged panel without adding it to the production year list. Review original-source reuse terms before public redistribution.\n');
  return { id: 'ncrb_historical_2011_2015', referenceYears: manifest.referenceYears, status: 'production', path: 'historical_2011_2015/manifest.json', productionReady: true, dashboardIntegrated: true };
}
if (require.main === module) console.log(build());
module.exports = { build, selectedSummary, countColumns };
