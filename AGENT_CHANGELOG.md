# AI Collaboration Log & Changelog

This log tracks all architectural, performance, accessibility, and code quality changes made by AI assistants (Antigravity & Claude) on the **Delhi Crime Dashboard** repository.

> **Note for AI Assistants (Antigravity & Claude)**:
> Whenever you make changes to this codebase, please add an entry below under `## [Date] - [Assistant Name]` describing what was modified, added, or refactored so that future turns and other AI agents remain fully synchronized.

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
