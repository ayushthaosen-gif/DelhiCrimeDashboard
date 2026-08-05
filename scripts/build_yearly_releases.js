const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const RELEASES = path.join(ROOT, 'data', 'releases');
const dashboard = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'dashboard_final.json'), 'utf8')).districts;
const road = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'road_safety_trends.json'), 'utf8'));

const YEARS = Array.from({ length: 9 }, (_, i) => 2016 + i);
const CRIME_FIELDS = ['theft', 'robbery', 'burglary', 'totalIPC', 'crimeAgainstWomen', 'totalSLL'];
const DISTRICT_CRIME_SCHEMA = {
  year: 'integer', district: 'string; join key', district_existed_as_separate_reporting_zone: 'boolean', coverage: 'string',
  theft: 'integer|null; registered cases', robbery: 'integer|null; registered cases', burglary: 'integer|null; registered cases',
  total_ipc_bns: 'integer|null; registered cases', crime_against_women: 'integer|null; registered cases', total_sll: 'integer|null; registered cases',
  theft_previous_year_comparable: 'boolean', robbery_previous_year_comparable: 'boolean', burglary_previous_year_comparable: 'boolean',
  total_ipc_previous_year_comparable: 'boolean', crime_against_women_previous_year_comparable: 'boolean', total_sll_previous_year_comparable: 'boolean',
  null_reason: 'string; empty when no row-level caveat applies'
};
const NCRB_2022 = {
  ipc: 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016833111DistrictwiseIPCCrimes2022.xlsx',
  sll: 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016838002DistrictwiseSLLCrimes2022.xlsx',
  women: 'https://www.ncrb.gov.in/uploads/nationalcrimerecordsbureau/custom/17016840143DistrictwiseCrimeagainstWomen2022.xlsx'
};
const NCRB_2023 = {
  ipc: 'https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes20231.xlsx',
  sll: 'https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2023.xlsx',
  women: 'https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2023.xlsx'
};
const NCRB_2024 = {
  ipc: 'https://www.ncrb.gov.in/uploads/files/1DistrictwiseIPCCrimes2024.xlsx',
  sll: 'https://www.ncrb.gov.in/uploads/files/2DistrictwiseSLLCrimes2024.xlsx',
  women: 'https://www.ncrb.gov.in/uploads/files/3DistrictwiseCrimeagainstWomen2024.xlsx'
};
const IDP = {
  ipc2016: 'https://ckandev.indiadataportal.com/dataset/e311a510-ce48-4f4c-baf6-0ec5f9278285/resource/7d5e2cc6-a704-4248-aa44-13d7186f847c/download/districtwise-ipc-crimes-2016.csv',
  ipc2017onward: 'https://ckandev.indiadataportal.com/dataset/e311a510-ce48-4f4c-baf6-0ec5f9278285/resource/387dedad-5978-4f97-a6c5-60ca45f9405a/download/districtwise-ipc-crimes-2017-onwards.csv',
  catalog: 'https://indiadataportal.com'
};

function csvEscape(value) {
  if (value == null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
function toCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  return [headers.join(','), ...rows.map(row => headers.map(h => csvEscape(row[h])).join(','))].join('\r\n') + '\r\n';
}
function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function yearKey(metric, year) {
  if (year === 2023) return metric;
  return `${metric}${year}`;
}
function crimeRows(year) {
  return dashboard.map(d => {
    const historical = year <= 2021;
    const coverage = historical ? (d[`coverage${year}`] || d[`coverageTotalIPC${year}`] || 'not reported') : 'reported';
    const existed = historical ? Boolean(d[`districtExistedAsSeparateZone${year}`]) : true;
    const row = {
      year,
      district: d.district,
      district_existed_as_separate_reporting_zone: existed,
      coverage,
      theft: d[yearKey('theft', year)] ?? null,
      robbery: d[yearKey('robbery', year)] ?? null,
      burglary: d[yearKey('burglary', year)] ?? null,
      total_ipc_bns: d[yearKey('totalIPC', year)] ?? null,
      crime_against_women: d[yearKey('crimeAgainstWomen', year)] ?? null,
      total_sll: d[yearKey('totalSLL', year)] ?? null,
      theft_previous_year_comparable: comparable(d, 'theft', year, historical),
      robbery_previous_year_comparable: comparable(d, 'robbery', year, historical),
      burglary_previous_year_comparable: comparable(d, 'burglary', year, historical),
      total_ipc_previous_year_comparable: comparable(d, 'totalIPC', year, historical),
      crime_against_women_previous_year_comparable: comparable(d, 'crimeAgainstWomen', year, historical),
      total_sll_previous_year_comparable: comparable(d, 'totalSLL', year, historical),
      null_reason: !existed ? 'district did not exist as a separate reporting zone' : year === 2016 ? 'burglary/total IPC/crime against women/SLL omitted where definitions or schemas are incompatible' : ''
    };
    return row;
  });
}
function comparable(d, metric, year, historical) {
  if (historical) return Boolean(d[`${metric}PreviousYearComparable${year}`]);
  return d[yearKey(metric, year - 1)] != null && d[yearKey(metric, year)] != null;
}
function districtRoadRows(year) {
  if (year === 2022) return dashboard.map(d => ({ year, district: d.district, fatal_road_crashes: d.fatalRoadCrashes2022 ?? null, hit_and_run_crashes: d.hitAndRunCrashes2022 ?? null, coverage: d.fatalRoadCrashes2022 == null ? 'not separately reported in 11-district source geography' : 'reported' }));
  if (year === 2023 || year === 2024) return dashboard.map(d => ({
    year, district: d.district,
    crash_prone_zones: d[`crashProneZones${year}`] ?? null,
    simple_crashes_at_zones: d[`simpleCrashes${year}`] ?? null,
    fatal_crashes_at_zones: d[`fatalCrashes${year}`] ?? null,
    total_crashes_at_zones: d[`totalCrashes${year}`] ?? null,
    persons_killed: d[`personsKilled${year}`] ?? null,
    persons_injured: d[`personsInjured${year}`] ?? null,
    coverage: 'reported'
  }));
  return [];
}
function crimeSources(year) {
  if (year === 2016) return [{ id: 'ncrb_ipc_2016', publisher: 'NCRB via India Data Portal', url: IDP.ipc2016, role: 'primary extraction file', status: 'used' }];
  if (year <= 2021) return [
    { id: 'ncrb_ipc_2017_onward', publisher: 'NCRB via India Data Portal', url: IDP.ipc2017onward, role: 'theft, robbery and burglary extraction', status: 'used' },
    { id: 'ncrb_category_tables', publisher: 'NCRB via India Data Portal', url: IDP.catalog, role: 'full category tables used for reconstructed total IPC, crime against women and SLL', status: year >= 2017 ? 'used; 2022 exact-total validation' : 'not used; incompatible schema' }
  ];
  const sources = year === 2022 ? NCRB_2022 : year === 2023 ? NCRB_2023 : NCRB_2024;
  return Object.entries(sources).map(([type, url]) => ({ id: `ncrb_${type}_${year}`, publisher: 'National Crime Records Bureau', url, role: 'official district table', status: 'used' }));
}
function roadSources(year) {
  if (year === 2022) return [{ id: 'delhi_road_crash_fatalities_2022', publisher: 'Delhi Traffic Police / Transport Department GNCTD', url: 'https://transport.delhi.gov.in/sites/default/files/2024-09/2022_delhi_road_crash_fatalities_report_1.pdf', role: 'district fatal and hit-and-run crashes; citywide trend and victims', status: 'used' }];
  if (year === 2023 || year === 2024) return [{ id: `delhi_crash_report_${year}`, publisher: 'Delhi Traffic Police', url: `https://traffic.delhipolice.gov.in/delhi-crash-report-${year}`, role: 'district crash totals, named zones, citywide trend and victims', status: 'used' }];
  return [{ id: `delhi_traffic_annual_${year}`, publisher: 'Delhi Traffic Police', url: 'https://traffic.delhipolice.gov.in/', role: 'citywide crash trend' + (year >= 2019 ? ' and victims by mode' : ''), status: 'used in compiled trend series' }];
}
function sourceFileForZones(year) {
  if (year === 2023) return path.join(ROOT, 'data', 'crash_zones_2023_geocoded.json');
  if (year === 2024) return path.join(ROOT, 'data', 'crash_zones_2024_geocoded.json');
  return null;
}
function normalizeZones(year) {
  const file = sourceFileForZones(year);
  if (!file) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const records = Array.isArray(raw) ? raw : raw.features || raw.zones || [];
  return records.map((item, index) => {
    const p = item.properties || item;
    const coords = item.geometry?.coordinates || [];
    const latitude = p.lat ?? p.latitude ?? coords[1] ?? null; const longitude = p.lng ?? p.lon ?? p.longitude ?? coords[0] ?? null;
    return { ...p, year, record_id: p.id ?? p.rank ?? index + 1, location: p.location || p.name || p.location_name || '', road: p.road || '', district: p.district || null, fatal_crashes: p.fatalCrashes ?? p.fatal_crashes ?? p.fatal ?? null, simple_crashes: p.simpleCrashes ?? p.simple_crashes ?? p.simple ?? null, total_crashes: p.totalCrashes ?? p.total_crashes ?? p.total ?? null, latitude, longitude, coordinate_status: p.coordinate_status || p.geocodeStatus || p.geocodeSource || (latitude != null && longitude != null ? 'mapped/project geocode' : 'unresolved'), source_record: p.source || null };
  });
}
function fileEntry(dir, name, datasetId, derivedFrom) {
  const file = path.join(dir, name);
  return { path: name, datasetId, mediaType: name.endsWith('.csv') ? 'text/csv' : 'application/json', sha256: sha256(file), bytes: fs.statSync(file).size, derivedFrom };
}
function buildYear(year) {
  const dir = path.join(RELEASES, String(year));
  fs.mkdirSync(dir, { recursive: true });
  const crime = crimeRows(year);
  write(path.join(dir, 'district_crime.json'), JSON.stringify(crime, null, 2) + '\n');
  write(path.join(dir, 'district_crime.csv'), toCsv(crime));
  const outputs = [
    fileEntry(dir, 'district_crime.json', `delhi_district_crime_${year}`, ['data/dashboard_final.json']),
    fileEntry(dir, 'district_crime.csv', `delhi_district_crime_${year}`, ['data/dashboard_final.json'])
  ];
  const districtRoad = districtRoadRows(year);
  if (districtRoad.length) {
    write(path.join(dir, 'district_road_safety.json'), JSON.stringify(districtRoad, null, 2) + '\n');
    write(path.join(dir, 'district_road_safety.csv'), toCsv(districtRoad));
    outputs.push(fileEntry(dir, 'district_road_safety.json', `delhi_district_road_safety_${year}`, ['data/dashboard_final.json']));
    outputs.push(fileEntry(dir, 'district_road_safety.csv', `delhi_district_road_safety_${year}`, ['data/dashboard_final.json']));
  }
  const trend = road.trends.find(x => x.year === year);
  const victims = road.victims.find(x => x.year === year);
  if (trend || victims) {
    const citywide = [{ year, ...(trend || {}), ...(victims || {}) }];
    write(path.join(dir, 'citywide_road_safety.json'), JSON.stringify(citywide, null, 2) + '\n');
    write(path.join(dir, 'citywide_road_safety.csv'), toCsv(citywide));
    outputs.push(fileEntry(dir, 'citywide_road_safety.json', `delhi_citywide_road_safety_${year}`, ['data/road_safety_trends.json']));
    outputs.push(fileEntry(dir, 'citywide_road_safety.csv', `delhi_citywide_road_safety_${year}`, ['data/road_safety_trends.json']));
  }
  const zones = normalizeZones(year);
  if (zones.length) {
    write(path.join(dir, 'crash_prone_zones.json'), JSON.stringify(zones, null, 2) + '\n');
    write(path.join(dir, 'crash_prone_zones.csv'), toCsv(zones));
    outputs.push(fileEntry(dir, 'crash_prone_zones.json', `delhi_crash_prone_zones_${year}`, [`data/${path.basename(sourceFileForZones(year))}`]));
    outputs.push(fileEntry(dir, 'crash_prone_zones.csv', `delhi_crash_prone_zones_${year}`, [`data/${path.basename(sourceFileForZones(year))}`]));
  }
  const nullCounts = Object.fromEntries(CRIME_FIELDS.map(metric => [metric, crime.filter(row => row[metric === 'totalIPC' ? 'total_ipc_bns' : metric === 'crimeAgainstWomen' ? 'crime_against_women' : metric === 'totalSLL' ? 'total_sll' : metric] == null).length]));
  const manifest = {
    schemaVersion: '1.0.0', releaseYear: year, jurisdiction: 'Delhi', geography: '15 current territorial police-district names', joinKey: 'district', generatedBy: 'scripts/build_yearly_releases.js', generatedAt: new Date().toISOString(),
    productionStatus: 'production dashboard data', nullPolicy: 'Null is unknown, unavailable, incompatible, or not separately reported; never coerce null to zero.',
    comparability: year === 2016 ? 'Burglary and reconstructed totals are deliberately null because source definitions/schemas are incompatible.' : year <= 2018 ? 'Some current districts were not separately reported; inspect row coverage and comparability flags.' : 'Inspect per-metric previous-year comparability flags before calculating change.',
    coverage: { districtRows: crime.length, districtsWithAnyCrimeValue: crime.filter(r => CRIME_FIELDS.some(m => r[m === 'totalIPC' ? 'total_ipc_bns' : m === 'crimeAgainstWomen' ? 'crime_against_women' : m === 'totalSLL' ? 'total_sll' : m] != null)).length, nullCounts },
    schemas: { districtCrime: DISTRICT_CRIME_SCHEMA, districtRoadSafety: districtRoad.length ? 'Columns are self-describing snake_case counts plus coverage.' : null, citywideRoadSafety: trend || victims ? 'One row; citywide counts from the annual trend/victim table.' : null, crashProneZones: zones.length ? 'Normalized year/record_id/location/road/district/crash counts/lat-lon/status plus preserved source fields.' : null },
    sources: [...crimeSources(year), ...roadSources(year)], files: outputs,
    sharedData: { manifest: '../shared/manifest.json', warning: 'Infrastructure layers are latest-available snapshots, not measurements for this crime year.' }
  };
  write(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  write(path.join(dir, 'README.md'), `# Delhi research release ${year}\n\nImport-ready production data for ${year}. Start with \`manifest.json\`; it contains source URLs, checksums, coverage and null/comparability rules.\n\nFiles:\n${outputs.map(f => `- \`${f.path}\` - ${f.datasetId}`).join('\n')}\n\nNull values are never zeros. Infrastructure is catalogued in \`../shared/manifest.json\` because it is not a same-year historical measurement.\n`);
  return { year, path: `${year}/manifest.json`, files: outputs.length, districtRows: crime.length };
}

function buildShared() {
  const dir = path.join(RELEASES, 'shared');
  const datasets = [
    ['streetlights_underpasses', 'data/streetlight_grid.json', 'Delhi Transport Stack Open Transit Data / PAPL survey', 'https://otd.delhi.gov.in/', 'Publisher terms; partial 9-district survey coverage'],
    ['pedestrian_overbridges', 'data/delhi_pedestrian_overpasses_osm.geojson', 'OpenStreetMap contributors via Overpass', 'https://www.openstreetmap.org/copyright', 'ODbL; mapped inventory, snapshot 2026-08-04'],
    ['metro_bus_atm_liquor_surveillance', 'data/poi_markers_latlng.json', 'OpenStreetMap contributors via Overpass', 'https://www.openstreetmap.org/copyright', 'ODbL; tag-based mapped coverage'],
    ['police_locations', 'data/police_markers_latlng.json', 'Delhi Police GSDL plus OpenStreetMap posts', 'https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac', 'Official station export plus ODbL community-mapped posts'],
    ['district_boundaries', 'data/dashboard_boundaries_simplified.geojson', 'Delhi Police GSDL', 'https://gist.github.com/Vonter/a1f0f9d50a587ce059ddcfb086fc0fac', 'Simplified display geometry; not survey-grade'],
    ['ward_boundaries_and_derived_infrastructure', 'data/delhi_wards_infra.geojson', 'Project spatial join over legacy ward polygons', 'data/source/README.md', 'Derived; 290 legacy wards; inspect basis fields'],
    ['liquor_vends_approximate', 'data/delhi_liquor_vends_all_coordinates_approx.geojson', 'DSCSC / DCCWS published vend list', 'https://dscsc.delhi.gov.in/dscsc/liquor-vends', 'Coordinates are approximate unless explicitly flagged exact']
  ].map(([id, file, publisher, url, licenseAndCaveat]) => ({ id, file, publisher, url, licenseAndCaveat, sha256: sha256(path.join(ROOT, file)), bytes: fs.statSync(path.join(ROOT, file)).size }));
  const knownByFile = Object.fromEntries(datasets.map(d => [d.file, d.id]));
  const productionFileInventory = fs.readdirSync(path.join(ROOT, 'data'), { withFileTypes: true })
    .filter(entry => entry.isFile() && /\.(json|geojson|csv)$/.test(entry.name))
    .map(entry => {
      const file = `data/${entry.name}`;
      return {
        file,
        datasetId: knownByFile[file] || entry.name.replace(/\.(geojson|json|csv)$/, ''),
        provenanceStatus: knownByFile[file] ? 'source-described-above' : 'derived-or-compiled-production-file',
        documentation: knownByFile[file] ? null : 'See the yearly manifests, dashboard footer, data/README.md, and generating script before reuse.',
        sha256: sha256(path.join(ROOT, file)),
        bytes: fs.statSync(path.join(ROOT, file)).size
      };
    });
  write(path.join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: '1.0.0', scope: 'shared and non-year-specific production datasets', generatedBy: 'scripts/build_yearly_releases.js', generatedAt: new Date().toISOString(), warning: 'Do not label these latest-available infrastructure snapshots as historical measurements for a crime year.', datasets, productionFileInventory }, null, 2) + '\n');
  write(path.join(dir, 'README.md'), '# Shared production datasets\n\nMachine-readable provenance for infrastructure, boundaries and approximate-location layers that do not belong to a single crime year. See `manifest.json`.\n');
}

fs.mkdirSync(RELEASES, { recursive: true });
const index = YEARS.map(buildYear);
buildShared();
write(path.join(RELEASES, 'manifest.json'), JSON.stringify({ schemaVersion: '1.0.0', title: 'Delhi Urban Safety Observatory yearly research releases', years: index, shared: 'shared/manifest.json', staged2025: '2025/README.md', importGuidance: 'Choose a year, read manifest.json, then import CSV or JSON. Do not join shared infrastructure as if it were measured in that year.' }, null, 2) + '\n');
write(path.join(RELEASES, 'README.md'), `# Yearly research releases

Choose a folder from \`2016/\` through \`2024/\`, then read its \`manifest.json\` before importing \`district_crime.csv\` or \`district_crime.json\`. Road-safety and crash-zone files are included only when that year has a compatible production dataset.

- \`manifest.json\` - machine-readable index
- \`shared/manifest.json\` - infrastructure, boundaries and other non-year-specific production data
- \`2025/\` - separate audited staging release; not automatically integrated into production

Regenerate with \`npm run build:releases\`. Null never means zero.
`);
console.log(`Generated ${YEARS.length} yearly releases plus shared manifest.`);
