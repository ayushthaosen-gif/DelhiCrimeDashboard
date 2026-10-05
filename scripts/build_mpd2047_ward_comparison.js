// Planned (MPD-2047) vs current (OpenStreetMap) land use, per MCD ward.
//
// Inputs, all committed snapshots -- this script does no network I/O:
//   data/source/mpd2047_landuse_raw.geojson  planned land use, 4,722 polygons, EPSG:4326
//   data/delhi_wards_infra.geojson           290 MCD wards
//   data/landuse_by_ward.csv                 current OSM land use per ward (built separately)
//
// Why wards and not the dashboard's 15 police districts: MPD-2047 is organised by DDA planning
// zones, which are not police districts and have no published crosswalk to them. Wards are a
// finer unit that can be intersected with the plan geometrically, so every figure here comes from
// an areal intersection and never from matching a name.
//
// THE COMPARISON THIS SCRIPT REFUSES TO MAKE NAIVELY
// The two sides have very different coverage. MPD-2047 covers about 971 km2 of an NCT area of
// roughly 1,483 km2. OSM land-use tagging averages 22.6% of ward area. Normalising both to full
// ward area would make the plan appear to "add" land use that OSM has merely never tagged. So each
// side is normalised within its own known area and BOTH denominators are carried through to the
// output, per ward. A reader can always see how much of the ward each source actually describes.
//
// CATEGORY CROSSWALK -- deliberately strict
// Only unambiguous pairs are compared:
//     residential   <-> RD      (RD-RESIDENTIAL AREA)
//     industrial    <-> M1      (M1-INDUSTRIAL)
//     green_open    <-> P1, P2  (regional park/forest, district park/green)  -- parks only
//     agriculture   <-> A1      (Agriculture land)
// "green_open" here means OSM green/open space EXCLUDING agricultural tags, and "agriculture" is the
// OSM agricultural tags (farmland, farmyard, orchard, plantation, plant nursery, greenhouse
// horticulture, allotments), taken from the land-use CSV's green_open_agriculture_km2 column. Before
// 2026-10-03 the OSM side of "parks" included farmland (71% of its area) while the plan side was
// parks only, so the parks comparison was not like for like.
// Everything else is reported on the plan side alone, never equated to an OSM category:
//   * A1 is "Agriculture land" in the gazette's own legend (Table 5.1, land-use category 9). It is
//     the second largest code at ~209 km2. Checked against DDA's separate Low Density Area layer:
//     A1 is exactly the GREEN BELT type of that overlay (155 polygons, 209.3 km2, 100% match; the
//     overlay's other type, LDRA, 72.9 km2, contains no A1). 201.4 km2 of A1 is premises tagged
//     GREEN BELT and 7.9 km2 VILLAGE ABADI, which the gazette says is residential wherever it sits
//     (Table 5.1 footnote) -- NOT reclassified here, see the metadata note. A1 is a zoning
//     designation, not a crop survey, so agriculture<->A1 is the closest counterpart, not an
//     identity; it is compared, with that caveat carried in the output metadata.
//   * C1-C3, PS1/PS2, G1-G3, T1-T3, U1-U5 have plausible OSM counterparts but the mappings are
//     judgement calls, so they stay out of the delta and are reported as planned-only area.
//   * A2 (river and water body) has no counterpart: OSM tags water as natural=water, which the
//     current land-use extract does not carry at all.

const fs = require('fs');
const turf = require('@turf/turf');

const PLAN_PATH = 'data/source/mpd2047_landuse_raw.geojson';
const WARD_PATH = 'data/delhi_wards_infra.geojson';
const CURRENT_PATH = 'data/landuse_by_ward.csv';
const OUT_CSV = 'data/mpd2047_ward_comparison.csv';
const OUT_JSON = 'data/mpd2047_ward_comparison.json';

// Below this share of a ward described by a source, the ward's delta is flagged rather than
// presented as a finding. Chosen to match the spirit of the streetlight survey gate: show the
// number, mark it untrustworthy, never silently drop the ward.
const THIN_COVERAGE_PCT = 10;

const COMPARABLE = {
  residential: ['RD'],
  industrial: ['M1'],
  green_open: ['P1', 'P2'],
  agriculture: ['A1'],
};
const PLAN_ONLY_LABELS = {
  A1: 'Agriculture land (Green Belt portion of the Low Density Area overlay)',
  A2: 'River and water body',
  C1: 'Commercial', C2: 'Commercial', C3: 'Commercial',
  PS1: 'Public and semi-public facilities', PS2: 'Public and semi-public facilities',
  PS1BGCGCE: 'Public and semi-public facilities', PS1FCO: 'Public and semi-public facilities',
  G1: 'Government', G2: 'Government', G3: 'Government',
  P3: 'Recreational - historical monument', P4: 'Recreational - sports complex',
  T1: 'Transportation - airport', T2: 'Transportation', T3: 'Transportation',
  U: 'Utility', U1: 'Utility - water treatment', U2: 'Utility - sewage treatment',
  U3: 'Utility - power', U4: 'Utility - solid waste', U5: 'Utility - drain',
  RF: 'Foreign mission',
};

function readCsv(p) {
  const lines = fs.readFileSync(p, 'utf8').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map(l => {
    // These files have no quoted commas; a plain split is correct and keeps this dependency-free.
    const cells = l.split(',');
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const planLegend = (plan.metadata && plan.metadata.legend) || {};
const wards = JSON.parse(fs.readFileSync(WARD_PATH, 'utf8'));
const currentRows = readCsv(CURRENT_PATH);
const currentByNo = new Map(currentRows.map(r => [r.ward_no, r]));

// Pre-compute plan bounding boxes once; without this the 290 x 4722 pairing is unworkably slow.
const planFeatures = plan.features
  .filter(f => f.geometry && f.geometry.coordinates)
  .map(f => ({ f, bbox: turf.bbox(f), code: String(f.properties.use_zones || '').trim() || '(blank)' }));

function bboxOverlaps(a, b) {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

const CODES = new Set(planFeatures.map(p => p.code));
const comparableCodes = new Set(Object.values(COMPARABLE).flat());

const rows = [];
let skippedGeom = 0;
let processed = 0;
const overlapWards = [];

for (const ward of wards.features) {
  processed++;
  if (processed % 25 === 0) process.stdout.write('  ' + processed + '/' + wards.features.length + ' wards\r');
  const wp = ward.properties;
  const wardBox = turf.bbox(ward);
  const wardAreaKm2 = turf.area(ward) / 1e6;

  const plannedByCode = {};
  for (const cand of planFeatures) {
    if (!bboxOverlaps(wardBox, cand.bbox)) continue;
    let piece = null;
    // turf 7 takes a FeatureCollection of exactly two features here, not two arguments.
    try { piece = turf.intersect(turf.featureCollection([ward, cand.f])); }
    catch (e) { skippedGeom++; continue; }
    if (!piece) continue;
    let a = 0;
    try { a = turf.area(piece) / 1e6; } catch (e) { skippedGeom++; continue; }
    if (!isFinite(a) || a <= 0) continue;
    plannedByCode[cand.code] = (plannedByCode[cand.code] || 0) + a;
  }

  const plannedTotal = Object.values(plannedByCode).reduce((x, y) => x + y, 0);
  const planCoveragePct = wardAreaKm2 > 0 ? (plannedTotal / wardAreaKm2) * 100 : 0;
  // A statutory land-use plan should tile without gaps or overlaps, so intersected area must not
  // exceed the ward. Summing per-polygon intersections independently would double-count any
  // overlap, which is exactly the bug the OSM land-use script had to solve with union/difference.
  // Count it rather than silently accepting an impossible share.
  if (planCoveragePct > 101) overlapWards.push({ ward: wp.Ward_Name, pct: +planCoveragePct.toFixed(1) });

  const cur = currentByNo.get(String(wp.Ward_No));
  const currentMappedPct = cur ? Number(cur.mapped_pct) : null;

  const row = {
    ward: wp.Ward_Name,
    ward_no: wp.Ward_No,
    district: wp.assignedDistrict || '',
    area_sq_km: +wardAreaKm2.toFixed(3),
    plan_covered_km2: +plannedTotal.toFixed(3),
    plan_coverage_pct: +planCoveragePct.toFixed(1),
    osm_mapped_pct: currentMappedPct == null ? null : +currentMappedPct.toFixed(1),
  };

  // Comparable categories: share of each side's OWN described area, so the two are commensurable.
  for (const [cat, codes] of Object.entries(COMPARABLE)) {
    const plannedKm2 = codes.reduce((a, c) => a + (plannedByCode[c] || 0), 0);
    // OSM side. green_open is net of agriculture; agriculture is the carved-out subset. Both come
    // from the same overlap-resolved tally, so they cannot double-count each other.
    const osmAgriKm2 = cur ? Number(cur.green_open_agriculture_km2) : null;
    const curKm2 = !cur ? null
      : cat === 'agriculture' ? osmAgriKm2
      : cat === 'green_open' ? Number(cur.green_open_km2) - osmAgriKm2
      : Number(cur[cat + '_km2']);
    const curMappedKm2 = cur
      ? ['residential', 'commercial', 'industrial', 'institutional', 'green_open', 'other']
        .reduce((a, c) => a + Number(cur[c + '_km2'] || 0), 0)
      : null;
    const plannedShare = plannedTotal > 0 ? (plannedKm2 / plannedTotal) * 100 : null;
    const currentShare = curMappedKm2 ? (curKm2 / curMappedKm2) * 100 : null;
    row['planned_' + cat + '_km2'] = +plannedKm2.toFixed(3);
    row['planned_' + cat + '_share_pct'] = plannedShare == null ? null : +plannedShare.toFixed(1);
    row['current_' + cat + '_km2'] = curKm2 == null ? null : +curKm2.toFixed(3);
    row['current_' + cat + '_share_pct'] = currentShare == null ? null : +currentShare.toFixed(1);
    row['delta_' + cat + '_pp'] = (plannedShare == null || currentShare == null)
      ? null : +(plannedShare - currentShare).toFixed(1);
  }

  // Plan-only area, reported but never differenced against OSM.
  let planOnly = 0;
  for (const [code, km2] of Object.entries(plannedByCode)) {
    if (!comparableCodes.has(code)) planOnly += km2;
  }
  row.planned_not_comparable_km2 = +planOnly.toFixed(3);

  const thin = row.plan_coverage_pct < THIN_COVERAGE_PCT
    || row.osm_mapped_pct == null || row.osm_mapped_pct < THIN_COVERAGE_PCT;
  row.comparison_confidence = thin ? 'low - thin coverage on at least one side' : 'ok';
  rows.push(row);
}
process.stdout.write('\n');

const headers = Object.keys(rows[0]);
const csv = [headers.join(',')]
  .concat(rows.map(r => headers.map(h => (r[h] == null ? '' : r[h])).join(',')))
  .join('\n') + '\n';
fs.writeFileSync(OUT_CSV, csv);

const lowConf = rows.filter(r => r.comparison_confidence !== 'ok').length;
const citywide = {
  planned_total_km2: +rows.reduce((a, r) => a + r.plan_covered_km2, 0).toFixed(1),
  ward_area_total_km2: +rows.reduce((a, r) => a + r.area_sq_km, 0).toFixed(1),
  wards: rows.length,
  wards_low_confidence: lowConf,
};
for (const cat of Object.keys(COMPARABLE)) {
  citywide['planned_' + cat + '_km2'] = +rows.reduce((a, r) => a + r['planned_' + cat + '_km2'], 0).toFixed(1);
  citywide['current_' + cat + '_km2'] = +rows.reduce((a, r) => a + (r['current_' + cat + '_km2'] || 0), 0).toFixed(1);
}
citywide.planned_not_comparable_km2 = +rows.reduce((a, r) => a + r.planned_not_comparable_km2, 0).toFixed(1);

fs.writeFileSync(OUT_JSON, JSON.stringify({
  metadata: {
    title: 'MPD-2047 planned land use versus current OSM-mapped land use, by MCD ward',
    generated_from: [PLAN_PATH, WARD_PATH, CURRENT_PATH],
    plan_status: (plan.metadata && plan.metadata.plan_status) || null,
    plan_attribution: (plan.metadata && plan.metadata.attribution) || null,
    plan_legend_field: (plan.metadata && plan.metadata.legend_field) || null,
    plan_legend: planLegend,
    legend_supplement_from_gazette: { A1: 'Agriculture land (gazette Table 5.1, land-use category 9: Agriculture and Water Body)' },
    codes_present_without_legend_entry: [...CODES].filter(c => c !== '(blank)' && !(c in planLegend)),
    crosswalk: COMPARABLE,
    plan_only_labels: PLAN_ONLY_LABELS,
    thin_coverage_pct: THIN_COVERAGE_PCT,
    method: 'Areal intersection of each ward polygon with MPD-2047 land-use polygons. Shares are computed within each source\'s own described area -- planned shares over plan-covered area, current shares over OSM-tagged area -- because the two sources cover very different fractions of a ward. Both denominators are reported per ward.',
    comparability_caveat: 'A planned-versus-current difference is a difference between a statutory plan and a community-mapped inventory. It is not a measurement of change on the ground, and a positive delta may mean the plan designates more of something OR that OSM has not tagged it.',
    a1_note: 'A1 = "Agriculture land" (gazette Table 5.1). Verified against DDA FeatureServer layer 9 (LOW DENSITY AREA): A1 equals the GREEN BELT type of that overlay exactly (155 polygons, 209.3 km2). It is compared with OSM agricultural tags as the closest counterpart; A1 is a zoning designation, not a survey of what is grown. 7.9 km2 of A1 is VILLAGE ABADI premises, which the gazette treats as residential in any use zone; that area is left in A1 here, so planned residential is slightly understated and planned agriculture slightly overstated.',
    buckets_note: 'planned_covered = comparable (residential + industrial + green_open + agriculture) + planned_not_comparable, exactly. green_open is OSM green/open space excluding agricultural tags (compared with plan P1+P2 parks); agriculture is OSM agricultural tags (compared with plan A1). Changed 2026-10-03: previously OSM green_open included farmland, and A1 was plan-only.',
    geometry_failures: skippedGeom,
  },
  citywide,
  wards: rows,
}, null, 1) + '\n');

console.log('Wrote ' + OUT_CSV + ' and ' + OUT_JSON + ' -- ' + rows.length + ' wards');
console.log('  plan-covered area across wards: ' + citywide.planned_total_km2 + ' km2 of ' + citywide.ward_area_total_km2 + ' km2');
console.log('  wards flagged low-confidence  : ' + lowConf + '/' + rows.length);
console.log('  codes with no legend entry    : ' + (JSON.stringify([...CODES].filter(c => c !== '(blank)' && !(c in planLegend))) || '[]'));
if (overlapWards.length) console.log('  WARDS OVER 101% PLAN COVERAGE (overlap): ' + JSON.stringify(overlapWards.slice(0, 8)));
if (skippedGeom) console.log('  geometry operations skipped   : ' + skippedGeom);
