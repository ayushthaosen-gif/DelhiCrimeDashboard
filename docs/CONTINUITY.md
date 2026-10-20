# Can I compare these years?

`data/continuity.json` is the single place that says whether two years of a measure can be compared. Having a value for every year does not make a valid trend: a change can come from how the data was collected, defined or mapped, not from what happened.

States: **Comparable** (a change figure is shown), **Compare with caution** (shown with a warning and the reason), **Not comparable** (both values stay visible, no change figure, no joined trend line), **Unavailable** (left blank, never zero).

What the file records, each with a reason and an evidence path:

- **Availability**: values that do not exist (2011-2013 SLL and crimes against women; the 2016 aggregates).
- **Definition breaks**: the 2013/2014 NCRB reporting-format change (also the old burglary head versus the revised criminal-trespass/burglary head), the 2016 compilation, the 2021/2022 source change, the 2023/2024 BNS switch.
- **Geography**: the 11 district names of 2011-2016 are inferred (no roster), the 2016/2017 reorganisation (Rohini, Shahdara, Dwarka; the seven existing districts that lost or gained stations are listed, and four that did not), the 2019 creation of Outer North, and the first year each new district exists.
- **Road measures**: the 2022 Traffic Police 11-district series cannot be compared with 2023-2024; zone lists differ by report.
- **Series**: the citywide road trend (caution) and partial-year series (never compared with full years).

`scripts/lib/continuity.js` turns the file into answers (`compareYears`, `segmentOf`, `changeBetween`). The same source is injected into the dashboard, which uses it for the indicator under every map, the change column in View table, the change tile for a historical district, the "Shared scale" colour option (one linear scale only across years that can be compared) and the continuity columns in downloads. `test/continuity.test.js` checks the file, the rules, the injection, and that the rules agree with the per-district comparability flags already in `data/dashboard_final.json` from 2017 onward.

To change a rule, edit `data/continuity.json` with the evidence, then `npm run build` and `npm test`.
