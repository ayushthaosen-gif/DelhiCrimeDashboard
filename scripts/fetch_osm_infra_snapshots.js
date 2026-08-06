// One-off, reproducible fetcher for three new OSM/Overpass infrastructure snapshots: traffic
// signals + pedestrian crossings, hospitals, and footway/sidewalk geometry. Writes raw Overpass
// JSON straight to data/source/ (same "committed snapshot, not fetched live at build time"
// convention already used for osm_pedestrian_overpasses_delhi_raw.json) so scripts/build_*.js can
// process a fixed, reviewable input rather than re-querying a live API on every build.
//
//   node scripts/fetch_osm_infra_snapshots.js
//
// Bounding box matches the dashboard's own district-boundary extent (data/dashboard_boundaries_
// simplified.geojson), padded slightly: south 28.35, west 76.80, north 28.95, east 77.40.

const fs = require('fs');
const path = require('path');
const https = require('https');
const ROOT = path.resolve(__dirname, '..');
const BBOX = '28.35,76.80,28.95,77.40'; // south,west,north,east
const ENDPOINT = 'https://overpass-api.de/api/interpreter';

const QUERIES = {
  osm_traffic_signals_crossings_delhi_raw: `
    [out:json][timeout:120];
    (
      node["highway"="traffic_signals"](${BBOX});
      node["highway"="crossing"](${BBOX});
    );
    out body;
  `,
  osm_street_lamps_delhi_raw: `
    [out:json][timeout:90];
    node["highway"="street_lamp"](${BBOX});
    out body;
  `,
  osm_hospitals_delhi_raw: `
    [out:json][timeout:120];
    (
      node["amenity"="hospital"](${BBOX});
      way["amenity"="hospital"](${BBOX});
      relation["amenity"="hospital"](${BBOX});
    );
    out center;
  `,
  osm_footways_delhi_raw: `
    [out:json][timeout:180];
    (
      way["highway"="footway"](${BBOX});
      way["highway"="pedestrian"](${BBOX});
      way["footway"="sidewalk"](${BBOX});
    );
    out geom;
  `,
};

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const body = 'data=' + encodeURIComponent(query);
    const req = https.request(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), 'User-Agent': 'DelhiCrimeDashboard/1.0 (https://github.com/ayushthaosen-gif/DelhiCrimeDashboard; reproducible infra-data snapshot fetch)', 'Accept': '*/*' }, timeout: 180000 }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('Overpass returned ' + res.statusCode + ': ' + data.slice(0, 300)));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Overpass request timed out')); });
    req.write(body);
    req.end();
  });
}

async function main() {
  for (const [name, query] of Object.entries(QUERIES)) {
    console.log('Fetching', name, '...');
    const json = await fetchOverpass(query);
    const parsed = JSON.parse(json); // fail fast if Overpass returned an error body, not valid JSON
    const outPath = path.join(ROOT, 'data', 'source', name + '.json');
    fs.writeFileSync(outPath, JSON.stringify(parsed));
    console.log('Wrote', outPath, '—', (parsed.elements || []).length, 'elements');
    await new Promise(r => setTimeout(r, 2000)); // be polite to the shared public Overpass instance
  }
}

main().catch(err => { console.error(err); process.exit(1); });
