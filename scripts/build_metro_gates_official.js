// Counts and distances derived from the official Delhi Metro gate locations (DMRC, via the Delhi Transport Stack), for the 290 legacy wards, the 15 districts
// and the 93 crash-prone zones of 2024. Writes data/derived/metro_gates_official_2024.json.
//
//   node scripts/build_metro_gates_official.js <dmrc_station_and_gate_locations.xlsx> <LicenceAgreement.pdf>      (needs `unzip`)
//
// The raw file is NOT in the repository. The dataset's licence (Delhi Transport Stack Licence Agreement 1.0, Schedule 1) allows derivatives and
// redistribution as part of a collection made from works from different sources, but not redistribution of the licensed work on its own, so only the
// derived counts and distances are published, never the gate coordinates. Run this locally; test/metro_gates_official.test.js checks the committed result.

const fs = require('fs');
const path = require('path');
const { sha256 } = require('./lib/release_utils');
const { readWorkbook } = require('./lib/xlsx_min');
const { indexPolygons, locate } = require('./lib/geo');

const ROOT = path.join(__dirname, '..');
const [xlsx, licence] = process.argv.slice(2);
if (!xlsx || !licence) { console.error('usage: node scripts/build_metro_gates_official.js <xlsx> <licence pdf>'); process.exit(1); }
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const num = s => parseFloat(String(s == null ? '' : s).replace(/[NE]/g, ''));

const wb = readWorkbook(xlsx);
const stations = wb.stations.slice(1), gateRows = wb.gates.slice(1);
const stationCodes = new Set(stations.map(r => r.B).filter(Boolean));

// ---- quality of the file as supplied ----
const valid = gateRows.filter(r => isFinite(num(r.D)) && isFinite(num(r.E)));
const key5 = r => num(r.D).toFixed(5) + ',' + num(r.E).toFixed(5);
const pairSeen = {}; let dupPairs = 0; valid.forEach(r => { const k = r.A + '|' + r.B; pairSeen[k] = (pairSeen[k] || 0) + 1; if (pairSeen[k] > 1) dupPairs++; });
const posSeen = {}; valid.forEach(r => { posSeen[key5(r)] = (posSeen[key5(r)] || 0) + 1; });
const quality = {
  gateRows: gateRows.length, rowsWithoutCoordinates: gateRows.length - valid.length, rowsWithBlankStationCode: gateRows.filter(r => !r.A).length,
  stationCodesNotInStationSheet: [...new Set(gateRows.map(r => r.A))].filter(c => c && !stationCodes.has(c)).length,
  repeatedStationAndGateNamePairs: dupPairs, rowsSharingAPositionWithAnotherRow: valid.filter(r => posSeen[key5(r)] > 1).length,
  stationRows: stations.length, stationCodes: stationCodes.size
};

// one gate = one distinct (station code, gate name, position to 5 decimal places); a row that repeats all three is not counted twice. Several gates of a
// station often share one recorded position (the file gives station-level coordinates for many gates), so a shared position does not make them one gate.
const seen = new Set(), gates = [];
valid.forEach(r => { const k = [r.A || '', r.B || '', key5(r)].join('|'); if (seen.has(k)) return; seen.add(k); gates.push({ lng: num(r.E), lat: num(r.D) }); });
quality.exactDuplicateRowsNotCounted = valid.length - gates.length;

const wards = read('data/delhi_wards_infra.geojson').features, wardIndex = indexPolygons(wards);
const districts = read('data/dashboard_boundaries_simplified.geojson').features, districtIndex = indexPolygons(districts);
const wardCounts = {}, districtCounts = {}; let inDelhi = 0, outside = 0;
gates.forEach(g => {
  const w = locate(wardIndex, g.lng, g.lat), d = locate(districtIndex, g.lng, g.lat);
  if (w < 0 && d < 0) { outside++; return; }
  inDelhi++;
  if (w >= 0) { const no = String(wards[w].properties.Ward_No); wardCounts[no] = (wardCounts[no] || 0) + 1; }
  if (d >= 0) { const n = districts[d].properties.district || districts[d].properties.name; districtCounts[n] = (districtCounts[n] || 0) + 1; }
});

const hav = (a, b) => { const R = 6371000, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const zones = read('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').features.map(f => {
  const z = { lng: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] };
  const d = gates.map(g => hav(z, g));
  return { zone: f.properties.location_name, accuracy_m: f.properties.estimated_accuracy_m, nearest_gate_m: Math.round(Math.min.apply(null, d)), gates_within_250m: d.filter(x => x <= 250).length, gates_within_500m: d.filter(x => x <= 500).length };
});

const out = {
  schemaVersion: '1.0.0',
  title: 'Official Delhi Metro gate counts and distances, derived from the DMRC gate locations on the Delhi Transport Stack',
  source: {
    dataset: 'Delhi Metro: Gate Locations', provider: 'Delhi Metro Rail Corporation (DMRC)', via: 'Delhi Transport Stack (Department of Transport, GNCTD)',
    datasetPage: 'https://delhi.transportstack.in/data-services/datadetails/3', datasetId: 3, version: '1', published: '2024-10-11', lastUpdatedByPublisher: '2024-12-02', retrieved: '2026-10-22',
    file: path.basename(xlsx), sha256: sha256(xlsx), bytes: fs.statSync(xlsx).size, chargingModel: 'Free', access: 'Open, download',
    licence: { name: 'Delhi Transport Stack Licence Agreement 1.0', sha256: sha256(licence), schedule1: 'Derivatives allowed; redistribution of the licensed work on its own is not allowed but is allowed as part of a collection made from works from different sources; any part of the work may be used and distributed; attribution to Transport Stack; a modified version must indicate what changed.' },
    attribution: 'Delhi Metro gate locations: Delhi Metro Rail Corporation, via the Delhi Transport Stack (Department of Transport, GNCTD), dataset 3, version 1, last updated by the publisher 2024-12-02. Counts and distances here were derived by this project and are not the original data. Provided without warranty; neither DMRC nor the Delhi Transport Stack guarantees its accuracy.'
  },
  method: 'A gate is one distinct (station code, gate name, position to 5 decimal places) among the rows with coordinates; exact duplicate rows are not counted twice, and gates that share a recorded position stay separate gates. Gates are assigned to the legacy 290 wards and the 15 police districts by point-in-polygon (the same rule as the profiles). Distances to the 2024 crash-prone zones are great-circle distances from each zone\'s placed point, which has its own stated accuracy of 150 m to 5 km.',
  quality,
  summary: { distinctGates: gates.length, gatesInDelhiWards: inDelhi, gatesOutsideDelhi: outside, wardsWithAGate: Object.keys(wardCounts).length, zonesWithAGateWithin250m: zones.filter(z => z.gates_within_250m > 0).length, zonesWithAGateWithin500m: zones.filter(z => z.gates_within_500m > 0).length },
  caveats: [
    'Only the derived counts and distances are published. The gate coordinates are not, because the licence does not allow redistributing the licensed work on its own.',
    'The file has defects (see quality): rows with no station code or coordinates, station codes missing from the station sheet, repeated rows and shared positions. They have been counted, not corrected; the Data Publisher should be told (licence clause 3.3.2).',
    'The file covers the whole metro network including the NCR; only gates inside the 290 wards and 15 districts are counted here.',
    'The data was last updated by the publisher on 2024-12-02 (manual updates), so newer stations and gates are missing.',
    'A zone\'s distance to the nearest gate depends on its hand-placed position (150 m to 5 km accuracy).'
  ],
  wards: wardCounts,
  districts: districtCounts,
  zones
};
fs.mkdirSync(path.join(ROOT, 'data', 'derived'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/derived/metro_gates_official_2024.json'), JSON.stringify(out, null, 2) + '\n');
console.log('metro gates: ' + JSON.stringify(out.summary) + ' | quality ' + JSON.stringify(quality));
