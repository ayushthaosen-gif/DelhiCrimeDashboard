const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const manifest = read('manifest.json');
const named = read('named_zones_2013_2015.json'), roads15 = read('roads_2015_derived_exact_labels.json'), roads11 = read('roads_2011_2012_retrospective.json');
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
console.log('named_zones_2013_2015.json: ' + named.length + ' rows validated; roads_2015: ' + roads15.length + ' groups; roads_2011_2012: ' + roads11.length + ' rows');
