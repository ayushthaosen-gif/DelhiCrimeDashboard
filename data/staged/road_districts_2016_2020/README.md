# Traffic Police road data, 2016 to 2020 (staged)

Aggregate district and selected-zone crash counts from the Delhi Traffic Police annual reports, digitised and reconciled by Codex and added here unchanged. Read [FINDINGS.md](FINDINGS.md) first: it holds the continuity judgements and the source issues.

- Status: **staged**. Author checked, not independently reviewed against the PDFs. Not on any map or chart.
- Independent check added when it was committed: every district row sums (fatal + injury + non-injury = total), and the whole-district rows sum to the citywide crashes and fatal crashes in `data/road_safety_trends.json` for all five years.
- `generated/` holds the aggregate CSV and JSON; `validation_2016_2020.json` and `transcriptions_2016_2020.json` hold the checks and the page transcriptions; `acquisition_manifest.json` records every source URL, retrieval time and SHA-256.
- The source PDFs (hundreds of MB), page renders and Codex's build scripts are not in the repository. Links in FINDINGS.md to `review_2016_2020/` and `inputs/` point at those omitted files. The hashes in the manifest identify the PDFs.
- Counts, not rates. Selected zones change every year, so a falling zone count is not a fall in risk. Dwarka is a separate unit from 2018, so district changes across 2017 to 2018 are not calculated. Missing values (people killed, the 2016 zone breakdown, New Delhi's 2019 zone row) are null, never zero.
- Public availability is not an open licence; no reuse licence was verified.

## Added for the Road safety district tables (2021)

`generated/traffic_district_crashes_2019_2021.*`, `printed_dtp_totals_2019_2021.*` and `generated/crash_zone_districts_2021.*` come from the 2021 report (Tables 6.1 and 6.30). Only their 2021 rows are used: 2019 and 2020 come from those years' own annual reports, so no observation is duplicated. The 2021 selected-zone table omits Central (11 districts plus the printed total); that omission is shown as "not in the table", never zero. These files now feed the "Districts, 2016 to 2024" section of Road safety, and the series is registered as production in `data/series_status.json`. Named-zone and road lists for 2016 to 2021 have not been transcribed.
