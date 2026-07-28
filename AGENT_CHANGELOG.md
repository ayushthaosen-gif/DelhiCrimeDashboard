# AI Collaboration Log & Changelog

## [2026-07-28] - Claude (Anthropic) - Historical Data Integrated into Main Dashboard, Total-Infra Default View

### 📈 2016-2021 theft/robbery/burglary now live on the map, list, and detail panel

Integrates Codex's `delhi_crime_2016_2021_harmonized.json` (previously generated but not wired into anything) into `dashboard_final.json` and `build.js`, plus two smaller user-requested changes.

1. **Merged `data/delhi_crime_2016_2021_harmonized.json` into `data/dashboard_final.json`** — every district record now also carries `theft2016`...`theft2021`, `robbery2016`...`robbery2021`, `burglary2017`...`burglary2021` (2016 burglary deliberately omitted, matching Codex's own definition-break caveat), plus the coverage/comparability flag fields Codex built for exactly this purpose.
2. **Generalized the year-lookup system in `build.js`** rather than special-casing historical years: the whole codebase already used a `<metricKey><year>` field-naming convention (`theft2022`, `theft2024`) with the metric's own "current" year stored bare (`theft`) — the historical fields follow the identical convention, so `yearField()`/`metricValue()`/`yearSuffix()`/`prevYearOf()` needed generalizing (dropping their hardcoded 2022/2024 branches for a uniform `key + year` rule), not extending. Added `historicalYears` to the `theft`/`robbery`/`burglary` METRICS entries; `buildYearToggle()` now renders 2016-2024 (2017-2024 for burglary) only for those three, with the historical buttons tooltipped with their distinct source.
3. **Respects every caveat Codex's data already encodes**: `computeAnalysis()` branches for historical years — skips the total-IPC/crime-against-women framing (not reconstructed for 2016-2021) and states plainly why; suppresses the infrastructure-correlation paragraph entirely for historical years rather than silently correlating present-day streetlight data against a different decade; `crimeRow()` checks each metric's `<key>PreviousYearComparable<year>` flag and shows "not comparable to `<year>`" instead of a year-over-year badge across a boundary the source data itself flags as invalid (e.g. burglary 2016→2017's definition break). Districts that didn't exist as a separate reporting zone in a given year already render as the existing no-data hatch, for free, since the merged fields are simply `null` there — no new map/list code needed.
4. **Switching metrics resets the year if it's no longer valid** (e.g. leaving Theft/2019 for Total IPC snaps back to 2023) so the page can never end up requesting a metric/year combination that doesn't exist.
5. **"Total Infrastructure — Citywide" now shown when no district is selected**, replacing an arbitrary default to South-East. New `renderTotalInfraSummary()`: citywide crime totals (with a coverage note when fewer than 15 districts report a metric for the selected year), citywide infra totals with an X/15-districts-covered note per layer, and — the only place it belongs — the newly-added **374 official DSCSC/DCCWS licensed liquor vends** citywide count (see below), since it has no reliable per-district breakdown.
6. **Evaluated the user-supplied `delhi_liquor_vends_with_osm_coordinates.zip`** (374 official government liquor-vend records + 13 standalone OSM points): confirmed all 14 geometry-bearing points in the zip already exist in the dashboard's current 65-point `alcoholShop` OSM layer (matched by OSM id) — zero new mappable locations. The only new information is the citywide **total of 374 officially licensed vends** (vs. OSM's 65 community-mapped ones), which isn't attributable to individual districts (373 of 374 official records have no published coordinate) — added as a citywide-only fact in the new Total Infra view and in the Sources citation/Excel sheet, not as a map layer or per-district metric.
7. Updated the footer Sources citation, the Excel "Sources & Methodology" sheet (two new rows), and the "Year comparison" methodology blurb to describe the historical extension's exact scope and the liquor-vends provenance.

**Deliberately out of scope** (would need separate, more invasive work): bivariate mode, the correlation matrix, scatter plots, and CSV/Excel field export were not extended to cover 2016-2021 — bivariate/correlation would require pairing historical crime with historical infrastructure, which doesn't exist (Codex's own `infrastructureWarning` already says as much), and the export field list is a hand-picked flat schema that would need its own redesign for 9 years x 3 metrics rather than a quick add.

Verified: rebuilt `delhi_safety_dashboard.html`, extracted `<script>` passed `node --check` (caught and fixed one unescaped apostrophe that broke the historical-year correlation-suppression string), served locally, confirmed via `javascript_tool` on a genuinely fresh page load — default view is "Total Infrastructure — Citywide" with correct citywide sums and the 374-vend citation; switching to Theft/2018 updates the map/ranked-list/detail panel correctly; Total IPC/Crime-against-Women/SLL rows show "—" (not garbage or zero) for a historical year; burglary's year toggle omits 2016 while theft/robbery's includes it; the 2016→2017 burglary boundary correctly shows "not comparable to 2016" instead of a misleading percentage; switching from a historical year to a non-historical metric resets the year; and no console errors throughout a full click-around regression (metric tab → historical year → district select → rank-list click).

---

## [2026-07-28] - Codex (OpenAI) - Historical Zone-Existence Labels

1. Replaced ambiguous historical `not separately reported` coverage with `district did not exist as a separate reporting zone`.
2. Added a boolean `districtExistedAsSeparateZoneYYYY` field for every district-year so map and analysis code can distinguish non-existent historical zones from metric-definition nulls.
3. Updated rendering metadata with the exact user-facing label and an explicit prohibition on displaying either null class as zero.

## [2026-07-28] - Codex (OpenAI) - Incorporation-Safe Historical Schema

1. Extended `build_verified_historical_data.js` to generate `data/delhi_crime_2016_2021_harmonized.json`, keyed by the same district `name` used in `dashboard_final.json`.
2. Added flat year fields (`theft2016`, `robbery2016`, etc.), per-year coverage, and metric-specific previous-year-comparison eligibility.
3. Deliberately nulled 2016 burglary because its source definition combines criminal trespass and burglary; 2017 onward uses the comparable day-plus-night burglary definition.
4. Added machine-readable metric availability and rendering rules so unsupported values cannot become zero, rankings, correlations or invalid percentage changes.

## [2026-07-28] - Codex (OpenAI) - Verified Historical Crime Data File

1. Added `build_verified_historical_data.js` to reproduce a conservative 2016–2021 Delhi territorial-district crime dataset from the NCRB-derived India Data Portal extracts.
2. The generated file contains theft, robbery and burglary only, with per-row coverage and comparability flags. Unsafe reconstructed IPC, crime-against-women and SLL totals are explicitly omitted.
3. The verification metadata records the 45/45 exact 2022 cross-check, district-coverage changes, specialized-unit exclusions, the 2016 burglary definition break and the confirmed misclassified Lakshadweep SLL record.

This log tracks all architectural, performance, accessibility, and code quality changes made by AI assistants (Antigravity & Claude) on the **Delhi Crime Dashboard** repository.

> **Note for AI Assistants (Antigravity & Claude)**:
> Whenever you make changes to this codebase, please add an entry below under `## [Date] - [Assistant Name]` describing what was modified, added, or refactored so that future turns and other AI agents remain fully synchronized.

## [2026-07-28] - Claude (Anthropic) - Interactive Map Upgrade, Phase 6: URL State, Export, Mobile (final phase)

### 🔗 Shareable URLs, CSV/GeoJSON export, mobile bottom sheets

Phase 6 of 6 — completes the interactive-map upgrade requested by the user (phases 1-5, below, covered year/rate/bivariate parity, search/zoom/drawer, clustering/heatmap/circles, spatial radius-intersection tools, and the composite unsafe-areas layer).

1. **Shareable URL state** (`?year=2023&crime=theft&rate=perCapita&bivariate=1&infra=busStop&district=North`, matching the exact format the user asked for) — `applyUrlStateOnLoad()` reads params once before the first render; `updateUrlState()` writes them back via `history.replaceState()` at the end of every `renderChoropleth()` call, since virtually every state-changing control already routes through that one function — one hook instead of wiring every individual control. A "🔗 Share view" button copies the current URL to the clipboard.
2. **CSV / GeoJSON export of the currently filtered map** — both reflect exactly what's on screen (current metric, year, rate mode, and bivariate infra layer if active), not a fixed full-data dump; filenames encode the active state (e.g. `delhi_map_theft_2023_density.csv`).
3. **Mobile bottom sheets** (`max-width: 720px`) — all filter/toggle controls collapse behind a "☰ Filters" button that slides them up as a bottom sheet instead of a cluttered multi-row topbar; the district drawer switches from a right-side slide-in to a bottom-side slide-up sheet on the same breakpoint.

**Two bugs caught during verification**:
- The CSV-export row-join used a literal `\n` inside the *outer* template literal that `build_interactive_map.js` itself uses to build the whole HTML/script string — the outer template literal's own escape processing turned `\n` into a real newline character before it ever reached the generated page, landing as an actual line break inside a single-quoted JS string in the shipped script (a syntax error). `node build_interactive_map.js` ran fine (the outer script is valid JS either way) but the *generated* file failed `node --check`. Fixed by escaping it as `\\n` in the source so the generated code contains a literal backslash-n.
- The mobile "Filters" bottom sheet's `display: none` media-query rule for `#pointLayerToggles` was silently overridded by an inline `style="display:flex"` attribute on that same element from phase 3 — inline styles always beat stylesheet rules regardless of selector specificity. Caught by checking `getComputedStyle(...).display` before/after clicking the mobile toggle and seeing no change. Fixed by moving the inline style to a `.point-toggles-row` CSS class so the media query can actually override it.

Verified: rebuilt, `node --check` passed after both fixes, served locally (with a corrected test server that strips query strings before resolving the file path — the first version 404'd on any `?...` URL, which is a test-harness limitation, not an app bug) — confirmed a full round-trip (set state via UI → read back the resulting URL → reload with those exact params → every piece of state, including zoomed-to-district and open drawer, restored correctly), CSV/GeoJSON downloads captured via a `URL.createObjectURL` override and inspected directly (correct headers, values, and metadata for the active filter state), and the mobile bottom sheet toggling verified at a 375px viewport via `resize_window`. Finished with a full phase 1-6 regression pass together in one script (metric change → district select → point layer → spatial analysis → unsafe mode → URL check → reset) confirming no phase broke any other, and no console errors throughout.

---

## [2026-07-28] - Claude (Anthropic) - Interactive Map Upgrade, Phase 5: Composite "Unsafe Areas" Layer

### ⚠️ Transparent composite risk layer, with a user-facing methodology writeup

Phase 5 of the 6-phase interactive map upgrade (phases 1-4, below, covered year/rate/bivariate parity, search/zoom/drawer, clustering/heatmap/circles, and spatial radius-intersection tools).

1. **`computeUnsafeScores()`** — each district's composite score is the plain average of five factors, each independently converted to a 0-1 percentile rank first (`percentileScale()`, already used elsewhere on this page) so no single factor's raw scale can dominate: total IPC crime density, crime-against-women density, and fatal-crash (2023) density (higher rank = less safe), plus police infrastructure density and streetlight density (both inverted — lower coverage = less safe). Streetlight density is excluded from the average for districts the PAPL survey never covered, rather than silently treated as zero.
2. **No hidden weighting** — every factor counts equally, and this is stated directly in a methodology modal (`#methodOverlay`, opened via a "ⓘ methodology" link that only appears once the layer is on) rather than left for the user to reverse-engineer.
3. **Toggle** (`#chkUnsafe`) replaces the choropleth fill with the composite score (0-100 scale, same rust color ramp) and each district's popup switches to a full factor-by-factor breakdown (label + percentile per factor, plus how many of the 5 factors were actually covered for that district) instead of the usual single-metric popup.
4. Wired into the reset-map control, same as every other toggle added in phases 3-4.

**Serious bug caught during verification** (via `javascript_tool`, not a visible failure): `unsafeMode` was declared with `let` far below where `renderChoropleth()` first runs during initial page setup. Referencing a `let` before its declaration line has executed throws a `ReferenceError` and — critically — silently halts all remaining top-level script execution for the rest of that `<script>` block. This meant the entire Phase 4 spatial-analysis wiring (event listeners for the analysis dropdown, radius toggle, heatmap checkbox, methodology modal) would have shipped broken, not just the new Phase 5 code, because they're declared later in the same script and never got the chance to register. Fixed by moving `let unsafeMode = false;` up next to the page's other early state variables (`bivariateMode`, `displayMode`, etc.), before the first `renderChoropleth()` call. A second, unrelated syntax error (backticks inside a JS comment prematurely closing the outer template literal that builds the whole HTML string in `build_interactive_map.js`) was caught by `node build_interactive_map.js` itself failing to run, before this even reached the browser.

Verified: after both fixes, re-ran the *entire* phase 3-5 test suite end-to-end in one pass (not just the new Phase 5 code) specifically because the TDZ bug had a blast radius — confirmed marker clustering, heatmap, bus-stop toggling, the crashes-near-liquor-shops analysis (4 of 107 within 250m, unchanged from Phase 4's own verification), the composite score computation and legend/popup content, the methodology modal open/close, and reset-map all work correctly together with no console errors.

**Not yet done** (final phase): URL state, CSV/GeoJSON export of the filtered map, mobile bottom sheets.

---

## [2026-07-28] - Claude (Anthropic) - Interactive Map Upgrade, Phase 4: Spatial-Intersection Tools

### 📐 Radius-based crash-zone analyses, weak-police-coverage districts, adjustable radius

Phase 4 of the 6-phase interactive map upgrade (phases 1-3, below, covered year/rate/bivariate parity, search/zoom/drawer, and clustering/heatmap/circles).

1. **`haversineMeters()`** — great-circle distance, accurate at Delhi's scale (city spans ~50km, well within where the spherical-earth approximation's error is negligible).
2. **Adjustable radius control** (100m / 250m / 500m / 1km segmented toggle, `analysisRadius`), shared by every spatial tool below.
3. **Four analysis modes** (`#analysisSelect`), computed live over the 107 geocoded crash zones and existing POI datasets — no new data needed:
   - Crashes with a liquor shop within the radius
   - Crashes with **no** surveillance point within the radius
   - Crashes with a bus stop within the radius
   - High-crime districts with weak police coverage (district-level, not radius-based — top-tertile on the selected crime metric **and** bottom-tertile on police infrastructure density, using the same `getTertileIndex()` as bivariate mode)
   Point-radius modes recolor matching crash-zone markers (amber ring) and fade non-matches; the district mode draws a dashed rust outline around matches. A plain-English summary line states the exact match count and radius used.
4. **Click a crash zone → nearby-infrastructure panel** (`showNearbyInfra()`) — counts liquor shops, CCTV/guards, bus stops, ATMs, police stations, and chowkis within the current radius of that specific zone, independent of whichever analysis mode (if any) is active.

**Sanity-checked, not just executed**: the weak-police-coverage query returned "0 of 15" districts for Theft — rather than assuming that's a bug, cross-checked the raw per-district crime/police-density numbers directly and confirmed it's a real result: Delhi's top-tertile-crime districts (North-West, North-East, Shahdara, East, Central) all happen to have above-average police infrastructure density, consistent with the existing correlation matrix's already-verified +0.538 Pearson r between Police Infra and Theft — police presence tracks crime demand here, so "high crime + weak coverage" is a genuinely empty intersection for this metric, not a broken query.

Verified: rebuilt, `node --check` passed, served locally — all four analysis modes return sensible, radius-scaling match counts (liquor-shop proximity: 4/107 at 250m → 26/107 at 1km), the nearby-infrastructure panel returns correct per-type counts on a real zone click, and the page layout was restructured from fragile hardcoded pixel offsets (`top: 78px`) to a flexbox column (topbar + analysis bar auto-sized, map region filling the remainder) specifically because the new analysis bar row would otherwise have silently overlapped the map — confirmed via `map.getSize()`/`clientHeight` matching the actual available space. No console errors.

**Not yet done** (later phases): composite "unsafe areas" layer, URL state, CSV/GeoJSON export, mobile bottom sheets.

---

## [2026-07-28] - Claude (Anthropic) - Interactive Map Upgrade, Phase 3: Clustering, Heatmap, Circles

### 🧩 Marker clustering, shape variety, heatmap/proportional-circle modes, reset control

Phase 3 of the 6-phase interactive map upgrade (phases 1-2, below, added year/rate/bivariate parity and search/zoom/drawer).

1. **Marker clustering** for the two dense point layers (Leaflet.markercluster via CDN) — bus stops (3,151) and ATMs (649) now cluster into bubbles that split apart on zoom, instead of rendering thousands of unclustered circles that were unreadable and slow to pan.
2. **Distinct marker shapes per layer** (`shapeIcon()` div-icon helper): police stations = square, chowkis/posts = triangle, liquor shops = diamond, CCTV/guards = ring, bus stops/ATMs = small dot inside clusters — colors alone no longer have to carry all the distinction.
3. **Heatmap mode** (Leaflet.heat) — crash zones weighted by fatal-crash count, toggleable independently of the discrete circle-marker crash-zone layer, for a citywide-glance view of crash concentration.
4. **Proportional-circle display mode** — a Choropleth/Circles toggle; Circles mode fades the district fill to near-transparent and draws a circle at each district's centroid, area-scaled (sqrt of value, not radius-linear) to the selected metric, avoiding the area bias where a physically large sparse district and a small dense one read as equally "intense" under a flat fill.
5. **Layer counts** next to every point-layer checkbox label (e.g. "Bus stops (3,151)"), and a **point-layer legend** (shape + color swatch per active layer) that appears once any point layer is toggled on.
6. **Reset-map control** — one button restores default view/zoom, clears district selection and the drawer, unchecks bivariate/heatmap/all point layers, and resets display mode to choropleth.

**Bug caught during verification**: the reset button's checkbox-clearing loop dispatched the `change` event *before* setting `checked = false`, so the handler still read the old `true` state and re-added layers instead of removing them — bus stops/ATMs stayed on the map after "reset." Fixed by flipping `checked` first, then dispatching only if it had actually been on.

Verified: rebuilt, `node --check` passed, served locally — confirmed via `javascript_tool` that `L.markerClusterGroup`/`L.heatLayer` loaded from CDN and built cluster groups with the exact expected counts (3,151/649), toggling layers updates counts/legend/map state correctly, heatmap and circle modes both activate with the right layer/point counts (15 district circles), and reset now genuinely clears every toggled state (layers, heatmap, circles, selection, drawer, view) — no console errors at any step.

**Not yet done** (later phases): spatial radius-intersection tools, composite "unsafe areas" layer, URL state, CSV/GeoJSON export, mobile bottom sheets.

---

## [2026-07-28] - Claude (Anthropic) - Interactive Map Upgrade, Phase 2: Search, Zoom, District Drawer

### 🔍 District search + zoom-to-district, right-side district intelligence drawer

Phase 2 of the 6-phase interactive map upgrade (phase 1, below, added year/rate/bivariate parity).

1. **District search** — text input in the topbar with a live-filtered dropdown (substring match on district name); Enter selects the typed exact match or the first filtered result; Escape/outside-click dismisses.
2. **Zoom-to-district** — selecting a district (via search, or clicking its polygon) calls `map.fitBounds()` on that district's geometry and opens its popup. The selected district's outline is highlighted (amber, thicker stroke) in `renderChoropleth()`.
3. **Right-side district intelligence drawer** (`#drawer`, slide-in panel) — shows the selected district's current metric value/rank/YoY change, area & population, a full infrastructure-coverage list (value + covered/gap badge per `infraCovered()`, same logic as `build.js`), and a live correlation column (Pearson r of every INFRA layer vs. the currently selected crime metric, citywide) — reusing `pearson()` ported from `build.js`. Closes via an ✕ button, which also clears `selectedDistrict` and re-renders.
4. Drawer content re-renders automatically whenever the year/rate-mode/metric changes while a district is selected (`renderChoropleth()` calls `renderDrawer()` at the end when `selectedDistrict` is set), so it never shows stale numbers against the current map state.

**Two bugs caught during verification, both via `javascript_tool` rather than a visible failure**:
- `selectDistrict()` captured the Leaflet layer reference *before* calling `renderChoropleth()`, which rebuilds `geoLayer` (and therefore `districtLayers`) from scratch — the captured reference was already detached by the time `fitBounds()`/`openPopup()` ran. Fixed by re-reading `districtLayers[name]` after the rebuild.
- `map.fitBounds()` with default animation never updated `getCenter()`/`getZoom()` in this verification environment — traced to the Browser pane not actively compositing frames (confirmed via `map._lastCenter`, which *did* update correctly, versus the animated `getCenter()`, which lagged indefinitely). Fixed by passing `{ animate: false }`, which is also more robust for the URL-driven navigation planned in a later phase.

Verified: rebuilt, `node --check` on the extracted script passed, served locally — `selectDistrict()` correctly updates the map center/zoom/selected outline and opens the drawer with values cross-checked against the main dashboard's own South-East detail panel (theft 238.9/km², rank 4th, +14.3% vs 2022) and correlation matrix (Police Infra r=+0.538, Streetlights r=-0.281, etc. — exact matches); search filtering, Enter-to-select (verified via direct event dispatch matching real focus/value state), and drawer-close all confirmed with no console errors.

**Not yet done** (later phases): marker clustering, heatmap/proportional-circle modes, spatial radius-intersection tools, composite "unsafe areas" layer, URL state, CSV/GeoJSON export, mobile bottom sheets.

---

## [2026-07-28] - Claude (Anthropic) - Interactive Map Upgrade, Phase 1: Year/Rate/Bivariate Parity

### 🗺️ `interactive_map.html` gains the main dashboard's core analytical parity

**Why**: the user asked for a substantial upgrade to the Leaflet interactive map (~20 requested features — year selector, drawer, clustering, heatmaps, spatial-intersection tools, URL state, mobile sheets, etc.). Given the scope, agreed with the user to build it in phases rather than one large unverified pass. This is phase 1 of 6.

1. **Year selector (2022/2023/2024)** — mirrors `build.js`'s year-aware `METRICS[]` (`prevKey`/`key2024` fields); switches choropleth colors, popup values, and ranks. Road-safety metrics with a fixed reporting year (`fatalRoadCrashes2022`, `crashProneZones2023`, etc.) hide the toggle, same as the main dashboard.
2. **Density (per km²) / per-capita (per 100k) toggle** — reuses the same `getRateVal()` formula as `build.js`.
3. **Year-over-year % change badge** in every district popup (▲/▼, colored), computed against the previous year's value in the same rate mode.
4. **3×3 bivariate mode** (crime × infrastructure) — ported `BIVARIATE_MATRIX`/`getTertileIndex()`/`getBivariateColor()` from `build.js` verbatim (tertiles computed live from whichever districts have valid data, not fixed cut points), with its own dedicated 3×3 grid legend and an infra-layer dropdown.
5. **Richer popups**: district name, metric+year, rank of 15, formatted value with unit, YoY badge, and a source citation line (crime source + infra source when in bivariate mode) — previously just showed a bare number.

**Bug caught during verification**: initial `rankOf()` port expected feature objects (`f.properties[key]`) but was called with an already-unwrapped properties array, throwing `Cannot read properties of undefined` on every choropleth render after the first. Caught via `javascript_tool` after a UI click produced no visible change and `geoLayer` stayed `null`; fixed by matching the function signature to what's actually passed in.

Verified: rebuilt via `node build_interactive_map.js`, extracted `<script>` passed `node --check`, served locally, confirmed via `javascript_tool` — year/rate toggles update `activeYear`/`rateMode` and the legend text correctly (checked Theft 2023 density → 2024 per-100k, values changed as expected), bivariate mode renders the correct 3×3 legend and combined-source popup content, no console errors at any step.

**Not yet done** (later phases): district search/zoom, intelligence drawer, marker clustering, heatmap/proportional-circle modes, spatial radius-intersection tools, composite "unsafe areas" layer, URL state, CSV/GeoJSON export, mobile bottom sheets.

---

## [2026-07-28] - Claude (Anthropic) - DMRC Official Station/Gate Data Evaluated, Not Integrated

### 🚇 `metroGates` left on OSM data — user-supplied DMRC file has a data-quality problem

The user supplied `dmrc_station_and_gate_locations.xlsx` (official DMRC station + gate list, 2 sheets, no xlsx-reading package in the repo so parsed manually from the underlying OOXML via `unzip` + a small regex-based sheet reader) as a candidate to replace the OSM-derived `metroGates` metric (`railway=subway_entrance`, 529 points).

**Finding**: after parsing (268 station rows / 264 unique stations; 687 gate rows) and building a coordinate parser robust to the file's many DMS notations (`°`/`˚`/`*`/`⁰`, dotted deg.min.sec, swapped lat/lng, literal `"28 DEG N"` placeholders), a systemic issue surfaced that isn't a formatting quirk: **~13% of stations (34 of 264) and ~82 of 687 gates share one of a handful of identical placeholder coordinates with completely unrelated stations** — e.g. `28.6314,77.2192` (Rajiv Chowk's real coordinate) is reused verbatim by 19 different stations (Arjan Garh, Laxmi Nagar, Noida City Centre, Nehru Place, Palam, Sikanderpur, etc.) and 41 gates across 14 stations. This reads as an incomplete geocoding pass baked into the source file, not noise — using it as-is would silently mis-plot ~1 in 8 stations on top of Rajiv Chowk instead of their real location.

**Decision**: presented the full flagged list to the user (34 station rows, 33 format-unparseable/geographically-nonsensical gate rows, 49 placeholder-sharing gate rows) with options to exclude-and-integrate, gates-only, or hold off. **User chose to hold off** — `metroGates`/`metroGateDensity` remain unchanged (OSM `railway=subway_entrance`, 529 points). No data files were modified for this item.

**If revisited later**: the coordinate parser and full flagged-row lists exist only in this session's scratch directory (not committed) — would need to be redone, but the methodology (regex DMS parser handling `°/˚/*/⁰` symbols + dotted deg-min-sec, plus a placeholder-coordinate detector via grouping by rounded lat/lng and flagging clusters shared across >2 distinct station names) is documented here for whoever picks this up.

---

## [2026-07-28] - Claude (Anthropic) - Refreshed Liquor Shop & CCTV Datasets (Overpass Re-query)

### 📡 More Complete OSM Data for `alcoholShop` and `surveillance` Layers

**Why**: the user supplied updated Overpass QL queries (`shop=alcohol` OR `shop=wine` OR `shop=beverages` with a qualifying `alcohol` tag, for liquor; `man_made=surveillance` for CCTV) plus a README explicitly noting these are OSM community-mapped snapshots, not authoritative government inventories. Re-running them confirmed OSM coverage has grown substantially since the original query: both new datasets are a strict superset of the previously-committed one (every old OSM id — 50 liquor, 433 surveillance — is contained in the new results), so this is a straightforward data refresh, not a methodology change.

1. **Liquor shops**: 50 → **65** points (`shop=alcohol`: 60, `shop=wine`: 5; no qualifying `shop=beverages` records currently mapped in Delhi). All 65 fall inside a district polygon.
2. **CCTV & guard posts**: 433 → **1,596** raw points, **1,583** inside a district polygon (13 fall outside every district boundary and are excluded from counts, same treatment as other OSM layers here).
3. Queried via `overpass.kumi.systems` (the primary `overpass-api.de` mirror returned HTTP 504 "server too busy"; rotated to the next mirror per the user's own script's endpoint list).
4. Updated `data/overpass_surveillance_alcohol.json` (combined source), re-ran the same equirectangular-projection + point-in-polygon pipeline used for every other POI layer to regenerate `data/dashboard_final.json` (`alcoholShops`/`alcoholShopDensity`/`surveillanceCameras`/`surveillanceDensity` per district), `data/poi_markers.json` (SVG-projected) and `data/poi_markers_latlng.json` (real lat/lng, for `interactive_map.html`).
5. Updated all count references in `build.js`: footer citation, Data Dictionary source map, and Excel Sources & Methodology sheet, plus widened the liquor-shop citation wording to mention all three shop tags now queried.
6. **Projection note**: no committed script does the lat/lng → SVG (x,y) conversion, so the exact affine transform was recovered by least-squares fit against the existing `busStops` marker pairs (3,151 points, sub-pixel residual <0.06px) rather than re-derived from scratch — same numerical result either way, just verified against known-good output instead of blind trust.

Verified: both new raw datasets confirmed as strict supersets of the old ones (by OSM id) before adopting; rebuilt `delhi_safety_dashboard.html` and `interactive_map.html`; extracted `<script>` passed `node --check`; served locally and confirmed via browser — no console errors, `#alcoholLayer`/`#surveillanceLayer` circle counts match exactly (65 / 1,583), Data Dictionary and correlation-matrix footnotes show the new counts and query wording, interactive map's embedded marker counts match, and toggling the liquor/CCTV layers on the Leaflet page produces no console errors.

---

## [2026-07-28] - Claude (Anthropic) - Interactive Leaflet Map (separate page)

### 🗺️ Real Basemap, Zoom/Pan — `interactive_map.html` + `build_interactive_map.js`

**Why a separate page, not a rewrite of the main dashboard**: the main dashboard is deliberately a single self-contained HTML file (no external requests, works from `file://`). Leaflet needs a tile server (CARTO, in this case) and the Leaflet library itself at view-time, which breaks that property. Rather than compromise the main dashboard's portability, this ships as a second, independent static page — `delhi_safety_dashboard.html` is completely unchanged in its own logic, just gained one link.

1. **`build_interactive_map.js`** generates `interactive_map.html`: Leaflet 1.9.4 (via unpkg CDN) + CARTO's free keyless Voyager basemap tiles (`{s}.basemaps.cartocdn.com`, OSM + CARTO attribution, no API key/signup required — chosen specifically over Stadia Maps, which needs a domain-registered key).

2. **Real lat/lng data, not the dashboard's projected SVG coordinates.** The main dashboard projects everything into a custom 1000×900 equirectangular SVG space with no inverse available for reuse. For this page:
   - `data/poi_markers_latlng.json` — bus stops/ATMs/liquor shops/surveillance re-derived from the original OSM sources keeping real lat/lng (same district point-in-polygon filter as `data/poi_markers.json`, so counts match exactly: 3,151 bus stops, 649 ATMs, 50 liquor shops, 430 surveillance).
   - `data/police_markers_latlng.json` — police stations/chowkis **inverse-projected** back to lat/lng from the existing `data/police_markers.json` (only x/y was ever saved for these), verified the round-trip lands on sane real-world coordinates (e.g. PS Civil Lines → 28.689, 77.222).
   - `data/dashboard_boundaries_simplified.geojson` copied in directly — already real lat/lng, no conversion needed.
   - Crash zones reuse `data/crash_zones_2023_geocoded.json` directly (already has real lat/lng).

3. **Features**: a metric dropdown (12 crime/infra metrics) driving a live percentile-scaled choropleth over the district GeoJSON (same rank-based color logic as the main dashboard, reimplemented standalone here since this page has no shared JS with `build.js`); seven independently toggleable point layers (police stations, chowkis, crash zones, bus stops, ATMs, liquor shops, CCTV/guards) — all off by default so the map opens uncluttered; popups on every marker and district.

4. **Link back**: added one button in the main dashboard's header (`Open interactive street map →`) linking to `interactive_map.html`; the new page has a "← Back to dashboard" link in its own topbar.

Verified: no console errors, Leaflet/CARTO tiles actually load over the network (confirmed via `.leaflet-tile-loaded` in the DOM, not just absence of errors), all layer counts match their known totals exactly (15 districts, 107 zones, 3,151/649/50/430 POI points), metric switching updates the choropleth colors and legend live, and layer toggle checkboxes correctly add/remove their Leaflet layer group from the map.

---

## [2026-07-28] - Claude (Anthropic) - POI Point Markers & Sources Citation Fix

### 🗺️ Bus Stop, ATM, Liquor Shop & CCTV/Guard Point Markers

1. **Sources citation gap**: the visible footer citation was missing Liquor Shops and CCTV/Guards — both had been added to `INFRA[]`, the Data Dictionary, and the Excel Sources & Methodology sheet, but never to the footer users actually see on the page. Added both.

2. **Point-level marker data (`data/poi_markers.json`)**: until now, bus stops/ATMs/liquor shops/surveillance only existed as per-district aggregate counts (density metrics) — there was no way to actually see *where* they are. Projected all four datasets into the map's SVG coordinate space using the exact same equirectangular projection as the district polygons (verified point-in-polygon counts match the existing aggregate counts exactly: 3,151/3,199 bus stops, 649/666 ATMs, 50/50 liquor shops, 430/433 surveillance points — the same points excluded from the district-count aggregation for falling outside every polygon are excluded here too).

3. **Four new toggleable map layers** (`#busStopLayer`, `#atmLayer`, `#alcoholLayer`, `#surveillanceLayer`), built once in `initMap()` following the existing police/zones pattern, with per-marker hover tooltips (name + district). Bus stops render small and semi-transparent (3,151 points) so they don't visually overwhelm the choropleth underneath; the other three are more visible at natural counts (fewer points).

4. **Purpose**: lets a viewer visually cross-reference where these POI types cluster against the crime choropleth or the bivariate mode added last commit — multiple layers can be toggled on simultaneously to look for spatial overlap/correlation directly on the map, not just as an r-value in the correlation matrix.

Verified: all four layer counts match their known aggregate totals exactly, tooltips show correct name/district on hover, all layers can be toggled on simultaneously together with bivariate mode + police + zones with no console errors and negligible render cost (layers are pre-built once, toggling is just a display:none/inline flip), and the CSV/Excel export builders still produce valid output.

---

## [2026-07-28] - Claude (Anthropic) - Bivariate Crime × Infrastructure Choropleth

### 🗺️ 3x3 Bivariate Map Mode

1. **`BIVARIATE_MATRIX` + `getTertileIndex()`** — 3x3 color grid (crime columns × infrastructure rows), tertile split computed live from whichever districts have valid data on both axes (not fixed cut points), so the grouping stays meaningful across metric/year/rate-mode switches.

2. **`getBivariateColor(d, crimeMetricKey, infraMetricKey)`** — deliberately built on `metricValue()`/`getInfraVal()` rather than dividing by `areaSqKm` directly, so bivariate mode respects whichever year (`activeYear`) and rate mode (density vs. per-capita, `rateMode`) are already selected elsewhere on the page instead of silently using a different basis.

3. **`renderMap()`**: branches fill color and hover-tooltip body on `isBivariateMode`; swaps between the existing percentile legend (`#singleLegend`) and a new 3x3 grid legend (`#bivariateLegend`) with live-updating axis labels (crime metric label / infra layer label).

4. **New toggle** (`#bivariateToggle`, wired via the existing `setupToggleControl()` helper) — "Bivariate map (crime × infrastructure)", crossing whichever crime metric tab (`activeMetric`) and infrastructure scatter-tab (`scatterType`) are currently selected.

5. **Bug caught during wiring**: the infrastructure scatter-tab click handler only called `renderScatter()`, not `renderMap()` — switching the infra axis while bivariate mode was on left the map showing the previous layer. Fixed by also calling `renderMap()` there when `isBivariateMode` is true.

Verified: toggled on/off cleanly, switched crime metric and infra tabs with live map/label updates (no manual refresh needed), confirmed all 9 matrix cells actually get used across the 15 districts, confirmed per-capita rate-mode switch doesn't crash it, and confirmed the CSV/Excel export builders (unrelated code path, sanity-checked since nearby) still produce valid output.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 10

### 📐 Academic & Public Policy Statistical Rigor Overhaul

1. **Statistical Significance Testing ($p$-Value Calculation)**
   - Implemented Student's $t$-distribution transformation ($t = \frac{|r|\sqrt{n-2}}{\sqrt{1-r^2}}$) and two-tailed $p$-value estimation (`getCorrelationPValue`).
   - Styled correlation matrix cells with significance indicators (`*` for $p < 0.05$, `(ns)` for non-significant $p \ge 0.05$) and added $t$-stat, $df$, and exact $p$-values to hover tooltips.

2. **Spearman’s Rank Correlation ($\rho$)**
   - Implemented non-linear monotonic rank correlation (`spearmanRank`) to mitigate linear outlier distortion.
   - Added a dual-mode coefficient switcher in the correlation matrix (**Pearson $r$** vs **Spearman $\rho$**) and displayed both $r$ ($p$-val) and $\rho$ ($p$-val) in the scatter plot summary card.

3. **Spatial Density vs. Per-Capita Crime Rate Switcher**
   - Integrated official Census population estimates for all 15 districts into `data/dashboard_final.json` (~18.14 million residents total).
   - Added a global **Calculation Mode Switcher**: **Spatial Density ($\text{cases}/\text{km}^2$)** vs **Per-Capita Rate ($\text{cases}/100\text{k residents}$)** across the choropleth map, ranked list, scatter plot, detail cards, and matrix.

4. **Z-Score Standardization**
   - Added mean ($\mu$) and standard deviation ($\sigma$) normalization functions (`calcMean`, `calcStdDev`, `computeZScore`) for multi-metric composite scoring and zero-centered variance scaling.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 9

### 🍷 Liquor Shops & CCTV/Guard Surveillance Infrastructure Layers

1. **Liquor Shops (`data/dashboard_final.json`, `build.js` INFRA[])**
   - Mapped 50 OpenStreetMap liquor/wine & beer shop points (`shop=alcohol` via Overpass API) cleanly into Delhi's 15 police districts using affine coordinate projection & point-in-polygon spatial testing.
   - Added `alcoholShop` metric (`alcoholShops` count and `alcoholShopDensity` per km²) to `INFRA[]` with full 15-district coverage.

2. **CCTV & Security Guard Surveillance (`data/dashboard_final.json`, `build.js` INFRA[])**
   - Mapped 433 OpenStreetMap surveillance points (`man_made=surveillance` via Overpass API, including CCTV cameras, ALPR systems, and security guard posts).
   - Added `surveillance` metric (`surveillanceCameras` count and `surveillanceDensity` per km²) to `INFRA[]` across all 15 districts (e.g. New Delhi: 119, East: 113, South-East: 85).

3. **Dashboard & Export Wiring**
   - Automatically flows through dynamic Pearson correlation matrix (`renderCorrelationMatrix()`), scatter plot tabs, CSV/Excel workbook export builders, and data dictionary.
   - Updated `export_data.js` and regenerated `exports/districts.csv` and `exports/districts.json`.

---

## [2026-07-28] - Claude (Anthropic) - Bus Stops & ATM Infrastructure Layers

### 🚌 New Infrastructure Metrics

1. **Bus Stops (`data/dashboard_final.json`, `build.js` INFRA[])**
   - Aggregated 3,199 OpenStreetMap bus stop points (`highway=bus_stop` / `public_transport=platform`) into per-district counts via point-in-polygon against the existing district boundaries.
   - 48 of 3,199 points fell outside every district polygon (likely just across the Delhi border) and are excluded from the district counts.
   - Added as a new `INFRA[]` entry (`busStop`) — full 15-district coverage, no survey gap, same treatment as `metroGate`.

2. **ATMs (`data/dashboard_final.json`, `build.js` INFRA[])**
   - Same treatment for 666 ATM points (`amenity=atm`, sourced via Overpass API). 17 of 666 fell outside every district polygon and are excluded.
   - Added as a new `INFRA[]` entry (`atm`).

3. **Wiring**
   - Both new entries flow automatically through every INFRA-driven feature already built by Antigravity's Phase 6 rewrite (dynamic `renderMethod()`, `renderCorrelationMatrix()`, scatter tabs, `computeAnalysis()`) since those all iterate `INFRA[]`/`METRICS[]` generically rather than hardcoding dimensions — no changes needed to that logic.
   - Added `busStops`/`busStopDensity`/`atms`/`atmDensity` to `FIELDS[]` (CSV/Excel export), the Data Dictionary SRC map, the Sources & Methodology sheet, and the footer citation.
   - Not added to `renderCompareCard()`'s side-by-side comparison — that function hand-picks a curated subset of fields (doesn't even include existing metro gates or underpasses), so this was left as a deliberate scope boundary rather than folded in.

**Note on repo scope**: per explicit user instruction, this chat now treats `DelhiCrimeDashboard` as the sole active project — no further changes will be synced in from `wallwalkerv4`. Bus stops were also added to `wallwalkerv4`'s copy of the dashboard earlier the same day, before this instruction; that copy has since diverged further (via Antigravity's Phase 3-8 work here) and should not be treated as a sync source going forward.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 8

### 🎨 Clean Enterprise Design (Emoji Removal)

1. **Title & Heading Cleaning**
   - Removed all decorative emojis from section titles, card headers, buttons, labels, and hover tooltips:
     - Purpose Banner: Removed `🛡️` icon.
     - Data Note: Removed `⚠` icon.
     - Search Input: Removed `🔍` icon.
     - Compare Button: `⚔️ Compare Districts` → `Compare Districts`.
     - Correlation Matrix Title: `📊 Dynamic Infrastructure-Crime Correlation Matrix` → `Dynamic Infrastructure-Crime Correlation Matrix`.
     - Compare Modal Heading: `⚔️ Side-by-Side District Comparison` → `Side-by-Side District Comparison`.
     - Download CSV & Excel Buttons: Removed `⬇` down-arrows.
     - Street View Links & Labels: Removed `📍`, `👮`, `🚨` icons.
     - Hover Tooltips: Removed `🚗`, `🔓`, `🏚️`, `👩`, `⚖️` row icons.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 7

### 🚑 Emergency Syntax Fix (`delhi_safety_dashboard.html`)

1. **Unescaped Quote Escape Fix (`build.js` line 1181)**
   - **Root Cause**: `build.js` generates the client-side JavaScript via a Node.js template string. An unescaped single quote in `'<h3 style="font-family:\'Big Shoulders\'...'` rendered as `'<h3 style="font-family:'Big Shoulders'...'` in the generated HTML `<script>` tag, causing a V8 `SyntaxError: Unexpected identifier 'Big'` that prevented the client script from executing.
   - **Fix**: Removed font-family inline style override from the heading string generator (relying on clean CSS inheritance). Verified `delhi_safety_dashboard.html` `<script>` tag syntax via automated V8 evaluation.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 6

### 📊 Dynamic Correlation Matrix & Statistical Rigor Overhaul

1. **Dynamic Pearson $r$ Calculation in `renderMethod()`**
   - Replaced static single hardcoded Theft correlation ($r = -0.281$) with dynamic Pearson $r$ calculations computed against the **currently active metric** (`activeMetric`) and year (`activeYear`).
   - Cards update instantly when switching between Theft, Robbery, Burglary, Total IPC, Crimes Against Women, or SLL Crimes.

2. **Interactive 4x6 Correlation Matrix Table (`renderCorrelationMatrix`)**
   - Added a full, color-coded Pearson Correlation Matrix heatmap table comparing all 4 Infrastructure variables against all 6 Crime metrics.
   - Color-coded cells indicate strength ($r \ge +0.4$ red, $r \le -0.4$ green) with interactive tooltips showing sample size $n$ and exact coefficient.

3. **Metric-Aware District Detail Correlation Narrative (`computeAnalysis`)**
   - Replaced fixed single-sentence hit-and-run correlation string in `computeAnalysis()` with a dynamic metric-aware correlation paragraph.
   - Computes real-time Pearson $r$ for the selected district's active metric vs. streetlight density, ranking the district's density among covered peers.

4. **Confounder & Ecological Fallacy Annotations**
   - Added methodology notes explaining urban activity density as a confounding variable (commercial corridors concentrate both footfall/infrastructure investment AND crime exposure, preventing naive causal misinterpretations).

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 5

### 🐞 Search Bar Scope & Multi-Category Bug Fix

1. **Global `findDistrictName` Scope Fix**
   - Moved `findDistrictName(x, y)` helper out of `initMap()` closure into global top-level scope in `build.js`.
   - Resolves runtime `ReferenceError: findDistrictName is not defined` crash when typing in the search bar.

2. **Multi-Category Match Expansion (`setupSearch`)**
   - Expanded search type-ahead to match across 3 entity types:
     1. **Districts** (e.g. Rohini, South-East, Dwarka)
     2. **Police Stations & Chowkis** (e.g. Kashmere Gate, Majnu ka Tila, Connaught Place)
     3. **Crash-Prone Blackspot Zones** (e.g. Mukarba Chowk, Peeragarhi, Dhaula Kuan)
   - Reduced debounce latency to 50ms for instant type-ahead feedback.
   - Smoothly scrolls to district detail panel upon item selection and automatically turns on the relevant map overlay (`showPolice` / `showZones`).

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 4

### 📍 Google Street View Integration for Crash Blackspots & Police Facilities

1. **Crash-Prone Zones Table (`#zoneGrid`)**
   - Added direct `📍 Street View` links for all 107 accident blackspots pointing to Google Street View 360° panoramas (`viewpoint=lat,lng`).

2. **Map Markers Interactive Click Handler (`data-sv-url`)**
   - Added `data-sv-url` attributes to all police station, chowki, and crash zone map markers.
   - Clicking any marker directly opens Google Maps / 360° Street View photography for that location in a new tab.

3. **District Detail Panel Street View Section**
   - Added a dedicated `📍 Street View Locations` section in `renderDetail()` listing key police stations and top crash blackspots for the selected district.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 3

### 🚀 Search, Sparklines & Comparison Mode

1. **Instant Search & Auto-Complete Bar (`setupSearch`)**
   - Added interactive search bar above controls allowing real-time query matching across all 15 districts and 250+ police stations, chowkis, and outposts.
   - Type-ahead dropdown auto-filters results and selects/highlights target district on click.

2. **3-Year Crime Trajectory Sparklines (`renderSparkline`)**
   - Implemented SVG sparklines for all 6 NCRB crime metrics inside `renderDetail()`.
   - Visualizes 3-point trend trajectory (2022 → 2023 → 2024) with color-coded directional lines (rust = increase, green = decrease) and hover tooltips.

3. **Side-by-Side District Comparison Mode (`setupCompareMode` & `renderCompareCard`)**
   - Added interactive `⚔️ Compare Districts` toggle button and comparison card.
   - Allows users to select any two districts side-by-side to compare area, crime metrics, streetlight density, police infrastructure, and fatal crash counts in a split-screen matrix.

4. **Global Delegated Tooltips & UI Polishing**
   - Converted tooltip listener to a document-level delegated handler with `position: fixed` to ensure hover tooltips work on all `.metric-tab` buttons, legend scales, and map elements.
   - Removed default browser rectangular focus outline on SVG district paths (`outline: none !important`).

---

## [2026-07-28] - Claude (Anthropic) - Sync Note

This repo was originally a snapshot synced from a sibling project (`wallwalkerv4`, a GaitWay walkability dashboard) via `build.js` + `data/`.

**That sync has stopped as of this entry.** Antigravity's Phase 1/2 work (commits `383da62`, `98896d0`, `7b24be1`) rewrote real architecture here — `initMap()` + targeted DOM updates instead of `innerHTML` rebuilds, keyboard a11y, scatter hover, the `.xml` Excel fix, and richer police-marker data — that has no equivalent upstream in `wallwalkerv4`. Continuing to sync would silently overwrite that work. **This repo is now its own project.** Future changes here should build on what's already in `build.js`, not replace it wholesale from elsewhere.

Prior to the divergence, Claude's contributions (now absorbed by Antigravity's rewrite where they overlap) were: full 15-district 2023 crash data from the Delhi Road Crash Report 2023, the 107-zone crash-prone-zone list with real severity and coordinates, district-center map markers, the consolidated road-safety tabbed panel, the 2022/2023/2024 crime year-comparison toggle, high-DPI canvas rendering, custom map tooltips, percentile-rank color scaling, and the `exports/` + `export_data.js` clean-data pipeline for programmatic reuse.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 2

### 🛡️ Feature Additions & Data Mapping Enhancements

1. **Accurate Chowki & Outpost Mapping (`data/police_markers.json`)**
   - Cleaned up generic names in `data/police_markers.json` to reflect exact descriptive chowki/outpost titles (e.g., "Police Post Majnu ka Tila", "Police Post ISBT Kashmere Gate", "Swarup Nagar Police Post", "Khan Market Police Post").
   - Added geocoded chowkis and outposts for Outer, Outer North, Dwarka, West, and South-West districts.
   - Updated map rendering in `initMap()` so hovering over any police station or chowki displays its parent district (e.g. `Police Chowki / Outpost · North District` or `Official Police Station · Karol Bagh District`).

2. **Multi-Crime Breakdown Hover Legend**
   - Refactored `renderMap()` district hover tooltips to show a multi-crime summary box for the active year whenever a user hovers over any district polygon.
   - Breakdown shows **Theft, Robbery, Burglary, Crime against Women, and SLL Crimes** side-by-side.
   - Added hover legend tooltip to the color scale (`#legendScale`) explaining percentile color ranges.

3. **Metric Tab Explanatory Tooltips**
   - Updated `METRICS` and `INFRA` data structures in `build.js` to include title, description, and source metadata.
   - Attached `data-tt-title` and `data-tt-body` to all metric tab buttons (`#metricTabs`, `#scatterTabs`, `#scatterYTabs`), so hovering over any metric explains what it measures and its dataset origin.

4. **Project Rationale & Purpose Banner**
   - Added a prominent project mission card (*"About the Delhi District Safety Index & Project Rationale"*) directly below the main dashboard header.
   - Clearly outlines the project's goal: evaluating urban safety, walkability, traffic risks, and infrastructure equity for citizens, researchers, and policy makers.

---

## [2026-07-28] - Antigravity (Google DeepMind AI) - Phase 1

### 🚀 Optimizations & Enterprise-Grade Enhancements

1. **DOM Performance (Targeted SVG Updates)**
   - Created `initMap()` to generate SVG DOM elements once on startup (defs, paths, labels, police/zone markers).
   - Refactored `renderMap()` to perform targeted DOM attribute updates (`fill`, `stroke-width`, `data-tt-body`, `display`) instead of wiping and re-parsing `svg.innerHTML` on every interaction.

2. **Accessibility (a11y) & Keyboard Navigation**
   - Added `tabindex="0"`, `role="button"`, and `aria-label` attributes to district `<path>` SVG elements.
   - Added `keydown` event listeners (`Enter` / `Space`) on map paths for full keyboard accessibility.
   - Upgraded toggle controls (`#lightToggle`, `#policeToggle`, `#zonesToggle`) to semantic switches with `role="switch"`, `aria-checked="true|false"`, `tabindex="0"`, and keyboard trigger handlers.

3. **Scatter Plot Label Collision Fix**
   - Removed static overlapping text canvas labels in `renderScatter()`.
   - Added interactive `mousemove` distance checking on `#scatterCanvas` to detect nearest data point.
   - Implemented dynamic hover highlighting and tooltips for canvas data points.

4. **Excel Download Format Warning Fix**
   - Updated SpreadsheetML XML export filename from `.xls` to `.xml` (`gaitway_delhi_safety_index.xml`).
   - Prevents Microsoft Excel format mismatch security prompts when users open the exported workbook.

5. **Modern ES6 Syntax Standardization**
   - Refactored string concatenation (`'...' + ...`) across `renderList()`, `renderMethod()`, `renderZones()`, `renderRoadSafetyTabs()`, `renderDownloadTabs()`, and `renderDownloadFields()` to ES6 template literals.
