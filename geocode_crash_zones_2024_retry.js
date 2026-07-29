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
const BBOX = { minLat: 28.35, maxLat: 28.95, minLng: 76.7, maxLng: 77.45 };

async function main() {
  const partial = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'), 'utf8'));
  let resolved = 0, stillFailed = 0;
  const results = [];
  for (const zone of partial) {
    if (zone.lat != null) { results.push(zone); continue; }
    // Simplified query: strip parenthetical/slash variants, try "<name>, New Delhi, India" (no road)
    const cleanName = zone.name.split('/')[0].trim();
    const attempts = [cleanName + ', New Delhi, India', cleanName + ' Delhi'];
    let hit = null, usedQuery = null;
    for (const q of attempts) {
      try { hit = await geocode(q); } catch (e) { hit = null; }
      await sleep(1100);
      if (hit) { usedQuery = q; break; }
    }
    if (hit) {
      const lat = Number(hit.lat), lng = Number(hit.lon);
      if (lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng) {
        results.push({ ...zone, lat, lng, geocodeSource: 'OSM Nominatim retry (' + usedQuery + ')' });
        resolved++;
        console.log('OK  ', zone.name, '->', lat, lng, '  [', usedQuery, ']');
        continue;
      } else {
        console.log('REJECTED (outside bbox)', zone.name, lat, lng);
      }
    }
    stillFailed++;
    results.push(zone);
    console.log('FAIL', zone.name);
  }
  console.log('Retry resolved:', resolved, 'Still failed:', stillFailed);
  fs.writeFileSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'), JSON.stringify(results, null, 1));
}
main();
