# 2025 police-district crash crosswalk coverage

Status: **partial, staged; not dashboard-integrated**.

- Source tables: 50 police-station rows published by three district-administration iRAD/eDAR reports: West, South-East and North-West.
- Jurisdiction mapping: 46 rows map exactly to one of six Delhi Police districts using *Delhi Police RTI Manual 1*, updated 22 May 2026, Appendix master station list, pages 13-22.
- Unresolved rows: 4 (`Madipur`, `Mianwali Nagar`, `PASCHIM VIHAR`, `MACT Cell NW`). They remain null; they are not assigned by name similarity. `PASCHIM VIHAR` is particularly ambiguous because the Manual separately lists Paschim Vihar East and Paschim Vihar West.
- Temporal caveat: the Manual is a post-period (2026) structural reference for 2025 source rows. It is recorded on each mapped row and does not prove no station-jurisdiction change occurred during 2025.
- Coverage caveat: six mapped police districts is not the 15-district dashboard geography. Do not calculate Delhi-wide totals, rankings, or comparisons from this file.
- Metric caveat: blank source cells remain null. The station and district files retain `reporting_administrative_area`, mapping evidence page, source and temporal basis.

`road_crashes_by_police_station_2025.csv` is the authoritative staged table. `road_crashes_by_police_district_2025.csv` is a partial aggregation only; it deliberately contains only mapped districts represented by the available reports.