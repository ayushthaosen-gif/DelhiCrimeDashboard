const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const A = 1576.0135160203026, B = -120999.92546426499;
const C = -1795.7704845778383, D = 51887.77965738758;
function project(lng, lat) {
  return [Math.round((A * lng + B) * 10) / 10, Math.round((C * lat + D) * 10) / 10];
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
const boundaries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), 'utf8'));
function assignDistrict(lng, lat) {
  for (const f of boundaries.features) {
    if (pointInRing(lng, lat, f.geometry.coordinates[0])) return f.properties.district;
  }
  return null;
}

const partial = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'), 'utf8'));
let freshProjected = 0, outsideDistricts = 0;
const final = partial.map(z => {
  if (z.lat == null) return { ...z, geocodeSource: 'unresolved' };
  if (z.x != null) return z; // already has x/y/district from 2023 reuse
  const [x, y] = project(z.lng, z.lat);
  const district = assignDistrict(z.lng, z.lat);
  if (!district) outsideDistricts++;
  freshProjected++;
  return { ...z, x, y, district };
});
console.log('freshly projected:', freshProjected, 'of which outside all districts:', outsideDistricts);

fs.writeFileSync(path.join(ROOT, 'data/crash_zones_2024_geocoded.json'), JSON.stringify(final, null, 1));
fs.unlinkSync(path.join(ROOT, 'data/crash_zones_2024_partial.json'));
console.log('Wrote data/crash_zones_2024_geocoded.json —', final.length, 'zones,', final.filter(z=>z.lat!=null).length, 'with coordinates');
