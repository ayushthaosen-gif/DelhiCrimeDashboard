# Historical research staging: 2011–2015

Historical crime remains separate research, off the dashboard. Start with [the availability and comparability report](AVAILABILITY_AND_COMPARABILITY.md) and the [staged NCRB release](../../releases/historical_2011_2015/manifest.json). The user subsequently authorized only the citywide road trend extension to 2011 (total accidents, fatal accidents and deaths); injury/category revisions and historical district series remain separate. Public redistribution terms for archived originals remain unresolved.

`raw/` contains immutable official originals, source-page snapshots and explicitly marked discovery/mislinked-document evidence. `inputs/sources.json` records original and resolved URLs, SHA-256, byte size, retrieval date, reference years, publication evidence, PDF timestamps, source role and reuse terms. `inputs/traffic_table_6_1.json` is a visually checked transcription of a raster table, retained as printed with source contradictions. `generated/` contains reproducible Delhi extracts, separate summaries, availability and quality findings. `manifest.json` hashes every generated artifact and the structured inputs, including the retained production comparison baseline and archive search log.

The complete all-India NCRB files are retained to establish source identity; only their Delhi section is extracted. No geographic conversion or allocation is performed. The 2015 retrospective traffic geography is explicitly a 2015-report vintage, not asserted to be original-year boundaries. Dashes and blanks remain null; numeric zero remains zero. Early SLL and comparable crimes-against-women aggregates are not supplied by the selected IPC table; they are not claimed globally unavailable. Additional multi-year catalogue links remain discovery leads.

For offline reproduction, install Python 3.10+ and the pinned package in `tools/history_2011_2015/requirements.txt`, and put Poppler `pdftotext` on PATH. Run from repository root:

```text
python tools/history_2011_2015/build.py
python tools/history_2011_2015/build.py --check
python -m unittest discover -s tools/history_2011_2015 -p "test_*.py"
python tools/history_2011_2015/fetch_missing.py
```

The final command verifies existing originals and lists missing files without network access. Add `--fetch` only to retrieve missing files over verified HTTPS. Changed live bytes are rejected, never silently accepted as the archived edition. Dynamic landing pages may no longer reproduce their historical snapshot; retain the archived bytes.

No blanket open reuse licence was established for direct NCRB/Traffic Police assets. The registry distinguishes download access from redistribution permission. Keep this research archive private pending terms review before any public redistribution.
