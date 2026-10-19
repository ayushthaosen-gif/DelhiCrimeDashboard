// Reconstruct a dated reference map; never substitute it for unverified years.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const turf = require('@turf/turf');
const root = path.join(__dirname, '..');
const base = path.join(root, 'data/staged/police_geography_history');
const read = p => JSON.parse(fs.readFileSync(path.join(base, p), 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write = (p, value) => fs.writeFileSync(path.join(base, p), JSON.stringify(value, null, 2) + '\n');
const stations = read('raw/stations_2014.geojson');
const roster = read('roster_2014.json');
assert.equal(sha(path.join(base, 'raw/police_stations_2014.zip')), '72d35143e8dbbc1b76f55db22ab315449ca89a080a3c894436b5b402770c9049');
assert.equal(stations.features.length, 163);
const names = new Map(stations.features.map(f => [f.properties.PS, f]));
assert.equal(names.size, 163, 'Duplicate station geometry labels');
const assigned = new Set();
const dissolve = (label, members, territorial) => {
  const features = members.map(name => {
    assert(names.has(name), `Missing station ${name}`);
    assert(!assigned.has(name), `Station assigned twice: ${name}`);
    assigned.add(name);
    return names.get(name);
  });
  const merged = turf.union(turf.featureCollection(features));
  assert(merged && ['Polygon', 'MultiPolygon'].includes(merged.geometry.type));
  merged.properties = {name: label, territorial, geometryReferenceYear: 2014, stationCount: members.length, stations: members};
  return merged;
};
const features = Object.entries(roster.districts).map(([name, members]) => dissolve(name, members, true));
features.push(dissolve('IGI Airport', roster.airportStations, false));
assert.equal(assigned.size, 163);
assert.equal(features.filter(f => f.properties.territorial).length, 11);
assert.equal(Object.values(roster.districts).flat().length, 161);
const crime = JSON.parse(fs.readFileSync(path.join(root, 'data/releases/historical_2011_2015/as_printed/ncrb_2014_ipc.json')));
const canonical = s => s.toLowerCase().replace(/[^a-z]/g, '');
const units = new Map(crime.reporting_units.map(row => [canonical(row.reporting_unit_label), row]));
for (const f of features) {
  const row = units.get(canonical(f.properties.name));
  assert(row, `No original reporting-unit row for ${f.properties.name}`);
  f.properties.counts = row.selected_metrics;
  f.properties.sourceRow = row.source_row;
  f.properties.sourceLabel = row.reporting_unit_label;
}
const sourceUnion = turf.union(stations);
const resultUnion = turf.union(turf.featureCollection(features));
const areaError = Math.abs(turf.area(sourceUnion) - turf.area(resultUnion));
assert(areaError < 1, `Dissolve changed footprint by ${areaError} square metres`);
const stationArea = stations.features.reduce((sum, f) => sum + turf.area(f), 0);
const districtOverlap = features.reduce((sum, f) => sum + turf.area(f), 0) - turf.area(resultUnion);
const validation = {
  stationPolygons: 163, territorialStationPolygons: 161, airportStationPolygons: 2,
  territorialDistricts: 11, airportGeometrySeparate: true,
  unmatchedStations: [], duplicateAssignments: [], unmatchedCrimeRows: [],
  sourceFootprintSqKm: turf.area(sourceUnion) / 1e6,
  dissolveFootprintDifferenceSqMetres: areaError,
  sourceOverlapSqKm: (stationArea - turf.area(sourceUnion)) / 1e6,
  reconstructedDistrictOverlapSqKm: districtOverlap / 1e6,
  geometryQualityStatus: 'needs_review',
  countJoin: 'Exact 2014 reporting-unit identity after case/punctuation normalization; no aggregation or allocation',
  otherYearsEnabled: false,
  limitations: ['Community-preserved geometry uploaded 2014-05-13; survey/effective date not supplied.', 'Roster dated 2014-12-09; changes within that interval have not been independently ruled out.', 'Archived station polygons overlap; district polygons retain cross-district overlaps. No snapping, clipping or invented corrections applied.', 'A 2014 reference reconstruction, not an exact annual boundary certification.']
};
write('districts_2014_reference.geojson', {type: 'FeatureCollection', features});
write('validation.json', validation);
write('manifest.json', {
  schemaVersion: '1.0.0', status: 'reference_preview', productionReady: false, dashboardIntegrated: false,
  geometryReferenceYear: 2014, approvedForOtherYears: [], annualBoundaryCertification: false,
  generatedBy: 'scripts/build_historical_geography_preview.js',
  sources: [
    {id: 'station_geometry', url: 'https://groups.google.com/group/datameet/attach/79bd403db2079203/delhi%20police%20stations.zip?part=0.1', contextUrl: 'https://groups.google.com/g/datameet/c/G3EQ5ggZkKc/m/A5IHsj1AvXkJ', claimedOriginalUrl: 'http://www.delhipolice.nic.in/knowurps.html', publicationDate: '2014-05-13', effectiveDate: null, retrievedDate: '2026-10-19', path: 'raw/police_stations_2014.zip', sha256: sha(path.join(base, 'raw/police_stations_2014.zip')), reuseTerms: 'No explicit open licence found in post/archive; source claim and reuse permission are not independently verified.'},
    {id: 'station_roster', url: roster.sourceUrl, referenceDate: roster.referenceDate, publicationDate: '2014-12-09', originalBinarySha256: null, retrievalStatus: 'Search-index text inspected; live binary returned 404', transcriptionPath: 'roster_2014.json', transcriptionSha256: sha(path.join(base, 'roster_2014.json')), reuseTerms: 'Official parliamentary factual roster; no explicit open-data licence verified for this file.'},
    {id: 'crime_counts', path: 'data/releases/historical_2011_2015/as_printed/ncrb_2014_ipc.json', referenceYear: 2014, sha256: sha(path.join(root, 'data/releases/historical_2011_2015/as_printed/ncrb_2014_ipc.json')), originalSourceManifest: 'data/staged/history_2011_2015/manifest.json'},
    {id: 'dwarka_notification', url: 'https://www.mha.gov.in/sites/default/files/UTPSectionMHA_13042018.pdf', notificationDate: '2017-11-09', number: 'F.1/6/2016/HP-I/Estt./4049-4056', finding: 'Dwarka carved from South-West and Outer; not South-East.', originalBinarySha256: null, retrievalStatus: 'Official search-index text inspected; live binary returned 404'}
  ],
  inputs: ['raw/stations_2014.geojson', 'roster_2014.json'].map(p => ({path: p, sha256: sha(path.join(base, p))})),
  validation,
  policy: 'Never merge today\'s whole districts by presumed parent. Preserve station membership, original counts, special units, nulls and definition breaks. Counts only; no modern population or area denominators.'
});
const [west, south, east, north] = turf.bbox(turf.featureCollection(features));
const project = ([lon, lat]) => [40 + (lon-west)/(east-west)*920, 40 + (north-lat)/(north-south)*790];
const svgPath = geometry => {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.map(polygon => polygon.map(ring => ring.map((coord, i) => `${i ? 'L' : 'M'}${project(coord).map(n => n.toFixed(2)).join(',')}`).join('') + 'Z').join('')).join('');
};
const labels = features.filter(f => f.properties.territorial).map(f => {
  const [x, y] = project(turf.pointOnFeature(f).geometry.coordinates);
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" style="font:14px system-ui;fill:#10292f;paint-order:stroke;stroke:white;stroke-width:3;pointer-events:none">${f.properties.name}</text>`;
}).join('');
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Delhi historical police districts — 2014 reference preview</title>
<style>body{font:16px system-ui;margin:0;background:#f5f4f0;color:#202b31}main{max-width:1200px;margin:auto;padding:28px}h1{font-size:30px;margin-bottom:8px}.note{padding:16px;border-left:4px solid #a36b20;background:#fff8e9;line-height:1.5}.layout{display:grid;grid-template-columns:minmax(0,2fr) minmax(270px,1fr);gap:24px;margin-top:24px}svg{width:100%;background:white;border:1px solid #ccc;border-radius:10px}.district{stroke:#fff;stroke-width:1.5;cursor:pointer;fill-rule:evenodd}.district:hover,.district:focus{stroke:#111;stroke-width:3;outline:none}label{font-weight:600}select{padding:9px;font:inherit;margin:8px}table{border-collapse:collapse;width:100%;background:white}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}td:last-child,th:last-child{text-align:right}a{color:#125f83}.small{font-size:14px;line-height:1.5}.legend{display:flex;align-items:center;gap:8px;margin:8px 0}.ramp{display:inline-block;background:linear-gradient(90deg,#e5f0f1,#146c79);width:150px;height:12px}.selected{font-weight:700;background:#dceff1}footer{margin-top:24px}@media(max-width:750px){.layout{grid-template-columns:1fr}main{padding:16px}}</style>
</head><body><main><p>HISTORICAL MAP · REVIEW PREVIEW</p><h1>Delhi’s earlier police districts</h1><p>2014 reference reconstruction · 11 territorial districts · registered cases, counts not rates</p>
<div class="note"><strong>Reference map, awaiting boundary verification.</strong> Station polygons preserved in May 2014 are grouped using the official December 2014 station roster. Their exact effective date and changes between those dates remain unverified. The archived shapes also contain overlaps, including ${ (districtOverlap / 1e6).toFixed(2) } km² between reconstructed districts. This map is separate from the dashboard and is not enabled for other years.</div>
<p>Earlier districts cover areas that later became separate districts. For example, the 2014 South-West district includes Dwarka North and South stations; Uttam Nagar is in 2014 West. Later reorganisations must be reconstructed separately.</p>
<label for="metric">2014 crime measure</label><select id="metric"><option value="theft">Theft</option><option value="robbery">Robbery</option><option value="total_ipc">Total IPC</option><option value="criminal_trespass_burglary_revised_definition">Criminal trespass/burglary — 2014 definition</option></select>
<div class="layout"><section aria-label="Historical district map"><svg viewBox="0 0 1000 870" role="group" aria-label="2014 reference police district map">${features.map((f, i) => `<path class="district" tabindex="0" role="button" data-index="${i}" d="${svgPath(f.geometry)}"><title></title></path>`).join('')}${labels}</svg><div class="legend">Lower <span class="ramp"></span> Higher <span id="range"></span></div><p class="small">Airport jurisdiction is shown separately in grey and excluded from the territorial colour scale. Railway, Metro and specialised units have no territorial polygon here; they remain in the source tables.</p></section><section><h2 id="detail">Explore a district</h2><p id="description" aria-live="polite">Select a shape or use the table. No values are redistributed to later districts.</p><table><thead><tr><th>2014 reporting district</th><th id="measure">Cases</th></tr></thead><tbody id="rows"></tbody></table></section></div>
<footer class="small"><p>Definition warning: the revised 2014 NCRB categories are retained as printed. No cross-year trend or modern population/area rates are calculated. A missing source value stays unavailable.</p><p><a href="manifest.json">Source manifest</a> · <a href="districts_2014_reference.geojson">Download reference boundaries and counts</a> · <a href="validation.json">Validation</a> · <a href="README.md">Scope and remaining work</a></p></footer></main>
<script>const features=${JSON.stringify(features.map(f => f.properties)).replace(/</g,'\\u003c')};const metric=document.getElementById('metric');const number=n=>n==null?'Unavailable':n.toLocaleString('en-IN');let selected=null;function detail(i){selected=i;const f=features[i];document.getElementById('detail').textContent=f.name+' · 2014';document.getElementById('description').textContent=metric.selectedOptions[0].text+': '+number(f.counts[metric.value])+' registered cases. '+f.stationCount+' archived station polygons. Original NCRB row '+f.sourceRow+'.';document.querySelectorAll('#rows tr').forEach(r=>r.classList.toggle('selected',+r.dataset.index===i));}function render(){const values=features.filter(f=>f.territorial).map(f=>f.counts[metric.value]).filter(n=>n!=null);const low=Math.min(...values),high=Math.max(...values);document.getElementById('range').textContent=number(low)+'–'+number(high);document.querySelectorAll('.district').forEach((p,i)=>{const f=features[i],n=f.counts[metric.value],t=high===low?.5:(n-low)/(high-low);p.style.fill=!f.territorial||n==null?'#c9cdd0':'hsl(188 55% '+(94-63*t)+'%)';const label=f.name+': '+number(n)+' cases';p.setAttribute('aria-label',label);p.querySelector('title').textContent=label;});document.getElementById('rows').innerHTML=features.map((f,i)=>'<tr data-index="'+i+'"><td><button type="button" data-index="'+i+'">'+f.name+(f.territorial?'':' (separate)')+'</button></td><td>'+number(f.counts[metric.value])+'</td></tr>').join('');document.querySelectorAll('#rows button').forEach(b=>b.onclick=()=>detail(+b.dataset.index));if(selected!=null)detail(selected);}document.querySelectorAll('.district').forEach((p,i)=>{p.onclick=()=>detail(i);p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();detail(i);}};});metric.onchange=render;render();</script></body></html>`;
fs.writeFileSync(path.join(base, 'preview.html'), html);
console.log('Built 2014 reference preview: 163 stations, 11 territorial districts + airport; other years disabled.');
