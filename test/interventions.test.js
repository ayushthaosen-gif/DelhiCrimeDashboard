// Guards the intervention-oriented views (data/profiles/recurring_locations, pedestrian_corridors_2024, audit_candidates_2024): the rules are the stated
// rules, repeated names are counted honestly, blanks stay blank, the audit areas carry their evidence and a checklist, and the page keeps its caveats.
//
//   node --test test/interventions.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256 } = require('../scripts/lib/release_utils');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const json = f => JSON.parse(read(f));
const rec = json('data/profiles/recurring_locations.json'), cor = json('data/profiles/pedestrian_corridors_2024.json'), aud = json('data/profiles/audit_candidates_2024.json'), man = json('data/profiles/interventions_manifest.json');
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];

test('recurring locations: every zone list of nine reports is counted, a place appears once per report, the tier follows the stated rule', () => {
  assert.deepEqual(rec.reports, YEARS);
  const listed = YEARS.map(y => rec.places.filter(p => p.years_listed.includes(y)).length);
  assert.deepEqual(listed, [108, 145, 110, 119, 77, 87, 117, 107, 93], 'each report\'s zones are all accounted for, none dropped or double counted');
  for (const p of rec.places) {
    assert.ok(p.reports_listed_of_9 >= 1 && p.reports_listed_of_9 <= 9);
    assert.equal(p.years_listed.length, p.reports_listed_of_9);
    assert.equal(p.recurrence, p.reports_listed_of_9 >= 7 ? 'persistent' : p.reports_listed_of_9 >= 5 ? 'frequent' : p.reports_listed_of_9 >= 3 ? 'repeated' : 'occasional');
    assert.equal(p.by_year.length, 9);
    p.by_year.forEach((v, i) => assert.equal(v !== null, p.years_listed.includes(YEARS[i])));
  }
  const bhalswa = rec.places.find(p => /bhalswa chowk/i.test(p.name));
  assert.equal(bhalswa.reports_listed_of_9, 9);
  assert.equal(bhalswa.recurrence, 'persistent');
  assert.equal(rec.places.filter(p => p.aliases_merged.length).length, 12, 'twelve reviewed spelling variants are merged');
  assert.ok(man.notMerged.some(n => /NEHRU PALACE/.test(n[0])), 'similar names that fail the test are listed, not merged');
  assert.match(rec.note, /not a proven identical footprint/);
});

test('blanks stay blank: a zone with no printed count has null counts in the history, never zero', () => {
  const z24 = json('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features.filter(f => f.properties.all_total_crashes == null).map(f => f.properties.location_name);
  assert.ok(z24.length === 5);
  for (const name of z24) {
    const p = rec.places.find(x => x.name === name || x.aliases_merged.includes(name));
    assert.ok(p, name);
    assert.equal(p.by_year[8].fatal, null, name + ' has no printed 2024 count');
    assert.equal(p.by_year[8].total, null);
  }
  const csv = read('data/profiles/recurring_locations.csv').split('\n');
  assert.ok(csv[0].includes('fatal_2024') && csv[0].includes('total_2016'));
});

test('audit areas: all 93 named 2024 zones, the evidence tier follows the stated rule, the checklist and reasons are present, positions are labelled approximate', () => {
  assert.equal(aud.rows.length, 93);
  assert.equal(new Set(aud.rows.map(r => r.zone)).size, 93);
  for (const r of aud.rows) {
    const years = r.reports_listed_of_9, ped = r.pedestrian_crash_prone_2024;
    const tier = ped && years >= 5 ? 1 : (years >= 5 || (ped && years >= 3)) ? 2 : (ped || years >= 3) ? 3 : 4;
    assert.equal(r.evidence_tier, tier, r.zone);
    assert.ok(r.reasons.length > 20 && /^Listed in \d of the 9 reports/.test(r.reasons));
    const items = r.field_checklist.split(' | ');
    assert.ok(items.length >= 2 && /Traffic Police first/.test(items[0]) && /cannot show/.test(items[items.length - 1]), r.zone + ' checklist frames the visit and the limits of the data');
    if (r.position_accuracy_m != null) assert.match(items[0], new RegExp('about ' + r.position_accuracy_m + ' m'));
    if (ped) assert.ok(items.some(t => /Pedestrian movement/.test(t)));
    if (r.fatal_crashes_2024 === null) assert.match(r.reasons, /no all-crash count is printed/, r.zone + ': an unprinted count is said, not shown as zero');
  }
  const t = { 1: 0, 2: 0, 3: 0, 4: 0 }; aud.rows.forEach(r => { t[r.evidence_tier]++; });
  assert.deepEqual(man.summary.auditTiers, { 1: t[1], 2: t[2], 3: t[3], 4: t[4] });
  assert.ok(aud.rows.filter(r => r.ward_no).length >= 85, 'almost every zone is linked to the ward its position falls in');
  assert.match(aud.note, /Areas, not points/);
  assert.match(aud.note, /not a finding/);
  assert.ok(aud.rows.filter(r => r.sparsely_mapped_surroundings).length > 50, 'the sparse-map flag is common, which is why it is not used to rank');
  assert.match(man.rules.sparselyMapped, /80 of 93 zones have no mapped crossing/);
});

test('pedestrian corridors: roads with two or more pedestrian crash-prone zones in 2024, sums equal the zone rows', () => {
  assert.ok(cor.rows.length >= 3);
  for (const c of cor.rows) {
    assert.ok(c.pedestrian_crash_prone_zones_2024 >= 2);
    const zs = aud.rows.filter(a => a.pedestrian_crash_prone_2024 && a.road_printed && a.road_printed.toUpperCase().replace(/[^A-Z0-9]/g, '') === c.road_printed.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    assert.equal(zs.length, c.pedestrian_crash_prone_zones_2024, c.road_printed);
    assert.equal(c.pedestrian_fatal_crashes_counted, zs.filter(z => z.pedestrian_fatal_crashes_2024 != null).reduce((a, z) => a + z.pedestrian_fatal_crashes_2024, 0));
  }
  assert.match(cor.note, /not a measured segment/);
});

test('the manifest lists every file and input with its current hash, the rules and the caveats; no machine-specific path', () => {
  for (const f of man.files) assert.equal(f.sha256, sha256(path.join(ROOT, f.path)), f.path);
  for (const f of man.inputs) assert.equal(f.sha256, sha256(path.join(ROOT, f.path)), f.path);
  assert.deepEqual(man.files.map(f => path.basename(f.path)).sort(), ['audit_candidates_2024.csv', 'audit_candidates_2024.json', 'pedestrian_corridors_2024.csv', 'pedestrian_corridors_2024.json', 'recurring_locations.csv', 'recurring_locations.json']);
  for (const k of ['recurrence', 'nameMatching', 'evidenceTier', 'pedestrianCorridor', 'sparselyMapped']) assert.ok(man.rules[k], k);
  assert.ok(man.caveats.some(c => /150 m to 5 km/.test(c)) && man.caveats.some(c => /re-draw/.test(c)) && man.caveats.some(c => /cause, responsibility or what should be built/.test(c)));
  for (const f of ['recurring_locations.json', 'audit_candidates_2024.json', 'pedestrian_corridors_2024.json', 'interventions_manifest.json']) assert.ok(!/[A-Za-z]:\\\\|\/Users\/|\/home\//.test(read('data/profiles/' + f)), f);
});

test('the Planning page shows the three views with their caveats, links the files, and the ward panel and evidence pack carry the audit areas', () => {
  const src = read('assets/page-planning.js'), why = read('assets/why.js'), html = read('planning.html');
  for (const t of ['Field-audit areas', 'Recurring locations', 'Pedestrian corridors']) assert.ok(src.includes(t), t);
  for (const t of ['Areas, not points.', 'A tier is not a danger rating', 'not a proven identical footprint', 'it is not a measured stretch', 'absence on the map is not used to rank']) assert.ok(src.includes(t), t);
  for (const f of ['audit_candidates_2024.csv', 'recurring_locations.csv', 'pedestrian_corridors_2024.csv', 'interventions_manifest.json']) assert.ok(src.includes('data/profiles/' + f), f);
  assert.ok(html.includes('id="plViews"'));
  assert.ok(why.includes('Field-audit areas in this ward') && why.includes('To check on site'));
  assert.ok(!/innerHTML/.test(src + why));
  const plan = fs.readFileSync(path.join(ROOT, 'assets/planning-data.js'), 'utf8');
  assert.ok(plan.includes('"interventions"') && plan.includes('"recurringTotal":324'));
  assert.ok(plan.length < 450 * 1024);
  assert.ok(read('package.json').includes('node scripts/build_interventions.js'));
});
