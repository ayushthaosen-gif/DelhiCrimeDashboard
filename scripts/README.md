# Scripts

Run these scripts from the repository root, preferably through `npm`.

- `build.js`: generates the main dashboard.
- `build_interactive_map.js`: generates the Leaflet map.
- `build_liquor_crash_analysis.js`: generates the liquor/crash analysis page.
- `build_liquor_crash_proximity.js`: derives liquor/crash proximity datasets.
- `build_ward_infra.js`: derives ward-level infrastructure metrics.
- `export_data.js`: regenerates reusable files under `exports/`.
- The remaining scripts are data-maintenance utilities for historical crime and crash-zone preparation.

Every script resolves paths from the repository root; none depends on a developer-specific home or temporary directory. Optional source overrides are documented under `data/source/README.md`.
