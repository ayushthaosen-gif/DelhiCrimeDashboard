// Generates clean, dashboard-independent data exports in exports/ — CSV and JSON,
// stripped of rendering-only fields (SVG path strings, pixel coordinates) so the
// numbers here mean the same thing whether you open them in Excel, pandas, or a
// completely different mapping stack. Re-run after editing anything in data/.
//
//   node export_data.js

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;
const OUT = path.join(ROOT, 'exports');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function toCSV(headers, rows) {
  return [headers.map(csvEscape).join(',')]
    .concat(rows.map(r => r.map(csvEscape).join(',')))
    .join('\r\n') + '\r\n';
}
function write(name, headers, rows, objects) {
  fs.writeFileSync(path.join(OUT, name + '.csv'), toCSV(headers, rows));
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify(objects, null, 2));
  console.log('Wrote exports/' + name + '.csv and .json —', objects.length, 'rows');
}

// ── 1. Districts: every crime/infrastructure/crash figure, no SVG path or pixel coords ──
const dashboardFinal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));
const districtFields = [
  'district', 'areaSqKm',
  'theft2022', 'theft', 'theft2024',
  'robbery2022', 'robbery', 'robbery2024',
  'burglary2022', 'burglary', 'burglary2024',
  'totalIPC2022', 'totalIPC', 'totalIPC2024',
  'crimeAgainstWomen2022', 'crimeAgainstWomen', 'crimeAgainstWomen2024',
  'totalSLL2022', 'totalSLL', 'totalSLL2024',
  'fatalRoadCrashes2022', 'hitAndRunCrashes2022',
  'crashProneZones2023', 'simpleCrashes2023', 'fatalCrashes2023', 'totalCrashes2023',
  'surveyPoints', 'totalLights', 'lightDensityPerKm2',
  'underpasses', 'underpassDensity',
  'metroGates', 'metroGateDensity',
  'policeStations', 'chowkiPosts', 'policeInfraCount', 'policeInfraDensity',
];
const districts = dashboardFinal.districts.map(d => {
  const row = {};
  districtFields.forEach(f => { row[f] = d[f] === undefined ? null : d[f]; });
  return row;
});
write('districts', districtFields, districts.map(r => districtFields.map(f => r[f])), districts);

// ── 2. Crash-prone zones, 2023: name, road, severity, and lat/lng where geocoded ──
// Matched by rank, not name — a couple of zone names have needed correction after the fact
// (one lost its name entirely to a table-parsing bug), and rank is the stable identifier that
// survives that, whereas a name-keyed join silently drops the match the moment either side edits it.
const zonesRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_raw.json'), 'utf8'));
const zonesGeo = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_geocoded.json'), 'utf8'));
const geoByRank = {};
zonesGeo.forEach(z => { geoByRank[z.rank] = z; });
const zoneFields = ['rank', 'name', 'road', 'simpleCrashes', 'fatalCrashes', 'totalCrashes', 'lat', 'lng', 'geocoded'];
const zones = zonesRaw.map(z => {
  const g = geoByRank[z.rank];
  const ok = !!(g && g.lat != null && g.lng != null);
  return {
    rank: z.rank, name: z.name, road: z.road,
    simpleCrashes: z.simple, fatalCrashes: z.fatal, totalCrashes: z.total,
    lat: ok ? g.lat : null, lng: ok ? g.lng : null, geocoded: ok,
  };
});
write('crash_prone_zones_2023', zoneFields, zones.map(r => zoneFields.map(f => r[f])), zones);

// ── 3. Citywide road safety trends, 2014-2023 ──
const trends = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/road_safety_trends.json'), 'utf8'));
const trendFields = ['year', 'crashes', 'fatalities', 'fatalCrashes'];
write('road_safety_trends_2014_2023', trendFields, trends.trends.map(r => trendFields.map(f => r[f])), trends.trends);

// ── 4. Road deaths by mode of travel, 2019-2023 ──
const victimFields = Object.keys(trends.victims[0]);
write('road_deaths_by_mode_2019_2023', victimFields, trends.victims.map(r => victimFields.map(f => r[f])), trends.victims);

console.log('\nAll exports written to exports/. See README.md for schema notes and usage examples.');
