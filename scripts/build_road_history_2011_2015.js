// Assembles data/releases/road_zones_roads_2011_2015/ from the reviewed recovery packages (named zones 2013 to 2015, derived 2015 road
// groups, retrospective 2011 and 2012 road stretches). Not run in CI: the packages are not in the repository. The release it writes is
// committed and checked by validate.cjs and test/road_history_2011_2015.test.js.
//
//   node scripts/build_road_history_2011_2015.js <folder holding road_2011_2012_recovery, road_2013_2014_recovery, road_2014_2015> <audited 2014 supplement folder>
//
// 2014 comes only from road_2013_2014_recovery. The older road_2014_2015/named_zones_2014.json holds a name-only list with null counts,
// a different serial order and different spellings; it is never joined by serial and is not read here.

const fs = require('fs');
const path = require('path');
const { sha256, toCsv } = require('./lib/release_utils');

const src = process.argv[2];
const sup = process.argv[3];
if (!src || !sup) { console.error('usage: node scripts/build_road_history_2011_2015.js <package folder> <2014 supplement folder>'); process.exit(1); }
const OUT = path.join(__dirname, '..', 'data', 'releases', 'road_zones_roads_2011_2015');
const rd = f => JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
const inputs = [];
const input = f => { const p = path.join(src, f); inputs.push({ file: f, sha256: sha256(p) }); return rd(f); };

const z13 = input('road_2013_2014_recovery/named_zones_2013.json');
const z14 = input('road_2013_2014_recovery/named_zones_2014.json');
const z15 = input('road_2014_2015/named_zones_2015.json');
const r15 = input('road_2014_2015/roads_2015_derived_exact_labels.json');
const r11 = input('road_2011_2012_recovery/roads_2011_2012_retrospective.json');
const supIn = f => { const p = path.join(sup, f); inputs.push({ file: 'supplement_2014/' + f, sha256: sha256(p) }); return JSON.parse(fs.readFileSync(p, 'utf8')); };
const s14 = supIn('named_zones_2014.json'), roads14 = supIn('roads_selected_zones_2014_derived.json'), circles14 = supIn('circles_selected_zones_2014_derived.json');
const recon14 = supIn('list_reconciliation.json'), dist14 = supIn('traffic_districts_2014_retrospective.json'), str14 = supIn('road_stretches_2014_retrospective.json');
const val1314 = input('road_2013_2014_recovery/validation.json');
const val1415 = input('road_2014_2015/validation.json');
input('road_2013_2014_recovery/source_manifest.json');

const NAMED_COLUMNS = ['reference_year', 'serial', 'name_as_printed', 'road_as_printed', 'district_as_printed', 'circle_as_printed', 'simple_crashes', 'fatal_crashes', 'total_crashes', 'list_order', 'source_table', 'source_pdf_page', 'source_printed_page', 'source_url', 'source_sha256', 'scope', 'latitude', 'longitude', 'review_status'];
const nz = (r, extra) => Object.assign({
  reference_year: r.reference_year, serial: r.serial, name_as_printed: r.name_as_printed, road_as_printed: r.road_as_printed || null,
  district_as_printed: r.district_as_printed || null, circle_as_printed: r.circle_as_printed || null,
  simple_crashes: r.simple_crashes, fatal_crashes: r.fatal_crashes, total_crashes: r.total_crashes,
  list_order: r.list_order || 'as printed', source_table: r.source_table || null, source_pdf_page: r.source_pdf_page, source_printed_page: r.source_printed_page == null ? null : r.source_printed_page,
  source_url: r.source_url, source_sha256: r.source_sha256, scope: r.scope, latitude: null, longitude: null, review_status: r.review_status
}, extra || {});
// the audited supplement's 2014 table must be the one already used: same serials, names, counts and roads
const key14 = r => [r.serial, r.name_as_printed, r.simple_crashes, r.fatal_crashes, r.total_crashes, r.road_as_printed || null].join('|');
if (s14.length !== z14.length || s14.some((r, i) => key14(r) !== key14(z14[i]))) throw new Error('the audited 2014 table differs from the recovery 2014 table');
const named = [
  ...z13.map(r => nz(r, { source_table: 'PWD compilation, PDF pages 133-141' })),
  ...z14.map(r => nz(r, { source_table: 'PWD compilation, PDF pages 142-150' })),
  ...z15.map(r => nz(r))
];

const ROAD15_COLUMNS = ['reference_year', 'road_as_printed', 'crash_prone_zones', 'simple_crashes', 'fatal_crashes', 'total_crashes', 'derivation', 'source_serials', 'source_sha256', 'scope'];
const ROAD11_COLUMNS = ['reference_year', 'report_year', 'road_group_as_printed', 'road_as_printed', 'fatal_crashes', 'simple_crashes', 'noninjury_crashes', 'total_crashes', 'source_table', 'source_pdf_page', 'source_printed_page', 'source_url', 'source_sha256', 'scope', 'comparison_state', 'comparison_reason', 'latitude', 'longitude'];

// 2014 road groups: derived by exact printed label from the zone table; the empty-road group is kept in the file and left out of the page's top 12
const sha14 = z14[0].source_sha256;
const ROAD14_COLUMNS = ROAD15_COLUMNS;
const r14 = roads14.map(r => ({ reference_year: 2014, road_as_printed: r.label_as_printed, crash_prone_zones: r.zone_count, simple_crashes: r.simple_crashes, fatal_crashes: r.fatal_crashes, total_crashes: r.total_crashes, derivation: 'Calculated by exact printed road label from the 2014 zone table (PWD compilation); not a printed road-summary table. A blank road cell is kept as its own group with a null road.', source_serials: r.source_serials, source_sha256: sha14, scope: r.scope }));
const STRETCH14_COLUMNS = Object.keys(str14[0]);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(OUT, 'staged_2014'), { recursive: true });
const stage = (name, data, cols) => { fs.writeFileSync(path.join(OUT, 'staged_2014', name + '.json'), JSON.stringify(data, null, 2) + '\n'); fs.writeFileSync(path.join(OUT, 'staged_2014', name + '.csv'), toCsv(cols, data)); };
const write = (name, data) => fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + '\n');
write('named_zones_2013_2015.json', named);
fs.writeFileSync(path.join(OUT, 'named_zones_2013_2015.csv'), toCsv(NAMED_COLUMNS, named));
write('roads_2015_derived_exact_labels.json', r15);
fs.writeFileSync(path.join(OUT, 'roads_2015_derived_exact_labels.csv'), toCsv(ROAD15_COLUMNS, r15));
write('roads_2011_2012_retrospective.json', r11);
fs.writeFileSync(path.join(OUT, 'roads_2011_2012_retrospective.csv'), toCsv(ROAD11_COLUMNS, r11));
write('roads_2014_derived_exact_labels.json', r14);
fs.writeFileSync(path.join(OUT, 'roads_2014_derived_exact_labels.csv'), toCsv(ROAD14_COLUMNS, r14));
write('road_stretches_2014_retrospective.json', str14);
fs.writeFileSync(path.join(OUT, 'road_stretches_2014_retrospective.csv'), toCsv(STRETCH14_COLUMNS, str14));
stage('traffic_districts_2014_retrospective', dist14, Object.keys(dist14[0]));
stage('circles_selected_zones_2014_derived', circles14, Object.keys(circles14[0]));
stage('list_reconciliation_2014', recon14, Object.keys(recon14[0]).concat(Object.keys(recon14.reduce((a, r) => Object.assign(a, r), {})).filter(k => !(k in recon14[0]))));

const sum = (rows, k) => rows.reduce((a, r) => a + r[k], 0);
const tot = y => { const rows = named.filter(r => r.reference_year === y); return { zones: rows.length, simple: sum(rows, 'simple_crashes'), fatal: sum(rows, 'fatal_crashes'), total: sum(rows, 'total_crashes') }; };
const sourcesOf = y => { const r = named.find(x => x.reference_year === y); return { report_year: y, url: r.source_url, sha256: r.source_sha256 }; };
const manifest = {
  schemaVersion: '1.0.0',
  title: 'Delhi Traffic Police named accident-prone zones 2013 to 2015 and early road stretches 2011 to 2012, as printed',
  status: 'staged',
  scope: 'Named selected accident-prone zones (one row per zone) and, for 2011 and 2012, printed highway and ring-road stretch statistics. Counts within selected zones or stretches, not whole-city or whole-road counts. Counts, not rates.',
  sources: [
    { report_year: 2013, note: 'Delhi PWD compilation of the Traffic Police accident-prone locations (archived PDF, pages 133-141). An official compilation, not a recovered annual report.', url: z13[0].source_url, sha256: z13[0].source_sha256 },
    { report_year: 2014, note: 'Same compilation, pages 142-150.', url: z14[0].source_url, sha256: z14[0].source_sha256 },
    Object.assign(sourcesOf(2015), { note: 'Delhi Traffic Police Road Accidents in Delhi 2015, chapter 10 (Table 10.1).' }),
    { report_year: '2011 and 2012', note: 'Road Accidents in Delhi 2015, Table 6.5 (printed page 42, PDF page 5): a retrospective table of highway and ring-road stretches that includes 2011 and 2012.', url: r11[0].source_url, sha256: r11[0].source_sha256 }
  ],
  derivedTotals: {
    note: 'Sums of the printed rows. 2013 and 2014 print no grand total in the compilation; 2015 does not reconcile to a printed total either, apart from the cross-checks below.',
    2013: tot(2013), 2014: tot(2014), 2015: tot(2015)
  },
  printedCrossChecks: val1415.printed_crosschecks,
  blankRoads: { 2013: val1314['2013'].blank_roads.map(s => ({ serial: s })), 2014: val1314['2014'].blank_roads.map(s => ({ serial: s })), note: 'Serials whose road cell is blank in the source; the road stays null.' },
  roads2015: { groups: r15.length, derivation: 'Calculated by exact printed road label from Table 10.1. Not a printed road-summary table; printed spelling variants of one road remain separate groups, so this is not necessarily 45 unique roads.' },
  roads2014: { groups: r14.length, withRoad: r14.filter(r => r.road_as_printed).length, derivation: 'Calculated by exact printed label from the 2014 zone table. Not a printed road-summary table; spelling variants stay separate; the one zone with a blank road is its own null group.' },
  supplement2014: {
    note: 'Audited supplement of 22 October 2026 (single-agent second pass: all nine pages reviewed, 137 simple and fatal pairs re-transcribed; not independent external review). Its 2014 zone table is identical to the one used here.',
    stretches2014: { rows: str14.length, arithmeticDiscrepancies: str14.filter(r => r.source_arithmetic_discrepancy).map(r => ({ road: r.road_as_printed, fatal: r.fatal_crashes, simple: r.simple_crashes, nonInjury: r.noninjury_crashes, printedTotal: r.total_crashes_as_printed, componentSum: r.component_sum })), note: 'Two 2014 stretch rows of Table 6.5 do not add up in the source. Printed values are kept, the discrepancy is shown on the page, and the rows are on hold for source review: no change figure is made from them.' },
    stagedNotOnPage: ['traffic_districts_2014_retrospective: 11 district rows from the 2015 report Table 6.1 (8,623 crashes, 1,629 fatal), a retrospective geography; no 2015 table to sit beside it, so kept off the district tables', 'circles_selected_zones_2014_derived: circle sums of selected zones', 'list_reconciliation_2014: the 137 names compared with a separate Traffic Police 2014 list (124 exact, 11 spelling variants, 2 tentative); evidence only, no range or location is imported']
  },
  roads2011to2012: { rows: r11.length, note: 'Six national highways, four Ring Road stretches and three Outer Ring Road stretches per year. Simple is separate from non-injury in this source; fatal + simple + non-injury = total. Not selected-zone sums. Original annual reports and zone tables for 2011 and 2012 were not located.' },
  supersession: '2014 named zones come only from the PWD compilation (137 rows with counts). An older name-only 2014 list (137 names, null counts, different serial order and spellings) exists in the recovery package and is not used; serial numbers are never joined across the two.',
  caveats: [
    'Each year selects its own zones and the list changes every year; a longer list or a larger sum is not a worse year.',
    'The 2013 and 2014 compilation gives printed district and circle names; 2014 uses circle codes with no district assignment. They are kept as printed and are not mapped to any later district.',
    'No coordinates; a repeated name does not prove an unchanged location.',
    'Selected-page visual review was done for 2013; for 2014 all nine pages were reviewed and re-transcribed in a second pass by one agent; no independent second transcription review is claimed. 2015 was visually transcribed by the extracting agent and not independently reviewed.',
    'Archive timestamps and upload folders are not publication dates.'
  ],
  inputPackages: inputs,
  outputs: fs.readdirSync(OUT).filter(f => /\.(json|csv)$/.test(f) && f !== 'manifest.json').sort().map(f => ({ file: f, sha256: sha256(path.join(OUT, f)) }))
    .concat(fs.readdirSync(path.join(OUT, 'staged_2014')).sort().map(f => ({ file: 'staged_2014/' + f, sha256: sha256(path.join(OUT, 'staged_2014', f)) })))
};
write('manifest.json', manifest);
console.log('2014 road groups', r14.length, '| 2014 stretches', str14.length);
console.log('2013', tot(2013), '2014', tot(2014), '2015', tot(2015), '| 2015 road groups', r15.length, '| 2011-12 rows', r11.length);
