# Delhi Crime Dashboard

A self-contained, single-file dashboard analyzing crime and road-safety data
across Delhi's 15 police districts (2022-2024) against real public
infrastructure coverage — streetlights, pedestrian underpasses, metro station
gates, and police infrastructure.

Open [`delhi_safety_dashboard.html`](delhi_safety_dashboard.html) directly in
a browser — no server or build step required to view it.

## What's new in this version

- **Full 15-district 2023 crash data.** The Delhi Road Crash Report 2023 uses
  the same 15-district geography as everything else on this page (unlike the
  2022 report, which only covers 11), so its crash-prone-zone, fatal-crash,
  and total-crash figures are now selectable choropleth/list metrics with
  zero coverage gaps.
- **107 named crash-prone zones with real severity**, replacing the old
  87-zone, name-only 2021 list. Each zone now carries its actual 2023 simple/
  fatal/total crash counts, plus coordinates for all 107 (cross-validated
  against the source table by rank and fatal-crash count — zero mismatches).
  105 of 107 fall inside a district polygon and are plotted on the map as a
  toggleable layer, sized and shaded by fatal crash count; the remaining 2
  sit just outside every simplified district boundary and stay in the text
  list instead of being force-placed.
- **District-center markers** on the map — a ring-and-dot symbol at each
  district's polygon centroid (labeled as an approximate center, not a
  specific administrative address).
- **Citywide road-safety detail panel**, consolidated into one tabbed section
  (Trends / By Mode of Travel / Crash-Prone Zones) instead of three separate
  panels: a 2014-2023 crash/fatality trend line, a 2019-2023 breakdown of
  road deaths by mode of travel (pedestrian, two-wheeler, car, cyclist, bus),
  and the full crash-prone-zone list.
- **Year comparison for crime data.** A 2022 / 2023 / 2024 toggle on the map,
  ranked list, and district detail panel, each with a "vs. previous year"
  change badge, backed by three years of matching NCRB district-wise tables.
- **Downloadable everything.** Every dataset above has its own CSV button,
  plus a full Excel workbook (Data, Correlation Matrix, Data Dictionary,
  Sources & Methodology, Current Comparison sheets) for citation.

## Using this data in your own report or dashboard

The dashboard's in-app CSV/Excel buttons are meant for a person clicking
around in a browser. If you want to pull the data programmatically instead —
into a report, a notebook, or your own dashboard — use the [`exports/`](exports/)
directory: plain CSV + JSON files, one per dataset, stripped of anything
specific to this dashboard's own rendering (no SVG path strings, no pixel
coordinates — real latitude/longitude instead).

| File | Rows | What's in it |
|---|---|---|
| `exports/districts.csv` / `.json` | 15 | Every crime (2022/23/24), road-safety (2022 and 2023), and infrastructure figure, one row per district. Raw counts only — no derived ranks or percentages; compute those yourself from these numbers if you need them. |
| `exports/crash_prone_zones_2023.csv` / `.json` | 107 | Named crash-prone zones with real 2023 simple/fatal/total crash counts and coordinates for all 107, `geocoded: true` throughout. |
| `exports/road_safety_trends_2014_2023.csv` / `.json` | 10 | Citywide road crashes, fatalities, and fatal crashes, one row per year. Not broken down by district. |
| `exports/road_deaths_by_mode_2019_2023.csv` / `.json` | 5 | Citywide road deaths/injuries by mode of travel (pedestrian, cyclist, car, two-wheeler, bus, slow-moving, other), one row per year. |

**Fetch directly without cloning**, e.g. from a notebook or another app:

```bash
curl -O https://raw.githubusercontent.com/ayushthaosen-gif/DelhiCrimeDashboard/main/exports/districts.csv
```

```js
const districts = await fetch(
  'https://raw.githubusercontent.com/ayushthaosen-gif/DelhiCrimeDashboard/main/exports/districts.json'
).then(r => r.json());
```

```python
import pandas as pd
districts = pd.read_csv('https://raw.githubusercontent.com/ayushthaosen-gif/DelhiCrimeDashboard/main/exports/districts.csv')
```

**Regenerate the exports** after changing anything in `data/`:

```bash
node export_data.js
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

The HTML file is generated from `build.js`, which reads the data in `data/`
and the fonts in `fonts/`, and writes the finished `delhi_safety_dashboard.html`
back to the repo root:

```bash
node build.js
```

Edit `build.js` (not the generated HTML) to change layout, styling, or logic,
then re-run the command above.

## What's in here

- **`delhi_safety_dashboard.html`** — the generated dashboard (the actual
  deliverable).
- **`build.js`** — the Node build script: one large template literal producing
  the full HTML + CSS + JS, with no external libraries or CDN dependencies.
- **`data/`** — district-level crime, infrastructure, road-safety, and
  correlation data as JSON. Internal, purpose-built for `build.js` — if you
  want to reuse the data yourself, use `exports/` instead (see above).
- **`fonts/`** — the Big Shoulders webfont, embedded as base64 at build time.
- **`export_data.js`** / **`exports/`** — the clean CSV/JSON exports and the
  script that generates them, for anyone integrating this data elsewhere.

## Data & sourcing

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
- Metro station gates & police chowkis/outposts: OpenStreetMap (ODbL).
- Police stations & district boundaries: Delhi Police GSDL.

Coverage gaps (e.g. districts the streetlight survey never drove through, or
the 2022 road-crash report's 11-district geography) are treated as missing
data, not zero — see the in-app confidence markers and the "How this is
calculated" panel for details.
