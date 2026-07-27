# Delhi Crime Dashboard

A self-contained, single-file dashboard analyzing crime and road-safety data
across Delhi's 15 police districts (2022-2024) against real public
infrastructure coverage — streetlights, pedestrian underpasses, metro station
gates, and police infrastructure.

Open [`delhi_safety_dashboard.html`](delhi_safety_dashboard.html) directly in
a browser — no server or build step required to view it.

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
- **`data/`** — district-level crime, infrastructure, and correlation data as
  JSON.
- **`fonts/`** — the Big Shoulders webfont, embedded as base64 at build time.

## Data & sourcing

Every figure is cited directly in the dashboard's footer and in its
downloadable Excel workbook (Sources & Methodology sheet), including:

- Crime data (2022-2024): National Crime Records Bureau (NCRB), *Crime in
  India*, District Wise Reports.
- Road-safety data (2022): Delhi Traffic Police / Transport Department GNCTD,
  *2022 Delhi Road Crash Fatalities Report*.
- Streetlights & underpasses: PAPL survey, via Delhi Transport Stack Open
  Transit Data.
- Metro station gates & police chowkis/outposts: OpenStreetMap (ODbL).
- Police stations & district boundaries: Delhi Police GSDL.

Coverage gaps (e.g. districts the streetlight survey never drove through) are
treated as missing data, not zero — see the in-app confidence markers and the
"How this is calculated" panel for details.
