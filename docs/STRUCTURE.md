# Repository structure

The repository separates published pages, source data, reusable exports, build tooling, and research pipelines.

```text
DelhiCrimeDashboard/
├── index.html                         # GitHub Pages entry point
├── delhi_safety_dashboard.html       # generated main dashboard
├── interactive_map.html              # generated Leaflet map
├── liquor_crash_analysis.html        # generated spatial analysis
├── data/                              # dashboard source and derived datasets
│   └── releases/2025/                 # audited 2025 research release
├── exports/                           # legacy dashboard-independent CSV/JSON exports (deprecated)
├── fonts/                             # fonts embedded by the main build
├── notebooks/                          # example analysis notebook(s) over data/releases/
├── scripts/                           # Node build and data-maintenance scripts
├── test/                              # Node tests
├── tools/pipeline_2025/               # isolated Python collection pipeline
├── docs/                              # article, changelog, data changelog, and project documentation
└── .github/workflows/                 # CI and source-monitoring workflows
```

The generated HTML pages remain at the repository root intentionally. Moving them would change the existing GitHub Pages URLs.

Run build and test tasks through `npm` from the repository root. Run the Python collector from `tools/pipeline_2025/`.

## Research releases

`data/releases/2016/` through `data/releases/2024/` are generated, year-by-year import releases. Each has a machine-readable manifest and normalized CSV/JSON. `data/releases/shared/` catalogs non-year-specific production layers. `data/releases/2025/` remains the independently audited staging release.
