# NCRB 2001 to 2010: extraction scripts

Rebuilds the Delhi tables in `data/staged/delhi_ut_total_2001_2010/` from the NCRB *Crime in India* PDFs. The PDFs are not committed; `pdf_sources.tsv` lists each URL (the 2001 district table is `TABLE-8-2001.pdf` and the 2001 total table `TABLE%205-2001.pdf` in the same folder) and the staged files record each PDF's SHA-256.

1. Download the PDFs into one folder as `<year>-district.pdf` (Table 1.14) and `<year>-total_state_city.pdf` (Table 1.6).
2. `python -I extract_district.py <year> <first page> <last page> [spill]`: reads the Delhi block of the district table by word position (pages 34 to 36 for 2002 to 2005, 46 to 48 for 2006 to 2009, 49 to 51 for 2010; add `spill` for 2006 to 2009, where the last rows continue on the next page group). Needs `pdfplumber`.
3. `python -I normalise.py`: names the 30 columns, merges spelling variants of unit names, and checks that every column adds to the printed TOTAL row and that total IPC equals the Delhi UT total.
4. `python -I build_release.py`: writes the staged files.

The PDF text layer is not trustworthy on its own. The Delhi UT and Delhi (City) totals, the whole of 2001, and the specialised-unit cells for 2008 and 2009 (CAW, Crime Branch, EOW, STF) were read from page images and are entered in the scripts. The checks in `test/delhi_ut_2001_2010.test.js` are what protect the numbers.
