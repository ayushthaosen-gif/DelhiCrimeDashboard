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
  fatal/total crash counts. 42 of the 107 were confidently geocoded and are
  plotted on the map as a toggleable layer, sized and shaded by fatal crash
  count; the rest are listed with their real numbers rather than guessed at.
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
  correlation data as JSON.
- **`fonts/`** — the Big Shoulders webfont, embedded as base64 at build time.

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
- Crash-prone zone map coordinates: OpenStreetMap Nominatim geocoding of the
  zone names (42 of 107 resolve confidently; the rest are listed by name).
- Streetlights & underpasses: PAPL survey, via Delhi Transport Stack Open
  Transit Data.
- Metro station gates & police chowkis/outposts: OpenStreetMap (ODbL).
- Police stations & district boundaries: Delhi Police GSDL.

Coverage gaps (e.g. districts the streetlight survey never drove through, or
the 2022 road-crash report's 11-district geography) are treated as missing
data, not zero — see the in-app confidence markers and the "How this is
calculated" panel for details.
