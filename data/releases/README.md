# Yearly research releases

Choose a folder from `2016/` through `2024/`, then read its `manifest.json` before importing `district_crime.csv` or `district_crime.json`. Road-safety and crash-zone files are included only when that year has a compatible production dataset.

- `manifest.json` - machine-readable index
- `shared/manifest.json` - infrastructure, boundaries and other non-year-specific production data
- `2025/irad/` - authoritative staged iRAD release; older staging retained for provenance
- `2026/irad/` - provisional partial-year iRAD release; never compare with a full year

Regenerate with `npm run build:releases`. Null never means zero.
