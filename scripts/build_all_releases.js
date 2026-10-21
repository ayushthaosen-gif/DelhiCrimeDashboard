const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
function build() {
  const yearly = require('./build_yearly_releases');
  const years = yearly.buildYears();
  const historical = require('./build_historical_crime_release').build();
  const citywideRoad = require('./build_citywide_road_release').build();
  const delhiUt = require('./build_delhi_ut_series').build();
  require('./build_historical_reporting_view').build();
  require('./build_irad_releases').build();
  require('./build_police_station_crosswalk').build();
  // Shared inventory needs the generated reference targets to exist, too.
  yearly.buildShared();
  const index = { schemaVersion: '1.0.0', title: 'Delhi Urban Safety Observatory yearly research releases', years, shared: 'shared/manifest.json', staged2025: '2025/README.md', importGuidance: 'Choose a year, read manifest.json, then import CSV or JSON. Do not join shared infrastructure as if it were measured in that year.', stagedReleases: [2025, 2026].map(year => ({ year, status: year === 2025 ? 'staged' : 'provisional', path: `${year}/irad/manifest.json`, productionReady: false, coverageComplete: false })) };
  fs.writeFileSync(path.join(ROOT, 'data/releases/README.md'), '# Yearly research releases\n\nChoose a folder from `2016/` through `2024/`, then read its `manifest.json` before importing `district_crime.csv` or `district_crime.json`. Road-safety and crash-zone files are included only when that year has a compatible production dataset.\n\n- `manifest.json` - machine-readable index\n- `shared/manifest.json` - infrastructure, boundaries and other non-year-specific production data\n- `2025/irad/` - authoritative staged iRAD release; older staging retained for provenance\n- `2026/irad/` - provisional partial-year iRAD release; never compare with a full year\n\nRegenerate with `npm run build:releases`. Null never means zero.\n');
  index.historicalReleases = [historical];
  index.citywideRoadTrend = citywideRoad;
  index.delhiUtSeries = delhiUt;
  fs.appendFileSync(path.join(ROOT, 'data/releases/README.md'), '\nSeparate series:\n\n- [Citywide road trend, 2011–2024](citywide_road_trend/manifest.json): counts, not rates; on the road chart only.\n- [Named zones and roads 2016-2021](road_zones_roads_2016_2021/README.md): the named accident-prone zones and road-wise zone tables from the annual reports, shown on Road safety.\n- [Enforcement figures 2019-2022](road_enforcement_2019_2022/README.md): citywide hit-and-run, drink-driving and over-speeding figures from the annual reports, shown on Road safety beside 2023 and 2024.\n- [Road crash report 2022, district and zone tables](road_crash_report_2022/README.md): selected-zone counts by district, 117 named zones and the roads table, from the 2022 report; shown on Road safety and Explore with a caution beside 2023.\n- [NCRB historical panel, 2011–2015](historical_2011_2015/README.md): staged Delhi UT totals and original reporting units, off the dashboard. Never join these to current districts or add them to the production year list.\n');
  // Release index is written last, after all referenced targets exist.
  fs.writeFileSync(path.join(ROOT, 'data/releases/manifest.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`Generated ${years.length} production years, shared inventory, staged releases and final index.`);
}
if (require.main === module) build();
module.exports = { build };
