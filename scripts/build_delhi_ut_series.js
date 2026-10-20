// Delhi-wide crime series: the Delhi UT totals as NCRB prints them, collected independently of the district tables' sums.
//   2011-2015: the printed Delhi UT summaries already extracted into data/releases/historical_2011_2015/citywide_crime.json
//   2022-2024: the printed "Total Districts" row of the Delhi block in NCRB's district-wise tables
//              (data/staged/delhi_ut_series/printed_totals_2022_2024.json, from tools/delhi_ut_series/extract.py)
//   2016-2021: not collected yet. The district-level extract for those years deliberately omits totals and is never summed here.
// A blank or dash is null, never zero. Definitions are kept apart: the old burglary head, the revised criminal-trespass/burglary
// head and the later burglary definition are three different columns.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { toCsv } = require('./lib/release_utils');

const ROOT = path.resolve(__dirname, '..');
const DIR = 'data/releases/delhi_ut_series/';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const sha = file => {
  const bytes = fs.readFileSync(path.join(ROOT, file));
  // Text files hash with normalised line endings (like the other releases); binary workbooks hash their exact bytes.
  return crypto.createHash('sha256').update(/\.(json|csv|md)$/i.test(file) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes).digest('hex');
};

const COLUMNS = ['year', 'status', 'scope', 'reporting_units', 'offence_basis', 'theft', 'robbery', 'burglary_old_head', 'criminal_trespass_burglary_revised_head', 'burglary', 'total_ipc_bns', 'total_sll', 'total_crimes_against_women', 'total_crimes_in_which_women_was_victim', 'sources', 'note'];
const GAP_REASON = 'Not collected yet. The NCRB state/UT tables for this year are not archived in this repository, and the district-level extract for 2016-2021 omits totals on purpose, so no Delhi-wide figure is shown or computed.';

function basis(year) {
  if (year <= 2013) return 'IPC, NCRB format before 2014';
  if (year <= 2015) return 'IPC, NCRB format revised in 2014';
  if (year <= 2023) return 'IPC';
  return 'BNS from 1 July 2024, with IPC';
}

function build() {
  const hist = read('data/releases/historical_2011_2015/citywide_crime.json');
  const printed = read('data/staged/delhi_ut_series/printed_totals_2022_2024.json');
  const histManifest = 'data/releases/historical_2011_2015/manifest.json';
  const rows = [];
  for (const r of hist) {
    assert.equal(r.jurisdiction, 'Delhi UT');
    rows.push({
      year: r.reference_year, status: 'printed', scope: 'Delhi UT summary as printed by NCRB; not a mega-city table and not a sum of districts',
      reporting_units: r.source_reporting_units, offence_basis: basis(r.reference_year),
      theft: r.theft, robbery: r.robbery, burglary_old_head: r.burglary_old_definition, criminal_trespass_burglary_revised_head: r.criminal_trespass_burglary_revised_definition, burglary: null,
      total_ipc_bns: r.total_ipc, total_sll: r.total_sll, total_crimes_against_women: r.total_crimes_against_women, total_crimes_in_which_women_was_victim: r.total_crimes_in_which_women_was_victim,
      sources: [histManifest], note: Object.values(r.null_reasons || {}).join(' ')
    });
  }
  for (let year = 2016; year <= 2021; year++) {
    rows.push({ year, status: 'not_collected', scope: 'Delhi UT', reporting_units: null, offence_basis: basis(year), theft: null, robbery: null, burglary_old_head: null, criminal_trespass_burglary_revised_head: null, burglary: null, total_ipc_bns: null, total_sll: null, total_crimes_against_women: null, total_crimes_in_which_women_was_victim: null, sources: [], note: GAP_REASON });
  }
  const checks = [];
  for (const y of printed.years) {
    const t = y.printedTotal;
    for (const m of Object.keys(t)) assert.equal(y.agreement[m], true, `${y.year} ${m}: printed total does not equal the sum of the printed unit rows`);
    for (const s of y.sources) assert.equal(sha(s.path), s.sha256, `${s.path} changed since extraction`);
    rows.push({
      year: y.year, status: 'printed', scope: 'Delhi UT: printed "Total Districts" row of the Delhi block, covering every reporting unit including specialised units; not a sum of the 15 districts',
      reporting_units: y.unitCount, offence_basis: basis(y.year),
      theft: t.theft, robbery: t.robbery, burglary_old_head: null, criminal_trespass_burglary_revised_head: null, burglary: t.burglary,
      total_ipc_bns: t.total_ipc_bns, total_sll: t.total_sll, total_crimes_against_women: t.total_crimes_against_women, total_crimes_in_which_women_was_victim: null,
      sources: y.sources.map(s => s.path), note: 'Total crimes against women is the IPC/BNS plus SLL total. The printed total equals the sum of the printed unit rows for every figure.'
    });
    // Cross-check against the separately built district release: the printed Delhi total minus the 15 territorial districts must equal the specialised units' printed rows.
    const districts = read(`data/releases/${y.year}/district_crime.json`);
    const territorial = new Set(districts.map(d => d.district));
    const map = { theft: 'theft', robbery: 'robbery', burglary: 'burglary', total_ipc_bns: 'total_ipc_bns', total_sll: 'total_sll', total_crimes_against_women: 'crime_against_women' };
    const reconciliation = {};
    for (const [measure, field] of Object.entries(map)) {
      const districtSum = districts.reduce((n, d) => n + d[field], 0);
      const specialised = Object.entries(y.units).filter(([label]) => !territorial.has(label)).reduce((n, [, v]) => n + v[measure], 0);
      assert.equal(t[measure] - districtSum, specialised, `${y.year} ${measure}: printed Delhi total minus the 15 districts must equal the specialised units`);
      reconciliation[measure] = { printedDelhiTotal: t[measure], sumOfFifteenDistricts: districtSum, specialisedUnits: specialised };
    }
    checks.push({ year: y.year, reportingUnits: y.unitCount, printedTotalEqualsSumOfPrintedUnits: true, specialisedUnits: Object.keys(y.units).filter(label => !territorial.has(label)), reconciliation, columns: y.printedTotalRow });
  }
  rows.sort((a, b) => a.year - b.year);
  const years = rows.map(r => r.year);
  assert.deepEqual(years, [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024]);

  const csvRows = rows.map(r => ({ ...r, sources: r.sources.join(' | ') }));
  const files = {
    'delhi_ut_crime.json': JSON.stringify(rows, null, 2) + '\n',
    'delhi_ut_crime.csv': toCsv(COLUMNS, csvRows)
  };
  fs.mkdirSync(path.join(ROOT, DIR), { recursive: true });
  for (const [file, text] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, DIR + file), text);
  const manifest = {
    schemaVersion: '1.0.0', title: 'Delhi-wide registered crime, as NCRB prints the Delhi UT totals', status: 'production', generatedBy: 'scripts/build_delhi_ut_series.js',
    coverage: { printedYears: rows.filter(r => r.status === 'printed').map(r => r.year), notCollectedYears: rows.filter(r => r.status === 'not_collected').map(r => r.year) },
    geography: 'Delhi UT as a whole. Independent of district boundaries, so the district splits of 2016, 2017 and 2019 do not affect it. It includes every reporting unit NCRB lists for Delhi (territorial districts plus specialised units such as Metro, Railway and Crime Branch), so it is higher than the sum of the territorial districts.',
    unit: 'Registered cases; counts, not rates.',
    nullPolicy: 'A blank or dash in a source is null, never zero. Missing years are rows with status not_collected, never filled.',
    definitions: [
      'Burglary is three separate columns: the original head (2011-2013), the revised criminal-trespass/burglary head (2014-2015) and the later burglary definition (2022-2024). They are not one series.',
      'NCRB changed its reporting format and offence groupings in 2014, so 2013 and 2014 are not comparable; the 2024 tables follow the BNS (in force from 1 July 2024), so 2023 to 2024 is a caution.',
      'Special and Local Laws and crimes-against-women totals are not available for 2011-2013.',
      'Total crimes against women is the head printed in each source: the original-year table for 2014-2015 and the IPC/BNS plus SLL total in the district table from 2022. Check the original table before comparing the two ranges. The separate printed "crimes in which women was victim" head is kept in its own column for 2014-2015.'
    ],
    comparability: 'Read data/continuity.json: use compareYears with the district "Delhi UT", which skips district-boundary breaks and applies definition breaks and the missing years.',
    sources: [
      { path: histManifest, role: '2011-2015 printed Delhi UT summaries (NCRB Crime in India, original-year tables)', sha256: sha(histManifest) },
      ...printed.years.flatMap(y => y.sources.map(s => ({ path: s.path, role: `${y.year} ${s.table} district-wise table, printed Total Districts row`, sha256: s.sha256 }))),
      { path: 'data/staged/delhi_ut_series/printed_totals_2022_2024.json', role: 'extraction record with the column headers and the unit-sum agreement check', sha256: sha('data/staged/delhi_ut_series/printed_totals_2022_2024.json') }
    ],
    verification: checks,
    externalCheck: 'The 2022 total of 300,429 IPC crimes matches the Delhi row of the NCRB Crime in India 2022 state/UT table as quoted in a web search on 2026-10-20; this is a spot check, not a full comparison.',
    files: Object.entries(files).map(([file, text]) => ({ path: file, bytes: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') }))
  };
  fs.writeFileSync(path.join(ROOT, DIR + 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, DIR + 'README.md'), `# Delhi-wide registered crime (Delhi UT totals as printed)

**Production.** Delhi UT totals exactly as NCRB prints them, independent of district boundaries. Start with [manifest.json](manifest.json).

- [delhi_ut_crime.csv](delhi_ut_crime.csv) / [JSON](delhi_ut_crime.json): one row per year, 2011 to 2024.
- 2011-2015 come from the printed Delhi UT summaries; 2022-2024 from the printed "Total Districts" row of NCRB's district-wise tables, which equals the sum of the printed unit rows for every figure.
- **2016-2021 are rows with status \`not_collected\`.** They are gaps, not zeros, and are never filled by summing districts.
- Burglary is three separate columns because the definition changed. 2013 to 2014 is not comparable and 2023 to 2024 is a caution; see [data/continuity.json](../../continuity.json).

Regenerate with \`python tools/delhi_ut_series/extract.py\` then \`node scripts/build_delhi_ut_series.js\` (also part of \`npm run build:releases\`).
`);
  return { id: 'ncrb_delhi_ut_totals', status: 'production', path: 'delhi_ut_series/manifest.json', printedYears: manifest.coverage.printedYears };
}
if (require.main === module) console.log(build());
module.exports = { build };
