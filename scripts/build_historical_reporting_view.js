// Separate original reporting units from the current district/infrastructure model.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const DIR = 'data/historical_reporting/';
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, p))).digest('hex');
const canonical = s => s.toLowerCase().replace(/[^a-z]/g, '');
const TERRITORIAL = new Set(['Central','East','New Delhi','North','North-East','North-West','Outer','South','South-East','South-West','West'].map(canonical));
const blank = () => Object.fromEntries(['theft','robbery','burglary_old_definition','criminal_trespass_burglary_revised_definition','burglary','total_ipc','total_sll','total_crimes_against_women','total_crimes_in_which_women_was_victim'].map(k => [k, null]));
function build() {
  const inputs = new Set();
  const load = p => { inputs.add(p); return read(p); };
  const hist = 'data/releases/historical_2011_2015/';
  const city = load(hist + 'citywide_crime.json');
  const years = [];
  for (let year = 2011; year <= 2015; year++) {
    const file = hist + `as_printed/ncrb_${year}_${year < 2014 ? '1_14' : 'ipc'}.json`;
    const ipc = load(file);
    const tables = year < 2014 ? [] : ['sll','women'].map(kind => ({file: hist + `as_printed/ncrb_${year}_${kind}.json`, kind}));
    const extras = tables.map(t => ({...t, table: load(t.file)}));
    const units = ipc.reporting_units.map(row => {
      const values = {...blank(), ...row.selected_metrics};
      const evidence = [{path: file, sourceLabel: row.reporting_unit_label, sourceRow: row.source_row ?? null, sourceSerial: row.source_serial, sourcePdfPages: row.source_pdf_pages ?? null}];
      for (const extra of extras) {
        const matching = extra.table.reporting_units.filter(r => canonical(r.reporting_unit_label) === canonical(row.reporting_unit_label));
        assert.equal(matching.length, 1, `Nonunique source identity ${year} ${row.reporting_unit_label}`);
        Object.assign(values, matching[0].selected_metrics);
        evidence.push({path: extra.file, sourceLabel: matching[0].reporting_unit_label, sourceRow: matching[0].source_row, sourceSerial: matching[0].source_serial});
      }
      return {label: row.reporting_unit_label, territorial: TERRITORIAL.has(canonical(row.reporting_unit_label)), values, evidence};
    });
    assert.equal(units.filter(r => r.territorial).length, 11);
    const summary = city.find(r => r.reference_year === year);
    years.push({year, units, territorialCount: 11, citywide: {values: {...blank(), ...Object.fromEntries(Object.keys(blank()).map(k => [k, summary[k] ?? null]))}, scope: summary.geography_scope, evidence: summary.source_paths},
      notes: summary.definition_notes,
      sourceLabel: 'NCRB original-year district tables, as printed',
      map: year === 2014 ? {status: 'reference_only', referenceYear: 2014, path: 'data/staged/police_geography_history/districts_2014_reference.geojson'} : {status: 'boundary_unverified', referenceYear: null, path: null},
      comparability: 'Separate annual reporting units. No cross-year district trend, growth rate or geographic allocation is inferred.'});
  }
  for (const year of [2016,2017,2018]) {
    const file = `data/releases/${year}/district_crime.json`;
    const records = load(file);
    const units = records.filter(r => r.district_existed_as_separate_reporting_zone).map(row => ({
      label: row.district, territorial: true,
      values: {...blank(), theft: row.theft, robbery: row.robbery, burglary: row.burglary, total_ipc: row.total_ipc_bns, total_sll: row.total_sll, total_crimes_against_women: row.crime_against_women},
      evidence: [{path: file, sourceLabel: row.district, coverage: row.coverage}],
      nullReason: row.null_reason || null
    }));
    assert.equal(units.length, year === 2016 ? 11 : 14);
    years.push({year, units, territorialCount: units.length, citywide: {values: blank(), scope: 'No independently extracted Delhi UT aggregate in this selected release. Territorial rows are not summed into a citywide total.', evidence: []},
      notes: year === 2016 ? ['The existing verified extract supplies theft and robbery. Burglary, total IPC, SLL and crimes-against-women aggregates remain null because of incompatible source definitions/schema.', 'The October 2016 reorganisation creates a transition-year boundary question. Eleven names in the annual extract do not certify an unchanged 2014 footprint.'] : ['These values are from the existing verified NCRB/India Data Portal series. IPC, SLL and crimes-against-women totals use its validated reconstruction method; they are not new original-table transcriptions.', 'Fourteen territorial units are separately reported. Outer North is absent as a reporting unit; no empty modern Outer North row is added.', 'Dwarka was notified in November 2017 and operational in December 2017. The full-year reporting basis must be established before mapping the annual count.'],
      sourceLabel: 'Existing verified NCRB / India Data Portal extract',
      map: {status: 'boundary_unverified', referenceYear: null, path: null},
      comparability: 'No cross-year district change or present-day area/population rates; transition-year geography requires source verification.'});
  }
  const geometry = load('data/staged/police_geography_history/districts_2014_reference.geojson');
  const quality = load('data/staged/police_geography_history/validation.json');
  const payload = {schemaVersion: '1.0.0', years, policy: {countsOnly: true, currentDistrictAllocation: false, currentInfrastructureJoin: false, annualBoundariesVerified: false, nullMeans: 'Unavailable from the selected source or definition incompatible; never zero.'}};
  fs.mkdirSync(path.join(ROOT, DIR), {recursive: true});
  fs.writeFileSync(path.join(ROOT, DIR, 'counts_2011_2018.json'), JSON.stringify(payload, null, 2) + '\n');
  const manifest = {schemaVersion:'1.0.0', title:'Historical reporting view, 2011–2018', status:'reference_view', dashboardLinked:true, currentDistrictMapIntegrated:false, productionReady:false, referenceYears:years.map(y=>y.year), geography:'Original annual reporting-unit labels; specialised units separate. No crosswalk to current districts.', mapCoverage:years.map(y=>({year:y.year,...y.map})), sourceInputs:[...inputs].map(p=>({path:p,sha256:hash(p)})), definitionPolicy:'Old burglary (2011–2013), revised criminal trespass/burglary (2014–2015), and the later burglary series remain separate. Missing aggregates remain null.', sourcesManifest:'data/staged/history_2011_2015/manifest.json', existingSeriesSource:'data/delhi_crime_2016_2021_verified.json', mapManifest:'data/staged/police_geography_history/manifest.json', generatedBy:'scripts/build_historical_reporting_view.js'};
  fs.writeFileSync(path.join(ROOT, DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const features = geometry.features;
  const coords = features.flatMap(f => f.geometry.type === 'Polygon' ? f.geometry.coordinates.flat() : f.geometry.coordinates.flat(2));
  const xs = coords.map(p=>p[0]), ys=coords.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const project=([x,y])=>[25+(x-minX)/(maxX-minX)*950,25+(maxY-y)/(maxY-minY)*800];
  const shape=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p.map(r=>r.map((xy,i)=>(i?'L':'M')+project(xy).map(n=>n.toFixed(2)).join(',')).join('')+'Z').join('')).join('');
  const paths=features.map((f,i)=>`<path tabindex="0" role="button" data-i="${i}" d="${shape(f.geometry)}"><title></title></path>`).join('');
  const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Delhi historical crime · 2011–2018</title><style>
  :root{font-family:system-ui;color:#243036;background:#f5f4ef}body{margin:0}main{max-width:1160px;margin:auto;padding:28px}a{color:#0c6078}h1{font-size:clamp(27px,4vw,42px);margin-bottom:8px}p{line-height:1.55}.controls{display:flex;gap:20px;flex-wrap:wrap;margin:24px 0}label{font-weight:650}select{display:block;font:inherit;padding:10px;max-width:100%;margin-top:6px}.note{border-left:4px solid #a26f2b;background:#fff7e5;padding:14px 18px;margin:18px 0}.layout{display:grid;grid-template-columns:1fr 1fr;gap:24px}.panel{background:white;border:1px solid #d2d7d5;border-radius:12px;padding:18px}.empty{padding:25px 10px;line-height:1.65}.stat{font-size:30px;font-weight:700}.small{font-size:14px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border-bottom:1px solid #dce0dc;padding:10px 6px}td:nth-child(2),th:nth-child(2){text-align:right}td:last-child{font-size:13px}caption{text-align:left;font-size:21px;font-weight:650;padding-bottom:14px}.scroll{overflow:auto}button{font:inherit;cursor:pointer}.map{width:100%;height:auto}.map path{stroke:white;stroke-width:1.3;fill-rule:evenodd;cursor:pointer}.map path:focus,.map path:hover{stroke:#102c33;stroke-width:4;outline:none}.map-note{padding:10px;background:#fff6de}.legend{height:12px;background:linear-gradient(90deg,#e9f4f4,#146b76);margin:10px 0}footer{margin-top:28px}li{line-height:1.5;margin-bottom:8px}[hidden]{display:none!important}@media(max-width:800px){.layout{grid-template-columns:1fr}main{padding:16px}}
  </style></head><body><main><nav><a href="delhi_safety_dashboard.html">← Dashboard</a> · <a href="interactive_map.html">Current district map</a></nav><p class="small">HISTORICAL REPORTING VIEW · COUNTS, NOT RATES</p><h1>Delhi crime, as reported at the time</h1><p>Use the districts and offence definitions printed for each year. Later districts are not inserted as empty rows, and older totals are not distributed across today's boundaries.</p>
  <div class="controls"><label>Reporting year<select id="year">${years.map(y=>`<option value="${y.year}">${y.year}</option>`).join('')}</select></label><label>Crime measure<select id="metric"></select></label></div>
  <div id="coverage" class="note" aria-live="polite"></div><div class="layout"><section class="panel"><h2 id="mapTitle">Historical district map</h2><div id="mapMissing" class="empty"></div><div id="mapReference" hidden><p class="map-note">2014 reference reconstruction, not certified annual boundaries. May 2014 station shapes are grouped using the December 2014 roster. Shapes overlap by about ${quality.reconstructedDistrictOverlapSqKm.toFixed(2)} km² across districts; effective date and reuse terms remain unresolved.</p><svg class="map" viewBox="0 0 1000 850" role="group" aria-label="2014 reference police districts">${paths}</svg><div class="legend"></div><p class="small" id="mapRange"></p><p id="mapDetail" aria-live="polite">Select a shape to identify its reporting district.</p><p class="small">Airport is separate and grey; it is not included in the territorial colour scale.</p></div><p class="small"><a href="data/staged/police_geography_history/README.md">Boundary evidence and gaps</a> · <a href="data/staged/police_geography_history/preview.html">2014 reference map details</a></p></section><section class="panel"><h2>Delhi UT citywide total</h2><div class="stat" id="cityCount"></div><p id="cityScope" class="small"></p><h2>Definitions and comparability</h2><ul id="notes"></ul><p class="small">No year-to-year growth, current population/area rate or modern infrastructure comparison is calculated here. Missing source values remain unavailable.</p></section></div>
  <section class="panel scroll" style="margin-top:24px"><table><caption id="districtCaption">Original territorial reporting units</caption><thead><tr><th scope="col">Source reporting-unit label</th><th scope="col">Registered cases</th><th scope="col">Evidence</th></tr></thead><tbody id="territorialRows"></tbody></table></section>
  <section class="panel scroll" id="specialPanel" style="margin-top:24px"><table><caption>Specialised and other reporting units · separate from territorial districts</caption><thead><tr><th scope="col">Source reporting-unit label</th><th scope="col">Registered cases</th><th scope="col">Evidence</th></tr></thead><tbody id="specialRows"></tbody></table></section><p id="specialGap" class="small" hidden>Specialised-unit rows are not supplied in this selected verified extract. They are not assumed to be zero.</p>
  <footer class="small"><p><button id="download" type="button">Download selected-year counts (JSON)</button> · <a href="data/historical_reporting/counts_2011_2018.json">All eight years</a> · <a href="data/historical_reporting/manifest.json">Source manifest</a> · <a href="data/releases/historical_2011_2015/README.md">2011–2015 original table release</a></p><p>2011–2015 uses original-year NCRB table extracts, including separate Delhi UT summaries. 2016–2018 uses the existing verified NCRB / India Data Portal series. Source quality, publication dates and reuse limitations remain in their manifests.</p></footer></main><script>
  const REPORTING=${safeJSON(payload)};
  const MAP_UNITS=${safeJSON(features.map(f=>f.properties))};
  const yearEl=document.getElementById('year'),metricEl=document.getElementById('metric');
  const params=new URLSearchParams(location.search);const requested=Number(params.get('year'));yearEl.value=REPORTING.years.some(y=>y.year===requested)?String(requested):'2014';
  const fmt=n=>n==null?'Unavailable':n.toLocaleString('en-IN');const canon=s=>s.toLowerCase().replace(/[^a-z]/g,'');const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function selectedYear(){return REPORTING.years.find(y=>y.year===Number(yearEl.value));}
  function measures(y){return [['theft','Theft'],['robbery','Robbery'],[y<2014?'burglary_old_definition':y<2016?'criminal_trespass_burglary_revised_definition':'burglary',y<2014?'Burglary · original 2011–2013 head':y<2016?'Criminal Trespass/Burglary · revised 2014–2015 head':'Burglary · later series'],['total_ipc','Total cognizable IPC crime'],['total_sll','Total cognizable SLL crime'],['total_crimes_against_women','Total crimes against women'],...(y<2016?[['total_crimes_in_which_women_was_victim','Total crimes in which women was victim · separate printed head']]:[])];}
  function setMeasures(wanted){const y=Number(yearEl.value);const options=measures(y);if(wanted==='totalIPC')wanted='total_ipc';if(wanted==='totalSLL')wanted='total_sll';if(wanted==='crimeAgainstWomen')wanted='total_crimes_against_women';if(['burglary','burglary_old_definition','criminal_trespass_burglary_revised_definition'].includes(wanted))wanted=options[2][0];metricEl.innerHTML=options.map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('');metricEl.value=options.some(([k])=>k===wanted)?wanted:'theft';}
  function evidence(r){return r.evidence.map(e=>'<a href="'+esc(e.path)+'">'+esc(e.sourceLabel)+(e.sourceRow?' · row '+e.sourceRow:e.sourceSerial?' · serial '+e.sourceSerial:'')+'</a>').join('<br>');}
  function renderRows(rows){return rows.map(r=>'<tr><th scope="row">'+esc(r.label)+'</th><td>'+fmt(r.values[metricEl.value])+'</td><td>'+evidence(r)+'</td></tr>').join('');}
  function render(){const d=selectedYear(),key=metricEl.value,territorial=d.units.filter(r=>r.territorial),special=d.units.filter(r=>!r.territorial);document.getElementById('coverage').textContent=d.year+' · '+d.territorialCount+' territorial reporting districts'+(special.length?' + '+special.length+' other units':'')+' · '+d.sourceLabel+'. Counts only; no current-district allocation.';document.getElementById('districtCaption').textContent=d.year+' · '+d.territorialCount+' original territorial reporting units';document.getElementById('territorialRows').innerHTML=renderRows(territorial);document.getElementById('specialRows').innerHTML=renderRows(special);document.getElementById('specialPanel').hidden=!special.length;document.getElementById('specialGap').hidden=!!special.length;document.getElementById('cityCount').textContent=fmt(d.citywide.values[key]);document.getElementById('cityScope').textContent=d.citywide.scope+' This is separate from the territorial table, not a sum of displayed districts.';document.getElementById('notes').innerHTML=d.notes.map(n=>'<li>'+esc(n)+'</li>').join('');document.getElementById('mapReference').hidden=d.map.status!=='reference_only';document.getElementById('mapMissing').hidden=d.map.status==='reference_only';document.getElementById('mapTitle').textContent=d.map.status==='reference_only'?'2014 historical reference map':d.year+' · historical boundaries not yet verified';document.getElementById('mapMissing').textContent='The '+d.year+' counts are available below in their original reporting districts. A verified boundary set for that reporting period has not been recovered. Today’s district polygons are not coloured with these totals. The 2014 reference shapes are available separately; they are not substituted for this year.';document.getElementById('mapDetail').textContent='Select a shape to identify its reporting district.';
  if(d.map.status==='reference_only'){const values=territorial.map(r=>r.values[key]).filter(v=>v!=null),low=values.length?Math.min(...values):null,high=values.length?Math.max(...values):null;document.querySelectorAll('.map path').forEach((p,i)=>{const f=MAP_UNITS[i],r=d.units.find(r=>canon(r.label)===canon(f.name)),n=r?r.values[key]:null,t=high===low?.5:(n-low)/(high-low);p.style.fill=!f.territorial||n==null?'#c9cdd0':'hsl(188 55% '+(94-63*t)+'%)';const label=(r?r.label:f.name)+': '+fmt(n)+' registered cases';p.setAttribute('aria-label',label);p.querySelector('title').textContent=label;});document.getElementById('mapRange').textContent=values.length?'Territorial scale: '+fmt(low)+'–'+fmt(high)+' registered cases.':'This selected measure is unavailable; no colour scale is calculated.';}
  const url=new URL(location.href);url.search='';url.searchParams.set('year',String(d.year));url.searchParams.set('metric',key);history.replaceState(null,'',url);}
  document.querySelectorAll('.map path').forEach((p,i)=>{const show=()=>{if(selectedYear().year!==2014)return;const f=MAP_UNITS[i],r=selectedYear().units.find(r=>canon(r.label)===canon(f.name));document.getElementById('mapDetail').textContent=(r?r.label:f.name)+': '+fmt(r?r.values[metricEl.value]:null)+' registered cases ('+metricEl.selectedOptions[0].text+'), 2014. '+f.stationCount+' archived station polygons.';};p.onclick=show;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}};});
  yearEl.onchange=()=>{const prior=metricEl.value;setMeasures(prior);render();};metricEl.onchange=render;document.getElementById('download').onclick=()=>{const d=selectedYear();const blob=new Blob([JSON.stringify({year:d.year,metric:metricEl.value,definition:metricEl.selectedOptions[0].text,unit:'Registered cases; counts not rates',geographyPolicy:REPORTING.policy,mapStatus:d.map,citywide:d.citywide,reportingUnits:d.units},null,2)+'\\n'],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='delhi_historical_reporting_'+d.year+'.json';a.click();URL.revokeObjectURL(url);};setMeasures(params.get('metric'));render();
  </script></body></html>`;
  fs.writeFileSync(path.join(ROOT, 'historical_crime.html'), html);
  console.log('Built historical reporting view: 2011–2018; original units, counts only, 2014 reference geometry only.');
  return manifest;
}
if (require.main === module) build();
module.exports={build};
