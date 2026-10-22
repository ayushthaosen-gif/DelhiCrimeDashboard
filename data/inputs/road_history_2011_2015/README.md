# Inputs for the 2011 to 2015 road release

The reviewed transcriptions and derived tables that `scripts/build_road_history_2011_2015.js` turns into [`data/releases/road_zones_roads_2011_2015/`](../../releases/road_zones_roads_2011_2015/README.md). They are committed so the release can be rebuilt by anyone; CI rebuilds it and fails if the committed release differs.

- `road_2013_2014_recovery/`: named zones 2013 and 2014 from the Delhi PWD compilation, with validation and source manifest.
- `road_2014_2015/`: named zones 2015 (Table 10.1) and the 2015 road groups calculated by exact printed label.
- `road_2011_2012_recovery/`: the 2011 and 2012 highway and ring-road stretches (retrospective Table 6.5 of the 2015 report).
- `supplement_2014/`: the audited 2014 supplement (2014 road groups, circle sums, list reconciliation, 11 retrospective district rows, 2014 stretches).
- [`sources.json`](sources.json): the source PDFs (URL, SHA-256, archive capture dates). The PDFs are about 800 MB in all and are not in the repository; fetch each and compare its hash. A file whose hash differs is a different file.

These are transcriptions: 2014 had a second visual pass by one agent, the rest were extracted or transcribed once. None is independently reviewed. Rebuild with `npm run build:road-history`.
