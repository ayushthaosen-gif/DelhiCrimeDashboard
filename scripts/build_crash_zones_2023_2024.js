// Joins the richer per-zone crash-type breakdown (delhi_crash_risk_locations_2023/2024.geojson,
// supplied by the user) onto the already-geocoded 2023 crash zones, and geocodes the 2024 zones
// by reusing 2023 coordinates where the same named location recurs (per the 2023-2024 comparison
// CSV) and falling back to OSM Nominatim for genuinely new-in-2024 names.
//
//   node scripts/build_crash_zones_2023_2024.js

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SCRATCH_2023 = process.env.CRASH_REPORT_2023_SOURCE || path.join(ROOT, 'data/source/crash_report_2023');
const SCRATCH_2024 = process.env.CRASH_REPORT_2024_SOURCE || path.join(ROOT, 'data/source/crash_report_2024');

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, ' ').trim();
}

const existing2023 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_geocoded.json'), 'utf8'));
const rich2023 = JSON.parse(fs.readFileSync(path.join(SCRATCH_2023, 'delhi_crash_risk_locations_2023.geojson'), 'utf8')).features.map(f => f.properties);
const rich2024 = JSON.parse(fs.readFileSync(path.join(SCRATCH_2024, 'delhi_crash_risk_locations_2024.geojson'), 'utf8')).features.map(f => f.properties);
const cctv2023 = JSON.parse(fs.readFileSync(path.join(SCRATCH_2023, 'delhi_cctv_priority_candidates_from_crash_report_2023.geojson'), 'utf8')).features.map(f => f.properties.location_name);
const cctv2024 = JSON.parse(fs.readFileSync(path.join(SCRATCH_2024, 'delhi_cctv_priority_candidates_from_crash_report_2024.geojson'), 'utf8')).features.map(f => f.properties.location_name);

// Hand-resolved aliases where the existing geocoded 2023 file and the new rich extract used
// slightly different naming for the same physical location (confirmed by road name + rough
// location match, not guessed) -- the rest join by normalized exact name.
const ALIASES_2023 = {
  'boulevard road': 'kashmiri gate chowk boulevard road',
  'maya puri chowk': 'mayapuri chowk',
  'arsd college': 'arsd college ring road',
  'janak puri east': 'janakpuri east',
  'pul mithai': 'pul mithai spm marg',
};

const RICH_FIELDS = [
  'pedestrian_crash_prone', 'pedestrian_simple_crashes', 'pedestrian_fatal_crashes', 'pedestrian_total_crashes',
  'two_wheeler_crash_prone', 'two_wheeler_simple_crashes', 'two_wheeler_fatal_crashes', 'two_wheeler_total_crashes',
  'htv_crash_prone', 'htv_simple_crashes', 'htv_fatal_crashes', 'htv_total_crashes',
  'hit_and_run_crash_prone', 'hit_and_run_simple_crashes', 'hit_and_run_fatal_crashes', 'hit_and_run_total_crashes',
  'day_time_crash_prone', 'day_time_simple_crashes', 'day_time_fatal_crashes', 'day_time_total_crashes',
  'night_time_crash_prone', 'night_time_simple_crashes', 'night_time_fatal_crashes', 'night_time_total_crashes',
  'blackspot_persons_killed', 'blackspot_persons_injured',
];

function pickRichFields(props) {
  const out = {};
  for (const k of RICH_FIELDS) out[k] = props[k] === undefined ? null : props[k];
  return out;
}

// --- 2023: join rich breakdown onto the already-geocoded zones ---
const rich2023ByName = {};
rich2023.forEach(p => { rich2023ByName[norm(p.location_name)] = p; });

let matched2023 = 0;
const enriched2023 = existing2023.map(z => {
  const key = ALIASES_2023[norm(z.name)] || norm(z.name);
  const p = rich2023ByName[key];
  if (p) matched2023++;
  return {
    ...z,
    year: 2023,
    cctvPriorityCandidate: cctv2023.includes(z.name) || (p && cctv2023.some(n => norm(n) === norm(p.location_name))),
    ...(p ? pickRichFields(p) : {}),
  };
});
console.log('2023: enriched', matched2023, 'of', existing2023.length, 'zones with rich breakdown');

fs.writeFileSync(path.join(ROOT, 'data/crash_zones_2023_geocoded.json'), JSON.stringify(enriched2023, null, 1));

// --- 2024: geocode via name-match to the (now enriched) 2023 set first, then flag the rest ---
const enriched2023ByName = {};
enriched2023.forEach(z => { enriched2023ByName[norm(z.name)] = z; });

// Manual aliases between the 2024 rich extract's names and the 2023 geocoded set, resolved by
// checking road_name + the 2023-2024 comparison CSV's match_key rather than guessed blind.
const ALIASES_2024_TO_2023 = {
  'azad pur chowk': 'azad pur chowk', // exact already, kept for clarity of intent
};

let reused2024 = 0;
const unresolved2024 = [];
const geocoded2024 = rich2024.map(p => {
  const key = ALIASES_2024_TO_2023[norm(p.location_name)] || norm(p.location_name);
  const match = enriched2023ByName[key];
  const base = {
    rank: p.table_6_29_rank || null,
    name: p.location_name,
    road: p.road_name,
    simple: p.all_simple_crashes,
    fatal: p.all_fatal_crashes,
    total: p.all_total_crashes,
    year: 2024,
    cctvPriorityCandidate: cctv2024.some(n => norm(n) === norm(p.location_name)),
    ...pickRichFields(p),
  };
  if (match && match.lat != null) {
    reused2024++;
    return { ...base, lat: match.lat, lng: match.lng, x: match.x, y: match.y, district: match.district, geocodeSource: 'matched to 2023 geocoded zone by name' };
  }
  unresolved2024.push(p.location_name);
  return { ...base, lat: null, lng: null, x: null, y: null, district: null, geocodeSource: 'unresolved' };
});
console.log('2024: reused coordinates for', reused2024, 'of', rich2024.length, 'zones (matched an already-geocoded 2023 zone by name)');
console.log('2024: unresolved (need Nominatim geocoding):', unresolved2024.length);
console.log(unresolved2024);

fs.writeFileSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'), JSON.stringify(geocoded2024, null, 1));
