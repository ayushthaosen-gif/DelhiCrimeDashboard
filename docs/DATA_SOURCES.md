# Data sources and original locations

Where each dataset comes from, with original URLs and reuse notes. A public URL does not automatically grant an open-data licence. Moved out of the README.

## Open-data locations and original URLs

The links below are locations where researchers can inspect or retrieve the underlying public data. A public URL does **not** automatically grant an open-data licence: check each publisher's terms before redistribution. OpenStreetMap-derived files require OpenStreetMap attribution and ODbL compliance.

| Dataset used by the dashboard | Publisher / original location | Direct data or landing-page URL | Format and coverage | Reuse note |
|---|---|---|---|---|
| District crime, 2024 | National Crime Records Bureau (NCRB), *Crime in India* district tables | [IPC/BNS crime XLSX](https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx); [SLL crime XLSX](https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx); [Crime against women XLSX](https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx) | XLSX; district tables | Official public files; verify NCRB terms before redistribution. |
| District crime, 2023 | NCRB, *Crime in India* district tables | [IPC crime XLSX](https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx); [SLL crime XLSX](https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx); [Crime against women XLSX](https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx) | XLSX; district tables | Official public files; verify NCRB terms before redistribution. |
| District crime, 2022 | NCRB, *Crime in India* district tables | [IPC crime XLSX](https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx); [SLL crime XLSX](https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx); [Crime against women XLSX](https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx) | XLSX; district tables | Official public files; verify NCRB terms before redistribution. |
| Historical crime, 2016-2021 | NCRB source tables distributed through India Data Portal | [2016 district IPC CSV](https://ckandev.indiadataportal.com/dataset/e311a510-ce48-4f4c-baf6-0ec5f9278285/resource/7d5e2cc6-a704-4248-aa44-13d7186f847c/download/districtwise-ipc-crimes-2016.csv); [2017 onward district IPC CSV](https://ckandev.indiadataportal.com/dataset/e311a510-ce48-4f4c-baf6-0ec5f9278285/resource/387dedad-5978-4f97-a6c5-60ca45f9405a/download/districtwise-ipc-crimes-2017-onwards.csv) | CSV; harmonized selectively in this project | See the compatibility/null rules in this README and the verified historical JSON metadata. |
| Road crashes and crash-prone zones, 2023 | Delhi Traffic Police | [Delhi Crash Report 2023](https://traffic.delhipolice.gov.in/delhi-crash-report-2023) | Web landing page with report download; all 15 police districts | Official report; map coordinates include project validation/geocoding notes. |
| Road crashes and crash-prone zones, 2024 | Delhi Traffic Police | [Delhi Crash Report 2024](https://traffic.delhipolice.gov.in/delhi-crash-report-2024) | Web landing page with report download; all 15 police districts | Official report; unresolved hyper-local locations remain flagged. |
| Road Crash Reports 2016 to 2022: district tables, named crash-prone zones, roads, enforcement | Delhi Traffic Police annual reports (PDF) | File names, printed pages and SHA-256 hashes are in the manifests under [`data/releases/road_zones_roads_2016_2021/`](../data/releases/road_zones_roads_2016_2021/README.md), [`data/releases/road_crash_report_2022/`](../data/releases/road_crash_report_2022/README.md), [`data/releases/road_enforcement_2019_2022/`](../data/releases/road_enforcement_2019_2022/README.md) and [`data/staged/road_districts_2016_2020/`](../data/staged/road_districts_2016_2020/FINDINGS.md) | PDF; tables read from the text layer, or transcribed from the page image where the table is an image (2016 to 2020) | Official reports; counts are within each year's selected zones; not independently reviewed. |
| Fatal crashes and hit-and-run, 2022 | Transport Department, GNCTD / Delhi Traffic Police | [2022 Delhi Road Crash Fatalities Report PDF](https://transport.delhi.gov.in/sites/default/files/2024-09/2022_delhi_road_crash_fatalities_report_1.pdf) | PDF; Traffic Police's 11-district geography | Four dashboard districts are null, not zero, because this report used a different geography. |
| Streetlights and pedestrian underpasses | Delhi Transport Stack (Department of Transport, GNCTD); survey by Papli AI ("PAPL") | [Delhi Transport Stack data catalogue](https://delhi.transportstack.in/data-services) (earlier address: [Open Transit Data portal](https://otd.delhi.gov.in/)) | Excel, "key hotspots" of Delhi only; surveyed portions of 9 of 15 districts | Catalogue lists it as Open. The portal's terms of use allow reproduction free of charge if accurate, not misleading and with the source prominently acknowledged ([terms read 2026-10-22](#delhi-transport-stack-terms)); the dataset's own licence in the catalogue has not been checked. Unsurveyed districts are stored as coverage gaps. |
| Pedestrian overbridges | OpenStreetMap via Overpass API | [Overpass API endpoint](https://overpass-api.de/api/interpreter); [exact query and processing notes](../data/source/README.md); [project GeoJSON](../data/delhi_pedestrian_overpasses_osm.geojson) | OSM ways grouped into 242 mapped bridge features; snapshot 2026-08-04 | ODbL; mapped inventory, not an official completeness register. |
| Metro gates (official list) | Delhi Metro Rail Corporation, via the Delhi Transport Stack (Department of Transport, GNCTD), dataset 3 | [Delhi Metro: Gate Locations](https://delhi.transportstack.in/data-services/datadetails/3) | Excel; 686 gate rows with coordinates across the whole network including the NCR; version 1, published 2024-10-11, last updated by the publisher 2024-12-02 | Delhi Transport Stack Licence Agreement 1.0, Schedule 1: derivatives allowed; redistribution of the licensed work on its own is **not** allowed (allowed as part of a collection of works from different sources); attribution required; a modified version must say what changed. Only counts and distances derived by this project are published ([derived file](../data/derived/metro_gates_official_2024.json)); the gate coordinates are not. The raw file hash is in the derived file. |
| Metro gates, bus stops, ATMs, liquor shops, surveillance and mapped police posts | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [Overpass Turbo query interface](https://overpass-turbo.eu/) | OSM point/way features; tag filters are documented in the dashboard footer and workbook | ODbL attribution/share-alike requirements apply. |
| Traffic signals, pedestrian crossings, hospitals, street lamps, footway/sidewalk coverage (interactive map; street-lamp points also available on the main dashboard) | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [exact queries and processing notes](../data/source/README.md) | Snapshot 2026-08-06, `scripts/fetch_osm_infra_snapshots.js` + `scripts/build_infra_extras.js`; footway coverage is a per-district length/density figure, not shipped as line geometry | ODbL; mapped inventory, not an official completeness register. |
| Combined PAPL + OSM streetlights (`data/streetlights_combined_by_district.csv`) | PAPL Open Transit Survey + OpenStreetMap contributors | [processing notes](../data/source/README.md) | District-level reconciliation: PAPL's number where surveyed (9 districts), OSM's street-lamp count as a fallback only where PAPL has nothing (3 districts); `combined_source` per row says which; 3 districts genuinely have neither and are left null | PAPL survey terms + OpenStreetMap ODbL; never blended into one unattributed figure. |
| Road and footway size (`data/road_sizes.csv`, `data/footway_sizes.csv`) | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [processing notes](../data/source/README.md) | Per-segment `highway=*` classification (always tagged), `lanes=*` (33.7% of roads), `width=*` (0.2% roads / 0.7% footways) -- no official Delhi per-segment width dataset was found; missing values left blank, never estimated | ODbL; sparse tagging, not a survey. |
| Land use — ward CSV (`data/landuse_by_ward.csv`) and interactive-map polygon layer | OpenStreetMap contributors | [OpenStreetMap data and licence](https://www.openstreetmap.org/copyright); [processing notes and known limitations](../data/source/README.md) | 290 wards, real polygon-overlap area by category, computed with @turf/turf; only ~23.4% of ward area is landuse-tagged in OSM on average -- see `mapped_pct` per row, never read the untagged remainder as "vacant" | ODbL; a community-extracted, unlicensed, PDF-derived DDA draft-plan alternative was found and deliberately not used -- see processing notes for why. |
| Official licensed liquor-vend list | Delhi State Civil Supplies Corporation (DSCSC) / DCCWS | [DSCSC Liquor Vends page](https://dscsc.delhi.gov.in/dscsc/liquor-vends) | Published list; 374 official records in the project | Location coordinates are approximate unless explicitly marked as exact. |
| Police stations and police-district boundaries | Delhi Police GSDL GIS export | [Community mirror of the GSDL export](https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac) | GIS station points and jurisdiction polygons | Mirror is provided because a stable original download URL is not available; inspect provenance before reuse. |

### Delhi Transport Stack terms

Read on 22 October 2026 from the portal's [terms of use](https://delhi.transportstack.in/termsofuse) and its two onboarding policies ([data users](https://dts-backend.transportstack.in/api/document/download/2/4), 8 pages, SHA-256 `383922694f128e70ab38dac3bfd1816f50001153ef0ee856f1b9acedd29fa324`; [data contributors](https://dts-backend.transportstack.in/api/document/download/2/5), 7 pages, SHA-256 `d5dc2ecd6a020f2e339d1eb5bc75769e158ec1eff7813f4ef79a99db568bf5f4`). What they say, and what they do not:

- **Reproduction.** "Material featured on this Portal may be reproduced free of charge", if reproduced accurately, not in a derogatory or misleading context, with the source prominently acknowledged; this does not extend to third-party copyright material. Use other than the intended purpose, or modification, is governed by the licence of the respective dataset in the data catalogue.
- **Data users.** Registration on the portal, a Data Request form stating commercial or non-commercial use, and acceptance of a Data User Agreement are required for the data; datasets are classed Open (the catalogue shows which) or approval-based. Data must be processed in India and the Digital Personal Data Protection Act applies. An application built on the data must be reported to the portal. A fee applies to commercial users only.
- **Not stated.** The text of the Data User Agreement (the policy lists it as Annexure B but it was not in the readable text), any named open licence, and the licence of the PAPL streetlight dataset. Redistribution of PAPL-derived figures in this project's exports is therefore attributed and accurate but not covered by a licence this project has read.
- This project uses only figures the catalogue lists as Open and has not registered as a data user.

### 2025 sources staged for review

These files are **not automatically integrated into the production dashboard**. Their collection status, checksums, resolved URLs and validation notes are recorded in [`data/releases/2025/audit/`](../data/releases/2025/audit/) and [`tools/pipeline_2025/output/`](../tools/pipeline_2025/output/). Current public landing pages include:

- [NCRB](https://ncrb.gov.in/) - no unambiguous official *Crime in India 2025* district release was found by the pipeline.
- [Delhi Traffic Police](https://traffic.delhipolice.gov.in/) - no qualifying full 2025 crash report was found by the pipeline.
- [New Delhi district iRAD/eDAR](https://dmnewdelhi.delhi.gov.in/integrated-road-accident-cases-month-wise/)
- [West Delhi district iRAD/eDAR](https://dmwest.delhi.gov.in/integrated-road-accident-cases-month-wise/)
- [South-East Delhi district iRAD/eDAR](https://dmsoutheast.delhi.gov.in/irad-edar-south-east/)
- [North-West Delhi district iRAD/eDAR](https://dmnorthwest.delhi.gov.in/irad-edar-north-west-delhi/)
- [Delhi Excise preferred-vends page](https://excise.delhi.gov.in/excise/preferred-vends-purchaseprocurement-liquor-p-10-permit)
- [DSCSC liquor-vends page](https://dscsc.delhi.gov.in/dscsc/liquor-vends)

Use the audit manifests - not a copied URL alone - to determine whether a 2025 source was downloaded, validated, review-pending or unavailable.

### Official reference archive (2024-2026)

The evidence archive complements the 2025 staging pipeline with the current official indices, Delhi Police Manual 1 (updated 22 May 2026), the 2022 MCD delimitation notification and the 9 October 2025 Excise preferred-vend circular. See [`data/raw/source_archive/manifest.json`](../data/raw/source_archive/manifest.json) for the exact original links and checksums. One source is intentionally recorded as unavailable when retrieval fails (rather than being replaced by a third-party mirror): the PIB page reporting the latest NCRB release returned HTTP 403 during archival. The dashboard continues to use its independently validated annual crime releases, not that blocked capture.

## Data & sourcing

Pedestrian-overbridge data is a reproducible OpenStreetMap Overpass snapshot from 4 August 2026. It selects pedestrian ways tagged as bridges, groups connected/nearby segments into 242 mapped bridge features, and assigns their centroids to the 15 district polygons. This is not an official completeness register; unmapped features and accessibility/status changes may be missing.

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
- Citywide road crash/fatality trends (2011-2024; counts, not rates) and road deaths by mode of
  travel (2019-2023): Delhi Traffic Police annual road crash data.
- Crash-prone zone map coordinates: provided lat/lng for all 107 zones,
  cross-validated against the source table by rank and fatal-crash count
  before use (105 of 107 fall inside a district polygon and are plotted).
- Streetlights & underpasses: PAPL survey, via Delhi Transport Stack Open
  Transit Data.
- Mapped pedestrian overbridges (242 OSM bridge groups), metro station gates & police chowkis/outposts: OpenStreetMap (ODbL).
- Police stations & district boundaries: Delhi Police GSDL.

Coverage gaps (e.g. districts the streetlight survey never drove through, or
the 2022 road-crash report's 11-district geography) are treated as missing
data, not zero — see the in-app confidence markers and the "How this is
calculated" panel for details.
