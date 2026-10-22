# Data Changelog

This tracks revisions to **already-published figures** — a number that
existed in a prior `data/releases/<year>/` snapshot and later changed value,
scope, or meaning. It is separate from [`AGENT_CHANGELOG.md`](AGENT_CHANGELOG.md),
which is a dev-facing log of every change to this repo (UI, build scripts,
new datasets, bug fixes) regardless of whether it touched a published
number.

If you cited a figure from this project before a date below, and that
figure appears in the "What changed" column, re-check it against the
current release before reusing it or reprinting it in something already
published.

Adding a *new* dataset, extending coverage into a year that was previously
absent, or fixing something that never shipped (a UI bug, a stale label) is
**not** a data-changelog entry — those go in `AGENT_CHANGELOG.md` only. This
file is only for a value someone could already have cited that has since
changed.

## Format

```
## YYYY-MM-DD - <dataset> - <one-line summary>

| Field | Old value | New value | Why |
|---|---|---|---|
| ... | ... | ... | ... |

Affected releases: data/releases/<years>/...
```

---

## 2026-10-22 - Trends and patterns page - hurt explanation withdrawn, road grouping corrected

| Field | Old value | New value | Why |
|---|---|---|---|
| Explanation of the 2023 to 2024 hurt fall | "hurt and grievous hurt were merged and simple hurt became non-cognisable" | The two tables use different heads ("Hurt" and "Hurt or Grievous Hurt"); press reports attribute the national fall to the BNS but the mechanism is not confirmed; simple hurt was already non-cognisable under IPC section 323 and is under BNS section 115(2) | An independent review (Codex) found primary sources (a Delhi Police training document and the Supreme Court judgment 2025 INSC 410) showing no new change of cognisability. This project has not read those documents itself. |
| National hurt figures | "6.36 lakh to 4.41 lakh" stated plainly | Same values marked rounded and from press reports, not checked against the NCRB report | The NCRB report itself could not be reached in the check. |
| Fatal crashes on "GTK Road" in the 2023 zone list | 64 (G.T. Road rows merged in) | 55; the three roads together 188 of 366 (was 197) | The 2023 report prints "G.T. Road" and "GTK Road" as different labels (three zones with 4, 3 and 2 fatal crashes are labelled G.T. Road); they are no longer combined. Persistent places on GTK Road 14 to 12; G.T. Road shows separately. |

No NCRB or Traffic Police figure changed. Delhi's own hurt numbers (6,045 to 2,028) and the 8% and 97% shares were verified against the NCRB workbooks. Affected: assets/page-patterns.js, data/continuity.json, data/derived/bns_hurt_2023_2024.json, scripts/lib/patterns.js, the planner brief.

---

## 2026-10-22 - Trends and patterns page, Delhi crime 2023 to 2024 - wording corrected, hurt reclassification added

| Field | Old value | New value | Why |
|---|---|---|---|
| Statement on the 2023 to 2024 step | "2024 reads 2,75,402. That is not a fall in crime." | "...lower than 2023, but this data cannot show whether that is a real fall." | The earlier wording asserted more than the evidence supports: the step is compare-with-caution, not proven artefact. |
| Reason attached to the 2023 to 2024 step (`data/continuity.json`) | BNS replaced the IPC on 1 July 2024 | Adds: NCRB attributes the national fall in hurt cases (6.36 lakh to 4.41 lakh, 30.58%, as reported in the press) to hurt and grievous hurt being merged and simple hurt becoming non-cognisable; Delhi hurt 6,045 to 2,028 is about 8% of the Delhi-wide fall, theft about 97% | Delhi figures recomputed from the archived NCRB workbooks (`data/derived/bns_hurt_2023_2024.json`); national figures are as reported and were not re-derived. No published count changed. |

Affected: assets/page-patterns.js, data/continuity.json, the Data & methods comparison checker text.

---

## 2026-10-22 - crash_prone_zones_2023 - rank 4 name and road labels corrected

| Field | Old value | New value | Why |
|---|---|---|---|
| Rank 4 `name` | Boulevard Road | Kashmiri Gate Chowk Boulevard Road | Table 6.29 of the Delhi Road Crash Report 2023 prints this zone as "Kashmiri Gate Chowk Boulevard Road". The earlier extraction kept only the last words as the name. |
| Rank 4 `road` | Kashmiri Gate Area | Boulevard Road | The report's Road Name column prints "Boulevard Road" for this row. "Kashmiri Gate Area" was not in the report. |

Counts (12 simple, 6 fatal, 18 total), rank, coordinates and district are unchanged. Checked against the page image of the report (PDF page 120). The recurring-location file now treats this zone and the 2024 zone of the same printed name as one place.

Affected releases: data/releases/2023/crash_prone_zones.csv and .json (and the deprecated exports/crash_prone_zones_2023.*).

---

## 2026-10-05 - mpd2047_ward_comparison / landuse_by_ward - parks and agriculture compared separately

| Field | Old value | New value | Why |
|---|---|---|---|
| `current_green_open_km2` (citywide) | 90.5 km² ("parks / green", mapped now) | 22.2 km² | The OSM side included farmland and other agricultural tags (68.3 km², 75% of it after overlap resolution) while the plan side was parks only (P1+P2). Parks are now compared with parks. |
| Parks gap, planned minus mapped (citywide) | +84.7 km² | +153.0 km² | Direct consequence: farmland had been masking about half of the real gap. |
| `planned_agriculture_km2`, `current_agriculture_km2`, `delta_agriculture_pp`, `planned_/current_agriculture_share_pct` | did not exist | 208.8 km² planned (A1) vs 68.3 km² mapped | New comparable line: OSM agricultural tags against the plan's A1 "Agriculture land". A1 is a zoning designation, not a crop survey, so this is the closest counterpart rather than an identity. |
| `planned_a1_agriculture_km2` | 208.8 km² (plan-only) | removed | Superseded by `planned_agriculture_km2` (same values) now that A1 is compared. |
| `landuse_by_ward.csv` | 16 columns | 18 columns | Added `green_open_agriculture_km2` and `green_open_agriculture_pct`. All 16 original columns are unchanged (0 changed cells across 290 wards); `green_open` still includes agriculture there. |

Per-ward values of the green_open, agriculture and delta fields in the MPD comparison changed for every ward with any mapped farmland. Residential and industrial figures did not change. Plan-side values did not change.

Affected files: `data/mpd2047_ward_comparison.csv`, `data/mpd2047_ward_comparison.json`, `data/landuse_by_ward.csv`.

## 2026-10-03 - mpd2047_ward_comparison - A1 relabelled "Agriculture land"; "other planned" no longer includes A1

| Field | Old value | New value | Why |
|---|---|---|---|
| `planned_green_belt_km2` (column, ward and citywide) | 208.8 km² citywide, named "green belt" | renamed `planned_a1_agriculture_km2`, same values | The gazette's own legend (Table 5.1) defines A1 as "Agriculture land". Cross-checked against DDA's Low Density Area layer: A1 equals its GREEN BELT type exactly (155 polygons, 209.3 km²). |
| `planned_not_comparable_km2` | 452.7 km² citywide | 243.9 km² citywide | The old value included A1 (208.8), so A1 was counted in both this field and its own line. Buckets now partition the plan total exactly: 298.1 + 38.4 + 175.2 + 208.8 + 243.9 = 964.4. |

Published for roughly three days (since 2026-09-30). No residential, industrial or parks/green figure changed. The per-ward values of `planned_not_comparable_km2` changed for every ward with any A1 area.

Affected files: `data/mpd2047_ward_comparison.csv`, `data/mpd2047_ward_comparison.json`.

---

_No other revisions recorded yet — this changelog began tracking on 2026-08-05,
the date `data/releases/` was first published. Every figure currently in
`data/releases/2016/` through `data/releases/2024/` is the first published
version of that figure._
