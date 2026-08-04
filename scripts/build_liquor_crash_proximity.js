// Spatial proximity analysis between Delhi's official liquor vends and the 2024 named
// crash-prone zones. Every coordinate in both source datasets is an approximation (locality/
// sector centroids for vends, landmark/intersection centres for crash zones) -- NOT a verified
// vend entrance or an official Delhi Traffic Police geotag. Proximity therefore means broad
// spatial association only. This script and everything downstream of it must never imply
// causation between liquor vends and crashes.
//
// Uses @turf/turf for distance/point-in-polygon (npm install succeeded in this environment);
// see USE_TURF below for the manual haversine/ray-casting fallback this repo has already used
// three times this session (build_ward_infra.js, finalize_crash_zones_2024.js,
// build_interactive_map.js) if turf is ever unavailable in a future environment.
//
//   node scripts/build_liquor_crash_proximity.js

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let turf = null;
try { turf = require('@turf/turf'); } catch (e) { /* fall back below */ }
const USE_TURF = !!turf;
console.log('Spatial engine:', USE_TURF ? '@turf/turf' : 'manual haversine/point-in-ring fallback');

// ---- manual fallback (only used if turf isn't installed) ----
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function distanceMeters(lng1, lat1, lng2, lat2) {
  if (USE_TURF) return turf.distance(turf.point([lng1, lat1]), turf.point([lng2, lat2]), { units: 'meters' });
  return haversineMeters(lat1, lng1, lat2, lng2);
}
function pointInPolygon(lng, lat, polygonGeometry) {
  if (USE_TURF) return turf.booleanPointInPolygon(turf.point([lng, lat]), polygonGeometry);
  if (polygonGeometry.type === 'Polygon') return pointInRing(lng, lat, polygonGeometry.coordinates[0]);
  return false;
}

// ---- load source files ----
const vendsRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
const zonesRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8'));
const buffersRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_250m_buffers_approx.geojson'), 'utf8'));
const reportMetrics = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_report_relevant_metrics_2024.json'), 'utf8'));

// ---- normalize (plain object shapes -- see CLAUDE_CODE_IMPLEMENTATION_BRIEF.md's TS
// interfaces for the field-by-field spec; this repo has no TypeScript, so these are just
// documented object literals) ----
function normalizeVend(f, i) {
  const p = f.properties;
  const isOfficial = p.record_source !== 'OpenStreetMap'; // official DSCSC/DCCWS records carry
  // no record_source field at all; only OSM-sourced points do (confirmed against the source
  // data directly -- one OSM point has operator:"Delhi Tourism", which would misclassify as
  // official under a naive "operator is truthy" rule, so record_source is the reliable signal).
  return {
    id: f.id || ('vend-' + i),
    name: p.name || '(unnamed)',
    operator: p.operator || null,
    isOfficial,
    recordSource: isOfficial ? 'official' : 'OpenStreetMap',
    vendCategory: p.vend_category || null,
    licenceClass: p.licence_class || null,
    coordinateIsApproximate: p.coordinate_is_approximate !== false,
    coordinateConfidence: p.coordinate_confidence || (isOfficial ? null : 'high'),
    estimatedAccuracyM: p.estimated_accuracy_m ?? null,
    matchedArea: p.matched_area || null,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    properties: p, // original properties preserved verbatim
  };
}

function normalizeZone(f, i) {
  const p = f.properties;
  return {
    id: f.id || p.feature_id || ('zone-' + i),
    name: p.location_name,
    roadName: p.road_name || null,
    listedInMainTable: !!p.listed_in_table_6_29,
    simpleCrashes: p.all_simple_crashes ?? null,
    fatalCrashes: p.all_fatal_crashes ?? null,
    totalCrashes: p.all_total_crashes ?? null,
    personsKilled: p.blackspot_persons_killed ?? null,
    personsInjured: p.blackspot_persons_injured ?? null,
    blackspot: !!p.blackspot_2024,
    blackspotRank: p.blackspot_rank ?? null,
    pedestrianRisk: !!p.pedestrian_crash_prone,
    twoWheelerRisk: !!p.two_wheeler_crash_prone,
    htvRisk: !!p.htv_crash_prone,
    hitAndRunRisk: !!p.hit_and_run_crash_prone,
    nightRisk: !!p.night_time_crash_prone,
    dayRisk: !!p.day_time_crash_prone,
    cctvPriorityCandidate: !!p.cctv_priority_candidate,
    coordinateConfidence: p.coordinate_confidence || null,
    estimatedAccuracyM: p.estimated_accuracy_m ?? null,
    longitude: f.geometry.coordinates[0],
    latitude: f.geometry.coordinates[1],
    properties: p,
  };
}

const allVends = vendsRaw.features.map(normalizeVend);
const officialVends = allVends.filter(v => v.isOfficial);
const osmOnlyVends = allVends.filter(v => !v.isOfficial);
const allZones = zonesRaw.features.map(normalizeZone);

console.log('Loaded:', allVends.length, 'total vend records (', officialVends.length, 'official,', osmOnlyVends.length, 'OSM-only),', allZones.length, 'named crash zones');

const buffersByZoneId = {};
buffersRaw.features.forEach(f => { buffersByZoneId[f.properties.feature_id || f.id] = f.geometry; });

// ---- proximity confidence (verbatim from CLAUDE_CODE_IMPLEMENTATION_BRIEF.md; never returns
// "high" because crash-zone coordinates are never official Delhi Traffic Police geotags) ----
function getProximityConfidence(vend, zone, distanceM) {
  if (!vend.coordinateIsApproximate && zone.coordinateConfidence === 'high') {
    return distanceM <= 500 ? 'medium' : 'low';
  }
  const combinedAccuracy = (vend.estimatedAccuracyM ?? 2000) + (zone.estimatedAccuracyM ?? 1000);
  if (distanceM > combinedAccuracy * 2) return 'medium';
  return 'low';
}

const BANDS = [500, 1000, 2000];

// ---- per-vend proximity (official vends only, per the brief) ----
const vendProximity = officialVends.map(vend => {
  let nearest = null, nearestDist = Infinity;
  const distances = allZones.map(zone => {
    const d = distanceMeters(vend.longitude, vend.latitude, zone.longitude, zone.latitude);
    if (d < nearestDist) { nearestDist = d; nearest = zone; }
    return { zone, distance: d };
  });

  const within = {}; // band -> array of {zone, distance}
  BANDS.forEach(band => { within[band] = distances.filter(d => d.distance <= band); });

  const sumField = (list, field) => list.reduce((a, d) => a + (d.zone[field] ?? 0), 0);
  const countFlag = (list, flag) => list.filter(d => d.zone[flag]).length;

  const insideApprox250m = allZones.some(zone => {
    const poly = buffersByZoneId[zone.id];
    return poly && pointInPolygon(vend.longitude, vend.latitude, poly);
  });

  return {
    ...vend,
    analysisYear: 2024,
    nearestCrashZone: nearest ? nearest.name : null,
    nearestCrashZoneDistanceM: Number.isFinite(nearestDist) ? Math.round(nearestDist) : null,
    proximityConfidence: nearest ? getProximityConfidence(vend, nearest, nearestDist) : null,
    zonesWithin500m: within[500].length,
    zonesWithin1km: within[1000].length,
    zonesWithin2km: within[2000].length,
    fatalCrashesWithin500m: sumField(within[500], 'fatalCrashes'),
    fatalCrashesWithin1km: sumField(within[1000], 'fatalCrashes'),
    fatalCrashesWithin2km: sumField(within[2000], 'fatalCrashes'),
    totalCrashesWithin500m: sumField(within[500], 'totalCrashes'),
    totalCrashesWithin1km: sumField(within[1000], 'totalCrashes'),
    totalCrashesWithin2km: sumField(within[2000], 'totalCrashes'),
    blackspotsWithin1km: countFlag(within[1000], 'blackspot'),
    nightRiskZonesWithin1km: countFlag(within[1000], 'nightRisk'),
    hitAndRunZonesWithin1km: countFlag(within[1000], 'hitAndRunRisk'),
    pedestrianRiskZonesWithin1km: countFlag(within[1000], 'pedestrianRisk'),
    twoWheelerRiskZonesWithin1km: countFlag(within[1000], 'twoWheelerRisk'),
    cctvPriorityZonesWithin1km: countFlag(within[1000], 'cctvPriorityCandidate'),
    insideApprox250mCrashZone: insideApprox250m,
    analysisWarning: 'Spatial association only; coordinates are approximate. This does not establish that this vend contributed to any crash.',
  };
});

// ---- per-zone proximity (all vends, split official vs OSM-only) ----
const zoneProximity = allZones.map(zone => {
  const officialDistances = officialVends.map(v => ({ v, d: distanceMeters(zone.longitude, zone.latitude, v.longitude, v.latitude) }));
  const osmDistances = osmOnlyVends.map(v => ({ v, d: distanceMeters(zone.longitude, zone.latitude, v.longitude, v.latitude) }));
  const within = {};
  BANDS.forEach(band => {
    within[band] = {
      official: officialDistances.filter(x => x.d <= band).length,
      osmOnly: osmDistances.filter(x => x.d <= band).length,
    };
  });
  let nearestOfficial = null, nearestDist = Infinity;
  officialDistances.forEach(({ v, d }) => { if (d < nearestDist) { nearestDist = d; nearestOfficial = v; } });

  return {
    ...zone,
    analysisYear: 2024,
    officialVendsWithin500m: within[500].official,
    officialVendsWithin1km: within[1000].official,
    officialVendsWithin2km: within[2000].official,
    osmOnlyShopsWithin500m: within[500].osmOnly,
    osmOnlyShopsWithin1km: within[1000].osmOnly,
    osmOnlyShopsWithin2km: within[2000].osmOnly,
    nearestOfficialVend: nearestOfficial ? nearestOfficial.name : null,
    nearestOfficialVendDistanceM: Number.isFinite(nearestDist) ? Math.round(nearestDist) : null,
    nearestOfficialVendCoordinateConfidence: nearestOfficial ? nearestOfficial.coordinateConfidence : null,
    analysisWarning: 'Spatial association only; coordinates are approximate. This does not establish that any nearby vend contributed to crashes at this location.',
  };
});

// ---- summary ----
function shareStats(list, predicate) {
  const matched = list.filter(predicate).length;
  return { count: matched, total: list.length, sharePercent: list.length ? Math.round((matched / list.length) * 1000) / 10 : null };
}
const summary = {
  analysisYear: 2024,
  generatedAt: new Date().toISOString(),
  vendsWithinBand: {
    '500m': shareStats(vendProximity, v => v.zonesWithin500m > 0),
    '1km': shareStats(vendProximity, v => v.zonesWithin1km > 0),
    '2km': shareStats(vendProximity, v => v.zonesWithin2km > 0),
  },
  blackspotsWithVendWithinBand: {
    '500m': shareStats(zoneProximity.filter(z => z.blackspot), z => z.officialVendsWithin500m > 0),
    '1km': shareStats(zoneProximity.filter(z => z.blackspot), z => z.officialVendsWithin1km > 0),
    '2km': shareStats(zoneProximity.filter(z => z.blackspot), z => z.officialVendsWithin2km > 0),
  },
  nightRiskZonesWithVendWithinBand: {
    '500m': shareStats(zoneProximity.filter(z => z.nightRisk), z => z.officialVendsWithin500m > 0),
    '1km': shareStats(zoneProximity.filter(z => z.nightRisk), z => z.officialVendsWithin1km > 0),
    '2km': shareStats(zoneProximity.filter(z => z.nightRisk), z => z.officialVendsWithin2km > 0),
  },
  hitAndRunZonesWithVendWithinBand: {
    '500m': shareStats(zoneProximity.filter(z => z.hitAndRunRisk), z => z.officialVendsWithin500m > 0),
    '1km': shareStats(zoneProximity.filter(z => z.hitAndRunRisk), z => z.officialVendsWithin1km > 0),
    '2km': shareStats(zoneProximity.filter(z => z.hitAndRunRisk), z => z.officialVendsWithin2km > 0),
  },
  distributionByOperator: officialVends.reduce((acc, v) => { acc[v.operator] = (acc[v.operator] || 0) + 1; return acc; }, {}),
  distributionByVendCoordinateConfidence: officialVends.reduce((acc, v) => { const k = v.coordinateConfidence || 'unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  distributionByZoneCoordinateConfidence: allZones.reduce((acc, z) => { const k = z.coordinateConfidence || 'unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  exactVsApproximate: {
    vendsExact: allVends.filter(v => !v.coordinateIsApproximate).length,
    vendsApproximate: allVends.filter(v => v.coordinateIsApproximate).length,
    zonesTotal: allZones.length,
    zonesApproximate: allZones.length, // every crash-zone coordinate in this dataset is approximate
  },
  coverageWarning: reportMetrics.crash_prone_zones_reported + ' crash-prone zones were reported for 2024, but the published tables provide enough names to map only ' + allZones.length + ' unique locations. Aggregate report totals and mapped point counts therefore have different coverage.',
  methodologyWarning: 'This tool explores spatial proximity between published liquor-vend listings and named road crash-prone locations. Most liquor-vend coordinates represent approximate locality or sector centres, and all crash-zone coordinates represent approximate landmark or intersection centres rather than official Delhi Traffic Police geotags. Proximity therefore indicates broad spatial association only. It does not establish that a liquor vend contributed to any crash. Results should be interpreted at neighbourhood scale, with 1-kilometre and 2-kilometre bands preferred over precise metre-level distances.',
  reportMetrics,
};

// ---- corridor summary (group zones by road_name; dedup vends within 1km of ANY zone on the road) ----
const roadNames = [...new Set(allZones.map(z => z.roadName).filter(Boolean))].sort();
const corridorSummary = roadNames.map(road => {
  const zonesOnRoad = zoneProximity.filter(z => z.roadName === road);
  const vendIdsWithin1km = new Set();
  zonesOnRoad.forEach(z => {
    vendProximity.forEach(v => {
      if (v.zonesWithin1km > 0) {
        const d = distanceMeters(z.longitude, z.latitude, v.longitude, v.latitude);
        if (d <= 1000) vendIdsWithin1km.add(v.id);
      }
    });
  });
  return {
    roadName: road,
    namedZoneCount: zonesOnRoad.length,
    totalFatalCrashes: zonesOnRoad.reduce((a, z) => a + (z.fatalCrashes ?? 0), 0),
    totalCrashes: zonesOnRoad.reduce((a, z) => a + (z.totalCrashes ?? 0), 0),
    blackspotCount: zonesOnRoad.filter(z => z.blackspot).length,
    nightRiskZoneCount: zonesOnRoad.filter(z => z.nightRisk).length,
    hitAndRunZoneCount: zonesOnRoad.filter(z => z.hitAndRunRisk).length,
    officialVendsWithin1kmOfAnyZone: vendIdsWithin1km.size,
  };
}).sort((a, b) => b.totalFatalCrashes - a.totalFatalCrashes);

// ---- operator summary ----
const operatorNames = [...new Set(officialVends.map(v => v.operator))];
const operatorSummary = operatorNames.map(op => {
  const vends = vendProximity.filter(v => v.operator === op);
  return {
    operator: op,
    vendCount: vends.length,
    shareWithin500m: shareStats(vends, v => v.zonesWithin500m > 0),
    shareWithin1km: shareStats(vends, v => v.zonesWithin1km > 0),
    shareWithin2km: shareStats(vends, v => v.zonesWithin2km > 0),
    shareWithin1kmOfBlackspot: shareStats(vends, v => v.blackspotsWithin1km > 0),
    shareWithin1kmOfNightRiskZone: shareStats(vends, v => v.nightRiskZonesWithin1km > 0),
    shareWithin1kmOfHitAndRunZone: shareStats(vends, v => v.hitAndRunZonesWithin1km > 0),
    interpretationNote: 'Operator differences are not adjusted for geographic distribution of vends across Delhi and should not be interpreted as an operator effect.',
  };
});

// ---- write outputs ----
function toFeatureCollection(records) {
  return {
    type: 'FeatureCollection',
    features: records.map(r => ({
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
      properties: Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'longitude' && k !== 'latitude')),
    })),
  };
}

fs.writeFileSync(path.join(ROOT, 'data/liquor_vend_crash_proximity_2024.geojson'), JSON.stringify(toFeatureCollection(vendProximity), null, 1));
fs.writeFileSync(path.join(ROOT, 'data/crash_zone_liquor_proximity_2024.geojson'), JSON.stringify(toFeatureCollection(zoneProximity), null, 1));
fs.writeFileSync(path.join(ROOT, 'data/liquor_crash_proximity_summary_2024.json'), JSON.stringify({ ...summary, corridorSummary, operatorSummary }, null, 1));

// ---- verification prints (per plan: verify standalone before touching any UI) ----
console.log('\n--- Verification ---');
console.log('Zones reported vs mapped:', reportMetrics.crash_prone_zones_reported, 'vs', allZones.length);
const ringRoad = corridorSummary.find(c => c.roadName === 'Ring Road');
console.log('Ring Road corridor:', ringRoad ? ringRoad.namedZoneCount + ' zones, ' + ringRoad.totalFatalCrashes + ' fatal' : 'NOT FOUND');
const monotonic = vendProximity.every(v => v.zonesWithin500m <= v.zonesWithin1km && v.zonesWithin1km <= v.zonesWithin2km);
console.log('Monotonic radius counts (500m <= 1km <= 2km) for all vends:', monotonic);
const negatives = vendProximity.some(v => v.nearestCrashZoneDistanceM < 0) || zoneProximity.some(z => z.nearestOfficialVendDistanceM < 0);
console.log('Any negative distances:', negatives);
console.log('Official vends:', officialVends.length, '| OSM-only:', osmOnlyVends.length, '| Zones:', allZones.length);
console.log('Wrote liquor_vend_crash_proximity_2024.geojson, crash_zone_liquor_proximity_2024.geojson, liquor_crash_proximity_summary_2024.json');
