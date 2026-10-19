# Using the data: yearly releases, manifests and legacy exports

How to load the research releases, what the manifests promise, and what to keep straight before you publish. Moved out of the README.

## Year-by-year research releases

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
