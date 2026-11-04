// Shared by the historical page (scripts/build_historical_reporting_view.js) and the dashboard (scripts/build.js):
// the display shapes for the historical reference maps, and the wording that labels them.
// Display geometry only. The staged GeoJSON is never altered. The outlines are schematic, not to scale.
const fs = require('node:fs');
const path = require('node:path');
const turf = require('@turf/turf');

const GEO = 'data/staged/police_geography_history/';
const VIEW_BOX = '0 0 1000 850';

function load(root, p) {
  return JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
}

// Dilate 90 m to close slivers between station shapes, then simplify.
function soften(feature) {
  const buffered = turf.buffer(feature, feature.properties.territorial ? 0.09 : 0.03, {units: 'kilometers'});
  const out = turf.simplify(buffered, {tolerance: 0.0004, highQuality: false});
  out.properties = feature.properties;
  return out;
}

// Earlier, coarser districts, built from the archived 2014 station polygons and the station list of each district as printed in the Rajya
// Sabha answers of 22 December 2004 (roster_2004.json). That list holds for the nine districts of 1988 to 2006. Stations opened after 2004 are
// not on it; each takes the district of the nearest listed station in its own 2014 district. 2007 is the same list with the 2014 Outer stations drawn as Outer, which
// the Ministry of Home Affairs dates to 5 September 2007. Inferred for the years other than 2004; display geometry only.
const norm = n => n.toLowerCase().replace(/[^a-z0-9]/g, '');
const dist = (a, b) => turf.distance([a.properties.longitude, a.properties.latitude], [b.properties.longitude, b.properties.latitude]);

function stationDistricts(root) {
  const stations = load(root, GEO + 'raw/stations_2014.geojson').features;
  const r04 = load(root, GEO + 'roster_2004.json');
  const r14 = load(root, GEO + 'roster_2014.json');
  const byName = new Map(stations.map(f => [norm(f.properties.PS), f]));
  const airport = new Set(r14.airportStations.map(norm));
  const listed = new Map();
  for (const [district, names] of Object.entries(r04.districts)) {
    for (const n of names) {
      const f = byName.get(norm(r04.names_as_printed_to_archive_spelling[n] || n));
      if (f) listed.set(f, district);
    }
  }
  const district14 = new Map();
  for (const [district, names] of Object.entries(r14.districts)) for (const n of names) district14.set(norm(n), district);
  const nineDistricts = new Map(listed);
  for (const f of stations) {
    if (nineDistricts.has(f) || airport.has(norm(f.properties.PS))) continue;
    // nearest listed station within the same 2014 district; the nearest overall if that district has none listed
    const same = [...listed].filter(([g]) => district14.get(norm(g.properties.PS)) === district14.get(norm(f.properties.PS)));
    let best = null, bestD = Infinity;
    for (const [g, district] of (same.length ? same : [...listed])) { const d = dist(f, g); if (d < bestD) { bestD = d; best = district; } }
    nineDistricts.set(f, best);
  }
  const outer = new Set(r14.districts.Outer.map(norm));
  const tenDistricts = new Map([...nineDistricts].map(([f, d]) => [f, outer.has(norm(f.properties.PS)) ? 'Outer' : d]));
  return { nine: nineDistricts, ten: tenDistricts, listedCount: listed.size, stationCount: stations.length - airport.size };
}

function dissolveBy(assign) {
  const groups = new Map();
  for (const [f, district] of assign) groups.set(district, (groups.get(district) || []).concat(f));
  return [...groups].map(([name, feats]) => {
    const merged = feats.length === 1 ? turf.feature(feats[0].geometry) : turf.union(turf.featureCollection(feats));
    merged.properties = { name, territorial: true };
    return merged;
  });
}

function earlierMaps(root) {
  const sd = stationDistricts(root);
  return { '2001': dissolveBy(sd.nine).map(soften), '2007': dissolveBy(sd.ten).map(soften), stationDistricts: sd };
}

function buildShapes(root) {
  const f14 = load(root, GEO + 'districts_2014_reference.geojson').features.map(soften);
  const early = earlierMaps(root);
  const f17 = load(root, GEO + 'districts_2017_reference.geojson').features.map(soften);
  const coords = [...f14, ...f17].flatMap(f => f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates.flat(2));
  const xs = coords.map(p => p[0]), ys = coords.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const project = ([x, y]) => [25 + (x - minX) / (maxX - minX) * 950, 25 + (maxY - y) / (maxY - minY) * 800];
  const shape = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
    .map(p => p.map(r => r.map((xy, i) => (i ? 'L' : 'M') + project(xy).map(n => n.toFixed(2)).join(',')).join('') + 'Z').join('')).join('');
  const withPath = fs => fs.map(f => ({properties: f.properties, d: shape(f.geometry)}));
  return {viewBox: VIEW_BOX, maps: {'2014': withPath(f14), '2017': withPath(f17), '2007': withPath(early['2007']), '2001': withPath(early['2001'])}};
}

function notes(root) {
  const sd = stationDistricts(root), newer = sd.stationCount - sd.listedCount;
  const quality = load(root, GEO + 'validation.json');
  const quality17 = load(root, GEO + 'validation_2017.json');
  const moved = Object.values(quality17.stationsChangingDistrictSince2014Roster).flat().length;
  return {
    reference2014: `2014 reference reconstruction, not certified annual boundaries. May 2014 station shapes are grouped using the December 2014 roster. Shapes overlap by about ${quality.reconstructedDistrictOverlapSqKm.toFixed(2)} km² across districts; effective date and reuse terms remain unresolved. Outlines are schematic, lightly smoothed for display, and not to scale.`,
    derived: `Derived reference map. The official 9 November 2017 Delhi Gazette schedule (14 districts, 163 territorial stations) is applied to the May 2014 station shapes. North Avenue and South Avenue (New Delhi) have no archived polygon, so New Delhi is drawn from its other stations. ${moved} of the 161 stations that have shapes sit in a different district than in the December 2014 roster. Station boundaries may have changed after 2014; the effective date of the shapes and their reuse terms remain unresolved. The same schedule is used for 2018: NCRB reports the same 14 districts in both years, but no separate 2018 schedule was found. The outlines are schematic and not to scale: they are lightly smoothed for display, so they are not usable for measuring area or placing a point.`,
    inferred: 'Inferred, not verified. No station-by-station roster has been found for this year. The 2014 reference shapes are shown because the Ministry of Home Affairs annual reports describe the same Delhi Police structure in every year from 2010-11 to 2014-15 (11 districts, 54 sub-divisions), NCRB reports the same 11 district names, and a district-share check found no large transfer; a single station moving between districts cannot be ruled out.',
    inferredEarly: 'Inferred, not verified. NCRB prints the same 11 district names for this year as for 2011 to 2015, and the Ministry of Home Affairs dates the eleventh district (South-East) to 1 October 2008, so the 2014 reference shapes are shown. No station roster for this year has been found. The Ministry also reports that 22 police stations and 9 sub-divisions were notified in 2009, so stations may have moved between districts. The outlines are schematic and not to scale.',
    inferredNine: `Inferred from a 2004 station list. The Rajya Sabha answers of 22 December 2004 print the police stations under each of the nine police districts (116 stations); ${sd.listedCount} of them are matched to the archived 2014 station polygons and grouped by that list. The Ministry of Home Affairs reports nine police districts from 1988 until Outer was added on 5 September 2007, which matches NCRB. ${newer} stations that opened after 2004 are given the district of the nearest listed station in their own 2014 district. The 2004 list is applied to 2002 to 2006 without a check for station moves in those years, so those years are less certain than 2004. The outlines are schematic and not to scale.`,
    inferredTen: `Inferred from a 2004 station list. The Ministry of Home Affairs dates Outer to 5 September 2007 and South-East to 1 October 2008, so 2007 has ten districts. The shapes use the Rajya Sabha station list of 22 December 2004 (nine districts) on the archived 2014 station polygons, with the stations of the 2014 Outer district drawn as Outer. Which stations Outer actually took in 2007 is not documented, and stations opened after 2004 are given the district of the nearest listed station in their own 2014 district. The outlines are schematic and not to scale.`,
    inferred2015: 'The 2014-15 report counts 161 territorial stations and the November 2017 schedule 163, so a few stations opened after the 2014 archive was made.',
    inferred2016: 'For 2016 specifically: the NCRB 2016 table still reports 11 districts. Rohini and Shahdara were notified on 14 October 2016 but press reports describe them as newly created in early December 2016, and no other reorganisation between December 2014 and then has been found. Station moves still cannot be ruled out.'
  };
}

// Every file the shapes and their labelling are built from; builders record these paths and hashes in their manifests.
const INPUTS = ['raw/stations_2014.geojson', 'roster_2014.json', 'roster_2004.json', 'districts_2014_reference.geojson', 'districts_2017_reference.geojson', 'validation.json', 'validation_2017.json', 'structure_evidence_2010_2016.json', 'structure_evidence_2007_2010.json'].map(f => GEO + f);

module.exports = {buildShapes, notes, VIEW_BOX, INPUTS};
