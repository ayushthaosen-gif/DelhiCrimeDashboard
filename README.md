# Delhi Urban Safety Observatory

[![JS build and test](https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/actions/workflows/js-build-test.yml/badge.svg)](https://github.com/ayushthaosen-gif/DelhiCrimeDashboard/actions/workflows/js-build-test.yml)

An open-data observatory for crime, road safety, infrastructure and urban form across Delhi: self-contained dashboards and interactive maps, reproducible year-by-year research releases, and a documented pipeline that collects newer official data without putting it on the dashboard until it is checked.

**Open it:** [dashboard](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/) · [interactive map](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/interactive_map.html) · [for reporters and researchers](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/for_reporters.html)

Prototypes (exploration tools, not citable sources): [3D crash-zone and ward explorer](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/map_3d.html) · [Master Plan 2047 comparison](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/map_3d_mpd.html) · [district iRAD reports, 2025 and 2026](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/irad_stations.html)

The dashboard is one HTML file; open [`delhi_safety_dashboard.html`](delhi_safety_dashboard.html) in a browser, with no server or build step.

## What data is here, and how current is it

Official crime and crash figures run **to 2024**. Newer material exists but is deliberately kept apart from the dashboard. The machine-readable version of this table is [`data/series_status.json`](data/series_status.json).

| Series id | Series | Latest period | Status | Geography |
|---|---|---|---|---|
| `ncrb_district_crime` | NCRB district crime (IPC/BNS, SLL, crimes against women) | 2024 | production | 15 police districts |
| `citywide_road_trend` | [Citywide road trend, 2011–2024](data/releases/citywide_road_trend/manifest.json) | 2024 | production | Delhi citywide; counts, not rates |
| `ncrb_historical_counts_2011_2018` | [Historical district crime counts, 2011–2018](data/historical_reporting/manifest.json) | 2018 | production | Original reporting districts; counts only, no allocation to current districts |
| `ncrb_delhi_ut_totals` | [Delhi-wide registered crime, printed Delhi UT totals](data/releases/delhi_ut_series/manifest.json) | 2024 | production | Delhi UT as a whole; 2016–2021 not yet collected |
| `historical_police_district_maps` | [Historical police-district reference maps](data/staged/police_geography_history/manifest.json) | 2018 | staged | Schematic reference shapes, labelled inferred or derived |
| `ncrb_2025` | NCRB Crime in India 2025 | none | not_published | 15 police districts |
| `crash_zones_2024` | Delhi Traffic Police crash-prone zones | 2024 | production | named locations (93 zones in 2024); 15 police districts |
| `traffic_police_crash_report_2025` | Delhi Traffic Police annual Road Crash Report 2025 | none | not_published | 15 police districts |
| `irad_district_reports` | District iRAD road-accident reports | 2026-08 (varies by district) | staged | revenue districts and police stations as printed; not mapped to the 15 police districts |
| `irad_2026_year_to_date` | iRAD reports for 2026 | 2026-01 to 2026-08 (South East to July, North East to August, New Delhi to May) | provisional | only the districts that publish 2026 reports |
| `irad_2025_release` | [Staged iRAD 2025 release](data/releases/2025/irad/manifest.json) | 2025; multi-period, coverage differs | staged | reporting districts and source station labels |
| `police_station_crosswalk` | [Police station crosswalk](data/reference/police_station_crosswalk.csv) | Manual 2026-05-22; draft evidence | staged | post-period structural reference |
| `delhi_police_2025_citywide_counts` | Delhi Police 2025 citywide counts as reported by two news outlets | 2025 | staged | Delhi as a whole, 8 offences, no district split |
| `osm_infrastructure` | OpenStreetMap infrastructure snapshots (overbridges, signals, crossings, hospitals, cameras, police, footways) | 2026-08 | production | points and ways, assigned to districts and wards |
| `crash_zone_sidewalks` | Sidewalk, footway and crossing mapping around crash zones | 2026-10 | staged | 250 m and 500 m around each 2024 crash zone |
| `papl_streetlights` | PAPL streetlight and underpass survey | survey period, not re-measured | retained_legacy_year | 9 of 15 districts surveyed |
| `liquor_vends` | Official liquor vend list | list date not established | production | points (positions mostly approximate) |
| `wards_legacy_290` | Delhi wards, legacy 290-ward geography | pre-2022 delimitation | retained_legacy_year | 290 wards |
| `wards_mcd_2022_250` | Delhi wards, current 250-ward geography (MCD delimitation 2022) | 2022 delimitation | not_implemented | 250 wards |
| `mpd2047_comparison` | Master Plan 2047 against 2021 satellite land cover | plan 2026 draft; land cover 2021 | staged | 290 legacy wards |

Status values: `production` (on the dashboard, validated), `staged` (collected and checked, kept off the dashboard), `provisional` (partial period, never compare with a full year), `not_published` (no official release yet), `not_implemented` (source archived, no layer built), `retained_legacy_year` (older survey or geography kept for reference).

## Main limitations

- **Crash-zone map positions are estimates**, roughly 250 m to 1 km off, not police geotags. Counts come straight from the Delhi Road Crash Report. See [`docs/CRASH_ZONE_COORDINATES.md`](docs/CRASH_ZONE_COORDINATES.md).
- **OpenStreetMap layers are incomplete.** A low count means little has been mapped, not that nothing is there. A zero from a survey-based layer can mean "not surveyed".
- **2025 and 2026 have no official district crime or full crash report yet.** The iRAD reports are a different series (see the table) and must not be set beside the traffic-police figures.
- **All ward layers use the legacy 290-ward geography**, not the current 250 wards.
- This repository is a compilation, not a primary source: cite the agency report for any figure ([how](for_reporters.html)).

## Download and reuse

Each year from 2016 to 2024 has a folder under [`data/releases/`](data/releases/) with `district_crime.csv`/`.json` and a `manifest.json` giving source URLs, SHA-256 checksums, coverage and what a null means. Read the manifest before analysing. The [separate 2011–2015 NCRB historical panel](data/releases/historical_2011_2015/README.md) is staged, with Delhi UT totals and original reporting units; it is not on the dashboard.

```python
import json
import pandas as pd
from pathlib import Path

release = Path('data/releases/2024')
manifest = json.loads((release / 'manifest.json').read_text(encoding='utf-8'))
districts = pd.read_csv(release / 'district_crime.csv')
```

Details, a worked notebook, the deprecated `exports/` folder and licensing cautions: [`docs/DATA_RELEASES.md`](docs/DATA_RELEASES.md). Corrections to a published figure are logged in [`docs/DATA_CHANGELOG.md`](docs/DATA_CHANGELOG.md).

## Documentation

- [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md): every source, with original URLs and reuse notes
- [`docs/DATA_RELEASES.md`](docs/DATA_RELEASES.md): how to use the yearly releases
- [`docs/HISTORICAL_2011_2015.md`](docs/HISTORICAL_2011_2015.md): earlier citywide road counts and the separate staged NCRB panel
- [`docs/PIPELINE_2025.md`](docs/PIPELINE_2025.md): the collection pipeline and the evidence archive
- [`docs/IRAD_DISTRICT_REPORTS.md`](docs/IRAD_DISTRICT_REPORTS.md): district road-accident reports, coverage and caveats
- [`docs/CRASH_ZONE_COORDINATES.md`](docs/CRASH_ZONE_COORDINATES.md) and [`docs/MPD_BUILT_UP_USE_TRIAL.md`](docs/MPD_BUILT_UP_USE_TRIAL.md): audits and negative results
- [`docs/ANALYSES.md`](docs/ANALYSES.md): liquor vends and crash zones
- [`docs/STRUCTURE.md`](docs/STRUCTURE.md): the repository layout in detail
- [`docs/WHATS_NEW.md`](docs/WHATS_NEW.md), [`docs/AGENT_CHANGELOG.md`](docs/AGENT_CHANGELOG.md): history
- Right-to-information drafts (not filed): [`docs/RTI_REQUEST_DRAFT.md`](docs/RTI_REQUEST_DRAFT.md), [`docs/RTI_DDA_EXISTING_LAND_USE_DRAFT.md`](docs/RTI_DDA_EXISTING_LAND_USE_DRAFT.md), [`docs/RTI_MCD_PROPERTY_USE_DRAFT.md`](docs/RTI_MCD_PROPERTY_USE_DRAFT.md)

## Repository layout

- `*.html` at the root: published GitHub Pages entry points; kept in place so public URLs stay stable. The dashboard and the interactive map are generated, so edit their build scripts, not the HTML.
- [`scripts/`](scripts/): JavaScript build, export, geocoding and analysis tools, plus the iRAD collector.
- [`data/`](data/): production datasets, immutable source inputs, audited yearly releases, staged and derived data.
- [`exports/`](exports/): legacy flat files, deprecated, kept for URL stability.
- [`tools/pipeline_2025/`](tools/pipeline_2025/): the Python collection and validation pipeline.
- [`docs/`](docs/) and [`test/`](test/): documentation and regression tests.

## Regenerate

```bash
npm test
npm run build
npm run build:interactive-map
npm run build:releases
```

Edit `scripts/build.js` and `scripts/build_interactive_map.js` rather than the generated HTML. CI rebuilds everything and fails if a committed output differs.

## Licence and citation

Code is [MIT-licensed](LICENSE); third-party data keeps its own licence (see [`docs/DATA_SOURCES.md`](docs/DATA_SOURCES.md)). OpenStreetMap-derived files need OSM attribution and ODbL compliance. See [`CITATION.cff`](CITATION.cff) for how to cite this repository, and always cite the original agency for a figure.
