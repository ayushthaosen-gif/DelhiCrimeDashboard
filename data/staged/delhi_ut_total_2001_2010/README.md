# Delhi UT total IPC crime, 2001 to 2010 (staged)

**Staged: not on the site and not in the coverage matrix.** One row per year from the NCRB *Crime in India* tables of total cognizable IPC crimes by State, UT and city (Table 5 for 2001, Table 1.6 for 2002 to 2010). The row is Delhi (UT) only.

- [delhi_ut_total_ipc_2001_2010.json](delhi_ut_total_ipc_2001_2010.json): incidence, share of all-India, NCRB's mid-year population, printed rate and rank, with the source URL and SHA-256 of the PDF each row came from.
- Read from the page images. The PDF text layer is misaligned for some rows, so it must not be used to re-extract these.
- Each row passes a check: incidence divided by population reproduces the printed rate (`node --test test/delhi_ut_2001_2010.test.js`).
- 2005 and 2007 are both printed as 56,065. Both were confirmed on the page images.
- Compare with 2011 onward (53,353 for 2011 in [the production series](../../releases/delhi_ut_series/README.md)) with care: NCRB's population estimates and counting rules changed (see [limitations](../../../docs/LIMITATIONS.md)).

Not yet collected from the same archive (found at `ncrb.gov.in/crime-in-india-table-content?year=YYYY`): Delhi (City) rows, crime-head counts (Table 1.8 / Table 6 in 2001) and district-wise tables (Table 1.14 / Table 8 in 2001). The 2007 Table 1.8 link on the NCRB site returns an error. To put this series on the site, add it to `scripts/build_delhi_ut_series.js` and the coverage years.
