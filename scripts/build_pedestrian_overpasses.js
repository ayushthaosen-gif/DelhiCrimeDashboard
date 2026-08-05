const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const rawPath = path.join(ROOT, 'data/source/osm_pedestrian_overpasses_delhi_raw.json');
const boundaryPath = path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson');
const outputPath = path.join(ROOT, 'data/delhi_pedestrian_overpasses_osm.geojson');
const dashboardPath = path.join(ROOT, 'data/dashboard_final.json');
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8').replace(/^\uFEFF/, ''));
const boundaries = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));
const nodeById = new Map(raw.elements.filter(e => e.type === 'node').map(n => [n.id, n]));
const ways = raw.elements.filter(e => e.type === 'way' && Array.isArray(e.nodes));
const parent = ways.map((_, i) => i);
function find(i){ while(parent[i] !== i){ parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
function join(a,b){ a=find(a); b=find(b); if(a!==b) parent[b]=a; }
const nodeOwners = new Map();
ways.forEach((w,i)=>w.nodes.forEach(n=>{ if(nodeOwners.has(n)) join(i,nodeOwners.get(n)); else nodeOwners.set(n,i); }));
const groups = new Map();
ways.forEach((w,i)=>{ const r=find(i); if(!groups.has(r)) groups.set(r,[]); groups.get(r).push(w); });
function pointInRing(lon,lat,ring){ let inside=false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1]; const hit=((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi); if(hit) inside=!inside;} return inside; }
function pointInGeometry(lon,lat,g){ const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates; return polys.some(p=>pointInRing(lon,lat,p[0])&&!p.slice(1).some(r=>pointInRing(lon,lat,r))); }
function hav(a,b){const R=6371000,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p; const q=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2; return 2*R*Math.asin(Math.sqrt(q));}
let components=[...groups.values()].map(ws=>{const ids=[...new Set(ws.flatMap(w=>w.nodes))]; const ns=ids.map(id=>nodeById.get(id)).filter(Boolean); const named=ws.find(w=>w.tags&&w.tags.name); return {ways:ws,nodes:ns,lat:ns.reduce((a,n)=>a+n.lat,0)/ns.length,lon:ns.reduce((a,n)=>a+n.lon,0)/ns.length,name:named?.tags?.name||null};}).filter(x=>Number.isFinite(x.lat));
let merged=true;
while(merged){ merged=false; outer: for(let i=0;i<components.length;i++) for(let j=i+1;j<components.length;j++){ if(hav(components[i],components[j])<=45){ const ways=[...components[i].ways,...components[j].ways], nodes=[...components[i].nodes,...components[j].nodes]; components[i]={ways,nodes,lat:nodes.reduce((a,n)=>a+n.lat,0)/nodes.length,lon:nodes.reduce((a,n)=>a+n.lon,0)/nodes.length,name:components[i].name||components[j].name}; components.splice(j,1); merged=true; break outer; } } }
const features=[];
for(const c of components){const boundary=boundaries.features.find(f=>pointInGeometry(c.lon,c.lat,f.geometry)); if(!boundary) continue; const ids=c.ways.map(w=>w.id).sort((a,b)=>a-b); const tags=Object.assign({},...c.ways.map(w=>w.tags||{})); features.push({type:'Feature',properties:{name:c.name||'Unnamed mapped pedestrian bridge',district:boundary.properties.district,osmWayIds:ids,osmUrl:'https://www.openstreetmap.org/way/'+ids[0],highway:tags.highway||null,bridge:tags.bridge||'yes',wheelchair:tags.wheelchair||null,lit:tags.lit||null,source:'OpenStreetMap contributors',sourceSnapshot:'2026-08-04',coverageNote:'Mapped OSM features only; absence does not prove no bridge exists.'},geometry:{type:'Point',coordinates:[+c.lon.toFixed(7),+c.lat.toFixed(7)]}});}
features.sort((a,b)=>a.properties.district.localeCompare(b.properties.district)||a.properties.name.localeCompare(b.properties.name));
const out={type:'FeatureCollection',metadata:{title:'Delhi mapped pedestrian bridges and overpasses',source:'OpenStreetMap contributors',sourceUrl:'https://www.openstreetmap.org/copyright',query:'highway=footway|path|steps + bridge=yes|footbridge; connected segments merged; centroids filtered to dashboard district polygons',snapshotDate:'2026-08-04',coverageCaveat:'This is a mapped-feature inventory, not an official completeness register. Unmapped structures are absent.'},features};
fs.writeFileSync(outputPath,JSON.stringify(out,null,2)+'\n');
const dashboard=JSON.parse(fs.readFileSync(dashboardPath,'utf8')); const counts={}; features.forEach(f=>counts[f.properties.district]=(counts[f.properties.district]||0)+1); dashboard.districts.forEach(d=>{d.pedestrianOverpasses=counts[d.district]||0; d.pedestrianOverpassDensity=Math.round((d.pedestrianOverpasses/d.areaSqKm)*100)/100;}); fs.writeFileSync(dashboardPath,JSON.stringify(dashboard,null,1)+'\n');
console.log('Mapped pedestrian bridge groups:',features.length); console.log(counts);

