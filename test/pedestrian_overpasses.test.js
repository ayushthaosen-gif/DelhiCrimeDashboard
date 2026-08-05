const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const bridges = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_pedestrian_overpasses_osm.geojson'), 'utf8'));
const districts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8')).districts;

test('pedestrian-overbridge snapshot has valid mapped point features', () => {
  assert.equal(bridges.features.length, 242);
  for (const f of bridges.features) {
    assert.equal(f.geometry.type, 'Point');
    const [lng, lat] = f.geometry.coordinates;
    assert.ok(lng >= 76.8 && lng <= 77.4 && lat >= 28.4 && lat <= 28.9);
    assert.ok(f.properties.district);
    assert.match(f.properties.osmUrl, /^https:\/\/www\.openstreetmap\.org\/way\/\d+$/);
    assert.equal(f.properties.sourceSnapshot, '2026-08-04');
  }
});

test('district overbridge counts reconcile exactly with the GeoJSON', () => {
  const byDistrict = {};
  bridges.features.forEach(f => { byDistrict[f.properties.district] = (byDistrict[f.properties.district] || 0) + 1; });
  assert.equal(districts.reduce((sum, d) => sum + d.pedestrianOverpasses, 0), bridges.features.length);
  districts.forEach(d => {
    assert.equal(d.pedestrianOverpasses, byDistrict[d.district] || 0);
    assert.equal(d.pedestrianOverpassDensity, Math.round((d.pedestrianOverpasses / d.areaSqKm) * 100) / 100);
  });
});
