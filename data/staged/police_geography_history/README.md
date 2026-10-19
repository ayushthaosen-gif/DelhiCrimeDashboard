# Historical police geography: reference preview

Open `preview.html` for a separate, offline 2014 reference map. It reconstructs 11 territorial police districts from 161 station polygons and keeps two airport station polygons separate. Theft, robbery, total IPC and the revised 2014 criminal-trespass/burglary count join directly to original 2014 NCRB rows. No totals are distributed across later districts, no rates are calculated, and no contemporary infrastructure is overlaid.

This is **not ready to replace the dashboard map**. The archive claims Delhi Police as its source, but provides no survey/effective date or explicit reuse licence. It was uploaded on 13 May 2014; the official station roster is dated 9 December 2014. Original MHA PDFs are currently 404; indexed official text was inspected and a factual roster transcription preserved, with its own checksum rather than a fabricated original-file checksum. The station shapes overlap and extend beyond the expected Delhi footprint; validation records those measurements. Boundaries are neither snapped nor clipped to invent a clean partition. Exact annual coverage still needs confirmation.

## Why whole modern districts cannot simply be merged

The official notification dated 9 November 2017 (F.1/6/2016/HP-I/Estt./4049–4056) states that Dwarka was carved from **South-West and Outer**, not South-East. The earlier 2014 roster places Dwarka North/South in South-West and Uttam Nagar in West. South-West itself later acquired stations listed under 2014 South. Consequently, a single modern-district parent lookup is insufficient. Station memberships and their boundaries must be dated independently.

## Year coverage and remaining work

| Crime reference year | Reporting geography in selected crime source | Available geometry | Map status |
| --- | --- | --- | --- |
| 2011 | 11 territorial districts plus specialised reporting units | 2014 reference only; no demonstrated 2011 equivalence | Disabled |
| 2012 | 11 territorial districts plus specialised reporting units | 2014 reference only; no demonstrated 2012 equivalence | Disabled |
| 2013 | 11 territorial districts; Metro added as a reporting unit | 2014 reference only; no demonstrated 2013 equivalence | Disabled |
| 2014 | 11 territorial districts plus specialised reporting units | May archive + December roster; effective dates and overlaps unresolved | Separate reference preview only |
| 2015 | 11 territorial districts plus specialised reporting units | No demonstrated equivalence to 2014 reference | Disabled |
| 2016 | Existing NCRB series reports 11 territorial labels; October reorganisation needs reconciliation | 2014 geometry cannot certify that annual reporting basis | Existing production map unchanged |
| 2017–2018 | 14 territorial labels in existing series; Dwarka notification is late 2017 | Need dated station shapes and full allocation schedules, including changes leading to Outer North | Existing production map unchanged |
| 2019 onward | 15 territorial labels in existing series | Current dashboard geometry remains unchanged | Existing production map unchanged |

To replace the historical dashboard views, verify dated boundary schedules for each reporting geography, obtain reusable geometry, resolve archive overlaps against an authoritative reference, and confirm annual NCRB reporting scope (including transition years). Do not colour the entire modern Dwarka polygon using a guessed parent count. Retain source definitions and missing values. Historical area/population denominators cannot be borrowed from today's polygons.

## Reproduce and validate

1. Optional archive re-extraction: install `pyshp==2.3.1`, then run `python tools/extract_historical_station_geometry.py`. This reads only fixed ZIP members in memory and verifies the original ZIP checksum.
2. With repository dependencies installed, run `node scripts/build_historical_geography_preview.js`.
3. Run `node --test test/historical_geography_preview.test.js`.

The build verifies one-to-one assignments of all 163 station polygons, 11 territorial districts, separate airport coverage, direct NCRB row joins and preservation of the archived union footprint. `manifest.json` records URLs, dates, hashes, reuse uncertainty and quality limitations; `validation.json` records geometry quality. This folder is separate from both production releases and the previously staged historical crime release.
