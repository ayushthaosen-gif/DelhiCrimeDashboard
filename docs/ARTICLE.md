# Where the lights end: what Delhi's own data says about safety, and what it still can't tell us

*Nearly a decade of district-level NCRB crime data, two years of named crash-prone zones, and multiple public-infrastructure datasets — brought together across Delhi's police districts and 290 legacy ward polygons. Here is what the combined view suggests, and what the data still cannot answer.*

## Why this exists

Delhi publishes a lot of safety-relevant data. NCRB releases district-wise crime figures every year. Delhi Traffic Police publishes an annual Road Crash Report naming specific blackspots, with fatal and total crash counts per location. The city's streetlight and pedestrian-underpass coverage was surveyed and made public through the Delhi Transport Stack's Open Transit Data initiative. OpenStreetMap has a dense, if uneven, layer of bus stops, ATMs, liquor vends, and CCTV/guard posts.

None of it talks to the rest of it. A resident can read that their district had thousands of IPC crimes last year, or that a specific stretch of GTK Road had eleven fatal crashes in 2024, or that a given ward has thin streetlight coverage — but not in the same place, not against the same map, and not in a form where you can ask whether more police infrastructure actually correlates with less crime, or whether the causal arrow points the other way. This project assembles that: one static dashboard plus an interactive street map, built from a dozen distinct public datasets, joined at the district and — for a growing subset of layers — the ward level.

*A visual version of this piece — with a choropleth district map and inline trend charts — is published separately as an artifact linked from this repo's discussion; this markdown version carries the same data in table form.*

## Why it's needed

Three audiences keep running into the same wall. **Citizens and journalists** want to ask whether a neighborhood is safe and get an answer grounded in more than one number — crime density alone flattens a real, multi-causal picture. **Researchers** need clean, joinable, correctly-cited data more than they need more raw PDFs; government reports are authoritative but siloed, with no shared join key out of the box. **Policymakers and planners** need to see infrastructure equity, not just crime counts — a district with high crime and thin coverage is a different problem than one with high crime and strong coverage, a distinction invisible until both datasets sit on the same map.

| If you're... | The actual lead is... |
|---|---|
| **Reporting** | Not "crime fell 16%" — it fell in *every* district by wildly different amounts, from −8% to −30%. That gap is the story; the citywide average hides it. |
| **Planning** | Police infrastructure correlates with road deaths because it's sited reactively, after the fact. Plan around the six districts never surveyed for streetlights at all — not measured, not zero. |
| **Researching** | Ward-level data exists for exactly two point layers (crash zones, liquor vends) and inherits crime rate from its parent district. Treat that inheritance as a labeled limitation in any downstream model, not ward-resolution ground truth. |

## The data, 2016 to 2024

Coverage isn't a single flat decade — it's layered, and where it's thin, the dashboard says so rather than interpolating.

| Years | What's covered |
|---|---|
| **2016–2021** | Theft & robbery, all years; burglary from 2017 (2016 excluded — incompatible source category). Total IPC, crime against women, and SLL crime for 2017–2021 were *reconstructed* by summing each year's full offence-category table, then verified by exactly reproducing the official 2022 totals for all 15 districts before trusting the method backward. |
| **2014–2024** | Citywide road-crash counts, fatalities, and mode-of-travel breakdown — Delhi Traffic Police annual reports, not broken down by district in the source. |
| **2022** | Fatal road crashes by district — but only 11 of 15 districts; Outer, Outer North, Rohini, and South-West used a different Traffic Police reporting geography that year and are excluded rather than shown as zero. |
| **2022–2024** | Full district-level crime (theft, robbery, burglary, total IPC, crime against women, SLL) — official NCRB district-wise tables, all 15 districts, no gap. |
| **2023** | 107 named crash-prone zones with real severity counts, cross-checked against the source table by rank and fatal-crash count; 105 resolved to coordinates. |
| **2024** | 93 named crash-prone zones, richer per-zone breakdown (pedestrian / two-wheeler / HTV / hit-and-run / day / night); only 54 resolved to coordinates. 374 official liquor vends added, approximate locality coordinates. 290 municipal wards aggregated for a finer-than-district bivariate view. |

## Citywide trends

**Total IPC crime**: 213,824 (2017) → peaked at 311,806 (2023) → 261,527 (2024), a **16.1% single-year drop**, uniform across every one of the 15 districts. That kind of simultaneous citywide drop is worth flagging for further reporting, not reading as unqualified good news — it could be a genuine effect, or a change in how something was classified or counted. NCRB's own report would carry any stated methodology note; this dashboard only has the numbers.

**Road fatalities**: 1,671 (2014) → a pandemic-era low of 1,196 (2020, fewer vehicles on the road, not safer roads) → back up to 1,551 (2024), the highest since 2018, on fewer total crashes (5,657) than most pre-pandemic years. Crashes are getting less frequent and more lethal per crash.

**Persons injured by mode, 2024 vs 2023**: two-wheeler riders remain the largest injured group by a wide margin — 2,234 in 2024 (42.8% of all road injuries), down slightly from 2,356 — and also carry the largest killed-count *increase* year over year (549 → 611, +11.3%). Pedestrians: 1,777 injured (down from 1,941). Cyclists: 106 injured (down from 118), but killed rose 30 → 53.

## Every district, 2023 → 2024

Total IPC crime fell in **all 15 districts** — but not by the same amount, ranging from West's −29.8% (27,606 → 19,383) to Shahdara's −8.1% (15,210 → 13,982). A uniform citywide policy shift would tend to move every district by a similar percentage, not by a factor of nearly four between the smallest and largest drop — this spread is itself a finding worth digging into, not a footnote.

| District | 2024 IPC | Change vs 2023 |
|---|---:|---:|
| North-West | 24,329 | −14.4% |
| North | 24,275 | −10.7% |
| North-East | 22,786 | −14.5% |
| South-East | 22,363 | −13.1% |
| Outer | 21,699 | −8.6% |
| East | 19,711 | −9.9% |
| West | 19,383 | −29.8% |
| South | 18,913 | −22.2% |
| Dwarka | 17,317 | −25.8% |
| Rohini | 16,479 | −9.8% |
| Outer North | 14,316 | −10.5% |
| Shahdara | 13,982 | −8.1% |
| Central | 13,690 | −26.3% |
| South-West | 9,899 | −18.1% |
| New Delhi | 2,385 | −14.3% |

Persons killed moved the *opposite* direction citywide, 1,457 → 1,551 (+6.4%) — property/theft-type crime and fatal road crashes are not the same trend line, and the dashboard deliberately never blends them into one "safety score."

## What correlates with what

Every crime and road-safety metric checked against every infrastructure layer, Pearson r across districts with real coverage for both axes (`*` = statistically significant, p<0.05 — most cells aren't, which at 8-15 districts is the honest result):

| Metric | Streetlt | Underps | Metro | Police | Bus | ATM | Liquor | CCTV |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Road deaths | +0.696 | +0.565 | +0.753 | **+0.868\*** | +0.711 | +0.591 | +0.559 | +0.527 |
| Hit & run | +0.669 | +0.626 | +0.709 | **+0.889\*** | +0.686 | +0.564 | +0.557 | +0.479 |
| Fatal crashes '24 | −0.491 | −0.133 | +0.253 | +0.279 | +0.270 | +0.268 | +0.252 | +0.148 |
| Persons killed '24 | +0.034 | +0.445 | **+0.480\*** | +0.692 | +0.460 | +0.403 | **+0.481\*** | +0.102 |
| Persons injured '24 | +0.285 | +0.720 | **+0.583\*** | **+0.850\*** | **+0.588\*** | **+0.514\*** | **+0.586\*** | +0.190 |

(Full 12×8 matrix, 96 cells, is live in the dashboard with per-cell tooltips: exact r, t-statistic, p-value, n.) Police infrastructure's correlations are the strongest in the table and should be read as "sited where the risk already is," not "causes the risk" — reactive allocation, not a policing failure.

## Ward-level findings — a finer grid than 15 districts

Two datasets have point coordinates — the 2024 crash zones and the 374 official liquor vends — which means they can be aggregated onto a much finer grid: 290 municipal wards (pre-2022 delimitation, used purely as a spatial grid).

- **92 of 93** 2024 crash zones assigned to a ward by point-in-polygon
- **372 of 374** official liquor vends assigned to a ward
- **50 of 290** wards have both a crash zone and a liquor vend present
- **287 of 290** wards matched to an enclosing district for crime-rate context

### The High-Injury Network

Vision Zero road-safety programs use a specific term for this: the **High-Injury Network** — the small share of a city's geography responsible for a disproportionate share of its fatal crashes, ranked and named so limited enforcement and engineering budgets go where they matter most. Delhi has never had one formally published; this dashboard can now compute one, from real data, at ward granularity.

- **18 of 290 wards (6.2%)** together account for **half** of every 2024 ward-assigned fatal crash — a real, computed cutoff (recomputed on every data rebuild), not an arbitrary top-N.
- **370** total 2024 fatal crashes summed across the 66 wards that have at least one.

| Rank | Ward | District | Zones | Fatal (sum) |
|---:|---|---|---:|---:|
| 1 | Adarsh Nagar | North-West | 3 | 19 |
| 2 | Timar Pur | North | 3 | 19 |
| 3 | Kashmere Gate | North | 3 | 17 |
| 4 | Ashok Vihar | North-West | 4 | 16 |
| 5 | Krishna Nagar | Shahdara | 2 | 11 |
| 6 | I.P. Extension | East | 2 | 11 |
| 7 | *(unnamed ward — source data gap)* | Shahdara | 3 | 11 |
| 8–18 | Dhir Pur, Punjabi Bagh, Sarai Pipal Thala, Mukherjee Nagar, Karam Pura, Bijwasan, Libas Pur, Kishangarh, Janak Puri West, Khichripur, Peragharhi | mixed | — | 6–10 each |

Rank 7 is a real ward polygon in the source boundary file with no name or ward number attached — flagged here rather than dropped or silently relabeled, the same discipline applied to every other data gap in this project. Three of the top five sit in North or North-West — the same two districts ranking highest for total IPC crime in 2024. Whether that's one underlying density/traffic-volume effect or two coincidences isn't something a correlation table can settle at this sample size; it's a lead, not a conclusion. This High-Injury Network designation is now flagged directly on every ward in the interactive map's ward-bivariate and exploratory-index popups, not just in this table.

Because no crime data is published below the district level, wards additionally inherit their enclosing district's crime rate (flagged *district-inherited*, not ward-specific) so a ward-level bivariate view — liquor vends × crash zones, or liquor vends × district crime rate — is possible at all. It's the most honest way to get finer-grained answers out of data that fundamentally isn't published fine-grained.

## Why the data is never the latest

This is a permanent property of official Indian government data, not a bug in this project. NCRB's own publication cycle runs roughly a year behind. Different reports use different reporting geographies — the 2022 fatal-crash report covers 11 districts, not 15. Infrastructure surveys are one-time snapshots, not sensors. And a geocoded location is not an official coordinate — every coordinate derived from a government report's prose description, including all 93 of the 2024 crash zones and all 374 liquor vends, is approximate by construction and labeled as such everywhere it appears.

The honest description of this dashboard: the best obtainable synthesis of what's officially published, current to whatever the slowest contributing report allows, with every staleness and precision limit surfaced rather than hidden.

## Toward a crowdsourced layer

Official data answers what got reported and processed. It structurally cannot answer what's happening right now, or what never got reported at all. A crowdsourced layer is the realistic way to close that gap — but only if designed to avoid becoming a second, worse source of false precision:

1. **Narrow, structured reports, not a free-for-all** — a streetlight outage, a broken crossing signal, a near-miss, each with a pin, a timestamp, a fixed category.
2. **Confidence tiers**, the same way this dashboard already separates "approximate" from "verified" coordinates, and now "ward-assigned" from "district-inherited." One unverified public report should never render identically to a Traffic-Police-confirmed blackspot.
3. **Moderation and rate-limiting** — a public map of unsafe spots is also a target for spam and coordinated manipulation. Not optional.
4. **A one-way export to whoever can act** — a periodic, structured handoff (e.g. "streetlight outages reported 3+ times in 30 days, unresolved"), the same way this dashboard already exports clean CSV and GeoJSON.
5. **A public changelog**, same as this project keeps — every promoted or rejected report traceable, so reporting accuracy itself becomes studyable.

For **government**, this becomes an early-warning signal layered on slow official reporting. For **media**, a cluster of independent reports at one intersection is a story lead, not a replacement for the eventual official report. For **researchers**, it's a legitimate dataset on the gap between what's officially recorded and what's actually experienced — provided the confidence-tiering is rigorous enough to keep that gap meaningful instead of noise. None of it replaces official data; it sits next to it, clearly labeled as a different kind of evidence.

---

*Delhi District Safety Index — [github.com/ayushthaosen-gif/DelhiCrimeDashboard](https://github.com/ayushthaosen-gif/DelhiCrimeDashboard). Built on NCRB Crime in India (2016-2024), Delhi Road Crash Reports (2014-2024), PAPL Open Transit Data, OpenStreetMap, and Delhi Police GSDL. Full source citations, per-cell correlation stats, and downloadable CSV/GeoJSON/Excel exports live in the dashboard itself.*
