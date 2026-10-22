// Builds the ward and district profiles and the export bundle, from the repository's own data, with the contract in scripts/lib/profile_schema.js.
//
//   node scripts/build_profiles.js
//
// Writes data/profiles/: schema.json, ward_profiles.{json,csv,geojson}, district_profiles.{json,csv,geojson}, manifest.json, README.md.
// Nothing is typed in here: every figure is read from a committed file, counted by point-in-polygon, and written only if the schema describes
// its column. A figure the source does not hold stays null (a blank cell); null is never turned into zero. Ward figures use the legacy
// 290-ward geography and are labelled so; crime is never shown below the 15 police districts except as a district value copied onto wards and
// labelled as such.

const fs = require('fs');
const path = require('path');
const { sha256, toCsv } = require('./lib/release_utils');
const { compareYears } = require('./lib/continuity');
const profileSchema = require('./lib/profile_schema');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data/profiles/');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const num = (v, d) => (v == null ? null : Math.round(v * Math.pow(10, d)) / Math.pow(10, d));

// ---------- geometry ----------
function ringBox(ring) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ring.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  return [x0, y0, x1, y1];
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function indexPolygons(features) {
  return features.map((f, i) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return { i, polys, box: polys.map(p => ringBox(p[0])) };
  });
}
function locate(index, lng, lat) {
  for (const e of index) {
    for (let k = 0; k < e.polys.length; k++) {
      const b = e.box[k];
      if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      const poly = e.polys[k];
      if (inRing(lng, lat, poly[0]) && !poly.slice(1).some(h => inRing(lng, lat, h))) return e.i;
    }
  }
  return -1;
}
function haversine(a, b) {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function polygonAreaKm2(coords) {
  // equirectangular shoelace, adequate at Delhi's scale
  const R = 6371, r = Math.PI / 180, lat0 = 28.6 * r;
  const ring = coords[0];
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0] * r * R * Math.cos(lat0), yi = ring[i][1] * r * R, xj = ring[j][0] * r * R * Math.cos(lat0), yj = ring[j][1] * r * R;
    a += xj * yi - xi * yj;
  }
  return Math.abs(a / 2);
}

// ---------- inputs ----------
const wardsGeo = read('data/delhi_wards_infra.geojson');
const districts = read('data/dashboard_final.json').districts;
const districtGeo = read('data/dashboard_boundaries_simplified.geojson');
const poi = read('data/poi_markers_latlng.json');
const extras = read('data/poi_markers_infra_extras.json');
const police = read('data/police_markers_latlng.json');
const overpasses = read('data/delhi_pedestrian_overpasses_osm.geojson');
const zonesGeo = read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson');
const sidewalks = read('data/derived/crash_zone_sidewalks_2024.json');
const footwaysRaw = read('data/source/osm_footways_delhi_raw.json');
const footwayCoverage = read('data/delhi_footway_coverage.json');
const continuity = read('data/continuity.json');
const status = read('data/series_status.json');
const landuseRows = (() => {
  const lines = fs.readFileSync(path.join(ROOT, 'data/landuse_by_ward.csv'), 'utf8').replace(/\r\n/g, '\n').trim().split('\n');
  const head = lines[0].split(',');
  return lines.slice(1).map(l => { const c = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = c[i]; }); return o; });
})();
const landuseByNo = {}; landuseRows.forEach(r => { landuseByNo[String(r.ward_no)] = r; });

const osmSnapshot = (status.series.find(s => s.id === 'osm_infrastructure') || {}).latest_reference_period || 'unknown';
const dataVersion = status.updated;
const schema = profileSchema.build({ osmSnapshot });

const wardIndex = indexPolygons(wardsGeo.features);
const countPoints = (list, lngI, latI) => {
  const c = new Array(wardsGeo.features.length).fill(0);
  list.forEach(p => { const w = locate(wardIndex, p[lngI], p[latI]); if (w >= 0) c[w]++; });
  return c;
};
const pts = list => countPoints(list, 1, 0); // [lat, lng, name]
const counts = {
  bus_stops: pts(poi.busStops), traffic_signals: pts(extras.trafficSignals), pedestrian_crossings: pts(extras.pedestrianCrossings), hospitals: pts(extras.hospitals),
  street_lamps_mapped: pts(extras.streetLamps), surveillance_points_mapped: pts(poi.surveillance), police_stations: pts(police.stations), police_posts: pts(police.posts),
  pedestrian_overpasses: (() => { const c = new Array(wardsGeo.features.length).fill(0); overpasses.features.forEach(f => { const w = locate(wardIndex, f.geometry.coordinates[0], f.geometry.coordinates[1]); if (w >= 0) c[w]++; }); return c; })()
};
// footway length: each segment's length goes to the ward holding the segment midpoint
const footwayM = new Array(wardsGeo.features.length).fill(0);
footwaysRaw.elements.forEach(el => {
  const g = el.geometry || [];
  for (let i = 1; i < g.length; i++) {
    const mid = { lat: (g[i - 1].lat + g[i].lat) / 2, lon: (g[i - 1].lon + g[i].lon) / 2 };
    const w = locate(wardIndex, mid.lon, mid.lat);
    if (w >= 0) footwayM[w] += haversine(g[i - 1], g[i]);
  }
});

// crash zones (2024): the zone file is positions placed by hand; each zone keeps its own stated accuracy
const sideByFeature = {}; sidewalks.zones.forEach(z => { sideByFeature[z.feature_id] = z; });
const zonesByWard = wardsGeo.features.map(() => []);
zonesGeo.features.forEach(f => {
  const p = f.properties, w = locate(wardIndex, f.geometry.coordinates[0], f.geometry.coordinates[1]);
  if (w < 0) return;
  const s = sideByFeature[p.feature_id] || {};
  zonesByWard[w].push({
    name: p.location_name, rank: p.table_6_29_rank == null ? null : p.table_6_29_rank, fatal_crashes: p.all_fatal_crashes == null ? null : p.all_fatal_crashes,
    total_crashes: p.all_total_crashes == null ? null : p.all_total_crashes, pedestrian_fatal_crashes: p.pedestrian_fatal_crashes == null ? null : p.pedestrian_fatal_crashes,
    position_confidence: p.coordinate_confidence || null, position_accuracy_m: p.estimated_accuracy_m == null ? null : p.estimated_accuracy_m,
    crossings_250m: s.crossings_250m == null ? null : s.crossings_250m, signals_250m: s.signals_250m == null ? null : s.signals_250m, footway_km_250m: s.footway_km_250m == null ? null : s.footway_km_250m,
    road_with_pedestrian_mapping_pct_250m: s.road_with_pedestrian_mapping_pct_250m == null ? null : s.road_with_pedestrian_mapping_pct_250m,
    crossings_500m: s.crossings_500m == null ? null : s.crossings_500m, signals_500m: s.signals_500m == null ? null : s.signals_500m, footway_km_500m: s.footway_km_500m == null ? null : s.footway_km_500m
  });
});
// A sum over the zones that print a count. With no zone it is 0 (there is nothing to count); with zones but no printed count it is null, never 0.
const sumKnown = (arr, k) => { if (arr.length === 0) return 0; const known = arr.filter(z => z[k] != null); return known.length === 0 ? null : known.reduce((a, z) => a + z[k], 0); };

// ---------- ward rows ----------
const wardRows = wardsGeo.features.map((f, i) => {
  const p = f.properties, lu = landuseByNo[String(p.Ward_No)];
  const area = p.areaSqKm != null ? p.areaSqKm : num(polygonAreaKm2(f.geometry.coordinates), 3);
  const per = v => (area > 0 ? num(v / area, 2) : null);
  const zones = zonesByWard[i].slice().sort((a, b) => (a.rank == null) - (b.rank == null) || a.rank - b.rank || a.name.localeCompare(b.name));
  const row = {
    ward_no: String(p.Ward_No), ward_name: p.Ward_Name, geography: 'legacy_290_wards', assigned_district: p.assignedDistrict || null, area_km2: area,
    crash_zones_2024: zones.length, crash_zones_without_printed_counts_2024: zones.filter(z => z.total_crashes == null).length, crash_zone_fatal_crashes_2024: sumKnown(zones, 'fatal_crashes'),
    crash_zone_total_crashes_2024: sumKnown(zones, 'total_crashes'), crash_zone_pedestrian_fatal_crashes_2024: sumKnown(zones, 'pedestrian_fatal_crashes'),
    crash_zone_names: zones.map(z => z.name).join(' | '),
    high_injury_network: p.highInjuryNetwork === true || p.highInjuryNetwork === 'true', high_injury_network_rank: p.highInjuryNetworkRank == null ? null : p.highInjuryNetworkRank
  };
  ['bus_stops', 'traffic_signals', 'pedestrian_crossings', 'pedestrian_overpasses', 'street_lamps_mapped', 'hospitals', 'surveillance_points_mapped', 'police_stations', 'police_posts'].forEach(k => { row[k] = counts[k][i]; });
  row.footway_km = num(footwayM[i] / 1000, 2);
  ['bus_stops', 'traffic_signals', 'pedestrian_crossings', 'street_lamps_mapped', 'hospitals', 'surveillance_points_mapped'].forEach(k => { row[k + '_per_km2'] = per(counts[k][i]); });
  row.footway_km_per_km2 = per(row.footway_km);
  row.official_liquor_vends = p.officialLiquorVends == null ? null : p.officialLiquorVends;
  row.residential_pct = lu ? num(+lu.residential_pct, 1) : null; row.commercial_pct = lu ? num(+lu.commercial_pct, 1) : null; row.industrial_pct = lu ? num(+lu.industrial_pct, 1) : null;
  row.institutional_pct = lu ? num(+lu.institutional_pct, 1) : null; row.green_open_pct = lu ? num(+lu.green_open_pct, 1) : null;
  row.landuse_mapped_pct = lu ? num(+lu.mapped_pct, 1) : null;
  row.low_landuse_coverage = lu ? +lu.mapped_pct < 25 : null;
  row.no_mapped_infrastructure = row.bus_stops + row.traffic_signals + row.pedestrian_crossings + row.hospitals === 0 && row.footway_km === 0;
  row.district_ipc_density_2024_per_km2 = p.totalIPCDensity2024Inherited == null ? null : p.totalIPCDensity2024Inherited;
  row.district_crime_against_women_density_2024_per_km2 = p.crimeAgainstWomenDensity2024Inherited == null ? null : p.crimeAgainstWomenDensity2024Inherited;
  return { row, zones, feature: f };
});

// consistency with the committed ward file: the same point-in-polygon counts must agree with what the interactive map already shows
wardRows.forEach(({ row, feature }) => {
  const p = feature.properties;
  if (row.bus_stops !== p.busStops || row.surveillance_points_mapped !== p.surveillance || row.crash_zones_2024 !== p.crashZones2024) {
    throw new Error('profile counts disagree with data/delhi_wards_infra.geojson for ' + row.ward_no);
  }
});

// ---------- district rows ----------
const UNSURVEYED = ['Dwarka', 'North-East', 'North-West', 'Outer', 'Outer North', 'Rohini'];
const coverageByDistrict = {}; footwayCoverage.forEach(c => { coverageByDistrict[c.district] = c; });
const districtRows = districts.map(d => {
  const fw = coverageByDistrict[d.name];
  const surveyed = UNSURVEYED.indexOf(d.name) < 0;
  const cmp = key => compareYears(continuity, key, 2023, 2024, d.name).state;
  return {
    district: d.name, area_km2: d.areaSqKm, population: d.population,
    theft_2024: d.theft2024, robbery_2024: d.robbery2024, burglary_2024: d.burglary2024, total_ipc_bns_2024: d.totalIPC2024, crime_against_women_2024: d.crimeAgainstWomen2024, total_sll_2024: d.totalSLL2024,
    total_ipc_2023: d.totalIPC, crime_comparison_2023_2024: cmp('totalIPC'),
    crashes_in_zones_2024: d.totalCrashes2024, fatal_crashes_in_zones_2024: d.fatalCrashes2024, crash_prone_zones_2024: d.crashProneZones2024,
    crashes_in_zones_2023: d.totalCrashes2023, fatal_crashes_in_zones_2023: d.fatalCrashes2023, persons_killed_2024: d.personsKilled2024, persons_killed_2023: d.personsKilled2023,
    road_comparison_2023_2024: cmp('totalCrashes'),
    streetlights_per_km2: surveyed ? d.lightDensityPerKm2 : null, underpasses: surveyed ? d.underpasses : null, papl_surveyed: surveyed,
    police_stations: d.policeStations, police_posts: d.chowkiPosts, metro_gates: d.metroGates, bus_stops: d.busStops, surveillance_points_mapped: d.surveillanceCameras,
    pedestrian_overpasses: d.pedestrianOverpasses, footway_km: fw ? fw.footwayLengthKm : null, footway_km_per_km2: fw ? fw.footwayDensityKmPerKm2 : null
  };
});

// ---------- every column must be described, and every description must be a column ----------
function checkColumns(rows, fields, what, extra) {
  const ids = fields.map(f => f.id), have = Object.keys(rows[0]);
  const allowed = new Set(ids.concat(extra || []));
  const undescribed = have.filter(k => !allowed.has(k)), missing = ids.filter(k => have.indexOf(k) < 0);
  if (undescribed.length || missing.length) throw new Error(what + ': undescribed columns ' + undescribed.join(',') + '; described but absent ' + missing.join(','));
}
checkColumns(wardRows.map(w => w.row), schema.wardFields, 'ward profile');
checkColumns(districtRows, schema.districtFields, 'district profile');
schema.zoneFields = [
  ['name', 'Zone name as printed'], ['rank', 'Rank in Table 6.29 (blank if not ranked there)'], ['fatal_crashes', 'Fatal crashes (blank if not printed)'], ['total_crashes', 'All crashes (blank if not printed)'],
  ['pedestrian_fatal_crashes', 'Pedestrian fatal crashes (blank if not printed)'], ['position_confidence', 'Confidence in the placed position'], ['position_accuracy_m', 'Estimated accuracy of the placed position, metres'],
  ['crossings_250m', 'Pedestrian crossings mapped within 250 m of the placed position'], ['signals_250m', 'Traffic signals mapped within 250 m'], ['footway_km_250m', 'Footway mapped within 250 m, km'],
  ['road_with_pedestrian_mapping_pct_250m', 'Share of mapped road length within 250 m with a mapped sidewalk or separate footway (sparse tagging: low mostly means unmapped)'],
  ['crossings_500m', 'Pedestrian crossings mapped within 500 m'], ['signals_500m', 'Traffic signals mapped within 500 m'], ['footway_km_500m', 'Footway mapped within 500 m, km']
].map(a => ({ id: a[0], label: a[1], uncertainty: /crossings|signals|footway|mapping/.test(a[0]) ? 'mapped_osm' : 'approximate_position' }));

// ---------- write ----------
const wardCols = schema.wardFields.map(f => f.id), districtCols = schema.districtFields.map(f => f.id);
const inOrder = (row, cols) => { const o = {}; cols.forEach(c => { o[c] = row[c]; }); return o; };
wardRows.forEach(w => { w.row = inOrder(w.row, wardCols); });
districtRows.forEach((r, i) => { districtRows[i] = inOrder(r, districtCols); });
const out = {};
out['schema.json'] = JSON.stringify(Object.assign({ schemaVersion: '1.0.0', description: 'The contract for the ward and district profile exports: every column, its unit, source, data year, uncertainty class and what a blank means.', dataVersion: dataVersion }, schema), null, 2) + '\n';
out['ward_profiles.json'] = JSON.stringify({ schemaVersion: '1.0.0', dataVersion: dataVersion, geography: 'legacy_290_wards', note: 'Legacy 290-ward geography (before the 2022 delimitation); not the current 250 MCD wards. Crash figures depend on approximate zone positions.', rows: wardRows.map(w => Object.assign({}, w.row, { zones: w.zones })) }, null, 1) + '\n';
out['ward_profiles.csv'] = toCsv(wardCols, wardRows.map(w => w.row));
out['ward_profiles.geojson'] = JSON.stringify({
  type: 'FeatureCollection', name: 'ward_profiles', properties: { dataVersion: dataVersion, geography: 'legacy_290_wards', schema: 'schema.json' },
  features: wardRows.map(w => ({ type: 'Feature', properties: w.row, geometry: w.feature.geometry }))
}) + '\n';
out['district_profiles.json'] = JSON.stringify({ schemaVersion: '1.0.0', dataVersion: dataVersion, geography: '15 Delhi Police districts', rows: districtRows }, null, 1) + '\n';
out['district_profiles.csv'] = toCsv(districtCols, districtRows);
out['district_profiles.geojson'] = JSON.stringify({
  type: 'FeatureCollection', name: 'district_profiles', properties: { dataVersion: dataVersion, geography: '15 Delhi Police districts (simplified, about 165 m tolerance)', schema: 'schema.json' },
  features: districtGeo.features.map(f => ({ type: 'Feature', properties: districtRows.find(r => r.district === f.properties.district), geometry: f.geometry }))
}) + '\n';

fs.mkdirSync(OUT, { recursive: true });
Object.keys(out).forEach(f => fs.writeFileSync(OUT + f, out[f], 'utf8'));

const inputs = ['data/delhi_wards_infra.geojson', 'data/dashboard_final.json', 'data/dashboard_boundaries_simplified.geojson', 'data/poi_markers_latlng.json', 'data/poi_markers_infra_extras.json', 'data/police_markers_latlng.json',
  'data/delhi_pedestrian_overpasses_osm.geojson', 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson', 'data/derived/crash_zone_sidewalks_2024.json', 'data/source/osm_footways_delhi_raw.json', 'data/delhi_footway_coverage.json',
  'data/landuse_by_ward.csv', 'data/continuity.json', 'data/series_status.json', 'data/geography_registry.json'];
const manifest = {
  schemaVersion: '1.0.0', title: 'Delhi ward and district profiles: export bundle', dataVersion: dataVersion, generatedBy: 'scripts/build_profiles.js',
  geographies: [
    { id: 'legacy_290_wards', rows: wardRows.length, caveat: 'Legacy ward geography (DataMeet, CC-BY-SA 2.5 India), before the 2022 delimitation; not an official or current boundary.' },
    { id: 'delhi_police_districts_15', rows: districtRows.length, caveat: 'Simplified boundaries (about 165 m tolerance), not survey-grade.' }
  ],
  files: Object.keys(out).filter(f => f !== 'manifest.json').map(f => ({ path: 'data/profiles/' + f, sha256: sha256(OUT + f) })),
  inputs: inputs.map(f => ({ path: f, sha256: sha256(path.join(ROOT, f)) })),
  nullPolicy: 'A blank cell means the source does not hold the figure. It is never zero. A zero is a source zero, or a count of mapped features that found none (read the uncertainty class).',
  uncertaintyClasses: Object.keys(schema.uncertaintyClasses),
  cannotEstablish: schema.cannotEstablish.general,
  licences: [
    'OpenStreetMap-derived fields: OpenStreetMap contributors, ODbL 1.0 (attribution required).',
    'Ward boundaries: DataMeet Municipal_Spatial_Data, CC-BY-SA 2.5 India (share-alike applies to the ward GeoJSON).',
    'Official figures (NCRB, Delhi Traffic Police, Delhi Police): no open reuse licence has been verified for the source documents.'
  ],
  methodNotes: [
    'Counts are assigned to wards by point-in-polygon; footway length by segment midpoint. Points on a boundary go to the first ward that contains them.',
    'Crash-zone fields depend on hand-placed positions with stated accuracy of 150 m to 5 km; the ward a zone falls in can be wrong.',
    'District profiles carry the 2023 to 2024 comparability state from data/continuity.json; no change figure is calculated.'
  ]
};
fs.writeFileSync(OUT + 'manifest.json', JSON.stringify(manifest, null, 2) + '\n', 'utf8');
fs.writeFileSync(OUT + 'README.md', `# Ward and district profiles

Export bundle for planners, journalists and researchers: [ward profiles](ward_profiles.csv) (290 legacy wards: CSV, [JSON](ward_profiles.json), [GeoJSON](ward_profiles.geojson)), [district profiles](district_profiles.csv) (15 police districts: CSV, [JSON](district_profiles.json), [GeoJSON](district_profiles.geojson)), the [field contract](schema.json) and the [provenance manifest](manifest.json) with input and output hashes.

How far the hand-placed zone positions change a zone\'s ward and the ward ranking is tested in [location_sensitivity_2024.json](location_sensitivity_2024.json) (with [zone](location_sensitivity_zones_2024.csv) and [ward](location_sensitivity_wards_2024.csv) CSVs): 2,000 seeded simulations within each zone\'s stated accuracy. Treat ward totals and ranks from the zone list as ranges.\n\nEvery column is described in \`schema.json\`: unit, source, data year, an uncertainty class, and what a blank means. Read the uncertainty class before using a number: OpenStreetMap counts are lower bounds, crash-zone figures depend on approximate positions, and crime is available only per district. A blank is never zero. Ward profiles use the legacy 290-ward geography, not the current 250 MCD wards.

Regenerate with \`node scripts/build_profiles.js\` (CI checks the files are current).
`, 'utf8');
console.log('profiles: ' + wardRows.length + ' wards, ' + districtRows.length + ' districts, ' + (wardRows.filter(w => w.row.low_landuse_coverage).length) + ' low-land-use-coverage wards, ' + (wardRows.filter(w => w.row.no_mapped_infrastructure).length) + ' with nothing mapped');
