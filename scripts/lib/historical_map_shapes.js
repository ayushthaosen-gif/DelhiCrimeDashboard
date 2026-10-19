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

function buildShapes(root) {
  const f14 = load(root, GEO + 'districts_2014_reference.geojson').features.map(soften);
  const f17 = load(root, GEO + 'districts_2017_reference.geojson').features.map(soften);
  const coords = [...f14, ...f17].flatMap(f => f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates.flat(2));
  const xs = coords.map(p => p[0]), ys = coords.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const project = ([x, y]) => [25 + (x - minX) / (maxX - minX) * 950, 25 + (maxY - y) / (maxY - minY) * 800];
  const shape = g => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
    .map(p => p.map(r => r.map((xy, i) => (i ? 'L' : 'M') + project(xy).map(n => n.toFixed(2)).join(',')).join('') + 'Z').join('')).join('');
  const withPath = fs => fs.map(f => ({properties: f.properties, d: shape(f.geometry)}));
  return {viewBox: VIEW_BOX, maps: {'2014': withPath(f14), '2017': withPath(f17)}};
}

function notes(root) {
  const quality = load(root, GEO + 'validation.json');
  const quality17 = load(root, GEO + 'validation_2017.json');
  const moved = Object.values(quality17.stationsChangingDistrictSince2014Roster).flat().length;
  return {
    reference2014: `2014 reference reconstruction, not certified annual boundaries. May 2014 station shapes are grouped using the December 2014 roster. Shapes overlap by about ${quality.reconstructedDistrictOverlapSqKm.toFixed(2)} km² across districts; effective date and reuse terms remain unresolved. Outlines are schematic, lightly smoothed for display, and not to scale.`,
    derived: `Derived reference map. The official 9 November 2017 Delhi Gazette schedule (14 districts, 163 territorial stations) is applied to the May 2014 station shapes. North Avenue and South Avenue (New Delhi) have no archived polygon, so New Delhi is drawn from its other stations. ${moved} of the 161 stations that have shapes sit in a different district than in the December 2014 roster. Station boundaries may have changed after 2014; the effective date of the shapes and their reuse terms remain unresolved. The same schedule is used for 2018: NCRB reports the same 14 districts in both years, but no separate 2018 schedule was found. The outlines are schematic and not to scale: they are lightly smoothed for display, so they are not usable for measuring area or placing a point.`,
    inferred: 'Inferred, not verified. No station-by-station roster has been found for this year. The 2014 reference shapes are shown because the Ministry of Home Affairs annual reports describe the same Delhi Police structure in every year from 2010-11 to 2014-15 (11 districts, 54 sub-divisions), NCRB reports the same 11 district names, and a district-share check found no large transfer; a single station moving between districts cannot be ruled out.',
    inferred2015: 'The 2014-15 report counts 161 territorial stations and the November 2017 schedule 163, so a few stations opened after the 2014 archive was made.',
    inferred2016: 'For 2016 specifically: the NCRB 2016 table still reports 11 districts. Rohini and Shahdara were notified on 14 October 2016 but press reports describe them as newly created in early December 2016, and no other reorganisation between December 2014 and then has been found. Station moves still cannot be ruled out.'
  };
}

// Every file the shapes and their labelling are built from; builders record these paths and hashes in their manifests.
const INPUTS = ['districts_2014_reference.geojson', 'districts_2017_reference.geojson', 'validation.json', 'validation_2017.json', 'structure_evidence_2010_2016.json'].map(f => GEO + f);

module.exports = {buildShapes, notes, VIEW_BOX, INPUTS};
