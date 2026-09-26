# Official source archive

This directory is an evidence archive, not a dashboard release. `manifest.json` is machine-readable and records the original URL, retrieval time, issuing agency, reference period, SHA-256 checksum, MIME type, source filename and scope notes for every retained file.

Run `node scripts/archive_official_sources.mjs` from the repository root to refresh the archive. Run `node scripts/archive_official_sources.mjs --offline` to re-check retained files without network access.

Archived material does not become dashboard data automatically. In particular, 2025 iRAD/eDAR records stay scoped to their publishing district or police station until a reviewed crosswalk reconciles them to the dashboard's 15 police districts. The Excise circular is a preferred-vend snapshot, not a complete inventory. Ward references distinguish the current 250 wards from legacy 290-ward data.
