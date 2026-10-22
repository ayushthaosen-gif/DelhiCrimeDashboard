// Point-in-polygon helpers shared by the sensitivity analysis. Same rule as scripts/build_profiles.js: a point goes to the first ward that contains it,
// and a hole in a polygon excludes it.

function ringBox(ring) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  ring.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
  return [x0, y0, x1, y1];
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function indexPolygons(features) {
  return features.map((f, i) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    return { i, polys, box: polys.map(p => ringBox(p[0])) };
  });
}
function locate(index, lng, lat) {
  for (const e of index) {
    for (let k = 0; k < e.polys.length; k++) {
      const b = e.box[k];
      if (lng < b[0] || lng > b[2] || lat < b[1] || lat > b[3]) continue;
      const poly = e.polys[k];
      if (inRing(lng, lat, poly[0]) && !poly.slice(1).some(h => inRing(lng, lat, h))) return e.i;
    }
  }
  return -1;
}
// small deterministic generator, so the analysis reproduces exactly
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// a point drawn uniformly from the disc of radius r metres around (lng, lat)
function inDisc(rand, lng, lat, r) {
  const rad = r * Math.sqrt(rand()), th = 2 * Math.PI * rand();
  const dLat = rad * Math.sin(th) / 111320, dLng = rad * Math.cos(th) / (111320 * Math.cos(lat * Math.PI / 180));
  return [lng + dLng, lat + dLat];
}

module.exports = { indexPolygons, locate, mulberry32, inDisc };
