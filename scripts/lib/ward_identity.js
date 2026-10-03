// Gives every ward polygon a usable, unique identity before anything keys on it.
//
// data/source/delhi_wards_boundaries.geojson (290 polygons) has two identity problems, both
// verified against the data rather than assumed:
//
//  1. One polygon has Ward_Name and Ward_No both null. It is NOT a lost ward: every numbered ward
//     1-272, all 8 CANT_* and all 9 NDMC_* are already present. It is a separate 37 km² polygon
//     that overlaps no other ward, sits along the Yamuna (touching ~22 wards on both banks), and is
//     mostly OSM floodplain/farmland. It is real ground that carries real crash data, so dropping it
//     would silently lose 3 crash zones and 11 fatal crashes. It is labelled for what the evidence
//     supports (an unwarded river-floodplain polygon) and not given a guessed MCD ward name.
//  2. Two distinct wards are both named RAM NAGAR (Ward_No 87 and 247), so Ward_Name is not a
//     unique key. Ward_No is unique; display names for duplicates get the number appended.
//
// The source file is an immutable input, so identity is applied at load time in each loader.

const UNWARDED_NAME = 'YAMUNA FLOODPLAIN (UNWARDED)';
const UNWARDED_NO = 'UNWARDED_1';

function applyWardIdentity(featureCollection) {
  const features = featureCollection.features;
  const unnamed = features.filter(f => !f.properties.Ward_Name && !f.properties.Ward_No);
  if (unnamed.length > 1) {
    throw new Error('Expected at most one identity-less ward polygon, found ' + unnamed.length + ' — refusing to guess which is which.');
  }
  unnamed.forEach(f => {
    f.properties.Ward_Name = UNWARDED_NAME;
    f.properties.Ward_No = UNWARDED_NO;
    f.properties.wardIdentityBasis = 'unwarded polygon; label assigned by build (source has no name or number)';
  });

  const byName = new Map();
  features.forEach(f => {
    const n = f.properties.Ward_Name;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(f);
  });
  byName.forEach((group, name) => {
    if (group.length > 1) group.forEach(f => { f.properties.Ward_Name = name + ' (' + f.properties.Ward_No + ')'; });
  });

  const nos = new Set();
  features.forEach(f => {
    if (!f.properties.Ward_No || nos.has(f.properties.Ward_No)) throw new Error('Ward_No is not a unique non-empty key: ' + f.properties.Ward_No);
    nos.add(f.properties.Ward_No);
  });
  return featureCollection;
}

module.exports = { applyWardIdentity, UNWARDED_NAME, UNWARDED_NO };
