# NCRB files recovered from the Internet Archive

Official NCRB tables for 2016-2021 that the Delhi-wide series needs. `manifest.json` records each file's original `ncrb.gov.in` URL, the Internet Archive capture (raw `id_` bytes), size and SHA-256.

- `cii2021_district_workbooks/`: the 2021 district-wise IPC, SLL and crime-against-women workbooks (same layout as the 2022-2024 ones in `../source_archive/ncrb/`).
- `cii2021_state_tables/`: Tables 1A.1, 1A.2, 1A.3 and 3A.1 of Crime in India 2021 (State/UT-wise, 2019-2021).
- `excerpts/`: the table pages cut from the Crime in India 2017, 2019 and 2020 Volume 1 PDFs (7-32 MB each, not committed). `excerpt_sources.json` records each PDF's capture, size, SHA-256 and the pages used; `tools/delhi_ut_series/make_excerpts.py` recreates the excerpts from the PDFs.

**Why the Internet Archive.** The live ncrb.gov.in certificate fails the Windows revocation check (CRYPT_E_REVOKED), so nothing was fetched from it directly and no check was bypassed. NCRB publishes no checksums; these files are trusted because overlapping years agree across independent editions and with the district workbooks (`data/staged/delhi_ut_series/`).

Reuse terms were not established for these files, as for the rest of the NCRB archive.
