## [2026-08-08] - Codex - OSM street-lamp layer on main dashboard

- Added all 1,457 OSM-tagged street lamps inside Delhi police-district polygons as an independent cyan point layer.
- Kept OSM lamps separate from the 3,150 yellow PAPL survey cells so their different collection methods and coverage remain visible.
- Added independent toggles, simultaneous overlay support, active-layer chips, point tooltips, and original OSM/Overpass attribution in the footer.
- Reused the audited 2026-08-06 OSM snapshot already shipped in the repository; no new or unvalidated data was introduced.

## [2026-08-08] - Codex - Streetlight survey point layer

- Replaced the main dashboard's streetlight heatmap with 3,150 proportional survey-cell markers.
- Marker size uses a logarithmic scale based on the recorded light count, preserving dense observations without obscuring nearby locations.
- Added hover details with each cell's recorded count and PAPL / Delhi Transport Stack OTD attribution.
- Kept survey coverage separate from the crime choropleth: unsurveyed districts are not presented as zero-light areas.
- Removed the obsolete heatmap canvas and rendering code.

## [2026-08-08] - Codex - Mobile filter-sheet fix

- Fixed the interactive map's mobile filter panel so the close control remains visible and reliably collapses the sheet.
- Separated the filter and spatial-analysis panels to prevent overlap on narrow screens.
- Forced mobile controls and layer groups into a single scrollable column, eliminating sideways overflow.
- Added accessible expanded-state labels, Escape-to-close, and automatic closure when returning to desktop width.

# AI Collaboration Log & Changelog

> **Before adding an entry here**: if the change alters the *value* of a
> figure already published in a prior `data/releases/<year>/` snapshot (a
> corrected total, a fixed miscount, a revised source figure — not a new
> dataset, not extended coverage, not a UI/build fix), also add a line to
> [`DATA_CHANGELOG.md`](DATA_CHANGELOG.md). This log is for every change to
> the repo; that one is only for numbers a researcher may have already
> cited.

## [2026-08-06] - Codex (OpenAI) - Main Dashboard Control Hierarchy and Responsive Layer UX

### Primary controls now lead; optional complexity remains visible only when requested

The home dashboard still had two separate clutter problems after its first collapsed-layer commit: the metric strip exposed every year-specific road field as a separate tab, and the long coverage warning occupied a large block before the map. This pass completed the primary-control redesign without removing data or changing calculations.

1. Replaced the 18-button metric strip with one grouped native selector for crime and road-safety outcomes. Consolidated the matching 2023/2024 crash-zone, fatal-crash, total-crash, persons-killed and persons-injured fields behind one metric plus an independent Year selector; map values, rankings, labels and current-comparison exports now follow that year.
2. Separated visualization mode from overlays: Choropleth/Bivariate is now a dedicated Display control rather than incorrectly appearing as a map layer.
3. Reorganized seven optional overlays into Safety and risk, Public infrastructure, and Survey overlays. The collapsed Map layers summary shows the active count; enabled layers remain visible as removable chips; Clear all layers removes them through their existing event paths.
4. Collapsed the long coverage/confidence/comparability explanation by default, preserving every caveat one click away while bringing the analysis controls and map much closer to the top of the page.
5. Added responsive two-column/mobile layouts, 44px primary touch targets, compact calculation/display segments, visible keyboard focus, and clearer control labels. Existing control IDs and map wiring were preserved.
6. Corrected the header date span to 2016-2024 and removed redundant year suffixes from the consolidated road-safety metric names.

Verified: `node --check` on `scripts/build.js` and the real generated inline script; `npm run build`; `npm test` 30/30; live desktop (1440x900) and mobile (390x844) browser checks covering crime and road-safety metric/year changes, Choropleth/Bivariate switching, collapsed-layer toggles, active-layer chips, clear/remove behavior, Compare Districts, and zero console errors.

---
## [2026-08-06] - Claude (Anthropic) - Combined PAPL + OSM Streetlight Metric, After Clarifying Scope First

### 💡 A real district-level reconciliation of the two streetlight sources — PAPL where surveyed, OSM only as a fallback, never blended into one unattributed number

User asked to "update OSM data with PAPL survey," which is genuinely ambiguous between two very different actions: merging the two datasets inside this repo (safe, reversible), or actually submitting edits to the live public OpenStreetMap database using PAPL survey data (a real-world action affecting a shared resource well beyond this project, not something to do without explicit confirmation it's actually wanted). Asked via `AskUserQuestion` before doing either. User confirmed: merge in-repo only.

Checked what a real merge could actually mean given the data's actual shape before writing code: PAPL (`data/dashboard_final.json`'s `surveyPoints`/`totalLights`) is district-level aggregate only, no point locations; OSM's `street_lamp` tagging is point-level but far sparser. No point-for-point reconciliation is possible between them — the only real merge is district-level.

1. **`scripts/build_infra_extras.js`** extended: for each district, use PAPL's `totalLights` where it's actually surveyed (`surveyPoints >= 10`, the same gate used everywhere else in this project) — 9 districts. Fall back to the OSM street-lamp count only where PAPL has nothing at all — 3 districts (Dwarka, North-West, Rohini). The remaining 3 districts (North-East, Outer, Outer North) have neither and are correctly left `null`, not a fabricated zero. Every row's `combined_source` says which source was actually used. Verified against real numbers, not just "the script ran": Central shows 8,173 (PAPL) vs. only 29 OSM-tagged lamps in the same district — confirms PAPL is genuinely far more complete where it's surveyed, exactly as expected, rather than the merge silently picking the wrong/smaller number.
2. Output as both `data/streetlights_combined_by_district.csv`/`.json` and a new "Streetlights (PAPL + OSM combined)" choropleth/bivariate option in `build_interactive_map.js`'s `INFRA[]`, joined onto boundary properties from its own file (not `dashboard_final.json`) — the existing PAPL-only "Streetlights" metric is untouched, so a reader can compare both rather than only ever seeing the merged figure.

Verified: `node --check`; live browser check confirmed the new bivariate option renders the correct combined_count/combined_source for a PAPL-surveyed district (Central), an OSM-fallback district (Dwarka), and a genuinely-no-data district (Outer) — matching the CSV exactly. `npm run build:releases` re-run for the two new files; `npm test` 30/30 pass.

## [2026-08-06] - Claude (Anthropic) - Land Use on the Map, Plus OSM Street Lamps as an Independent Supplement

### 🗺️ Same land-use data now also a real polygon layer on the interactive map, not just the CSV; new street-lamp point layer kept deliberately separate from the existing PAPL streetlight metric

User asked to also add land use to the map (after the CSV-only version shipped earlier the same day), then separately asked to add street lights from OSM/open data.

1. **Land use on the map**: `scripts/build_landuse_wards_csv.js` now also writes `data/delhi_landuse_simplified.geojson` — the same 9,881 landuse polygons behind the CSV, but coordinates rounded to 5 decimal places and `turf.simplify`d (0.0001° tolerance) so the embedded payload is ~2.8MB instead of the ~3.4MB full-precision version. Rendered as a new toggleable "Land use" polygon layer in `build_interactive_map.js`, styled by the same 6 categories as the CSV, with a static color-key legend and per-polygon popups repeating the same "only ~23.4% of area is tagged" caveat so the map layer can't drift from the CSV's honesty.
2. **Caught a real bug before it shipped**: the first version of the new code referenced a `landuse` variable inside the page's embedded `<script>` template without ever actually embedding the data (`${JSON.stringify(landuse)}`) — every other dataset on this page follows that pattern, and this one was missed. Caught immediately by comparing `interactive_map.html`'s file size before/after (2417KB, basically unchanged) against the expected +2.8MB, rather than assuming a clean `node --check` and no console errors meant the feature actually worked — a `ReferenceError` on `L.geoJSON(landuse, ...)` would only have surfaced by actually toggling the layer live, which a syntax check alone doesn't catch. Fixed and re-verified against the correct ~5.2MB output size.
3. **Also found and fixed a real, older gap while touching this code**: `POINT_LAYER_IDS` (the URL-state allowlist for which point-layer checkboxes can be restored from a shared link) had never been updated for `chkTrafficSignals`, `chkCrossings`, `chkHospitals`, or `chkCctvExploratory` from earlier work today — so a shared URL with those layers checked would have silently dropped them. Fixed comprehensively in one pass, including the new `chkLanduse` and `chkStreetLamps`.
4. **Street lamps**: `node["highway"="street_lamp"]` — 1,529 nodes fetched, 1,457 within district polygons. Added as its own clustered point layer, explicitly kept separate from the existing PAPL Open Transit Survey streetlight data (the source behind the "Streetlights" INFRA metric) rather than merged into it — the two are different surveys with different coverage and confidence, and blending them would produce one harder-to-attribute number instead of two independently comparable ones.

Verified: `node --check`; live browser checks confirmed both new layers toggle on/off, counts match the fetch output, the land-use legend shows/hides in sync with the checkbox (including via the URL-restore path, which dispatches a real `change` event rather than just setting `.checked`), and no console errors on a page now over 5MB. `npm run build:releases` re-run for the new `data/delhi_landuse_simplified.geojson`/`osm_street_lamps_delhi_raw.json` files; `npm test` 30/30 pass.

## [2026-08-06] - Claude (Anthropic) - Ward-Wise Land Use CSV — Checked and Rejected a License-Ambiguous Draft-Plan Source First

### 🗺️ `data/landuse_by_ward.csv` — real polygon-overlap area by category per ward, from OSM, after a genuine source tradeoff surfaced to the user before building anything

User asked for ward-wise land use. Found DDA's only vectorized land-use layer: a community GitHub extraction of the PDF map of the **draft** (not adopted) Master Plan 2041, with `license: null` on the repo and the extracting author's own disclosure of attribute-data loss (sub-categories collapsed to one blob per layer) and geometric distortion in several layers from the PDF's shading style. Rather than silently pick one source or the other, surfaced the tradeoff (draft-not-current, no license, known data loss vs. OSM's sparser-but-current-and-ODbL-licensed `landuse=*` tagging) to the user via `AskUserQuestion` before writing any code. User chose OSM.

1. Checked real tag coverage first (`out count` via Overpass): 11,366 landuse features (9,908 ways, 1,458 relations) in the fetch bbox.
2. **`scripts/build_landuse_wards_csv.js`** (new): processes the way-tagged subset only (relations need outer/inner ring assembly this script doesn't attempt — excluded rather than approximated with a rough centroid, which would silently bias area sums; this is a stated, visible gap, not a hidden one) into real polygon-overlap area per ward using `@turf/turf` (`turf.intersect` + `turf.area`, bbox-prefiltered for performance — 290 wards × ~9,900 polygons unfiltered would be too slow) — a first real use of the `@turf/turf` dependency in this repo, which until now was declared but unused (every other spatial join here is hand-rolled point-in-polygon).
3. Grouped OSM's ~70 distinct raw `landuse=*` values (including several individual mappers' free-text errors, e.g. a hotel name typed into the tag) into six readable categories (residential, commercial, industrial, institutional, green_open, other) via an explicit mapping table — anything unrecognized falls into `other` rather than being guessed at.
4. **Real, load-bearing finding, not hidden**: OSM landuse tagging covers only ~23.4% of ward area on average — most land in Delhi is simply untagged in OSM, not undeveloped. Every row's `mapped_pct` column makes this visible per-ward; documented explicitly in `data/source/README.md` so `100% - mapped_pct` is never misread as "vacant land."
5. Sanity-checked output against a known real-world fact rather than just eyeballing numbers: Delhi Cantonment (a military zone) correctly shows ~76% of its area landuse-tagged, entirely under `military` → the `other` category, not spuriously spread across residential/commercial/etc.

No map/dashboard code touched, matching the standing "keep this as data" instruction from the road/footway sizes work earlier this session. Wired into `package.json` (`build:landuse-wards`).

Verified: `node --check`; ran the script (290/290 wards processed without a topology-error crash, `turf.intersect` failures on individual degenerate pairs caught and skipped rather than aborting the whole build); spot-checked the Delhi Cantonment row against the known military-zone fact.

## [2026-08-06] - Claude (Anthropic) - Road and Footway Size CSVs — Real OSM Tags Only, No Official Delhi Width Dataset Found

### 📏 `data/road_sizes.csv` / `data/footway_sizes.csv` report classification, lane count, and explicit width per segment — not shipped to the map, per user request to keep this as data, not a UI layer

User asked to add data on road and footpath sizes, then specified it should stay as CSV rather than a new map layer, and asked to look for an official Delhi open-data source first rather than defaulting to OSM. Searched data.gov.in (found "State/UT wise surfaced length of PWD roads by width" — a state-level aggregate behind an API key, not per-segment Delhi geometry), OpenCity's Government-of-Delhi dataset listing (nothing road/footpath-width related), and PWD Delhi's Urban Roads Manual PDF (dead link). No usable official per-segment width dataset exists that's actually fetchable here.

Checked real coverage before building anything, rather than assuming OSM tagging would be sufficient: `width=*` is on only 0.2% of major-road segments and 0.7% of footway/sidewalk segments — too sparse to report as a metric on its own, but real where present, so kept rather than dropped. `lanes=*` is on 33.7% of major-road segments — a genuine, usable size proxy. `highway=*` classification (motorway/trunk/primary/secondary/.../footway/pedestrian) is tagged on effectively every segment and is the most complete size signal available.

1. **`scripts/build_road_footway_sizes_csv.js`** (new): processes the already-committed `osm_major_roads_delhi_raw.json` (10,934 ways) and `osm_footways_delhi_raw.json` (11,499 ways, deduplicated) into per-segment CSV rows: `osm_way_id, name, highway_class, lanes, width_m, surface, district, length_m` (roads) and the footway equivalent with `footway_tag` instead of `lanes`. District assigned via point-in-polygon on each way's midpoint, same convention as every other spatial join in this project. Missing `lanes`/`width_m` are left as an empty CSV field, never a fabricated or estimated value — this project's standing null policy applied to a new dataset.
2. Fixed a structural assumption bug while writing this: the major-roads snapshot was originally fetched with Overpass `out geom` (geometry embedded inline per way, same shape as the footways file), not `out body` with separate node elements — the first version of the script assumed the latter and silently produced zero road rows. Caught by checking the actual output count against the known 10,934-way input rather than assuming a >0 row count meant success.
3. Wired `build:road-footway-sizes` into `package.json`; documented coverage percentages and the official-dataset search dead-ends in `data/source/README.md` and the README's Data & sourcing table, so the next person doesn't repeat the same dead-end searches without knowing they were already tried.

Verified: `node --check`; ran the script and manually inspected output row counts against known input-element counts for both files; spot-checked CSV rows for correct null-handling (blank, not zero, for untagged lanes/width). No map or dashboard code touched, per the user's explicit "keep it in CSV" instruction.

## [2026-08-06] - Claude (Anthropic) - Added Traffic Signals, Crossings, Hospitals, and Footway Coverage to the Interactive Map

### 🚦 Three new OSM-sourced infrastructure layers, chosen from a user-requested shortlist, plus an exploratory CCTV/guard recommendation layer grounded in cited road-safety research

User asked what more infrastructure data could be added and picked three from the shortlist: traffic signals/pedestrian crossings, hospitals, and footway/sidewalk coverage.

1. **`scripts/fetch_osm_infra_snapshots.js`** (new): reproducible Overpass fetcher, same "committed snapshot, not fetched live" convention as the existing pedestrian-overbridge pipeline. Bounding box matches the dashboard's own district-boundary extent. Footways required splitting into four geographic quadrants and retrying after rate limits/a 504 — Delhi has too many mapped footway/sidewalk ways for the public Overpass instance to return in one request.
2. **`scripts/build_infra_extras.js`** (new): filters traffic signals (1,016) and pedestrian crossings (1,885) to two point layers; hospitals (652, deduplicated node/way/relation, way/relation centroid via `out center`) to a third. Footway/sidewalk coverage (11,499 raw ways, deduplicated by ID across quadrant-boundary overlaps) is deliberately **not** shipped to the browser as line geometry — computed instead as total length (km) and density (km/km²) per district at build time (`data/delhi_footway_coverage.json`), the same count+density shape every other `INFRA[]` entry already uses, so it plugs into the existing choropleth/bivariate/correlation-matrix machinery with no new UI code. 796.2 km mapped across the 15 districts — a mapped inventory, not an official completeness register, same caveat as every other OSM layer here.
3. Kept the new footway data out of `data/dashboard_final.json` (the heavily-depended-on core dataset) — it lives in its own file, joined onto boundary properties the same way the core stats already are, so this new, still-exploratory metric can't risk corrupting the file every other build script depends on.
4. **`scripts/build_interactive_map.js`**: three new toggleable point layers (traffic signals, pedestrian crossings, hospitals — all clustered, matching the existing bus-stop/ATM convention at this density) and `footway` added to `INFRA[]`.

Same turn, also:

5. **New exploratory CCTV/guard-post recommendation layer**, distinct from the existing report-sourced "CCTV priority sites" layer. Ranks the top 15 crash-zone sites by a percentile score blending this site's own fatal/total crash counts, the camera-coverage gap within 300m, and its surrounding district's crime rate (folded in per a follow-up request that it should also account for high crime, not just crash severity) — reuses the existing, tested `computeExploratoryScore` helper rather than a new ad-hoc implementation. Weights and methodology are grounded in and cite: WHO's *Save LIVES* road safety technical package / iRAP Safe System approach (severity-weighted micro-place prioritization), Weisburd (2015) on crime/crash concentration at micro-places, and Welsh & Farrington (2009) on CCTV coverage-gap effectiveness. Every popup shows a "Why this site" breakdown (factor, raw value, percentile, weight) generated from the scoring function's own output, not hand-written text.
6. Fixed a real layer-accumulation bug found while investigating a user-reported map screenshot: `clearAnalysisHighlight()` removed `weakCoverageLayer` from the map but never called `clearLayers()` on it, so the "weak police coverage" spatial-analysis outlines stacked on every re-run instead of being replaced.
7. Added hover tooltips to every marker/circle layer that previously only revealed its identity on click, plus `title` attributes on the metric/infra dropdowns.

Verified: `node --check` on the extracted script; live browser checks confirmed all three new point layers load/toggle/count correctly, footway density renders through the existing choropleth path with real per-district values, the CCTV-recommendation layer's popups show a correct factor breakdown, and the layer-leak fix holds steady across repeated triggers instead of accumulating. `npm run build:releases` re-run to pick up the two new `data/` files in the shared manifest inventory. `npm test` — 30/30 pass.

## [2026-08-05] - Claude (Anthropic) - Sparklines Only Ever Plotted 3 Years, Even Though 8-9 Years of Real Data Already Existed

### 📈 renderSparkline() was hardcoded to prevKey/key/key2024 and never looked at historicalYears, which every other part of this dashboard already reads

User asked why the district-detail sparklines showed only 3 years when the dashboard should have at least 5. The real answer: `renderSparkline()` was hardcoded to exactly three fields (`prevKey` → 2022, `key` → 2023, `key2024` → 2024) and never referenced `METRICS[].historicalYears` at all — even though that field already exists, already has verified data (theft/robbery/burglary: 2016-2021; total IPC/crime-against-women/SLL: 2017-2021), and is already used by the year toggle and historical charts elsewhere on this same page. The sparkline function alone never grew past its original 3-point design from before that historical data existed.

1. Rewrote `renderSparkline()` to build the full available year sequence (`historicalYears` + 2022/2023/2024) and plot only the years with a real, non-null value for that specific district — rather than a hardcoded 3-point line, it now dynamically spaces N points across the same 60×22 viewBox, shrinks the point radius slightly (2.5→1.8) so up to 9 points don't visually collide, and computes percentage change end-to-end over whatever span is actually available (not always "3Y").
2. Tooltip now lists every plotted year's value and the true span (e.g. "+41.5% over 2016-2024"), not a hardcoded "3-Year Trajectory (2022-2024)" label that would have been wrong the moment this changed.
3. Metrics without historical data (fatal-crash-2022-only metrics, etc.) are unaffected — the existing `!m.prevKey` guard already skipped them, and still does.

Verified: `node --check` on the correctly-extracted embedded script passed; `npm run build` completed; served locally, confirmed via `javascript_tool` on a real selected district — Theft and Robbery sparklines now plot 9 points (2016-2024), Burglary/Total IPC/Crime-Against-Women/SLL plot 8 (2017-2024), tooltip values match the underlying data exactly, zero console errors; `npm test` — 25/25 pass, unaffected (no test covered this function before).

---

## [2026-08-05] - Claude (Anthropic) - Fixed the Stale 2023 Default Year — Not a Data Gap, a Leftover

### 📅 The district drawer's crime metrics defaulted to 2023 even though every district has complete 2024 data

User asked why the district-intelligence drawer showed only 2023 figures. Checked the data before assuming: all 15 districts have complete 2024 values for every crime metric (theft, robbery, burglary, total IPC, crime against women, SLL) and every road-safety metric (crash-prone zones, fatal/total crashes) — no coverage gap. The `activeYear = '2023'` default was simply never updated after 2024 data was added to the dashboard earlier in its history; the page title itself had already been renamed away from "...— 2023" in an earlier branding pass, but this internal default was missed.

1. **`scripts/build.js`**: `activeYear` default → `'2024'`; also fixed a second, easy-to-miss instance — the metric-switch fallback that resets `activeYear` to `'2023'` when the newly-selected metric doesn't support the current year — to `'2024'` as well, so switching metrics doesn't silently drop back to the stale year.
2. **`scripts/build_interactive_map.js`**: same `activeYear` default fix, plus the URL-state "omit if default" comparison (`if (activeYear !== '2023') ...`) updated to `'2024'` so shared links stay clean at the new default instead of always carrying a redundant `year=2024` param.
3. **Deliberately left `zoneYear` (the crash-zone point-layer toggle) at its 2023 default** — that one has a real, different reason: the 2023 crash-zone dataset has far better geocoding coverage (105 of 107 zones plotted) than 2024's (54 of 93), so defaulting the *point layer specifically* to 2024 would show a visibly sparser map on load, not a "more current" one. Not every "why is this still 2023" is the same bug — checked this one before changing it and kept it as-is.

Verified: `node --check` on both correctly-extracted embedded scripts passed; `npm run build` and `npm run build:interactive-map` both completed; served locally, confirmed via `javascript_tool` that `activeYear` is now `'2024'` on load and a real district's detail panel shows "THEFT (2024)" / "TOTAL IPC (2024)" etc. with "vs 2023" comparisons, not the reverse; zero console errors; `npm test` — 25/25 pass (unaffected by this change, as expected).

---

## [2026-08-05] - Claude (Anthropic) - Named the Pedestrian Overbridges

### 🏷️ 221 of 242 bridges shared the literal string "Unnamed mapped pedestrian bridge" — gave every one a real, distinguishing name

91% of the 242 mapped bridges had no OSM name tag at all, and most of the small remainder carried a generic placeholder a mapper typed once ("Foot Over Bridge 1", "FOB 2", "Footover Bridge") that doesn't distinguish one bridge from another anywhere in the dataset. Only 8 features had genuinely specific real names ("Barapullah Bridge", "ITO Skywalk," etc.).

1. **Generate a name only where the existing one is generic** — a real, specific OSM name is always kept untouched. Detection: exact match on the code's own "Unnamed mapped pedestrian bridge" fallback, or a regex for the "Foot Over Bridge N" / "FOB N" placeholder family (case- and spacing-insensitive).
2. **Naming scheme reuses the `crossesMajorRoad` distinction added in the previous entry**: a bridge that crosses a major road becomes "`<road it crosses>` FOB" (e.g. "Rohtak Road FOB", "Mahatma Gandhi Marg FOB 11" when a road has several); one that doesn't becomes "`<district>` Footbridge" — deliberately *not* called a FOB in that case, since the road-crossing check itself says it isn't one. Numbered per key only when more than one bridge would otherwise share the generated name.
3. **Result: 241 of 242 features now have a distinct name** (up from 15 distinct names across all 242 before). The one remaining duplicate is a real OSM name — two physically separate structures both mapped as "Path around Hauz Khas Tank" — correctly left alone rather than force-disambiguated.
4. Added a test asserting no feature is left with a generic/bare-placeholder name, and that every generated name's suffix ("FOB" vs "Footbridge") agrees with that same feature's own `crossesMajorRoad` value — catching a bug class where the two computations could silently drift apart.

Verified: reran the pipeline — 233 of 242 names were regenerated, 241 distinct overall; `node --check` passed on the script and on both correctly-extracted embedded HTML scripts; `npm run build:interactive-map` and `npm run build` both completed; served locally, confirmed via `javascript_tool` a live popup renders a real name ("Rohtak Road FOB 2") with the road-crossing sentence, zero console errors; `npm test` — 25/25 pass (1 new).

---

## [2026-08-05] - Claude (Anthropic) - Reconciled a Parallel Foot-Over-Bridge Effort, Added a Road-Crossing Distinction

### 🌉 Two independent AI sessions built near-duplicate FOB pipelines at the same time — kept the better-engineered one, ported the one real improvement over

Pushed a standalone foot-over-bridge pipeline (`build_pedestrian_bridges.js`, 132 bridges, road-crossing-only) at the same time Codex independently built `scripts/build_pedestrian_overpasses.js` (242 bridges, broader "any mapped pedestrian bridge" scope) as part of a larger repo reorganization + branding pass. Discovered the collision at push time (`origin/main` had diverged 5 commits). Rather than force-push over it or ship two confusingly similar Infra metrics, compared both approaches directly with the user before touching anything:

- **Kept Codex's pipeline as the base** — it's better engineered in three real ways: exact union-find merging on shared OSM node IDs (vs. my distance-heuristic clustering), correct polygon-hole handling in the district point-in-polygon test (a gap in mine), and a reproducible committed raw-Overpass snapshot (`data/source/`) instead of a live API call at build time (which had rate-limited my own pipeline twice in the prior session).
- **Discarded my own `build_pedestrian_bridges.js`** — its unique value was narrow enough to port as one field rather than justify a second dataset.
- **Ported the one real improvement**: added `crossesMajorRoad` (bool) to `scripts/build_pedestrian_overpasses.js` — a proper segment-intersection test (not a distance guess) against a newly-fetched, separately-committed major-road snapshot (`data/source/osm_major_roads_delhi_raw.json`), correctly built from each OSM way's own node order (a component's deduplicated node set has no path order on its own — an easy mistake to make and initially made here before catching it). This distinguishes Codex's broader "any mapped pedestrian bridge" scope from a foot-over-bridge in the sense PWD Delhi and press coverage use the term (crosses live traffic, not a drain/canal/park path).
- **Cross-validated the two independent methodologies against each other**: 133 of 242 bridges cross a major road by this new check — within 1 of my separately-built pipeline's 132-bridge total from a completely different merge algorithm and dataset. That convergence is real evidence both approaches are measuring the same thing correctly, not just internally consistent.
- Surfaced `crossesMajorRoad` directly in the existing point-layer popup (not a separate layer) and added a test asserting it's a real, meaningfully-split boolean (not silently always true/false) plus consistency with the independent cross-check bound.

Verified: `node --check` on `scripts/build_pedestrian_overpasses.js` passed; reran it — 242 features unchanged, 133 now flagged `crossesMajorRoad`; `npm run build:interactive-map` and `npm run build` both completed; `node --check` on both correctly-extracted embedded scripts (last `</script>`, not first) passed; served locally, confirmed via `javascript_tool` a live popup renders the new road-crossing sentence correctly with zero console errors; `npm test` — 24/24 pass (3 new, all previously-passing tests unaffected).

---

## [2026-08-04] - Codex (OpenAI) - Delhi Urban Safety Observatory Branding & Pedestrian Overbridges

1. Renamed the main dashboard to **Delhi Urban Safety Observatory** and the Leaflet page to **Delhi Safety & Infrastructure Explorer**, preserving their existing public filenames and URLs.
2. Added a responsive civic-data hero illustration, project favicon, mobile layout refinements, viewport metadata, and overflow-safe map controls/legends.
3. Collected an OpenStreetMap Overpass snapshot of pedestrian bridge ways, grouped connected/nearby segments into 242 mapped pedestrian bridge features, filtered them to the 15 district polygons, and recorded OSM provenance/completeness caveats.
4. Added pedestrian-overbridge counts and densities to district analysis/exports and a clustered, URL-persisted point layer to the interactive map, including crash-zone proximity readouts.
5. Added automated tests validating all bridge coordinates, provenance links, district totals, and density calculations.


## [2026-08-03] - Codex (OpenAI) - Automated 2025 Data-Collection Pipeline

1. Added the isolated `pipeline_2025/` Python 3.12 package with configurable official-source registry, allowlisted discovery, candidate scoring, atomic checksummed downloads, extraction fallbacks, normalization, validation, provenance and status reporting.
2. Added iRAD/eDAR, liquor-vend, NCRB/Traffic publication-monitor and historical ohsome snapshot adapters. Missing 2025 sources are explicit statuses; legacy data is never relabelled.
3. Added a non-destructive dashboard-patch proposal gate, offline fixtures/tests, skipped live smoke checks and minimal-permission GitHub Actions workflows.
4. Production `data/`, `exports/`, `build.js` and generated dashboard HTML were intentionally not modified.

## [2026-07-29] - Claude (Anthropic) - High-Injury Network: A Vision Zero-Style Ward Ranking, Computed Not Guessed

### 🚨 Formalizing "worst wards" into a named, reusable, government-legible metric

Asked to research what makes best-in-class civic data journalism/dashboards work and propose ideas, then to pick the single best one for this project's purpose. Researched SafetiPin and Safecity (both Delhi-origin crowdsourced safety-mapping precedents), Vision Zero dashboards (Philly, Portland, DC, Indianapolis), The Marshall Project/ProPublica's crowdsourced-report-plus-news-corroboration pattern, Chicago's open-data/API practices, and FiveThirtyEight/Upshot's uncertainty-as-design ethos. Recommended the Vision Zero **High-Injury Network** concept as the best fit: it required no new infrastructure, no moderation/legal exposure, and directly reuses analysis this project already had (the ward-level fatal-crash ranking) — it just needed a real, computed threshold instead of an arbitrary top-5, and the standard term the field already uses.

1. **`build_ward_infra.js`**: added a `highInjuryNetwork` (bool) / `highInjuryNetworkRank` (int|null) computation — wards ranked by `crashZones2024FatalSum` descending, flagged until the running cumulative total first reaches 50% of the total across every ward with at least one 2024 fatal crash. This is a real cutoff recomputed on every rebuild, not a fixed top-N: currently **18 of 290 wards (6.2%)** account for half of all 370 ward-assigned 2024 fatal crashes.
2. **Caught a real data-quality gap while computing it**: one ward polygon in the DataMeet source boundary file has no `Ward_Name` or `Ward_No` at all, and it ranks #7 in the High-Injury Network (11 fatal crashes, Shahdara district by point-in-polygon assignment). Flagged explicitly as "(unnamed ward — source data gap)" everywhere it's referenced, rather than silently showing `null` or dropping it from the ranking.
3. **`build_interactive_map.js`**: both ward popup builders (`renderWardLayer` for the bivariate mode, `renderWardExploratoryLayer` for the liquor-crash index) now show a "⚠ High-Injury Network — #N of 18 wards..." badge whenever a ward carries the flag, so the designation is visible in the actual map, not just the article.
4. **Article/artifact and `ARTICLE.md`**: replaced the old "top 5 wards" table with the properly framed High-Injury Network section — full top-18 ranking, the 6.2%/50% headline stat, and the unnamed-ward caveat.

Verified: `node build_ward_infra.js` printed the computed cutoff (18 of 66 fatal-crash wards, 6.2% of all 290, 50% of 370) matching independent verification via a standalone script; `node build_interactive_map.js` → `node --check` on the correctly-extracted (last `</script>`, not first) embedded script passed; served locally, confirmed via `javascript_tool` that `wardsInfra.features` has exactly 18 `highInjuryNetwork: true` wards, and that Adarsh Nagar's ward-bivariate popup renders the badge with the correct rank and escaped apostrophe; `node --test` — 21/21 pass.

---

## [2026-07-29] - Claude (Anthropic) - Correlation Matrix Labeling + Missing 2024 Crash-Zone List

### 📊 Explained caption/sticky column for the correlation matrix, and a real gap found: 2024's 93 named zones were never in the main dashboard

Two follow-ups from the user after reviewing the dashboard. First, the "Dynamic Correlation Matrix" table (12 crime/road-safety metric rows × 8 infrastructure columns) had real per-cell tooltips and column headers already, but no caption explaining what the table was for, and its header column would scroll out of view on narrower screens — mocked up two fixes as an interactive widget (a labeled/sticky matrix vs. splitting into per-infrastructure tabs) before implementing; user picked the matrix option since it preserves cross-comparison. Added a one-line caption above the table ("Each row is a crime or road-safety metric; each column is an infrastructure type...") and made both the header row's and every row's first (metric-label) cell `position: sticky; left: 0`, so the row labels stay visible while scrolling through all 8 columns.

Second, the user asked why the "Road safety detail" panel's "Crash-Prone Zones" tab only covers 2023. Root cause: `build.js` never loaded `data/crash_zones_2024_geocoded.json` at all — that 93-zone 2024 dataset (added to the interactive map several entries ago) was simply never wired into the main dashboard's build script. Added a new "Crash-Prone Zones (2024)" tab, mirroring the existing 2023 one exactly: `ACCIDENT_ZONES_2024` embedded const, `renderZones2024()`, a `zoneGrid2024` list (93 zones, Street View links, fatal/simple/total counts, unresolved-coordinate zones flagged in their tooltip rather than hidden), and a CSV download button.

Verified: `node build.js`, extracted `<script>` (single tag, unambiguous) → `node --check` passed; served locally and confirmed via `javascript_tool` — the new "Crash-Prone Zones (2024)" tab renders all 93 zones (first: Azadpur Sabzi Mandi, 11 fatal), the correlation matrix's caption text and sticky-positioned header cell both present, the new CSV download button exists, zero console errors.

---

## [2026-07-29] - Claude (Anthropic) - Remove the Standalone Liquor-Crash Page's Dashboard Link

### 🔗 Main dashboard now points only at the interactive map for this data

The user pointed out that even after the datasets were folded into `interactive_map.html`, the main dashboard's header still had a separate "Open liquor vends × crash-zone spatial exploration (2024) →" button linking to the old standalone `liquor_crash_analysis.html` page — the previous entries' plan had deliberately kept that page as a "companion deep-dive," but the user's follow-up made clear they want the interactive map to be the single entry point, not a page users can still land on separately from the dashboard.

Removed that second button from `build.js`'s header (kept the one "Open interactive street map" button, its label extended to mention the liquor/crash-zone exploration is included) and updated the footer citation's liquor-vends source line to link to `interactive_map.html` instead. `liquor_crash_analysis.html` and its build script/data pipeline still exist in the repo (not deleted — no request to remove the underlying analysis, just to stop surfacing it as a separate dashboard entry point), just no longer linked from the dashboard UI.

Verified: `node build.js`, extracted `<script>` (this file only has one script tag, unlike the interactive map's CDN-tag ambiguity, so a plain `indexOf`/`lastIndexOf` extraction is unambiguous here) → `node --check` passed; served locally and confirmed via `javascript_tool` exactly one `a.compare-btn` now exists, pointing at `interactive_map.html`, no console errors.

---

## [2026-07-29] - Claude (Anthropic) - Fix: Interactive Map Was Actually Broken (Silent Script Failure)

### 🐛 The previous entry's "verified" build never actually ran in a browser — it was broken

The user reported the interactive map "seems broken" right after the previous entry claimed full `node --check` verification. Investigation found the check itself was invalid: the verification script extracted the embedded `<script>` block via `html.indexOf('<script>')` paired with `html.indexOf('</script>')` — but the page's `<head>` also has three CDN `<script src="...">` tags, and their closing `</script>` tags come *before* the real inline script's opening tag positionally when searched with plain `indexOf`. The slice this produced was empty, and `node --check` on an empty string trivially "passes" — so every "syntax check passed" claim in the previous entry was checking nothing.

Running the real page (via a temporary local static server, since the sandbox's Browser pane couldn't reach the repo path directly with `file://`) showed the real problem: an earlier edit that inserted `wardMetricLine()` ahead of a rewritten `renderWardLayer()` left a stray, incomplete duplicate of the *old* `renderWardLayer()` header still in the file (`function renderWardLayer() { ... const feats = wardsInfra.features;` with no closing brace) sitting directly above the new function. That one extra unclosed `{` threw the whole inline script off balance — a real browser hit `Unexpected end of input` and the entire script silently failed to execute, leaving the metric/ward dropdowns empty and the map non-interactive, exactly as the user described.

**Fixed**: removed the orphaned fragment; corrected the verification extraction to use the *last* `</script>` in the file, not the first. Re-verified for real this time via a local Node static server + the Browser pane: metric/ward dropdowns populate (11/8 options), the new liquor-vends and 2024-crash-zone point layers toggle on with correct counts (387/93), the liquor×crash ward bivariate pairing renders with the correct legend text, the heatmap correctly rebuilds (not duplicates) on a 2023→2024 zone-year switch, a CCTV site recommended in both report years shows both in its popup, `updateUrlState()`/reload correctly restores heatmap/zoneYear/ward mode+selectors/point layers, and an invalid URL (`crime=bogus&zoneYear=1999&wx=notreal&ward=nope`) is correctly rejected with defaults kept, with zero console errors throughout.

**Lesson**: `node --check` on a manually-sliced substring is only as trustworthy as the slicing logic — it must be checked against the real rendered page (or the extraction logic must be proven correct first), not treated as equivalent to a passing test.

Verified: `node build_interactive_map.js`, corrected extraction + `node --check` → real pass this time (2,144,929 chars, not 0); `node --test test/liquor_crash_proximity.test.js test/exploratory_score.test.js` — 21/21 pass; live browser verification as described above.

---

## [2026-07-29] - Claude (Anthropic) - Liquor Vends/Crash Zones Folded Into the Interactive Map, Infra×Crime Ward Bivariate, Robustness Fixes

### 🗺️ The standalone liquor-crash page's datasets become independent map layers + a ward bivariate pairing, plus 5 real bugs fixed in the existing interactive map

The user rejected the just-built standalone `liquor_crash_analysis.html` as the place for this data ("that needs to be added to the interactive map as independent data point... then... liquor vends × crash-zone spatial exploration as an option bivariate map option") and, separately, asked that the ward bivariate mode support infra × crime pairings, not only infra × infra. They also supplied a long, explicit acceptance checklist covering several *existing* interactive-map behaviors — reading the actual code (not assuming) confirmed three of those were real bugs. Planned via `EnterPlanMode`/`ExitPlanMode` (plan saved at `polymorphic-gliding-quasar.md`, reused/overwritten from the now-superseded standalone-page plan). `liquor_crash_analysis.html` itself was kept as a deeper-dive companion page, not removed.

1. **`build_ward_infra.js` extended**: in addition to the existing 4 OSM infra layers, now aggregates (a) the 374 official liquor vends and (b) the 93 named 2024 crash zones onto wards by point-in-polygon (372/374 and 92/93 assigned — the rest fall outside every ward polygon, same border-adjacency gap already documented for the other layers), and (c) **district-inherited crime metrics** — since NCRB crime data doesn't exist below the 15-district level, each ward's parent district is found via point-in-polygon (ward bbox-center vs. district boundary; 287/290 matched) and that district's 2024 Total IPC / Crime-Against-Women density is copied onto every ward inside it. All three new field groups are tagged (`wardAssignmentBasis: 'exploratory'` for the point-in-polygon-derived counts, since the source coordinates are themselves approximate; `wardMetricBasis: 'district-inherited'` for the copied crime figures, since they're district- not ward-resolution).
2. **`WARD_INFRA` split into `infra` / `crime` groups** (optgroup'd dropdowns) so the ward bivariate mode can now pair infra×infra (as before), crime×crime, or **infra×crime** — e.g. "Liquor Vends (official)" × "Crash Zones (2024)" directly answers the user's headline ask, and "Alcohol Shops" × "Total IPC Crime Rate (district)" answers the separate infra×crime request. Every axis with a non-null basis shows its caveat in both the ward popup and legend.
3. **Two new independent point layers**: official liquor vends (374 + 13 OSM-only, faded/hollow diamond, popup shows `coordinate_confidence`/`estimated_accuracy_m` directly, not just a tooltip) and the full 93-zone 2024 crash-risk dataset (dashed-outline circle markers) — a richer, fully-covered approximate-coordinate pass, kept distinct from the existing 54/93-geocoded "Crash zones" 2024 option rather than replacing it.
4. **New shared `computeExploratoryScore()` helper**: weight-normalized (falls back to equal weighting on missing/negative/non-finite/zero-sum weights), NaN-safe (a missing factor value is excluded and its weight redistributed across the item's remaining covered factors, never coerced to 0), always finite and clamped to [0,100] or `null`. Used for a **new ward-level "Liquor-Crash Exploratory Index"** (60% crash-zone density / 40% liquor-vend density, explicitly labeled non-official and visually distinct — dashed-border polygon fill, its own legend — from the CCTV-priority-candidate markers), and `computeUnsafeScores()` was refactored to call the same helper instead of its own ad-hoc average, so both composites now share one tested implementation.
5. **Confirmed-bug fixes**, found by reading the code, not assumed from the checklist alone:
   - **Heatmap wasn't zone-year-aware**: switching 2023→2024 while the heatmap was on left the old year's points on screen, since nothing but its own checkbox ever rebuilt it. Extracted `rebuildHeatLayer()` (single place `heatLayer` is ever created/replaced, always removing any prior instance first) and call it from the checkbox, `rebuildZonesLayer()`, and reset.
   - **CCTV-priority dedup silently dropped a location's second report-year recommendation.** Changed from "keep first year seen" to grouping by name and listing every year recommended in one marker's popup.
   - **URL/reload state didn't cover heatmap, zone year, ward mode/selectors, or point-layer visibility at all** — extended `updateUrlState()`/`applyUrlStateOnLoad()` to persist all of it, with every value validated against the actual known option lists before being applied (an unrecognized value is silently ignored, default kept). Point-layer/heatmap/ward restoration is deferred via `applyDeferredUrlState()` until after those sections finish wiring their own listeners, since they're defined later in the script than the original URL-state hook.
   - Moved `heatLayer`, `zoneYear`, and `wardExploratoryMode`'s `let` declarations earlier in the script (same fix already applied to `unsafeMode` in an earlier entry) — the new cross-references between `rebuildZonesLayer()`/`updateUrlState()` and those variables meant they'd otherwise be read before initialization (TDZ `ReferenceError`, silently halting the rest of the script).
6. **New test file** `test/exploratory_score.test.js` — extracts `percentileScale`/`normalizeExploratoryWeights`/`computeExploratoryScore`'s real source text out of `build_interactive_map.js` at test time (so the tests can never silently drift from what actually ships) and asserts: equal-weight fallback on missing/invalid weights, correct normalization when weights don't sum to 1, every score finite and in [0,100], missing values excluded not zeroed (never NaN), and the score never carries an inferred count. 7 new tests, all pass; all 14 pre-existing tests still pass.
7. Added `build:ward-infra`/`build:interactive-map` npm scripts and wired `test/exploratory_score.test.js` into `npm test`.

**Not done**: full interactive browser verification — this session's sandbox doesn't permit opening the Browser pane on this repo's path (outside the allowed preview root), so verification here is `node --check` on the real extracted embedded script (passed), the new unit tests against the real shipped source (passed), and the ward-aggregation script's own numeric self-checks (passed) — not a live click-through. Recommend a manual spot-check of the URL-restore/heatmap-year-switch/ward-bivariate-group behaviors before relying on this in production.

Verified: `node build_ward_infra.js` — 372/374 vends, 92/93 zones, 287/290 wards matched to a district; `node build_interactive_map.js` then `node --check` on the extracted `<script>` — passed; `node --test test/liquor_crash_proximity.test.js test/exploratory_score.test.js` — 21/21 pass.

---

## [2026-07-29] - Claude (Anthropic) - Liquor Vends × Crash-Prone Zones Spatial Exploration (New Page)

### 🗺️ New standalone page: 374 official vends vs. 93 named 2024 crash zones, spatial association only

The user supplied a detailed `CLAUDE_CODE_IMPLEMENTATION_BRIEF.md` (written assuming a React/TypeScript SPA with a runtime-fetch `public/` directory and an installed test framework) and asked to implement it in this repository. Planned via `EnterPlanMode`/`ExitPlanMode` before writing any code, specifically to flag and resolve the stack mismatch: **this repo has no framework, zero npm dependencies before this change, and generates self-contained static HTML at build time** — nothing like the brief's assumed architecture. User confirmed: adapt to this repo's actual conventions, try installing `@turf/turf` for the spatial math (`npm install` succeeded), use Node's built-in `node --test` instead of introducing a test framework, and build it in phases (data pipeline → map/UI → analytics → tests).

1. **`build_liquor_crash_proximity.js`** (new) — normalizes the two source datasets (374 official + 13 OSM-only liquor vends; 93 named 2024 crash-prone zones with pedestrian/two-wheeler/HTV/hit-and-run/night/blackspot/CCTV-priority flags already present as properties) and computes, per official vend: nearest crash zone, distance, proximity confidence (verbatim `getProximityConfidence()` rule from the brief — never returns `"high"`, since crash-zone coordinates are never official Delhi Traffic Police geotags), and counts/fatal-crash-sums within 500m/1km/2km bands, plus whether the vend falls inside any 250m crash-zone buffer polygon. Symmetric per-zone output (official/OSM-only vend counts within each band, nearest vend). Produces `data/liquor_vend_crash_proximity_2024.geojson`, `data/crash_zone_liquor_proximity_2024.geojson`, `data/liquor_crash_proximity_summary_2024.json` (aggregate shares, operator/confidence distributions, corridor summary grouped by road with vend deduplication, operator summary).
2. **Verified the brief's own numeric claims against the actual supplied files before trusting them** (this project's established habit): confirmed exactly 387 total / 374 official / 13 OSM-only vend features, 93 named zone features, `[lng, lat]` coordinate order — all matched.
3. **`build_liquor_crash_analysis.js`** (new) → **`liquor_crash_analysis.html`** — a standalone page (same Leaflet + CARTO Voyager CDN pattern as `interactive_map.html`, linked from the main dashboard's header): 11 toggleable map layers (official vends, OSM-only shops, crash zones, 250m buffers, black spots, night/hit-and-run/pedestrian/two-wheeler/HTV-risk zones, CCTV-priority candidates), each with a distinct shape/color (not color alone, for accessibility), a filter panel (operator, vend/zone coordinate confidence, road, distance band — **default 1km** per the brief, since most coordinates are approximate), popups citing exact-vs-approximate coordinates and proximity counts, a persistent (non-dismissible) methodology banner with the brief's exact interpretation text, and the 93-vs-111 completeness note.
4. **Insight cards** use the report-level `delhi_crash_report_relevant_metrics_2024.json` totals directly rather than recalculating from the incomplete 93-zone point inventory (matching the brief's explicit instruction). **Analytics tables**: sortable vend-centric and zone-centric tables, a corridor summary (grouped by road, vend-deduplicated), an operator summary (DSCSC vs. DCCWS, with an explicit note that differences aren't adjusted for geographic distribution). **Exploratory priority index**: implemented exactly as specified — configurable weights, explicitly labeled non-official, raw values always shown alongside, never described as a probability.
5. **Bug caught during verification**: the CSV export serialized the nested original-properties passthrough field as the literal string `"[object Object]"` instead of preserving it — found by actually downloading and inspecting a CSV via `javascript_tool`, not just checking the button existed. Fixed by JSON-encoding object/array-valued cells in the CSV writer.
6. **`test/liquor_crash_proximity.test.js`** (new) — Node's built-in `node --test` (zero new dependency), covering the brief's all 12 specified validation cases (coordinate order/validity, official/OSM-only counts, monotonic radius bands, no negative values, null-not-zero handling, banned causal-language check against the actual built HTML, property preservation, completeness-warning presence) plus 2 extras (proximity confidence never "high", summary internal consistency). All 14 pass.
7. Added `.gitignore` (didn't exist before — needed once `node_modules/` appeared from the `@turf/turf` install), a `package.json` `dependencies` entry, `npm run build:liquor-crash` / `npm test` scripts, a new README section on refreshing the pipeline, and updated the main dashboard's footer citation (the old "only 1 of 374 has a matched coordinate, not usable for mapping" line is now outdated — all 374 are mapped with approximate coordinates on the new page).

**Deliberately not done**: marker clustering (dataset sizes here — 374/13/93 — are small enough that it wasn't needed, unlike the 3,151-point bus-stop layer elsewhere in this project); a build-time spatial index (same reason, full brute-force comparison is fast enough at this scale).

Verified: `node build_liquor_crash_proximity.js` prints internal consistency checks (monotonic bands, no negatives, exact 374/13/93 counts) before the page build even runs; `node build_liquor_crash_analysis.js` then `node --check` on the extracted `<script>` passed; `node --test test/liquor_crash_proximity.test.js` — 14/14 pass; served locally and confirmed via `javascript_tool` — all layer counts correct, operator filter correctly narrows to 201 (DSCSC), distance-band toggle changes popup proximity numbers live, a spot-checked vend popup (YASHWANT PLACE) matches the derived GeoJSON exactly, the CSV export fix confirmed by downloading and inspecting the actual blob content, and a page-wide scan confirmed zero banned causal phrases. No console errors at any step.

---

## [2026-07-29] - Claude (Anthropic) - Delhi Road Crash Report 2023/2024 Full Integration

### 🚗 Trends through 2024, per-district persons killed/injured, road rankings, geocoded 2024 crash zones, CCTV priority sites

Planned via `EnterPlanMode`/`ExitPlanMode` given the scope (plan saved at the time as `polymorphic-gliding-quasar.md`). Builds on this session's earlier manual extraction of `fatalCrashes2024`/`totalCrashes2024`/`personsKilled2023-24` after the user supplied two structured extraction packages (`delhi_crash_report_2023_geojson_extract.zip`, `..._2024...zip`) that confirmed those numbers exactly and added much more.

1. **Citywide trends & mode-of-travel through 2024** (`data/road_safety_trends.json`) — appended a 2024 entry to `trends[]` (already-validated citywide totals) and read the 2024 "By Mode of Travel" table (Table 3.1) directly from the PDF for `victims[]`; its 2023 row matched the existing entry exactly before extraction, confirming correct table mapping. Fixed one hardcoded "2023" string in `renderTrends()`'s narrative text that would otherwise have kept citing the wrong year.
2. **Two new citywide-only tabs** in the "Road safety detail" panel (`build.js`, `ROAD_SAFETY_TABS`): **Enforcement 2023-2024** (hit-and-run fatal crashes + share of fatal crashes, drink-driving prosecutions, RLVD/OSVD camera systems, overspeed notices) and **Top Roads 2023-2024** (ranked by 2024 fatal crashes, Table 6.33). New data file `data/road_safety_extra_2023_2024.json`; both tabs' underlying road-summary rows sum to the already-verified citywide crash-prone-zone totals (366/1063 for 2023, 427/1088 for 2024) — cross-checked before trusting.
3. **Per-district Persons Injured 2023/2024** (`personsInjured2023`/`personsInjured2024`) — same Table 6.2 as the already-merged Persons Killed, verified by summing to the citywide totals (5470/5224). Added as new METRICS entries and as fixed detail-panel rows alongside the existing Crash Zones/Fatal/Total Crashes rows (which are **not** the same scope — a fact this session discovered and corrected the field descriptions for: those three are crashes *within* identified crash-prone zones specifically, not the district's full crash count; Persons Killed/Injured are the actual full-district totals).
4. **Enriched `data/crash_zones_2023_geocoded.json`** with per-zone pedestrian/two-wheeler/HTV/hit-and-run/day-time/night-time crash breakdowns and a `cctvPriorityCandidate` flag, joined from the user's rich extract onto the already-geocoded 107 zones by name (104 of 107 matched after resolving 6 naming variants by hand — e.g. "Maya Puri Chowk" ↔ "Mayapuri Chowk" — confirmed by road name, not guessed; 3 genuinely absent from the new extract).
5. **New `data/crash_zones_2024_geocoded.json`** (93 named zones, `build_crash_zones_2023_2024.js` + `geocode_crash_zones_2024.js`) — none of the 2024 report's zones have published coordinates. Reused coordinates for 42 that share a name with an already-geocoded 2023 zone; geocoded the rest via OSM Nominatim (rate-limited, descriptive User-Agent, results checked against Delhi's bounding box to reject wrong-city false positives). **Final result: 54 of 93 (58%) resolved**, 12 fresh via Nominatim. The remaining 39 are hyper-local names (e.g. "Kabootar Market", "X More") a geocoder can't resolve on free text alone — left unresolved (`lat`/`lng`: `null`) rather than force-placed, consistent with this project's established handling of incomplete official data (DMRC gates, liquor vends).
6. **Interactive map**: crash zones now have a **year toggle (2023/2024)** — `rebuildZonesLayer()` repopulates `zonesGroup`/`zoneMarkers` from whichever year is selected, so the existing spatial-analysis tools (radius searches, nearby-infra panel) automatically operate on the selected year with no changes needed to that code. Added a **CCTV priority-candidate layer** (pooled across both years, deduplicated by name, 30 geocoded sites) — explicitly labeled "recommended, not existing" in every popup per the source's own caveat, distinct from the existing OSM-derived "CCTV/guards" layer. Popups for crash zones now show the richer per-zone breakdown (pedestrian/two-wheeler/HTV/hit-and-run) where available.
7. Updated the footer citation and added 3 new Excel Sources & Methodology rows covering the 2024 zone data, its geocoding hit rate, and the CCTV priority-candidate caveat.

**Deliberately not done** (per the approved plan): the main dashboard's SVG map still only shows 2023 crash zones — the 2024 zone/CCTV layers are interactive-map-only, since the SVG map has no existing per-zone-year toggle infrastructure and retrofitting it wasn't in scope. Bivariate mode, the correlation matrix, and CSV/Excel per-district exports were not extended to include the new road-safety fields.

Verified: rebuilt both `delhi_safety_dashboard.html` and `interactive_map.html`, extracted `<script>` passed `node --check` on both, served locally — confirmed via `javascript_tool` that `TRENDS`/`VICTIMS` end at 2024 with correct values, the Enforcement/Top Roads tabs render, `personsInjured2023/2024` appear correctly in the detail panel, the interactive map's zone-year toggle correctly swaps to 54 zones with the right popup content (spot-checked "Delhi Gate": 4 fatal/10 total crashes 2024), the CCTV priority layer shows 30 sites, and reset-map correctly reverts the zone year to 2023 and clears the new layers. No console errors at any step.

---

## [2026-07-29] - Claude (Anthropic) - Ward-Level Bivariate Mode on the Interactive Map

### 🗺️ 290 Delhi wards, infra-vs-infra bivariate (no crime data exists at ward level)

The user asked to find Delhi ward boundaries and add them to the interactive map "for better bivariate." Investigated first rather than building blind: NCRB crime data is published only at the 15 Delhi-Police-district level — a completely different administrative geography from municipal wards, with no public ward-level crime dataset. Confirmed this with the user before building, who chose infra-vs-infra bivariate (two of the existing 4 OSM-derived point layers cross-referenced against each other, at finer spatial resolution than the 15 districts) over a boundaries-only reference layer.

1. **Ward source**: [DataMeet's Municipal_Spatial_Data](https://github.com/datameet/Municipal_Spatial_Data/tree/master/Delhi) (CC-BY-SA 2.5 India), 290 features (273 named MCD wards + 9 NDMC + 8 Delhi Cantonment charges). Bounding box matches this project's existing Delhi NCT boundary almost exactly, confirming correct geography — but the feature count (290, not the current 250-ward post-2022-unification structure) indicates this is most likely the pre-2022 delimitation. Documented as a vintage caveat rather than presented as current; used only for spatial aggregation, not anything requiring official/current ward lines.
2. **`build_ward_infra.js`** (new): point-in-polygon aggregates the same OSM-derived bus stop/ATM/liquor shop/CCTV point data already used for the 15-district metrics into per-ward counts and densities, with a bbox pre-filter before the full point-in-ring test (290 wards × ~5,400 points would otherwise be ~1.6M checks). 3,148/3,151 bus stops, 649/649 ATMs, 65/65 liquor shops, and 1,579/1,583 surveillance points assigned to a ward (the handful outside every ward polygon mirror the same border-adjacency gaps already documented for the district-level aggregation). Ward area computed via an equirectangular-projected shoelace formula (adequate at Delhi's ~50km scale). Output: `data/delhi_wards_infra.geojson`.
3. **Ward bivariate mode** in `build_interactive_map.js`: a "Ward bivariate (290 wards)" toggle + two infra-layer dropdowns, reusing the exact same `BIVARIATE_MATRIX`/`getTertileIndex()` 3×3 tertile-color logic as the existing district bivariate mode, just computed from the ward GeoJSON's density fields directly. Ward polygons render on top of the district choropleth (opacity 0.75) with their own dedicated legend and popups (ward name, area, both layers' counts/density, and a source citation including the delimitation-vintage caveat). Wired into the reset-map control alongside every other toggle.

**Bug caught during verification**: the ward GeoJSON was loaded in the Node build script's outer scope but never actually interpolated into the template literal that produces the page's embedded `<script>` block — the browser-side code referenced a `wardsInfra` that didn't exist there, throwing `ReferenceError` the moment ward bivariate mode was toggled on (`wardLayer` silently stayed `null`, easy to miss without deliberately checking). Fixed by adding the missing `const wardsInfra = ${JSON.stringify(wardsInfra)};` line inside the template literal, matching the existing pattern for `BOUNDARIES`/`POLICE`/`POI`/`ZONES`.

Verified: rebuilt, `node --check` passed, served locally — all 290 wards render with correct bivariate coloring and legend text, a spot-checked popup (Chandni Chowk: 2.62 km², 23 bus stops/8.78 per km², 18 CCTV/6.87 per km²) matches the aggregation script's own console output exactly, switching the X/Y infra-layer dropdowns updates the legend and recolors correctly, ward bivariate mode coexists cleanly with district selection/drawer with no interference, and reset-map correctly clears it. No console errors at any step.

---

## [2026-07-29] - Claude (Anthropic) - Reconstructed Total IPC, Crime Against Women, SLL Crime for 2016-2021

### 🔢 Filling in the "—" rows the previous entry left deliberately blank

The user asked why Total IPC/Crime Against Women/SLL Crime showed "0/15 districts" / "—" for 2016-2021, then asked to reconstruct that data too. Codex had explicitly left these three out of the historical extract for specific, verified reasons (see the two Codex entries below) — reconstructing them meant addressing those reasons, not just filling cells.

1. **Investigated why they were excluded**: none of the source India Data Portal tables (`districtwise-ipc-crimes-*`, `districtwise-crime-against-women-*`, `districtwise-sll-crimes-*`) has a "total" column — each metric is only available as ~30-115 individual offence-category columns that would need summing, and the category schema changes completely between the 2016 table and the 2017+ tables (e.g. IPC 2016 has ~29 categories, IPC 2017+ has ~115 much more granular ones).
2. **Validated the summation method before trusting it**: summed every non-metadata column, per district, for **2022** — a year already in `dashboard_final.json` with real official NCRB totals — across all three metrics. Got **45/45 exact matches** (15 districts × 3 metrics), meaning the 2017+ schema's columns really do add up to the official published total with no double-counting or gaps. This is the same validation discipline Codex used for theft/robbery/burglary, applied to the metrics Codex had been unable to validate.
3. **Extended 2017-2021 using the validated method** for all three metrics (same 14/15 → 15/15 district-coverage pattern already established, confirmed the exact same district — Outer North — is missing in 2017-2018 as in the existing theft/robbery data, cross-checking internal consistency).
4. **Deliberately still omitted 2016** for these three metrics — the 2016 table uses the old, non-matching category schema, and there's no 2016-era official total to validate a 2016 summation against (unlike 2017-2021, which could be checked against 2022's already-verified same-schema data). Rather than guess, left 2016 as "—" for Total IPC/Crime Against Women/SLL Crime specifically, consistent with the same caution Codex applied to burglary's 2016 gap.
5. **Confirmed the known bad SLL record** (district_code 553, mislabeled "Lakshadweep District" under state "Delhi", year 2017) is excluded automatically by the existing district-name matcher — no special-case code needed, it simply doesn't match any of the 15 real Delhi district names.
6. Extended `METRICS[].historicalYears` for `totalIPC`/`crimeAgainstWomen`/`totalSLL` to `['2017'..'2021']`, and refined `computeAnalysis()`'s branching: it previously treated *any* non-2022-2024 year as "theft-only, no IPC framing" — now correctly distinguishes "no full crime metrics for this specific year" (true only for 2016) from "historical year, so suppress the infrastructure-correlation paragraph" (true for any pre-2022 year regardless of metric, since that paragraph's problem — comparing old crime data to current infrastructure — applies independent of which crime metric has data).

Verified: rebuilt, `node --check` passed, served locally — 2019 Total IPC/Crime Against Women/SLL Crime rows now show real values with correct YoY badges (e.g. South-East Total IPC 2019: 23,467, +3.6% vs 2018) and the detail panel's narrative correctly uses the full IPC-ranking framing instead of the theft-only fallback; 2016 still correctly shows "—" for these three with the theft-only narrative and a clear explanation; Total IPC's year toggle starts at 2017 (not 2016); the 2019 map has zero no-data districts for Total IPC (matching full 15/15 coverage); no console errors. Footer citation, Excel Sources & Methodology sheet, and the "Year comparison" methodology blurb all updated to describe the reconstruction and its verification.

---

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
