// Fetches DDA's public settlement layers (existing, mostly residential, built-up areas that OpenStreetMap rarely tags with land use):
//   Lal Dora (village settlement areas), PM-UDAY unauthorised colonies (two layers), JJ clusters.
// Source: Delhi Development Authority GIS server (gis.dda.org.in), the same server the Master Plan 2047 layers come from.
// These are boundaries only (a few MB). Attribution: Delhi Development Authority.
//
//   node scripts/fetch_dda_settlement_layers.js
//
// Output: data/source/dda_settlements/<name>.geojson and manifest.json

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data/source/dda_settlements');
const BASE = 'https://gis.dda.org.in/server/rest/services/Hosted';

const LAYERS = [
  { name: 'laldora', title: 'Lal Dora (village settlement areas)', url: BASE + '/MASTER_PLAN_OF_DELHI_2047/FeatureServer/7', fields: 'zone,dist_nm,type,village' },
  { name: 'pm_uday_unauthorised_colony_boundary', title: 'PM-UDAY unauthorised colony boundaries', url: BASE + '/Pm_Uday_Unauthorized_Colony/FeatureServer/0', fields: 'un_col_id,un_col_nm,dist_nm,status' },
  { name: 'pm_uday_colonies_1511', title: 'PM-UDAY colonies (1511 list)', url: BASE + '/1511_PM_UDAY_Colonies/FeatureServer/0', fields: 'un_col_id,un_col_nm,dist_nm,status' },
  { name: 'jj_clusters', title: 'JJ clusters (slum settlements)', url: BASE + '/JJ_cluster/FeatureServer/0', fields: 'code,location,hh,land_statu' }
];

async function fetchAll(layer) {
  const features = [];
  for (let offset = 0; ; offset += 2000) {
    const q = `${layer.url}/query?where=1%3D1&outFields=${layer.fields}&outSR=4326&geometryPrecision=6&f=geojson&resultOffset=${offset}&resultRecordCount=2000`;
    const res = await fetch(q, { headers: { 'User-Agent': 'DelhiCrimeDashboard/1.0 (research; github.com/ayushthaosen-gif/DelhiCrimeDashboard)' } });
    if (!res.ok) throw new Error(layer.name + ' HTTP ' + res.status);
    const j = await res.json();
    features.push(...(j.features || []));
    if (!j.exceededTransferLimit && (j.features || []).length < 2000) break;
  }
  return features;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = { source: 'Delhi Development Authority GIS server (gis.dda.org.in)', retrieved_at: new Date().toISOString(), layers: [] };
  for (const layer of LAYERS) {
    const features = await fetchAll(layer);
    const file = path.join(OUT, layer.name + '.geojson');
    fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', name: layer.title, features }));
    manifest.layers.push({ name: layer.name, title: layer.title, service_url: layer.url, features: features.length, bytes: fs.statSync(file).size });
    console.log(layer.name, features.length, 'features', (fs.statSync(file).size / 1e6).toFixed(2), 'MB');
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
