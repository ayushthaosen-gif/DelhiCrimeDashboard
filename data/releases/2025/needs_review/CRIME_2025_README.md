# 2025 crime: citywide, news-reported, NOT verified

`crime_citywide_2025_news_reported.csv` holds Delhi-wide counts for selected offences that two news outlets reported on 2026-01-21 as Delhi Police data:

- IANS: https://ianslive.in/delhi-crime-numbers-show-downward-trend-in-2025--20260121160831
- ETV Bharat: https://www.etvbharat.com/en/bharat/delhi-crime-report-2025-murder-rape-robbery-cases-drop-sharply-police-claim-improved-law-and-order-enn26012102887

The two outlets agree on every figure they share. This is secondhand reporting: no Delhi Police table or press release was found. Delhi Police's site (delhipolice.gov.in) was searched on 2026-10-16 and exposed no crime-statistics page; its press-release pages list individual case reports, and only the first page of 52,375 records was visible to the fetch tool, so a releases page may exist there that was not seen.

## Not available
- **District-wise 2025**: not found anywhere.
- **Total IPC/BNS for 2025**: not found. Only the first half is reported (118,822 cases, 1 Jan to 30 Jun 2025, against 129,693 in 2024; PTI via Tribune https://www.tribuneindia.com/news/delhi/delhi-sees-8-4-pc-dip-in-overall-crime). Do not create `totalIPC2025`.
- **Theft, burglary, SLL**: only approximate news figures (vehicle theft about 35,014; other theft about 102,000), not staged.
- **NCRB Crime in India 2025**: not published; the latest edition is 2024 (released May 2026).

## Cautions
- Offence definitions and counting units may differ from the dashboard's NCRB-based columns; do not put these beside the 2022-2024 district figures.
- The Federal reported murder as 107 for 2025; that is a first-quarter figure, not the full year.
- Rows with scope notes need the original police table before any use.

Integration into the dashboard is a separate, human-approved step.
