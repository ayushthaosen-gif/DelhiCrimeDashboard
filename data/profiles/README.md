# Ward and district profiles

Export bundle for planners, journalists and researchers: [ward profiles](ward_profiles.csv) (290 legacy wards: CSV, [JSON](ward_profiles.json), [GeoJSON](ward_profiles.geojson)), [district profiles](district_profiles.csv) (15 police districts: CSV, [JSON](district_profiles.json), [GeoJSON](district_profiles.geojson)), the [field contract](schema.json) and the [provenance manifest](manifest.json) with input and output hashes.

Every column is described in `schema.json`: unit, source, data year, an uncertainty class, and what a blank means. Read the uncertainty class before using a number: OpenStreetMap counts are lower bounds, crash-zone figures depend on approximate positions, and crime is available only per district. A blank is never zero. Ward profiles use the legacy 290-ward geography, not the current 250 MCD wards.

Regenerate with `node scripts/build_profiles.js` (CI checks the files are current).
