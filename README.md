# Delhi Urban Safety Observatory

## Automated 2025 staging pipeline

`tools/pipeline_2025/` contains the separate, auditable Python 3.12 collection pipeline for official 2025 sources. It stages raw downloads, checksums, provenance, review queues and validation reports without modifying production dashboard data. See [`tools/pipeline_2025/README.md`](tools/pipeline_2025/README.md). Dashboard integration is always a separate human-approved proposal.

A self-contained, single-file dashboard analyzing crime and road-safety data
across Delhi's 15 police districts (2022-2024) against real public
infrastructure coverage — streetlights, pedestrian underpasses, mapped pedestrian overbridges, metro station
gates, and police infrastructure.

Open [`delhi_safety_dashboard.html`](delhi_safety_dashboard.html) directly in
a browser — no server or build step required to view it.

Code is [MIT-licensed](LICENSE); third-party data keeps its own source
license (see "Data & sourcing" below). See [`CITATION.cff`](CITATION.cff)
for how to cite this repository.

## Repository layout

- `*.html` at the root: published GitHub Pages entry points; kept in place so existing public URLs remain stable.
- [`scripts/`](scripts/): JavaScript build, export, geocoding, and analysis tools.
- [`data/`](data/): production datasets, immutable source inputs, and audited yearly releases.
- [`exports/`](exports/): legacy flat CSV/JSON outputs, deprecated in favor of `data/releases/<year>/` but kept for URL stability.
- [`tools/pipeline_2025/`](tools/pipeline_2025/): isolated Python collection and validation pipeline for 2025.
- [`docs/`](docs/): project article, changelog, and the detailed [repository structure guide](docs/STRUCTURE.md).
- [`test/`](test/): JavaScript regression tests; the Python pipeline has its own tests beside its source.

## Public pages

- [Delhi Urban Safety Observatory](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/)
- [Delhi Safety & Infrastructure Explorer](https://ayushthaosen-gif.github.io/DelhiCrimeDashboard/interactive_map.html)

## What's new in this version

- **New identity and compact map hero.** The project is now the **Delhi Urban Safety Observatory**; its Leaflet page is the **Delhi Safety & Infrastructure Explorer**. The responsive header uses a shorter map-led safety visualization and a project favicon.
- **Pedestrian-overbridge coverage.** A reproducible OpenStreetMap/Overpass snapshot is processed into 242 mapped pedestrian bridge groups, district counts/densities, an interactive clustered point layer, nearby-crash-zone context, and reusable exports. It is marked as mapped coverage rather than an official completeness register.

- **Sharp charts on high-DPI screens.** The scatter, trends, and
  road-deaths-by-mode charts now render at native device pixel density
  instead of a fixed buffer stretched by CSS — no more blur on Retina
  displays or modern phones.
- **Custom tooltips** on the map (districts, police markers, crash zones,
  district centers) replace OS-rendered SVG `<title>` tooltips — instant,
  styled, no 1-2 second hover delay.
- **Rank-based (percentile) color scale** on the map and ranked list instead
  of linear min-max — one outlier district can no longer squash every other
  district into the bottom of the color range and hide their real variance.
- **Deselection**: clicking the already-selected district, or the map
  background, clears the selection instead of it being sticky.
- Fixed a table-parsing bug where one crash-prone zone had lost its name
  entirely, and cleaned up OCR artifacts (e.g. "GTKRoad") that had leaked
  into the *displayed* zone list text, not just the map-coordinate lookups.
- Full 15-district 2023 crash data (crash-prone zones, fatal crashes, total
  crashes) from the Delhi Road Crash Report 2023 — zero coverage gaps,
  unlike the 2022 report's 11-district reporting geography.
- All 107 named crash-prone zones now carry real 2023 severity counts and
  coordinates (cross-validated against the source table by rank and
  fatal-crash count); 105 of 107 plot on the map as a toggleable layer,
  sized and shaded by fatal crash count.
- District-center markers on the map — a ring-and-dot symbol at each
  district's polygon centroid.
- Citywide road-safety detail panel, consolidated into one tabbed section
  (Trends / By Mode of Travel / Crash-Prone Zones).
- Year comparison for crime data: a 2022 / 2023 / 2024 toggle on the map,
  ranked list, and district detail panel, each with a "vs. previous year"
  change badge.
- Downloadable everything — CSV per dataset, plus a full Excel workbook for
  citation.

## Year-by-year research releases

Import-ready releases are organized like the audited 2025 folder:

- [`data/releases/2016/`](data/releases/2016/) through [`data/releases/2024/`](data/releases/2024/): one folder per production year.
- Every year contains `district_crime.csv`, `district_crime.json`, `manifest.json`, and a short README.
- Compatible road-safety and crash-zone tables are included only for years in which those datasets exist.
- [`data/releases/shared/manifest.json`](data/releases/shared/manifest.json) catalogs infrastructure, boundaries, approximate-location layers, derived analyses, checksums, source URLs and reuse caveats that do not belong to one year.
- [`data/releases/manifest.json`](data/releases/manifest.json) is the machine-readable release index. The existing [`data/releases/2025/`](data/releases/2025/) remains a separate audited staging release and is not silently treated as production.

Recommended import sequence:

```python
import json
import pandas as pd
from pathlib import Path

year = 2024
release = Path(f'data/releases/{year}')
manifest = json.loads((release / 'manifest.json').read_text(encoding='utf-8'))
districts = pd.read_csv(release / 'district_crime.csv')
```

Read `manifest.json` before analysis: it defines source URLs, SHA-256 checksums, coverage, null meaning, and previous-year comparability. For a fuller worked example — loading all nine years into one long panel, checking coverage before aggregating, and a basic citywide trend plot — see [`notebooks/example_analysis.ipynb`](notebooks/example_analysis.ipynb).

If a figure you've already cited from here changes in a later release, it will be logged in [`docs/DATA_CHANGELOG.md`](docs/DATA_CHANGELOG.md), separate from the dev-facing [`docs/AGENT_CHANGELOG.md`](docs/AGENT_CHANGELOG.md).

Regenerate all yearly releases with:

```bash
npm run build:releases
```

## Using this data in your own report or dashboard

The dashboard's in-app CSV/Excel buttons are meant for a person clicking
around in a browser. If you want to pull the data programmatically instead —
into a report, a notebook, or your own dashboard — use the
[year-by-year research releases](#year-by-year-research-releases) above
(`data/releases/2016/` through `data/releases/2024/`). Each year has a
`manifest.json` with source URLs, SHA-256 checksums, coverage flags, and
null/comparability rules, so you never have to guess whether a missing value
means zero or means "not reported."

```python
import json
import pandas as pd
from pathlib import Path

year = 2024
release = Path(f'data/releases/{year}')
manifest = json.loads((release / 'manifest.json').read_text(encoding='utf-8'))
districts = pd.read_csv(release / 'district_crime.csv')
```

```js
const districts = await fetch(
  'https://raw.githubusercontent.com/ayushthaosen-gif/DelhiCrimeDashboard/main/data/releases/2024/district_crime.json'
).then(r => r.json());
```

### Legacy `exports/` (deprecated, kept for URL stability)

`exports/districts.csv` / `.json` and the other flat files in
[`exports/`](exports/) predate the year-by-year releases above. They are
**stale** — they mix 2023 crime figures with a single infrastructure
snapshot, don't include 2024, and carry no manifest or checksums. They are
kept in place, unchanged, only so that existing links/scripts pointing at
them don't break; do not build anything new on top of them.

| Deprecated file | Superseded by |
|---|---|
| `exports/districts.csv` / `.json` | `data/releases/<year>/district_crime.csv` / `.json` (+ `district_road_safety.*` for 2022-2024) |
| `exports/crash_prone_zones_2023.csv` / `.json` | `data/releases/2023/crash_prone_zones.csv` / `.json` (2024 also now available at `data/releases/2024/crash_prone_zones.*`) |
| `exports/road_safety_trends_2014_2023.csv` / `.json` | `data/releases/<year>/citywide_road_safety.csv` / `.json` |
| `exports/road_deaths_by_mode_2019_2023.csv` / `.json` | `data/releases/<year>/citywide_road_safety.csv` / `.json` |

```bash
# legacy — still works, but stale; prefer data/releases/2024/ instead
curl -O https://raw.githubusercontent.com/ayushthaosen-gif/DelhiCrimeDashboard/main/exports/districts.csv
```

Regenerate the legacy exports (unchanged behavior) with:

```bash
node scripts/export_data.js
```

**Before you publish anything built on this data**, keep two things straight:

1. **Cite the original source, not this repo**, for each figure — see
   [Data & sourcing](#data--sourcing) below for exactly which agency/report
   each column comes from. This repo is a compilation, not the primary
   source, and the individual agencies (NCRB, Delhi Traffic Police) are who
   should be credited.
2. **OpenStreetMap data (crash-zone coordinates, metro gates, police
   chowkis/outposts) is ODbL-licensed** — if you redistribute it, OSM's
   [attribution and share-alike terms](https://www.openstreetmap.org/copyright)
   apply, not just a casual mention.

## Regenerating the dashboard

The HTML file is generated from `scripts/build.js`, which reads the data in `data/`
and the fonts in `fonts/`, and writes the finished `delhi_safety_dashboard.html`
back to the repo root:

```bash
npm run build
npm run build:interactive-map
```

Edit `scripts/build.js` and `scripts/build_interactive_map.js` rather than their generated HTML files, then run the corresponding build command above. `build:interactive-map` also refreshes the overbridge and ward-infrastructure derived data.

## What's in here

- **`delhi_safety_dashboard.html`** — the generated dashboard (the actual
  deliverable).
- **`scripts/build.js`** — the Node build script: one large template literal producing
  the full HTML + CSS + JS, with no external libraries or CDN dependencies.
- **`data/`** — district-level crime, infrastructure, road-safety, and
  correlation data as JSON. Internal, purpose-built for `build.js` — if you
  want to reuse the data yourself, use `data/releases/<year>/` instead (see
  [Year-by-year research releases](#year-by-year-research-releases) above).
- **`fonts/`** — the Big Shoulders webfont, embedded as base64 at build time.
- **`scripts/build_yearly_releases.js`** / **`data/releases/`** — the manifest-documented,
  checksummed CSV/JSON research releases, one folder per year, for anyone
  integrating this data elsewhere.
- **`scripts/export_data.js`** / **`exports/`** — older, flat CSV/JSON exports,
  kept only for URL-compatibility; deprecated in favor of `data/releases/`.

## Open-data locations and original URLs

The links below are locations where researchers can inspect or retrieve the underlying public data. A public URL does **not** automatically grant an open-data licence: check each publisher's terms before redistribution. OpenStreetMap-derived files require OpenStreetMap attribution and ODbL compliance.

| Dataset used by the dashboard | Publisher / original location | Direct data or landing-page URL | Format and coverage | Reuse note |
|---|---|---|---|---|
| District crime, 2024 | National Crime Records Bureau (NCRB), *Crime in India* district tables | [IPC/BNS crime XLSX](https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx); [SLL crime XLSX](https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx); [Crime against women XLSX](https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx) | XLSX; district tables | Official public files; verify NCRB terms before redistribution. |
| District crime, 2023 | NCRB, *Crime in India* district tables | [IPC crime XLSX](https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx); [SLL crime XLSX](https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx); [Crime against women XLSX](https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx) | XLSX; district tables | Official public files; verify NCRB terms before redistribution. |
| District crime, 2022 | NCRB, *Crime in India* district tables | [IPC crime XLSX](https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx); [SLL crime XLSX](https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx); [Crime against women XLSX](https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx) | XLSX; district tables | Official public files; verify NCRB terms before redistribution. |
| Historical crime, 2016-2021 | NCRB source tables distributed through India Data Portal | [2016 district IPC CSV](https://ckandev.indiadataportal.com/dataset/e311a510-ce48-4f4c-baf6-0ec5f9278285/resource/7d5e2cc6-a704-4248-aa44-13d7186f847c/download/districtwise-ipc-crimes-2016.csv); [2017 onward district IPC CSV](https://ckandev.indiadataportal.com/dataset/e311a510-ce48-4f4c-baf6-0ec5f9278285/resource/387dedad-5978-4f97-a6c5-60ca45f9405a/download/districtwise-ipc-crimes-2017-onwards.csv) | CSV; harmonized selectively in this project | See the compatibility/null rules in this README and the verified historical JSON metadata. |
| Road crashes and crash-prone zones, 2023 | Delhi Traffic Police | [Delhi Crash Report 2023](https://traffic.delhipolice.gov.in/delhi-crash-report-2023) | Web landing page with report download; all 15 police districts | Official report; map coordinates include project validation/geocoding notes. |
| Road crashes and crash-prone zones, 2024 | Delhi Traffic Police | [Delhi Crash Report 2024](https://traffic.delhipolice.gov.in/delhi-crash-report-2024) | Web landing page with report download; all 15 police districts | Official report; unresolved hyper-local locations remain flagged. |
| Fatal crashes and hit-and-run, 2022 | Transport Department, GNCTD / Delhi Traffic Police | [2022 Delhi Road Crash Fatalities Report PDF](https://transport.delhi.gov.in/sites/default/files/2024-09/2022_delhi_road_crash_fatalities_report_1.pdf) | PDF; Traffic Police's 11-district geography | Four dashboard districts are null, not zero, because this report used a different geography. |
| Streetlights and pedestrian underpasses | Delhi Transport Stack Open Transit Data; PAPL survey | [Open Transit Data portal](https://otd.delhi.gov.in/) | Portal/API data; surveyed portions of 9 of 15 districts | Portal terms apply; unsurveyed districts are stored as coverage gaps. |
| Pedestrian overbridges | OpenStreetMap via Overpass API | [Overpass API endpoint](https://overpass-api.de/api/interpreter); [exact query and processing notes](data/source/README.md); [project GeoJSON](data/delhi_pedestrian_overpasses_osm.geojson) | OSM ways grouped into 242 mapped bridge features; snapshot 2026-08-04 | ODbL; mapped inventory, not an official completeness register. |
| Metro gates, bus stops, ATMs, liquor shops, surveillance and mapped police posts | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [Overpass Turbo query interface](https://overpass-turbo.eu/) | OSM point/way features; tag filters are documented in the dashboard footer and workbook | ODbL attribution/share-alike requirements apply. |
| Traffic signals, pedestrian crossings, hospitals, street lamps, footway/sidewalk coverage (interactive map only) | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [exact queries and processing notes](data/source/README.md) | Snapshot 2026-08-06, `scripts/fetch_osm_infra_snapshots.js` + `scripts/build_infra_extras.js`; footway coverage is a per-district length/density figure, not shipped as line geometry; street lamps shown as their own layer, not merged with the PAPL-survey Streetlights metric | ODbL; mapped inventory, not an official completeness register. |
| Road and footway size (`data/road_sizes.csv`, `data/footway_sizes.csv`) | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [processing notes](data/source/README.md) | Per-segment `highway=*` classification (always tagged), `lanes=*` (33.7% of roads), `width=*` (0.2% roads / 0.7% footways) -- no official Delhi per-segment width dataset was found; missing values left blank, never estimated | ODbL; sparse tagging, not a survey. |
| Land use — ward CSV (`data/landuse_by_ward.csv`) and interactive-map polygon layer | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [processing notes and known limitations](data/source/README.md) | 290 wards, real polygon-overlap area by category, computed with @turf/turf; only ~23.4% of ward area is landuse-tagged in OSM on average -- see `mapped_pct` per row, never read the untagged remainder as "vacant" | ODbL; a community-extracted, unlicensed, PDF-derived DDA draft-plan alternative was found and deliberately not used -- see processing notes for why. |
| Official licensed liquor-vend list | Delhi State Civil Supplies Corporation (DSCSC) / DCCWS | [DSCSC Liquor Vends page](https://dscsc.delhi.gov.in/dscsc/liquor-vends) | Published list; 374 official records in the project | Location coordinates are approximate unless explicitly marked as exact. |
| Police stations and police-district boundaries | Delhi Police GSDL GIS export | [Community mirror of the GSDL export](https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac) | GIS station points and jurisdiction polygons | Mirror is provided because a stable original download URL is not available; inspect provenance before reuse. |

### 2025 sources staged for review

These files are **not automatically integrated into the production dashboard**. Their collection status, checksums, resolved URLs and validation notes are recorded in [`data/releases/2025/audit/`](data/releases/2025/audit/) and [`tools/pipeline_2025/output/`](tools/pipeline_2025/output/). Current public landing pages include:

- [NCRB](https://ncrb.gov.in/) - no unambiguous official *Crime in India 2025* district release was found by the pipeline.
- [Delhi Traffic Police](https://traffic.delhipolice.gov.in/) - no qualifying full 2025 crash report was found by the pipeline.
- [New Delhi district iRAD/eDAR](https://dmnewdelhi.delhi.gov.in/integrated-road-accident-cases-month-wise/)
- [West Delhi district iRAD/eDAR](https://dmwest.delhi.gov.in/integrated-road-accident-cases-month-wise/)
- [South-East Delhi district iRAD/eDAR](https://dmsoutheast.delhi.gov.in/irad-edar-south-east/)
- [North-West Delhi district iRAD/eDAR](https://dmnorthwest.delhi.gov.in/irad-edar-north-west-delhi/)
- [Delhi Excise preferred-vends page](https://excise.delhi.gov.in/excise/preferred-vends-purchaseprocurement-liquor-p-10-permit)
- [DSCSC liquor-vends page](https://dscsc.delhi.gov.in/dscsc/liquor-vends)

Use the audit manifests - not a copied URL alone - to determine whether a 2025 source was downloaded, validated, review-pending or unavailable.

## Data & sourcing

Pedestrian-overbridge data is a reproducible OpenStreetMap Overpass snapshot from 4 August 2026. It selects pedestrian ways tagged as bridges, groups connected/nearby segments into 242 mapped bridge features, and assigns their centroids to the 15 district polygons. This is not an official completeness register; unmapped features and accessibility/status changes may be missing.

Every figure is cited directly in the dashboard's footer and in its
downloadable Excel workbook (Sources & Methodology sheet), including:

- Crime data (2022, 2023 & 2024): National Crime Records Bureau (NCRB),
  *Crime in India*, District Wise Reports.
- District-wise crash-prone zones, fatal crashes, and total crashes (2023),
  plus the 107-zone blackspot list: Delhi Traffic Police, *Delhi Road Crash
  Report 2023* — all 15 districts, no reporting-geography gap.
- Fatal road crashes & hit-and-run (2022): Delhi Traffic Police / Transport
  Department GNCTD, *2022 Delhi Road Crash Fatalities Report* — 11 of 15
  districts (Traffic Police's own reporting geography for that year).
- Citywide road crash/fatality trends (2014-2023) and road deaths by mode of
  travel (2019-2023): Delhi Traffic Police annual road crash data.
- Crash-prone zone map coordinates: provided lat/lng for all 107 zones,
  cross-validated against the source table by rank and fatal-crash count
  before use (105 of 107 fall inside a district polygon and are plotted).
- Streetlights & underpasses: PAPL survey, via Delhi Transport Stack Open
  Transit Data.
- Mapped pedestrian overbridges (242 OSM bridge groups), metro station gates & police chowkis/outposts: OpenStreetMap (ODbL).
- Police stations & district boundaries: Delhi Police GSDL.

Coverage gaps (e.g. districts the streetlight survey never drove through, or
the 2022 road-crash report's 11-district geography) are treated as missing
data, not zero — see the in-app confidence markers and the "How this is
calculated" panel for details.

## Liquor vends × crash-prone zones spatial exploration

Both datasets — 374 official liquor vends and the 93 named 2024 crash-prone
zones — live directly in `interactive_map.html` as two independent,
toggleable point layers, and as a ward-level bivariate pairing option
("Liquor Vends (official)" × "Crash Zones (2024)", under the ward bivariate
mode's Infrastructure/Crime dropdown groups). This is the only place the
main dashboard links to for this data — the earlier standalone page
(`liquor_crash_analysis.html`) is no longer linked from the dashboard header,
though its build script and the deeper proximity-band analysis/exports it
produces still exist in the repo if needed directly. **Every coordinate is
approximate** — locality/sector centroids for vends, landmark/intersection
centres for crash zones, neither a verified vend entrance nor an official
Delhi Traffic Police geotag. Both treat proximity/co-location as broad
spatial association only, never causation, and say so persistently.

To refresh this analysis (e.g. if updated source extracts become available):

1. Replace the source files in `data/`: `delhi_liquor_vends_all_coordinates_approx.geojson`,
   `delhi_crash_prone_zones_2024_all_named_approx.geojson`,
   `delhi_crash_prone_zones_2024_250m_buffers_approx.geojson`,
   `delhi_crash_report_relevant_metrics_2024.json` — keep the exact filenames.
2. `npm install` once, if `node_modules/` isn't present (installs `@turf/turf`
   for the spatial math; `scripts/build_liquor_crash_proximity.js` falls back to a
   hand-rolled haversine/point-in-polygon implementation if `@turf/turf` isn't
   installed, so this step is optional but recommended).
3. `npm run build:liquor-crash` — runs `scripts/build_liquor_crash_proximity.js`
   (produces the three derived files: `liquor_vend_crash_proximity_2024.geojson`,
   `crash_zone_liquor_proximity_2024.geojson`, `liquor_crash_proximity_summary_2024.json`)
   then `scripts/build_liquor_crash_analysis.js` (produces `liquor_crash_analysis.html`).
4. `npm test` — runs the automated validation suite
   (`test/liquor_crash_proximity.test.js`, Node's built-in test runner) covering
   coordinate order/validity, official-vs-OSM record counts, monotonic
   distance-band counts, no negative values, and a check that no built page
   text uses causal language about liquor vends and crashes.
