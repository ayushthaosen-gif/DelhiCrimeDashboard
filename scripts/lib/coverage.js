// The year-by-year coverage matrix, the comparison notes and the versioned download bundles, all computed from committed data.
//
//   matrix      series (rows) by year 2011 to 2026 (columns); a year is "available" or "partial" only when the data is present in the repository,
//               every other cell takes its cause from data/coverage_gaps.json (the build refuses a gap with no stated cause)
//   comparison  the documented breaks between years (data/continuity.json), as plain statements with their evidence
//   bundles     file sets with hashes and a version, which the Data & methods page zips in the browser with a generated README
//
// Nothing here is typed in except the causes of gaps and the choice of files per bundle.

const fs = require('fs');
const path = require('path');
const { sha256, canonicalSize, toCsv } = require('./release_utils');
const { utRows } = require('./patterns');
const roadHistory = require('./road_history');

const ROOT = path.join(__dirname, '..', '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const exists = f => fs.existsSync(path.join(ROOT, f));
const YEARS = []; for (let y = 2011; y <= 2026; y++) YEARS.push(y);

const STATES = {
  available: 'Available',
  partial: 'Available with a qualification (see the note)',
  staged: 'Collected and checked, kept off the site',
  provisional: 'Part of a year only',
  not_printed: 'The source does not print it',
  not_extracted: 'The source exists but the figure has not been entered',
  source_not_found: 'The document could not be located',
  not_collected: 'Not looked for or not verified to exist',
  not_published: 'No official release yet'
};

function yearsOf(rows, key) { return new Set(rows.map(r => +r[key])); }

function build() {
  const gaps = read('data/coverage_gaps.json').gaps;
  const status = Object.fromEntries(read('data/series_status.json').series.map(s => [s.id, s]));
  const trends = read('data/road_safety_trends.json');
  const extra = read('data/road_safety_extra_2023_2024.json');
  const hist = roadHistory.build();

  const years = {};
  // crime
  years.ncrb_district_crime = new Set(); for (let y = 2016; y <= 2024; y++) if (exists('data/releases/' + y + '/district_crime.json')) years.ncrb_district_crime.add(y);
  const ut = utRows();
  years.delhi_ut_total_crime = new Set(ut.filter(r => r.total_ipc_bns).map(r => +r.year));
  years.delhi_ut_theft = new Set(ut.filter(r => r.theft).map(r => +r.year));
  // road
  years.citywide_road_trend = new Set(trends.trends.map(r => r.year));
  years.victims_by_mode = new Set([...read('data/releases/road_victims_by_mode_2004_2018/victims_by_mode.json').map(r => r.year), ...trends.victims.map(r => r.year)]);
  years.enforcement = new Set([...read('data/releases/road_enforcement_2019_2022/enforcement.json').map(r => r.reference_year), ...Object.keys(extra.enforcement).map(Number)]);
  years.traffic_district_tables = new Set([...Object.keys(hist.whole).filter(y => hist.whole[y].rows.length), ...Object.keys(hist.zones).filter(y => hist.zones[y].rows.length)].map(Number));
  years.named_zones = new Set([
    ...yearsOf(read('data/releases/road_zones_roads_2011_2015/named_zones_2013_2015.json'), 'reference_year'),
    ...yearsOf(read('data/releases/road_zones_roads_2016_2021/named_zones_2016_2021.json'), 'reference_year'),
    ...(read('data/releases/road_crash_report_2022/crash_prone_zones.json').length ? [2022] : []),
    ...(read('data/crash_zones_2023_raw.json').length ? [2023] : []),
    ...(read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features.length ? [2024] : [])
  ]);
  const printedRoads = new Set([...yearsOf(read('data/releases/road_zones_roads_2016_2021/roads_selected_zones_2017_2021.json'), 'reference_year'), ...(read('data/releases/road_crash_report_2022/roads_selected_zones.json').length ? [2022] : []), ...Object.keys(extra.roadSummary).map(Number)]);
  const derivedRoads = new Set([...yearsOf(read('data/releases/road_zones_roads_2011_2015/roads_2014_derived_exact_labels.json'), 'reference_year'), ...yearsOf(read('data/releases/road_zones_roads_2011_2015/roads_2015_derived_exact_labels.json'), 'reference_year')]);
  years.road_tables = new Set([...printedRoads, ...derivedRoads]);
  years.stretches = new Set([...yearsOf(read('data/releases/road_zones_roads_2011_2015/roads_2011_2012_retrospective.json'), 'reference_year'), ...yearsOf(read('data/releases/road_zones_roads_2011_2015/road_stretches_2014_retrospective.json'), 'reference_year')]);
  years.zone_positions = new Set([2023, 2024]);
  years.ward_profiles = new Set([2024]);
  years.irad_district_reports = new Set();

  const rows = [
    { id: 'ncrb_district_crime', group: 'Crime', series: 'District crime (NCRB), 15 police districts', unit: 'registered cases', geography: '15 police districts (earlier years under the districts reported that year)' },
    { id: 'delhi_ut_total_crime', group: 'Crime', series: 'Delhi-wide registered IPC/BNS cases (printed total)', unit: 'registered cases', geography: 'Delhi as a whole' },
    { id: 'delhi_ut_theft', group: 'Crime', series: 'Delhi-wide theft (printed)', unit: 'registered cases', geography: 'Delhi as a whole' },
    { id: 'citywide_road_trend', group: 'Road safety', series: 'Citywide crashes, fatal crashes and deaths', unit: 'counts', geography: 'Delhi as a whole' },
    { id: 'victims_by_mode', group: 'Road safety', series: 'Deaths by mode of travel', unit: 'persons killed', geography: 'Delhi as a whole' },
    { id: 'enforcement', group: 'Road safety', series: 'Enforcement (hit-and-run, drink-driving, speeding)', unit: 'counts', geography: 'Delhi as a whole' },
    { id: 'traffic_district_tables', group: 'Road safety', series: 'District crash tables', unit: 'crashes', geography: 'Traffic districts as printed (11, 12 or 15)' },
    { id: 'named_zones', group: 'Road safety', series: 'Named crash-prone zones', unit: 'crashes within each year\'s zones', geography: 'Named locations' },
    { id: 'road_tables', group: 'Road safety', series: 'Zones grouped by road', unit: 'crashes within zones', geography: 'Roads' },
    { id: 'stretches', group: 'Road safety', series: 'Highway and ring-road stretches', unit: 'whole-stretch crashes', geography: 'Printed stretches' },
    { id: 'zone_positions', group: 'Place', series: 'Crash-zone map positions', unit: 'points', geography: 'Hand-placed, 150 m to 5 km' },
    { id: 'ward_profiles', group: 'Place', series: 'Ward profiles (legacy 290 wards)', unit: 'counts and densities', geography: '290 legacy wards' },
    { id: 'irad_district_reports', group: 'Newer sources', series: 'District iRAD reports', unit: 'crashes', geography: 'Revenue districts and stations' }
  ];
  const partialNotes = {
    ncrb_district_crime: { 2016: 'Theft and robbery only; the other aggregates use incompatible definitions and are blank.', 2024: 'Uses BNS numbering from 1 July 2024; compare with caution.' },
    delhi_ut_total_crime: { 2024: 'Uses BNS numbering from 1 July 2024; compare with caution.' },
    victims_by_mode: { 2018: 'Last year of the older reports\' own categories; compare 2018 with 2019 with caution.' },
    zone_positions: { 2023: '105 of 107 zones fall inside a district and are plotted; positions are hand-placed.', 2024: 'Positions are hand-placed and approximate.' },
    road_tables: { 2014: 'Calculated here by exact printed label, not a printed table.', 2015: 'Calculated here by exact printed label, not a printed table.' }
  };
  // the 2011 to 2018 mode-of-travel years and the 2013 and 2014 zone lists carry a qualification
  const qualified = { victims_by_mode: [2011, 2018], named_zones: [2013, 2014] };
  const qualNote = { victims_by_mode: 'The older annual reports\' own categories (Table 3.1); compare 2018 with 2019 with caution.', named_zones: 'From a Delhi PWD compilation, not a recovered annual report; no grand total printed.' };

  const out = rows.map(r => {
    const cells = {};
    for (const y of YEARS) {
      let state, note = null, evidence = null;
      const have = years[r.id].has(y);
      if (r.id === 'irad_district_reports' && (y === 2025 || y === 2026)) {
        const s = status[y === 2025 ? 'irad_2025_release' : 'irad_2026_year_to_date'];
        state = y === 2025 ? 'staged' : 'provisional'; note = s.note || s.geography; evidence = s.where || null;
      } else if (have) {
        const q = qualified[r.id], derived = r.id === 'road_tables' && derivedRoads.has(y);
        const pn = (partialNotes[r.id] || {})[y];
        if (derived || pn || (q && y >= q[0] && y <= q[1])) { state = 'partial'; note = pn || (q ? qualNote[r.id] : null); } else state = 'available';
        if (r.id === 'ncrb_district_crime' && (y === 2016 || y === 2024)) state = 'partial';
        if (r.id === 'delhi_ut_total_crime' && y === 2024) state = 'partial';
      } else {
        const g = gaps.find(x => x.row === r.id && y >= x.years[0] && y <= x.years[1]);
        if (!g) throw new Error('coverage: no stated cause for ' + r.id + ' in ' + y);
        state = g.state; note = g.note; evidence = g.evidence;
      }
      if (!STATES[state]) throw new Error('coverage: unknown state ' + state);
      cells[y] = { state, note, evidence };
    }
    return Object.assign({}, r, { cells });
  });
  // a gap entry must describe a year that is truly empty
  for (const g of gaps) {
    const row = out.find(r => r.id === g.row);
    if (!row) throw new Error('coverage gaps: unknown row ' + g.row);
    for (let y = g.years[0]; y <= g.years[1]; y++) if (YEARS.includes(y) && ['available', 'partial'].includes(row.cells[y].state)) throw new Error('coverage gaps: ' + g.row + ' ' + y + ' is described as a gap but the data is present');
  }

  // comparison notes from the continuity rules
  const c = read('data/continuity.json'), comparison = [];
  for (const b of c.definitionBreaks) comparison.push({ applies_to: 'Crime: definitions and sources', measures: b.measures, between: b.between, state: b.state, reason: b.reason, evidence: b.evidence || null });
  for (const b of c.geography.breaks) comparison.push({ applies_to: 'Crime by district', between: b.between, state: 'not_comparable', reason: b.reason + ' Affected: ' + b.affected.join(', ') + (b.newDistricts.length ? '. New: ' + b.newDistricts.join(', ') : '') + '.', evidence: b.evidence || null });
  for (const b of c.roadHistory.breaks) comparison.push({ applies_to: 'Road districts', between: b.between, state: b.state, reason: b.reason, evidence: null });
  comparison.push({ applies_to: 'Road zones and roads', between: [2013, 2024], state: 'caution', reason: c.roadHistory.zoneReason, evidence: null });
  comparison.push({ applies_to: 'Road, all series', between: [2020, 2021], state: 'caution', reason: c.roadHistory.pandemicReason, evidence: null });
  comparison.push({ applies_to: 'Deaths by mode of travel', between: [2018, 2019], state: 'caution', reason: 'The 2011 to 2018 figures use the older annual reports\' own categories (for example "scooter and motorcycle riders"); the 2019 to 2024 series comes from the later reports with its own labels. The meaning is close but not identical.', evidence: 'data/releases/road_victims_by_mode_2004_2018/manifest.json' });
  comparison.push({ applies_to: 'Crime, hurt head', between: [2023, 2024], state: 'caution', reason: 'The 2023 table\'s head is "Hurt" and the 2024 head "Hurt or Grievous Hurt", so it is not like-for-like.', evidence: 'data/derived/bns_hurt_2023_2024.json' });

  return { years: YEARS, states: STATES, rows: out, comparison, note: 'A year is available only when the data is present in the repository; every other year states its cause. A blank is never a zero.' };
}

function csv(m) {
  const rows = [];
  for (const r of m.rows) for (const y of m.years) rows.push({ group: r.group, series_id: r.id, series: r.series, unit: r.unit, geography: r.geography, year: y, state: r.cells[y].state, meaning: m.states[r.cells[y].state], note: r.cells[y].note || '', evidence: r.cells[y].evidence || '' });
  return toCsv(['group', 'series_id', 'series', 'unit', 'geography', 'year', 'state', 'meaning', 'note', 'evidence'], rows);
}

// ---------- download bundles ----------
function resolveBundle(def) {
  const files = [];
  for (const part of def.include) {
    if (part.file) { files.push(part.file); continue; }
    const dir = path.join(ROOT, part.dir);
    const names = fs.readdirSync(dir).filter(n => (part.match || []).some(re => new RegExp(re).test(n))).sort();
    for (const n of names) files.push(part.dir + '/' + n);
  }
  return files.map(f => { if (!exists(f)) throw new Error('bundle ' + def.id + ': missing ' + f); return { path: f, bytes: canonicalSize(path.join(ROOT, f)), sha256: sha256(path.join(ROOT, f)) }; });
}

function bundles(updated) {
  const defs = read('data/bundles/bundles.json').bundles;
  const list = defs.map(d => {
    const files = resolveBundle(d);
    const version = updated + '-' + require('crypto').createHash('sha256').update(files.map(f => f.path + ':' + f.sha256).join('\n')).digest('hex').slice(0, 8);
    return { id: d.id, title: d.title, description: d.description, series: d.series, geography: d.geography, definitions: d.definitions, version, bytes: files.reduce((a, f) => a + f.bytes, 0), files };
  });
  return { schemaVersion: '1.0.0', dataVersion: updated, note: 'Each bundle is zipped in the browser from these files with a generated README, coverage, comparison notes and a manifest that records each file\'s expected and fetched SHA-256. The version changes whenever a file in the bundle changes.', bundles: list };
}

module.exports = { build, csv, bundles, YEARS, STATES };
