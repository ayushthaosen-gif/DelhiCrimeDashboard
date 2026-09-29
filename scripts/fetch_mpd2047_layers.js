// Fetch Master Plan for Delhi 2047 layers from DDA's own ArcGIS Enterprise portal as GeoJSON.
//
// Why this exists: MPD-2047's planned land use is published as queryable vector feature layers at
// gis.dda.org.in, not only as the PDF land-use sheet. That makes a real planned-vs-current
// comparison possible instead of a georeferencing exercise. Service discovery path, for the
// record: the portal app ids on dda.gov.in/master_plan_2047 resolve through
// /portal/sharing/rest/content/items/<appid>/data to webmap 053662f0b0b54236be04500bf408b04a,
// whose operationalLayers carry these FeatureServer URLs.
//
// Two things this script is careful about:
//   * Pagination is ordered by objectid. ArcGIS pagination without an explicit sort is not
//     guaranteed stable across requests, so an unordered page walk can silently duplicate or skip
//     features -- which would corrupt any area total computed from the result.
//   * Geometry is requested with outSR=4326. The layers are stored in UTM 43N (wkid 32643);
//     asking the server to reproject avoids doing it here and getting the datum shift wrong.
//
// This writes raw snapshots only. It does not touch dashboard data or any generated HTML.

const fs = require('fs');
const path = require('path');

const LAYERS = [
  {
    id: 'landuse_2047',
    name: 'LANDUSE 2047',
    url: 'https://gis.dda.org.in/server/rest/services/Hosted/MASTER_PLAN_OF_DELHI_2047/FeatureServer/8',
    out: 'data/source/mpd2047_landuse_raw.geojson',
    fields: 'objectid,use_zones,usepremise,code_premi,luse2041,zone,remarks',
  },
  {
    id: 'zone_boundary_2047',
    name: 'ZONE BOUNDARY',
    url: 'https://gis.dda.org.in/server/rest/services/Hosted/MASTER_PLAN_OF_DELHI_2047/FeatureServer/1',
    out: 'data/source/mpd2047_zone_boundary_raw.geojson',
    fields: '*',
  },
];

const PAGE = 150; // object-id batch size; keeps the objectIds= query string well under URL limits

async function getJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'DelhiCrimeDashboard-mpd2047-fetch/1.0 (+https://github.com/ayushthaosen-gif/DelhiCrimeDashboard)' },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
  return res.json();
}

async function countOf(layer) {
  const u = layer.url + '/query?where=1%3D1&returnCountOnly=true&f=json';
  const j = await getJson(u);
  if (typeof j.count !== 'number') throw new Error('No count returned for ' + layer.id);
  return j.count;
}

async function fetchLayer(layer) {
  const expected = await countOf(layer);

  // Deliberately NOT using resultOffset pagination. This service returns overlapping pages when
  // offsets are combined with a sort -- walking it that way yielded 864 unique features out of
  // 4722, silently dropping four fifths of the plan. Enumerating object ids first and then asking
  // for explicit id batches is deterministic: every feature is requested exactly once, and the
  // id list itself is the checksum.
  const ids = (await getJson(layer.url + '/query?where=1%3D1&returnIdsOnly=true&f=json')).objectIds || [];
  if (ids.length !== expected) {
    throw new Error(layer.id + ': id list has ' + ids.length + ' ids but count says ' + expected);
  }
  const unique = new Set(ids);
  if (unique.size !== ids.length) throw new Error(layer.id + ': service returned duplicate object ids');

  // No de-duplication here, deliberately. The id walk already requests each feature exactly once,
  // and the obvious-looking key is a trap: this layer's real OID field is `fid`, while `objectid`
  // is an ordinary non-unique integer attribute. De-duplicating on `objectid` collapses distinct
  // polygons that happen to share a value -- it silently reduced 4722 features to 864.
  const features = [];
  for (let i = 0; i < ids.length; i += PAGE) {
    const batch = ids.slice(i, i + PAGE);
    const u = layer.url + '/query'
      + '?objectIds=' + batch.join(',')
      + '&outFields=' + encodeURIComponent(layer.fields)
      + '&returnGeometry=true&outSR=4326&f=geojson';
    const page = await getJson(u);
    if (page.error) {
      throw new Error(layer.id + ': service error ' + page.error.code + ' -- ' + page.error.message);
    }
    const got = page.features || [];
    if (got.length !== batch.length) {
      throw new Error(layer.id + ': asked for ' + batch.length + ' ids but got ' + got.length
        + ' features. Refusing to write a snapshot with a gap in it.');
    }
    for (const f of got) features.push(f);
    process.stdout.write('  ' + layer.id + ': ' + features.length + '/' + expected + '\r');
  }
  process.stdout.write('\n');
  if (features.length !== expected) {
    throw new Error(layer.id + ': got ' + features.length + ' features but the service reports '
      + expected + '. Refusing to write a partial snapshot.');
  }
  const withoutGeometry = features.filter(f => !f.geometry || !f.geometry.coordinates).length;
  if (withoutGeometry) console.log('  note: ' + withoutGeometry + ' feature(s) came back without geometry');
  return { expected, features };
}

// The service's own uniqueValue renderer is the authoritative codebook for use_zones, so capture
// it alongside the geometry rather than transcribing labels by hand. Worth noting the codes are
// not guessable: RF is "FOREIGN MISSION", not a river front, and A1 -- the second largest category
// by area -- has no entry in the renderer at all, so it stays explicitly undecoded here instead of
// being assigned a plausible-sounding meaning.
async function fetchLegend(layer) {
  const meta = await getJson(layer.url + '?f=json');
  const r = meta && meta.drawingInfo && meta.drawingInfo.renderer;
  if (!r || !Array.isArray(r.uniqueValueInfos)) return null;
  const codebook = {};
  for (const info of r.uniqueValueInfos) {
    if (info.value != null) codebook[String(info.value)] = info.label == null ? null : String(info.label);
  }
  return { field: r.field1 || null, codebook };
}

(async () => {
  const provenance = [];
  for (const layer of LAYERS) {
    console.log('Fetching ' + layer.name + ' ...');
    const legend = await fetchLegend(layer);
    const { expected, features } = await fetchLayer(layer);
    const out = {
      type: 'FeatureCollection',
      metadata: {
        title: 'Master Plan for Delhi 2047 -- ' + layer.name,
        agency: 'Delhi Development Authority',
        service_url: layer.url,
        retrieved_at: new Date().toISOString(),
        stored_spatial_reference: 'EPSG:32643 (WGS 1984 UTM Zone 43N)',
        delivered_spatial_reference: 'EPSG:4326 (requested via outSR)',
        feature_count: features.length,
        service_reported_count: expected,
        pagination: 'ordered by objectid ASC, page size ' + PAGE + ', objectid-deduplicated',
        plan_status: 'MPD-2047 approved by DDA 2026-08-12 and notified by MoHUA as an extensive modification of MPD-2021.',
        coverage_caveat: 'Planned land use as published by DDA. It is a statutory plan, not a survey of what exists on the ground, and must not be read as current land use.',
        geography_caveat: 'Organised by DDA planning zones (for example P-I, L, N), which are not the 15 Delhi Police districts this dashboard is built on. Any attribution to a police district or MCD ward has to come from an explicit areal intersection, never a name match.',
        attribution: 'Delhi Development Authority, Master Plan for Delhi 2047 GIS portal (gis.dda.org.in)',
        legend_field: legend ? legend.field : null,
        legend: legend ? legend.codebook : null,
        legend_note: legend
          ? 'Taken verbatim from the service\'s uniqueValue renderer. Any use_zones value present in the data but absent from this codebook is deliberately left undecoded -- notably A1, which is the second largest category by area.'
          : 'This layer publishes no uniqueValue renderer, so no codebook was captured.',
      },
      features,
    };
    fs.mkdirSync(path.dirname(layer.out), { recursive: true });
    fs.writeFileSync(layer.out, JSON.stringify(out) + '\n');
    const kb = (fs.statSync(layer.out).size / 1024).toFixed(1);
    console.log('Wrote ' + layer.out + ' -- ' + features.length + ' features, ' + kb + ' KB');
    provenance.push({ id: layer.id, count: features.length, file: layer.out });
  }
  console.log('\nDone: ' + provenance.map(p => p.id + '=' + p.count).join(', '));
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });
