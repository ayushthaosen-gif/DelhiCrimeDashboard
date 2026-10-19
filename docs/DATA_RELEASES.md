# Using the data: yearly releases, manifests and legacy exports

How to load the research releases, what the manifests promise, and what to keep straight before you publish. Moved out of the README.

## Year-by-year research releases

The [citywide road trend, 2011–2024](../data/releases/citywide_road_trend/README.md), is a separate citywide series of counts, not rates. The [NCRB 2011–2015 historical panel](../data/releases/historical_2011_2015/README.md) is staged off the dashboard, with original geography and definition breaks. See [the history guide](HISTORICAL_2011_2015.md); neither changes the nine production crime years below.

Import-ready releases are organized like the audited 2025 folder:

- [`data/releases/2016/`](../data/releases/2016/) through [`data/releases/2024/`](../data/releases/2024/): one folder per production year.
- Every year contains `district_crime.csv`, `district_crime.json`, `manifest.json`, and a short README.
- Compatible road-safety and crash-zone tables are included only for years in which those datasets exist.
- [`data/releases/shared/manifest.json`](../data/releases/shared/manifest.json) catalogs infrastructure, boundaries, approximate-location layers, derived analyses, checksums, source URLs and reuse caveats that do not belong to one year.
- [`data/releases/manifest.json`](../data/releases/manifest.json) is the machine-readable release index. The existing [`data/releases/2025/`](../data/releases/2025/) remains a separate audited staging release and is not silently treated as production.

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

Read `manifest.json` before analysis: it defines source URLs, SHA-256 checksums, coverage, null meaning, and previous-year comparability. For a fuller worked example — loading all nine years into one long panel, checking coverage before aggregating, and a basic citywide trend plot — see [`notebooks/example_analysis.ipynb`](../notebooks/example_analysis.ipynb).

If a figure you've already cited from here changes in a later release, it will be logged in [`docs/DATA_CHANGELOG.md`](../docs/DATA_CHANGELOG.md), separate from the dev-facing [`docs/AGENT_CHANGELOG.md`](../docs/AGENT_CHANGELOG.md).

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
[`exports/`](../exports/) predate the year-by-year releases above. They are
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

## Phase 1 staged releases (2026-10-19; hand-maintained documentation)

The derived collection remains unchanged. `data/releases/2025/irad/manifest.json` is authoritative for staged 2025 iRAD; `data/releases/2026/irad/manifest.json` is provisional, year-to-date, and must never be compared with a full year. Both preserve input columns, values, duplicates and source order. `data/releases/irad_dispositions.json` accounts for every input row once, including historical, multi-year and undated exclusions. Counts and coverage are generated, not maintained in this prose.

Coverage matrices distinguish dated monthly observations, partial endpoints, gaps, year-only periods and overlapping annual/cumulative station windows. Blank scope is unspecified. Central December is a partial endpoint. Missing rows are not zeros. Source links prove that identical bytes were published on the verification date, not the original download location. PDF generation time, link-verification date and release metadata date are distinct.

`data/reference/police_station_crosswalk.csv` covers all distinct collection reporting-district/station-label pairs. Its evidence CSV is an author-created draft pending human verification. The owner clarified that repeated printed occurrences for the same normalized name and police district represent one identity, while all occurrences remain evidence; names identifying different districts remain ambiguous. The territorial roster and contextual repeated name occurrences are recorded separately in evidence notes. The extract includes the territorial roster and other station lists on printed pages 13-25, supporting MACT branch entries, and contextual repeated occurrences; it does not claim an exhaustive transcription of every address or specialised branch throughout the Manual. The post-period Manual cannot prove historical jurisdictions. The four required unresolved labels remain unresolved. No police-district aggregation is implemented.

The legacy pipeline config is unchanged. Compatibility joins its raw label to every normalized matching source label without inventing a reporting district, preserving its canonical display name, police district and page. See generated crosswalk coverage for those joins and mapped source-table row shares with denominators. These rows include overlapping annual and monthly windows, not unique stations, incidents or geographic completeness.

Both release commands invoke `scripts/build_all_releases.js`: production years, staged iRAD, crosswalk, shared inventory, then the index last. The release metadata date is a human-maintained constant; new manifests set generatedAt to null. Rebuild and fail on differences.
