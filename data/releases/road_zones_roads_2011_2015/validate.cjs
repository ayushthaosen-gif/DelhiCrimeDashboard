const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const manifest = read('manifest.json');
const named = read('named_zones_2013_2015.json'), roads15 = read('roads_2015_derived_exact_labels.json'), roads11 = read('roads_2011_2012_retrospective.json');
const roads14 = read('roads_2014_derived_exact_labels.json'), str14 = read('road_stretches_2014_retrospective.json'), dist14 = read('staged_2014/traffic_districts_2014_retrospective.json');
const fail = m => { throw Error(m); };

for (const o of manifest.outputs) {
  const h = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, o.file))).digest('hex');
  if (h !== o.sha256) fail('Output hash changed: ' + o.file);
}
for (const row of named) {
  if (row.simple_crashes + row.fatal_crashes !== row.total_crashes) fail('Row arithmetic: ' + row.reference_year + ' #' + row.serial);
  if (row.latitude != null || row.longitude != null) fail('Unexpected coordinates');
}
for (const year of [2013, 2014, 2015]) {
  const rows = named.filter(r => r.reference_year === year), t = manifest.derivedTotals[year];
  if (new Set(rows.map(r => r.serial)).size !== rows.length) fail(year + ' serials are not unique');
  if (rows.length !== t.zones) fail(year + ' zone count');
  for (const [f, k] of [['simple_crashes', 'simple'], ['fatal_crashes', 'fatal'], ['total_crashes', 'total']]) if (rows.reduce((a, r) => a + r[f], 0) !== t[k]) fail(year + ' ' + f);
}
if (manifest.printedCrossChecks['2014_zone_count'] !== manifest.derivedTotals[2014].zones || manifest.printedCrossChecks['2015_zone_count'] !== manifest.derivedTotals[2015].zones || manifest.printedCrossChecks['2015_zone_fatal_crashes'] !== manifest.derivedTotals[2015].fatal) fail('Printed cross-check');
for (const y of [2013, 2014]) {
  const blank = named.filter(r => r.reference_year === y && !r.road_as_printed).map(r => r.serial);
  if (JSON.stringify(blank) !== JSON.stringify(manifest.blankRoads[y].map(b => b.serial))) fail(y + ' blank roads');
}
if (roads15.reduce((a, r) => a + r.crash_prone_zones, 0) !== manifest.derivedTotals[2015].zones) fail('2015 road groups do not cover the zones');
if (roads15.reduce((a, r) => a + r.fatal_crashes, 0) !== manifest.derivedTotals[2015].fatal) fail('2015 road groups fatal');
for (const r of roads11) {
  if (r.fatal_crashes + r.simple_crashes + r.noninjury_crashes !== r.total_crashes) fail('2011-12 arithmetic: ' + r.reference_year + ' ' + r.road_as_printed);
  if (r.latitude != null || r.longitude != null) fail('Unexpected coordinates');
}
if (roads14.reduce((a, r) => a + r.crash_prone_zones, 0) !== manifest.derivedTotals[2014].zones || roads14.reduce((a, r) => a + r.fatal_crashes, 0) !== manifest.derivedTotals[2014].fatal || roads14.reduce((a, r) => a + r.simple_crashes, 0) !== manifest.derivedTotals[2014].simple) fail('2014 road groups do not cover the zones');
if (roads14.filter(r => !r.road_as_printed).length !== 1) fail('2014 expects one null-road group');
const bad14 = str14.filter(r => r.fatal_crashes + r.simple_crashes + r.noninjury_crashes !== r.total_crashes_as_printed).map(r => r.road_as_printed);
const flagged14 = str14.filter(r => r.source_arithmetic_discrepancy).map(r => r.road_as_printed);
if (JSON.stringify(bad14.sort()) !== JSON.stringify(flagged14.sort()) || bad14.length !== 2) fail('2014 stretch discrepancies must be exactly the two flagged rows');
if (str14.length !== 13) fail('2014 stretches');
if (dist14.length !== 11 || dist14.reduce((a, r) => a + r.total_accidents, 0) !== 8623 || dist14.reduce((a, r) => a + r.fatal_accidents, 0) !== 1629 || dist14.some(r => r.fatal_accidents + r.injury_accidents + r.non_injury_accidents !== r.total_accidents)) fail('2014 district table');
console.log('named_zones_2013_2015.json: ' + named.length + ' rows validated; roads_2015: ' + roads15.length + ' groups; roads_2011_2012: ' + roads11.length + ' rows');
