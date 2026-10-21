const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const read = f => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const manifest = read('manifest.json');
for (const [file, isRoad] of [['named_zones_2016_2021.json', false], ['roads_selected_zones_2017_2021.json', true]]) {
  const rows = read(file);
  for (const row of rows) {
    if (row.simple_crashes + row.fatal_crashes !== row.total_crashes) throw Error('Row arithmetic: ' + file);
    if (row.latitude != null || row.longitude != null) throw Error('Unexpected coordinates');
  }
  for (const year of [...new Set(rows.map(r => r.reference_year))]) {
    const annual = rows.filter(r => r.reference_year === year), total = manifest.printedTotals[year];
    for (const [field, key] of [['simple_crashes','simple'],['fatal_crashes','fatal'],['total_crashes','total']]) {
      if (annual.reduce((a,r) => a+r[field],0) !== total[key]) throw Error(year + ' total ' + field);
    }
    if ((isRoad ? annual.reduce((a,r) => a+r.crash_prone_zones,0) : annual.length) !== total.zones) throw Error(year + ' zone total');
  }
  console.log(file + ': ' + rows.length + ' rows validated');
}
