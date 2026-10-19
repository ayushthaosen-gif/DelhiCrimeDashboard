const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function build() {
  const yearly = require('./build_yearly_releases');
  const years = yearly.buildYears();
  require('./build_irad_releases').build();
  require('./build_police_station_crosswalk').build();
  // Shared inventory needs the generated reference targets to exist, too.
  yearly.buildShared();
  const index = { schemaVersion: '1.0.0', title: 'Delhi Urban Safety Observatory yearly research releases', years, shared: 'shared/manifest.json', staged2025: '2025/README.md', importGuidance: 'Choose a year, read manifest.json, then import CSV or JSON. Do not join shared infrastructure as if it were measured in that year.', stagedReleases: [2025, 2026].map(year => ({ year, status: year === 2025 ? 'staged' : 'provisional', path: `${year}/irad/manifest.json`, productionReady: false, coverageComplete: false })) };
  fs.writeFileSync(path.join(ROOT, 'data/releases/README.md'), '# Yearly research releases\n\nChoose a folder from `2016/` through `2024/`, then read its `manifest.json` before importing `district_crime.csv` or `district_crime.json`. Road-safety and crash-zone files are included only when that year has a compatible production dataset.\n\n- `manifest.json` - machine-readable index\n- `shared/manifest.json` - infrastructure, boundaries and other non-year-specific production data\n- `2025/irad/` - authoritative staged iRAD release; older staging retained for provenance\n- `2026/irad/` - provisional partial-year iRAD release; never compare with a full year\n\nRegenerate with `npm run build:releases`. Null never means zero.\n');
  // Release index is written last, after all referenced targets exist.
  fs.writeFileSync(path.join(ROOT, 'data/releases/manifest.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Generated ${years.length} production years, shared inventory, staged releases and final index.`);
}
if (require.main === module) build();
module.exports = { build };
