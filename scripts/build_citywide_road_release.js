const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { toCsv } = require('./lib/release_utils');
const ROOT = path.resolve(__dirname, '..');
const STAGE = 'data/staged/history_2011_2015/';
const DIR = 'data/releases/citywide_road_trend/';
const read = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function build() {
  const road = read('data/road_safety_trends.json');
  const baseline = read(STAGE + 'inputs/production_road_safety_baseline.json').data;
  const source = read(STAGE + 'generated/traffic_citywide_2011_2015.json');
  const archives = read(STAGE + 'generated/traffic_archived_statistics_editions.json');
  const prefix = source.rows.filter(r => r.reference_year <= 2013).map(r => ({ year: r.reference_year, crashes: r.values[4], fatalities: r.values[6], fatalCrashes: r.values[3] }));
  assert.deepEqual(road.trends, [...prefix, ...baseline.trends], 'Only add the validated 2011-2013 prefix; preserve all existing years');
  assert.deepEqual(road.victims, baseline.victims);
  for (const edition of archives.editions) for (const row of edition.rows) {
    const published = road.trends.find(r => r.year === row.reference_year);
    assert.deepEqual([published.crashes, published.fatalCrashes, published.fatalities], [row.values[4], row.values[3], row.values[6]]);
  }
  const registry = read(STAGE + 'inputs/sources.json');
  const provenance = registry.sources.filter(s => ['raw/dtp_statistics.html', ...archives.editions.map(e => e.path)].includes(s.path)).map(s => ({ ...s, path: STAGE + s.path }));
  for (const s of provenance) assert.equal(hash(fs.readFileSync(path.join(ROOT, s.path))), s.sha256);
  const files = { 'citywide_road_trend.json': JSON.stringify(road.trends, null, 2) + '\n', 'citywide_road_trend.csv': toCsv(['year', 'crashes', 'fatalities', 'fatalCrashes'], road.trends) };
  fs.mkdirSync(path.join(ROOT, DIR), { recursive: true });
  for (const [file, bytes] of Object.entries(files)) fs.writeFileSync(path.join(ROOT, DIR + file), bytes);
  const manifest = { schemaVersion: '1.0.0', title: 'Delhi citywide road trend, 2011-2024', status: 'production', generatedBy: 'scripts/build_citywide_road_release.js', generatedAt: null, referenceYears: road.trends.map(r => r.year), geography: 'Delhi citywide; no district allocation', unit: 'Police-reported annual counts, not rates', measures: { crashes: 'Total accidents', fatalCrashes: 'Fatal accidents, distinct from persons killed', fatalities: 'Persons killed' }, sourcePolicy: '2011-2013 agree across the archived 2014/2015 statistics pages and later official statistics. Existing 2014-2024 rows are unchanged from the retained compiled baseline.', caveats: ['Not population-, travel- or exposure-adjusted rates; the chart indexes counts to 2011=100, not a risk rate.', 'A standardized 30-day fatality follow-up definition was not established for the early source.', 'Original 2011-2014 complete annual booklets were not recovered. Archived injury/category counts differ from the later edition and are excluded from this extension.', 'Victim-by-mode data retain their separate 2019-2024 period. Historical traffic-district data and NCRB crime are not included here.'], sources: provenance, retainedBaseline: { path: STAGE + 'inputs/production_road_safety_baseline.json', sha256: hash(fs.readFileSync(path.join(ROOT, STAGE + 'inputs/production_road_safety_baseline.json'))) }, reuseTerms: registry.reuse_terms.filter(t => t.id === 'dtp'), files: Object.entries(files).map(([file, bytes]) => ({ path: file, bytes: Buffer.byteLength(bytes), sha256: hash(bytes) })) };
  fs.writeFileSync(path.join(ROOT, DIR + 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(ROOT, DIR + 'README.md'), '# Citywide road trend: 2011–2024\n\nAnnual police-reported **counts, not rates** for Delhi as a whole. [CSV](citywide_road_trend.csv), [JSON](citywide_road_trend.json), [provenance and caveats](manifest.json). Fatal crashes and persons killed are distinct. No district allocation is implied.\n\nOnly the agreeing 2011–2013 total crashes, fatal crashes and deaths are added; existing 2014–2024 rows and 2019–2024 victim-by-mode data are unchanged. Injuries and simple/non-injury categories are excluded from the extension because source editions differ. The dashboard indexes the count series to 2011=100; that is relative change, not a population/exposure-adjusted risk rate.\n\nRegenerate with `node scripts/build_citywide_road_release.js` or `npm run build:releases`.\n');
  return { id: 'citywide_road_trend', path: 'citywide_road_trend/manifest.json', status: 'production', coverageStart: 2011, coverageEnd: 2024 };
}
if (require.main === module) console.log(build());
module.exports = { build };
