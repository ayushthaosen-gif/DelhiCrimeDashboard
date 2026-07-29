// Geocodes the 2024 crash-prone zones that don't share a name with an already-geocoded 2023
// zone, via OSM Nominatim. Respects Nominatim's usage policy: 1 request/sec, descriptive
// User-Agent, no parallel requests.
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function geocode(query) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'User-Agent': 'DelhiCrimeDashboard-CrashZoneGeocoding/1.0 (one-off research use)' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  return json[0] || null;
}

// Delhi NCT bbox, same one used elsewhere in this project, to reject obviously-wrong matches.
const BBOX = { minLat: 28.35, maxLat: 28.95, minLng: 76.7, maxLng: 77.45 };

async function main() {
  const SCRATCH_2024 = 'C:/Users/ayush/AppData/Local/Temp/claude/C--Users-ayush/2c91efc8-fa16-49c9-baec-ebb26c6c5bd0/scratchpad/crash_geojson_2024';
  const rich2024 = JSON.parse(fs.readFileSync(path.join(SCRATCH_2024, 'delhi_crash_risk_locations_2024.geojson'), 'utf8')).features.map(f => f.properties);
  const partial = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'), 'utf8'));

  const results = [];
  let resolved = 0, failed = 0;
  for (const zone of partial) {
    if (zone.lat != null) { results.push(zone); continue; } // already reused from 2023
    const rich = rich2024.find(p => p.location_name === zone.name);
    const query = rich ? rich.osm_search_query : zone.name + ', Delhi, India';
    let hit = null;
    try {
      hit = await geocode(query);
      if (!hit) { await sleep(1100); hit = await geocode(zone.name + ', Delhi, India'); } // fallback: drop road name
    } catch (e) {
      console.log('ERROR geocoding', zone.name, e.message);
    }
    await sleep(1100);
    if (hit) {
      const lat = Number(hit.lat), lng = Number(hit.lon);
      if (lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng) {
        results.push({ ...zone, lat, lng, geocodeSource: 'OSM Nominatim (' + query + ')' });
        resolved++;
        console.log('OK  ', zone.name, '->', lat, lng);
        continue;
      } else {
        console.log('REJECTED (outside Delhi bbox)', zone.name, '->', lat, lng);
      }
    }
    failed++;
    results.push(zone); // keep as unresolved (lat/lng stay null)
    console.log('FAIL', zone.name);
  }
  console.log('Resolved via Nominatim:', resolved, 'Failed/unresolved:', failed);
  fs.writeFileSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'), JSON.stringify(results, null, 1));
}
main();
