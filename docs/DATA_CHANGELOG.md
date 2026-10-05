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
