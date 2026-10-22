// Builds data/releases/road_victims_by_mode_2004_2018/ from the transcribed Table 3.1 of the Traffic Police Road Accidents in Delhi reports
// (data/inputs/road_victims_by_mode/). Victims, killed and injured, by category of road user, Delhi as a whole. Every year must add up:
// the eight categories to the printed total for both killed and injured, and the killed total to the citywide trend already on the site.
//
//   node scripts/build_victims_by_mode.js      (npm run build:victims-by-mode; CI runs it and fails if the committed release differs)

const fs = require('fs');
const path = require('path');
const { sha256, toCsv } = require('./lib/release_utils');

const ROOT = path.join(__dirname, '..');
const IN = 'data/inputs/road_victims_by_mode/', OUT = path.join(ROOT, 'data', 'releases', 'road_victims_by_mode_2004_2018');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const trans = read(IN + 'table_3_1_transcription.json'), sources = read(IN + 'sources.json');
const trend = read('data/road_safety_trends.json').trends;

const CATS = ['pedestrians', 'cyclists', 'car_occupants', 'scooter_motorcycle_riders', 'bus_passengers', 'slow_moving_vehicles', 'animal_driven_vehicle_drivers', 'other_drivers'];
const rows = [];
for (const [year, r] of Object.entries(trans.rows)) {
  const v = r.values;
  if (v.length !== trans.columns.length) throw new Error(year + ': expected ' + trans.columns.length + ' values');
  const killed = CATS.map((_, i) => v[i * 2]), injured = CATS.map((_, i) => v[i * 2 + 1]);
  const sum = a => a.reduce((x, y) => x + y, 0);
  if (sum(killed) !== v[16]) throw new Error(year + ': killed categories sum ' + sum(killed) + ', printed total ' + v[16]);
  if (sum(injured) !== v[17]) throw new Error(year + ': injured categories sum ' + sum(injured) + ', printed total ' + v[17]);
  const t = trend.find(x => x.year === +year);
  if (t && t.fatalities !== v[16]) throw new Error(year + ': killed total ' + v[16] + ' differs from the citywide trend ' + t.fatalities);
  const src = trans.sources[r.source], doc = sources.documents.find(d => d.id === r.source);
  const row = { year: +year };
  trans.columns.forEach((c, i) => { row[c] = v[i]; });
  Object.assign(row, { source_report_year: src.reportYear, source_table: src.table, source_pdf_page: src.pdfPage, source_printed_page: src.printedPage, source_url: doc.url, source_sha256: doc.sha256, review_status: 'Read from the page image by one agent; categories add up to the printed total; not independently reviewed' });
  rows.push(row);
}
rows.sort((a, b) => a.year - b.year);

fs.mkdirSync(OUT, { recursive: true });
const columns = ['year'].concat(trans.columns, ['source_report_year', 'source_table', 'source_pdf_page', 'source_printed_page', 'source_url', 'source_sha256', 'review_status']);
fs.writeFileSync(path.join(OUT, 'victims_by_mode.json'), JSON.stringify(rows, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'victims_by_mode.csv'), toCsv(columns, rows));
const manifest = {
  schemaVersion: '1.0.0',
  title: 'Delhi road-crash victims (killed and injured) by category of road user, 2004 to 2018, as printed in Table 3.1',
  status: 'production',
  scope: 'Delhi as a whole, persons (not crashes). Fatalities and injuries by the victim\'s category of road user, from the Delhi Traffic Police annual reports. Not split by district. Counts, not rates.',
  years: [rows[0].year, rows[rows.length - 1].year],
  categories: 'Pedestrians; cyclists; car occupants; scooter and motorcycle riders; bus passengers; slow-moving vehicles (hand cart, electric rickshaw and cycle rickshaw pullers and passengers, as printed); drivers of animal-driven vehicles; other drivers; total.',
  sources: sources.documents,
  checks: ['Every year: the eight categories add up to the printed total for killed and for injured.', 'Every year from 2011: the killed total equals the citywide trend in data/road_safety_trends.json.'],
  caveats: [
    'These categories are the 2004 to 2018 reports\' own. The 2019 to 2024 mode-of-travel figures on the site come from a later report series with its own category labels (for example "two-wheeler riders"); the two series are close in meaning but a join across 2018 and 2019 should be read with caution.',
    'The totals are persons killed or injured and are not the same count as fatal crashes.',
    'A category share is the share of persons killed that year in that category.',
    '2001 to 2003 are printed in the 2015 report but their categories do not add up to the printed totals, so they are not included.', 'Single-agent transcription from page images; not independently reviewed. No explicit open licence verified; cite the Traffic Police report.'
  ],
  inputs: [IN + 'table_3_1_transcription.json', IN + 'sources.json'].map(f => ({ file: f, sha256: sha256(path.join(ROOT, f)) })),
  outputs: ['victims_by_mode.json', 'victims_by_mode.csv'].map(f => ({ file: f, sha256: sha256(path.join(OUT, f)) }))
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync(path.join(OUT, 'README.md'), '# Victims by category of road user, 2004 to 2018\n\nPersons killed and injured in Delhi road crashes by category of road user (pedestrians, cyclists, car occupants, scooter and motorcycle riders, bus passengers, slow-moving vehicles, animal-driven vehicle drivers, other drivers), 15 years, from Table 3.1 of the Traffic Police Road Accidents in Delhi 2018 report (the 2015 report table was used to check 2004 to 2014). [JSON](victims_by_mode.json), [CSV](victims_by_mode.csv), [sources, checks and caveats](manifest.json).\n\nEvery year adds up: the eight categories sum to the printed total for killed and for injured, and the killed totals from 2011 equal the citywide trend on the site. Persons, not crashes; Delhi as a whole; not split by district. These are the reports\' own categories, close to but not identical with the labels in the 2019 to 2024 series, so a join across 2018 and 2019 needs care. Transcribed from page images by one agent; not independently reviewed. Rebuild with `npm run build:victims-by-mode` (inputs in `data/inputs/road_victims_by_mode/`, source PDF URLs and hashes in its `sources.json`).\n');
console.log('victims by mode: ' + rows.length + ' years, ' + rows[0].year + ' to ' + rows[rows.length - 1].year + ', every year adds up');
