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
├── exports/                           # dashboard-independent CSV/JSON exports
├── fonts/                             # fonts embedded by the main build
├── scripts/                           # Node build and data-maintenance scripts
├── test/                              # Node tests
├── tools/pipeline_2025/               # isolated Python collection pipeline
├── docs/                              # article, changelog, and project documentation
└── .github/workflows/                 # CI and source-monitoring workflows
```

The generated HTML pages remain at the repository root intentionally. Moving them would change the existing GitHub Pages URLs.

Run build and test tasks through `npm` from the repository root. Run the Python collector from `tools/pipeline_2025/`.
