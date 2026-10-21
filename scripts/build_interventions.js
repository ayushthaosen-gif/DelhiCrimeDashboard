// Builds the intervention-oriented views from the repository's own data (Phase 3, step 4):
//   recurring_locations      named crash-prone zones that the Traffic Police list again and again, 2016 to 2024
//   pedestrian_corridors_2024  roads with two or more pedestrian crash-prone zones in 2024
//   audit_candidates_2024    the 93 named 2024 zones with the evidence behind each, an evidence tier and a field checklist
//
//   node scripts/build_interventions.js
//
// Rules, not scores. Nothing here says why a place is dangerous or what to build; it says where the reports keep pointing, how strong that
// evidence is, how well the surroundings are mapped, and what to look at on the ground. A name that repeats is the same place name, not a proven
// identical footprint. Positions are approximate. A blank stays blank.

const fs = require('fs');
const path = require('path');
const { sha256, toCsv } = require('./lib/release_utils');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data/profiles/');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
const key = s => String(s).toUpperCase().replace(/[^A-Z0-9]+/g, '');

// Spelling variants that are reviewed as the same place name: they never appear in the same year's list together, differ by one or two letters,
// and sit on the same road where the road is printed. Similar names that fail that test are listed, not merged.
const ALIASES = {
  'AZADPURSABJIMANDI': 'AZADPURSABZIMANDI', 'HYATTHOTEL': 'HYAATHOTEL', 'MAJNUKATILA': 'MAJNUKATILLA', 'MUKHARBACHOWK': 'MUKARBACHOWK',
  'RAJOKARIFLYOVER': 'RAJOUKARIFLYOVER', 'SEC12REDLIGHTDWARAKA': 'SEC12REDLIGHTDWARKA', 'TELCOGAZIPUR': 'TELCOGAJIPUR',
  'PREPAIDBOOTHMUKHARBACHOWK': 'PREPAIDBOOTHMUKARBACHOWK', 'NIZAMUDDINYAMUNABRIDGE': 'NIZAMUDINYAMUNABRIDGE', 'MONASTERYRINGROAD': 'MONESTRYRINGROAD',
  'TUGHLAKABADMETROSTATION': 'TUGLAQABADMETROSTATION', 'MUKHANDPURCHOWK': 'MUKUNDPURCHOWK'
};
const NOT_MERGED = [
  ['NEHRU PALACE', 'NEHRU PLACE', 'different places may be meant'], ['SEC-1,2 RED LIGHT DWARKA', 'SEC 10 RED LIGHT DWARKA', 'different sectors'],
  ['KIRARI MORE', 'KARKARI MORE', 'listed together in one year'], ['KHICHADI PUR', 'Khichripur', 'plausibly the same locality, not confirmed']
];
const canon = k => ALIASES[k] || k;

// ---------- named zones, every year ----------
const rowsByYear = {};
function add(y, name, road, fatal, total) { (rowsByYear[y] = rowsByYear[y] || []).push({ name, road: road || null, fatal: fatal == null ? null : fatal, total: total == null ? null : total }); }
read('data/releases/road_zones_roads_2016_2021/named_zones_2016_2021.json').forEach(z => add(z.reference_year, z.name_as_printed, z.road_as_printed, z.fatal_crashes, z.total_crashes));
read('data/releases/road_crash_report_2022/zones_2022_roads_from_later_reports.json').forEach(z => add(2022, z.name_as_printed, z.road_match_status === 'exact_name_later_report' ? z.road : null, z.fatal_crashes, z.total_crashes));
read('data/crash_zones_2023_raw.json').forEach(z => add(2023, z.name, z.road, z.fatal, z.total));
const zones24 = read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features;
zones24.forEach(f => add(2024, f.properties.location_name, f.properties.road_name, f.properties.all_fatal_crashes, f.properties.all_total_crashes));
YEARS.forEach(y => { if (!rowsByYear[y]) throw new Error('no zone list for ' + y); });

const places = {};
YEARS.forEach(y => rowsByYear[y].forEach(r => {
  const k = canon(key(r.name));
  const p = places[k] = places[k] || { place_key: k, names: {}, years: {}, roads: {} };
  p.names[r.name] = (p.names[r.name] || 0) + 1;
  if (p.years[y]) throw new Error('place listed twice in ' + y + ': ' + r.name);
  p.years[y] = { fatal: r.fatal, total: r.total };
  // roads are kept once per spelling-insensitive key; the latest year's spelling wins because years are visited in order
  if (r.road) p.roads[key(r.road)] = r.road;
}));
const tierOf = n => (n >= 7 ? 'persistent' : n >= 5 ? 'frequent' : n >= 3 ? 'repeated' : 'occasional');
const recurring = Object.values(places).map(p => {
  const yrs = YEARS.filter(y => p.years[y]);
  const latestYear = yrs[yrs.length - 1];
  const latestName = rowsByYear[latestYear].filter(r => canon(key(r.name)) === p.place_key)[0].name;
  const fatals = yrs.map(y => p.years[y].fatal).filter(v => v != null);
  return {
    place_key: p.place_key, name: latestName, aliases_merged: Object.keys(p.names).filter(n => key(n) !== key(latestName)).sort(), years_listed: yrs, reports_listed_of_9: yrs.length, recurrence: tierOf(yrs.length),
    first_year: yrs[0], last_year: latestYear, listed_in_2024: yrs.indexOf(2024) >= 0, roads_printed: Object.keys(p.roads).map(k => p.roads[k]).sort(),
    max_fatal_crashes_in_a_year: fatals.length ? Math.max.apply(null, fatals) : null,
    by_year: YEARS.map(y => (p.years[y] ? p.years[y] : null))
  };
}).sort((a, b) => b.reports_listed_of_9 - a.reports_listed_of_9 || (b.max_fatal_crashes_in_a_year || 0) - (a.max_fatal_crashes_in_a_year || 0) || a.name.localeCompare(b.name));
const placeByKey = {}; recurring.forEach(r => { placeByKey[r.place_key] = r; });

// ---------- 2024 zones with their surroundings ----------
const sidewalks = {}; read('data/derived/crash_zone_sidewalks_2024.json').zones.forEach(z => { sidewalks[z.feature_id] = z; });
const wardOfZone = {};
read('data/profiles/ward_profiles.json').rows.forEach(w => w.zones.forEach(z => { wardOfZone[z.name] = { ward_no: w.ward_no, ward_name: w.ward_name }; }));

function checklist(p, s, acc) {
  const items = ['Agree the location with the Traffic Police first: this position is an approximate landmark centre' + (acc != null ? ', estimated accurate to about ' + acc + ' m' : '') + ', not a geotag.'];
  if (p.pedestrian_crash_prone) items.push('Pedestrian movement: where people cross and wait, crossing type and spacing, footpath continuity and obstruction, refuge islands, speed of turning traffic.');
  if (p.two_wheeler_crash_prone) items.push('Two-wheeler movement: lane discipline, merge and U-turn points, surface and edge condition.');
  if (p.htv_crash_prone) items.push('Heavy-vehicle movement: turning space, bus and goods stops, loading, time-of-day mix with pedestrians.');
  if (p.hit_and_run_crash_prone) items.push('Hit-and-run cluster: lighting and camera coverage at the spot. The report lists such places as candidates for cameras; OpenStreetMap points are not a camera register.');
  if (p.night_time_crash_prone) items.push('Night-time cluster: street lighting along the corridor, lit crossings, signs and reflectors.');
  if (p.day_time_crash_prone) items.push('Day-time cluster: nearby generators of movement (market, bus stand, school, hospital, station) and their peak flows.');
  if (s && s.crossings_250m === 0 && s.signals_250m === 0 && s.footway_km_250m < 0.2) items.push('The map shows almost no crossings, signals or footways here. Record what actually exists: absence on the map is not absence on the ground.');
  items.push('Note what you see that the data cannot show: traffic volumes, speeds, signal timing, enforcement, visibility, informal crossings.');
  return items;
}

const audit = zones24.map(f => {
  const p = f.properties, s = sidewalks[p.feature_id] || {}, acc = p.estimated_accuracy_m == null ? null : p.estimated_accuracy_m;
  const place = placeByKey[canon(key(p.location_name))];
  const years = place.reports_listed_of_9, ped = p.pedestrian_crash_prone === true;
  const tier = ped && years >= 5 ? 1 : (years >= 5 || (ped && years >= 3)) ? 2 : (ped || years >= 3) ? 3 : 4;
  const reasons = [];
  reasons.push('Listed in ' + years + ' of the 9 reports from 2016 to 2024' + (years >= 7 ? ' (persistent)' : years >= 5 ? ' (frequent)' : years >= 3 ? ' (repeated)' : '') + '.');
  if (ped) reasons.push('Also on the 2024 pedestrian crash-prone list' + (p.pedestrian_fatal_crashes != null ? ' (' + p.pedestrian_fatal_crashes + ' pedestrian fatal crashes).' : '.'));
  if (p.all_fatal_crashes != null) reasons.push(p.all_fatal_crashes + ' fatal and ' + p.all_total_crashes + ' total crashes within the zone in 2024.'); else reasons.push('Appears only in the 2024 category lists: no all-crash count is printed.');
  const sparse = s.crossings_250m === 0 && s.signals_250m === 0 && s.footway_km_250m < 0.2;
  const ward = wardOfZone[p.location_name] || { ward_no: null, ward_name: null };
  return {
    zone: p.location_name, road_printed: p.road_name || null, ward_no: ward.ward_no, ward_name: ward.ward_name,
    reports_listed_of_9: years, years_listed: place.years_listed.join(' '), recurrence: place.recurrence,
    fatal_crashes_2024: p.all_fatal_crashes == null ? null : p.all_fatal_crashes, total_crashes_2024: p.all_total_crashes == null ? null : p.all_total_crashes,
    pedestrian_crash_prone_2024: ped, pedestrian_fatal_crashes_2024: p.pedestrian_fatal_crashes == null ? null : p.pedestrian_fatal_crashes, pedestrian_total_crashes_2024: p.pedestrian_total_crashes == null ? null : p.pedestrian_total_crashes,
    hit_and_run_crash_prone_2024: p.hit_and_run_crash_prone === true, night_time_crash_prone_2024: p.night_time_crash_prone === true, htv_crash_prone_2024: p.htv_crash_prone === true,
    cctv_priority_candidate_2024: p.cctv_priority_candidate === true,
    position_accuracy_m: acc, position_confidence: p.coordinate_confidence || null,
    crossings_mapped_250m: s.crossings_250m == null ? null : s.crossings_250m, signals_mapped_250m: s.signals_250m == null ? null : s.signals_250m, footway_km_mapped_250m: s.footway_km_250m == null ? null : s.footway_km_250m,
    sidewalk_mapped_share_of_roads_250m_pct: s.road_with_pedestrian_mapping_pct_250m == null ? null : s.road_with_pedestrian_mapping_pct_250m,
    sparsely_mapped_surroundings: sparse, evidence_tier: tier,
    evidence_tier_label: { 1: 'Strongest crash evidence: persistent and pedestrian crash-prone', 2: 'Strong: persistent, or pedestrian crash-prone and repeated', 3: 'Moderate: repeated, or pedestrian crash-prone', 4: 'Listed recently: limited history in these reports' }[tier],
    reasons: reasons.join(' '), field_checklist: checklist(p, s, acc).join(' | '),
    latitude: f.geometry.coordinates[1], longitude: f.geometry.coordinates[0]
  };
}).sort((a, b) => a.evidence_tier - b.evidence_tier || (b.fatal_crashes_2024 || 0) - (a.fatal_crashes_2024 || 0) || a.zone.localeCompare(b.zone));

// ---------- pedestrian corridors, 2024 ----------
const corridors = {};
audit.filter(a => a.pedestrian_crash_prone_2024 && a.road_printed).forEach(a => {
  const k = key(a.road_printed), c = corridors[k] = corridors[k] || { road: a.road_printed, zones: [] };
  c.zones.push(a);
});
const corridorRows = Object.values(corridors).filter(c => c.zones.length >= 2).map(c => ({
  road_printed: c.road, pedestrian_crash_prone_zones_2024: c.zones.length, zones: c.zones.map(z => z.zone).join(' | '),
  pedestrian_fatal_crashes_2024: c.zones.some(z => z.pedestrian_fatal_crashes_2024 == null) ? null : c.zones.reduce((a, z) => a + z.pedestrian_fatal_crashes_2024, 0),
  pedestrian_fatal_crashes_counted: c.zones.filter(z => z.pedestrian_fatal_crashes_2024 != null).reduce((a, z) => a + z.pedestrian_fatal_crashes_2024, 0),
  all_fatal_crashes_in_these_zones_2024: c.zones.filter(z => z.fatal_crashes_2024 != null).reduce((a, z) => a + z.fatal_crashes_2024, 0),
  zones_persistent_or_frequent: c.zones.filter(z => z.reports_listed_of_9 >= 5).length,
  wards: Array.from(new Set(c.zones.map(z => z.ward_name).filter(Boolean))).sort().join(' | '),
  crossings_mapped_within_250m_of_any_zone: c.zones.reduce((a, z) => a + (z.crossings_mapped_250m || 0), 0)
})).sort((a, b) => b.pedestrian_crash_prone_zones_2024 - a.pedestrian_crash_prone_zones_2024 || b.pedestrian_fatal_crashes_counted - a.pedestrian_fatal_crashes_counted || a.road_printed.localeCompare(b.road_printed));

// ---------- write ----------
const flat = r => Object.assign({}, r, { aliases_merged: (r.aliases_merged || []).join(' | '), years_listed: Array.isArray(r.years_listed) ? r.years_listed.join(' ') : r.years_listed, roads_printed: (r.roads_printed || []).join(' | ') });
const recurringCsvCols = ['name', 'reports_listed_of_9', 'recurrence', 'years_listed', 'first_year', 'last_year', 'listed_in_2024', 'roads_printed', 'max_fatal_crashes_in_a_year', 'aliases_merged'].concat(YEARS.map(y => 'fatal_' + y), YEARS.map(y => 'total_' + y));
const recurringRows = recurring.map(r => { const o = flat(r); YEARS.forEach((y, i) => { o['fatal_' + y] = r.by_year[i] ? r.by_year[i].fatal : null; o['total_' + y] = r.by_year[i] ? r.by_year[i].total : null; }); return o; });
const auditCols = Object.keys(audit[0]).filter(c => c !== 'latitude' && c !== 'longitude').concat(['latitude', 'longitude']);
const corridorCols = Object.keys(corridorRows[0]);

const out = {};
out['recurring_locations.json'] = JSON.stringify({ schemaVersion: '1.0.0', note: 'Named crash-prone zones across the nine annual reports, 2016 to 2024. A repeated name is the same place name, not a proven identical footprint; zone lists are re-drawn every year. A blank count means the report prints none for that year.', reports: YEARS, places: recurring }, null, 1) + '\n';
out['recurring_locations.csv'] = toCsv(recurringCsvCols, recurringRows);
out['pedestrian_corridors_2024.json'] = JSON.stringify({ schemaVersion: '1.0.0', note: 'Roads with two or more pedestrian crash-prone zones in the 2024 report. The road is the name printed beside each zone; a corridor here is a road with repeated pedestrian zones, not a measured segment.', rows: corridorRows }, null, 1) + '\n';
out['pedestrian_corridors_2024.csv'] = toCsv(corridorCols, corridorRows);
out['audit_candidates_2024.json'] = JSON.stringify({ schemaVersion: '1.0.0', note: 'The 93 named 2024 crash-prone zones with the evidence behind each, an evidence tier and a field checklist. Areas, not points: positions are hand-placed with a stated accuracy. Evidence for a field audit, not a finding.', rows: audit }, null, 1) + '\n';
out['audit_candidates_2024.csv'] = toCsv(auditCols, audit);
fs.writeFileSync(OUT + 'recurring_locations.json', out['recurring_locations.json']);
Object.keys(out).forEach(f => fs.writeFileSync(OUT + f, out[f], 'utf8'));

const tiers = {}; audit.forEach(a => { tiers[a.evidence_tier] = (tiers[a.evidence_tier] || 0) + 1; });
const inputs = ['data/releases/road_zones_roads_2016_2021/named_zones_2016_2021.json', 'data/releases/road_crash_report_2022/zones_2022_roads_from_later_reports.json', 'data/crash_zones_2023_raw.json', 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson', 'data/derived/crash_zone_sidewalks_2024.json', 'data/profiles/ward_profiles.json'];
const manifest = {
  schemaVersion: '1.0.0', title: 'Intervention-oriented views: recurring locations, pedestrian corridors and audit candidates', generatedBy: 'scripts/build_interventions.js', dataVersion: read('data/series_status.json').updated,
  files: Object.keys(out).map(f => ({ path: 'data/profiles/' + f, sha256: sha256(OUT + f) })), inputs: inputs.map(f => ({ path: f, sha256: sha256(path.join(ROOT, f)) })),
  rules: {
    recurrence: 'Reports (of 9, 2016 to 2024) that list the place name: 7 or more = persistent, 5 to 6 = frequent, 3 to 4 = repeated, 1 to 2 = occasional.',
    nameMatching: 'Names are matched after removing case, spaces and punctuation. Twelve reviewed spelling pairs are merged (listed in aliasesMerged); similar names that fail the test are listed in notMerged.',
    evidenceTier: 'Tier 1: pedestrian crash-prone in 2024 and listed in 5 or more reports. Tier 2: listed in 5 or more reports, or pedestrian crash-prone and listed in 3 or more. Tier 3: pedestrian crash-prone or listed in 3 or more. Tier 4: otherwise. A tier says how strong the crash evidence is, not how dangerous a place is.',
    pedestrianCorridor: 'A road with two or more 2024 pedestrian crash-prone zones, by the road name printed beside each zone.',
    sparselyMapped: 'No mapped crossing and no mapped signal within 250 m, and under 0.2 km of mapped footway within 250 m. It describes the map, not the street: 80 of 93 zones have no mapped crossing within 250 m, so absence on the map is not used to rank.'
  },
  aliasesMerged: Object.keys(ALIASES).length, notMerged: NOT_MERGED,
  summary: { places: recurring.length, persistent: recurring.filter(r => r.recurrence === 'persistent').length, frequent: recurring.filter(r => r.recurrence === 'frequent').length, repeated: recurring.filter(r => r.recurrence === 'repeated').length, corridors: corridorRows.length, auditTiers: tiers },
  caveats: [
    'Zone positions are hand-placed with an estimated accuracy of 150 m to 5 km; an audit area is an area, not a point.',
    'The Traffic Police re-draw the zone list every year and apply a count threshold, so a place leaving the list is not a place becoming safe, and a place joining it is not proof of a new hazard.',
    'Crash counts are within each zone, not all crashes on a road or in a ward. The 2022 list prints no road: roads there are those a later report assigns to the same name.',
    'Mapped infrastructure comes from OpenStreetMap and is a lower bound.',
    'Nothing here establishes cause, responsibility or what should be built. Field verification is needed first.'
  ]
};
fs.writeFileSync(OUT + 'interventions_manifest.json', JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log('interventions: ' + recurring.length + ' places (' + manifest.summary.persistent + ' persistent, ' + manifest.summary.frequent + ' frequent), ' + corridorRows.length + ' corridors, ' + audit.length + ' audit areas, tiers ' + JSON.stringify(tiers));
