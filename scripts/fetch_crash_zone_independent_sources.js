// Fetches two more independent coordinate sources for the 2024 crash-zone names, to feed the refinement (layer 4):
//   - GeoNames, through the keyless Open-Meteo geocoding API (best for localities, villages, stations)
//   - Wikidata coordinates (P625) for notable places (ISBTs, hospitals, flyovers, metro stations, temples)
// Neither is a crash location: they place the NAMED PLACE. Results are cached (1 request per 0.7 s, descriptive User-Agent).
//
//   node scripts/fetch_crash_zone_independent_sources.js
//
// Output: data/audits/crash_zones_2024/crash_zone_independent_sources_2024.json

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const zonesFile = path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson');
const outFile = path.join(ROOT, 'data/audits/crash_zones_2024/crash_zone_independent_sources_2024.json');
const UA = 'DelhiCrimeDashboard-CrashZoneAudit/1.0 (research audit; github.com/ayushthaosen-gif/DelhiCrimeDashboard)';
const BBOX = { minLat: 28.35, maxLat: 28.95, minLng: 76.7, maxLng: 77.45 };
const inDelhi = (lat, lng) => lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries) {
  tries = tries || 0;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (res.status === 429 && tries < 4) { await sleep(8000 * (tries + 1)); return getJson(url, tries + 1); } // polite back-off
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// "Near Yashobhoomi Convention Centre Dwarka" -> candidate place names, most specific first
function nameVariants(name) {
  const base = name.replace(/\(.*?\)/g, ' ').replace(/\b(near|opp\.?|opposite|metro station|red light|flyover|fly over|chowk|crossing|underpass|bus stand|bus stop|t-?point|cut)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  const list = [name.replace(/\s+/g, ' ').trim(), base];
  const words = base.split(' ');
  if (words.length > 2) list.push(words.slice(0, 2).join(' '), words[0]);
  return [...new Set(list.filter(w => w.length >= 4))];
}

async function geonames(name) {
  for (const v of nameVariants(name)) {
    const j = await getJson('https://geocoding-api.open-meteo.com/v1/search?count=10&language=en&format=json&country_code=IN&name=' + encodeURIComponent(v));
    await sleep(700);
    const hit = (j.results || []).find(r => /delhi/i.test(r.admin1 || '') && inDelhi(r.latitude, r.longitude));
    if (hit) return { query: v, lat: hit.latitude, lng: hit.longitude, name: hit.name, feature_code: hit.feature_code };
  }
  return null;
}

async function wikidata(name) {
  const clean = name.replace(/\b(near)\b/gi, '').trim();
  const s = await getJson('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=en&limit=5&search=' + encodeURIComponent(clean + ' Delhi'));
  await sleep(1500);
  const ids = (s.search || []).map(x => x.id);
  if (!ids.length) return null;
  const e = await getJson('https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels|descriptions&languages=en&ids=' + ids.join('|'));
  await sleep(700);
  for (const id of ids) {
    const ent = e.entities && e.entities[id], c = ent && ent.claims && ent.claims.P625 && ent.claims.P625[0] && ent.claims.P625[0].mainsnak.datavalue;
    if (!c) continue;
    const { latitude: lat, longitude: lng } = c.value;
    if (inDelhi(lat, lng)) return { id, lat, lng, label: ent.labels && ent.labels.en && ent.labels.en.value, description: ent.descriptions && ent.descriptions.en && ent.descriptions.en.value };
  }
  return null;
}

async function main() {
  const zones = JSON.parse(fs.readFileSync(zonesFile, 'utf8')).features.map(f => f.properties.location_name);
  const out = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : { note: 'Coordinates of the NAMED PLACE from GeoNames (via Open-Meteo) and Wikidata. Not crash locations.', zones: {} };
  let n = 0;
  for (const name of zones) {
    const prev = out.zones[name];
    if (prev && !prev.geonames_error && !prev.wikidata_error) continue;
    const rec = prev ? { geonames: prev.geonames, wikidata: null } : { geonames: null, wikidata: null };
    if (!prev || prev.geonames_error) { try { rec.geonames = await geonames(name); } catch (e) { console.log('geonames error', name, e.message); rec.geonames_error = e.message; } }
    try { rec.wikidata = await wikidata(name); } catch (e) { console.log('wikidata error', name, e.message); rec.wikidata_error = e.message; }
    out.zones[name] = rec; n++;
    fs.writeFileSync(outFile, JSON.stringify(out, null, 1));
  }
  const have = (k) => Object.values(out.zones).filter(r => r[k]).length;
  console.log('zones fetched this run:', n, '| with GeoNames:', have('geonames'), '| with Wikidata:', have('wikidata'), '| total', Object.keys(out.zones).length);
}
main().catch(e => { console.error(e); process.exit(1); });
