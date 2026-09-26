# Official source archive

This directory is an evidence archive, not a dashboard release. `manifest.json` is machine-readable and records the original URL, retrieval time, issuing agency, reference period, SHA-256 checksum, MIME type, source filename and scope notes for every retained file.

Run `node scripts/archive_official_sources.mjs` from the repository root to refresh the archive. Run `node scripts/archive_official_sources.mjs --offline` to re-check retained files without network access.

The nine NCRB district-wise workbooks under `ncrb/` are the primary evidence for every crime figure on the dashboard (IPC/BNS, SLL and crime-against-women, for 2022, 2023 and 2024). They were previously cited by URL only, which left nothing in the repository pinning the bytes the published numbers were read from — NCRB has reshuffled its `/uploads/` paths before. The 2024 IPC workbook is titled "Districtwise IPC/BNS Crimes - 2024"; its Delhi block reproduces the dashboard's `totalIPC2024` exactly for all 15 law-and-order districts, with NCRB's nine non-geographic Delhi rows (Crime Branch, EOW, IGI Airport, Metro, Railway, Spl Cell, SPUWAC, Vigilance) excluded.

Archived material does not become dashboard data automatically. In particular, 2025 iRAD/eDAR records stay scoped to their publishing district or police station until a reviewed crosswalk reconciles them to the dashboard's 15 police districts. The Excise circular is a preferred-vend snapshot, not a complete inventory. Ward references distinguish the current 250 wards from legacy 290-ward data.
