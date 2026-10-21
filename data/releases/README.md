# Yearly research releases

Choose a folder from `2016/` through `2024/`, then read its `manifest.json` before importing `district_crime.csv` or `district_crime.json`. Road-safety and crash-zone files are included only when that year has a compatible production dataset.

- `manifest.json` - machine-readable index
- `shared/manifest.json` - infrastructure, boundaries and other non-year-specific production data
- `2025/irad/` - authoritative staged iRAD release; older staging retained for provenance
- `2026/irad/` - provisional partial-year iRAD release; never compare with a full year

Regenerate with `npm run build:releases`. Null never means zero.

Separate series:

- [Citywide road trend, 2011–2024](citywide_road_trend/manifest.json): counts, not rates; on the road chart only.
- [Named zones and roads 2016-2021](road_zones_roads_2016_2021/README.md): the named accident-prone zones and road-wise zone tables from the annual reports, shown on Road safety.
- [Enforcement figures 2019-2022](road_enforcement_2019_2022/README.md): citywide hit-and-run, drink-driving and over-speeding figures from the annual reports, shown on Road safety beside 2023 and 2024.
- [Road crash report 2022, district and zone tables](road_crash_report_2022/README.md): selected-zone counts by district, 117 named zones and the roads table, from the 2022 report; shown on Road safety and Explore with a caution beside 2023.
- [NCRB historical panel, 2011–2015](historical_2011_2015/README.md): staged Delhi UT totals and original reporting units, off the dashboard. Never join these to current districts or add them to the production year list.
