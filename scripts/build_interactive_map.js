// Generates interactive_map.html — a separate page from the main dashboard, using Leaflet.js
// + OpenStreetMap standard tiles for a real, zoomable/pannable street map without a provider API key. Kept as its
// own page rather than folded into delhi_safety_dashboard.html because it needs external
// network requests (tiles, the Leaflet CDN bundle) at view-time, which would break the main
// dashboard's "works from file://, no external requests" design. Run:
//
//   node scripts/build_interactive_map.js

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const boundaries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_boundaries_simplified.geojson'), 'utf8'));
const dashboardFinal = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dashboard_final.json'), 'utf8'));
const policeMarkers = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/police_markers_latlng.json'), 'utf8'));
const poiMarkers = Object.assign(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers_latlng.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(ROOT, 'data/poi_markers_infra_extras.json'), 'utf8'))
);
const footwayCoverage = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_footway_coverage.json'), 'utf8'));
const streetlightsCombined = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/streetlights_combined_by_district.json'), 'utf8'));
const streetlightGrid = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/streetlight_grid.json'), 'utf8'));
const paplStreetlightPoints = streetlightGrid.points.map(([gx, gy, count]) => {
  const x = gx * streetlightGrid.cell;
  const y = gy * streetlightGrid.cell;
  const lon = 76.77599705784841 + x / 1576.2410031459287;
  const lat = 28.894521166321024 - y / 1795.3134203215425;
  return [Math.round(lat * 1e6) / 1e6, Math.round(lon * 1e6) / 1e6, 'PAPL survey cell · ' + count.toLocaleString('en-IN') + ' recorded lights'];
});
const landuse = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_landuse_simplified.geojson'), 'utf8'));
const crashZones = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2023_geocoded.json'), 'utf8'));
const crashZones2024 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crash_zones_2024_geocoded.json'), 'utf8'));
const wardsInfra = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_wards_infra.geojson'), 'utf8'));
const liquorVendsApprox = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_liquor_vends_all_coordinates_approx.geojson'), 'utf8'));
const crashZones2024Approx = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_crash_prone_zones_2024_all_named_approx.geojson'), 'utf8'));
const pedestrianOverpasses = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/delhi_pedestrian_overpasses_osm.geojson'), 'utf8'));
const mpd2047 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/mpd2047_ward_comparison.json'), 'utf8'));

// MPD-2047 planned land use versus current OSM-mapped land use, joined onto wards by ward_no.
// Joined here at build time rather than written into delhi_wards_infra.geojson, so the comparison
// stays owned by its own script and does not depend on where it sits in the build chain.
//
// Each comparable category carries THREE numbers, never just the difference: the planned share,
// the current share, and both coverage denominators. The plan describes about 65% of Delhi and OSM
// land-use tagging averages 22.6% of a ward, so a bare delta is not interpretable on its own -- a
// positive value can mean the plan designates more of something, or simply that OSM has not tagged
// it yet. Wards thin on either side are flagged rather than dropped.
(() => {
  const byWardNo = new Map(mpd2047.wards.map(w => [String(w.ward_no), w]));
  let joined = 0;
  for (const f of wardsInfra.features) {
    const m = byWardNo.get(String(f.properties.Ward_No));
    if (!m) continue;
    joined++;
    f.properties.mpdPlanCoveragePct = m.plan_coverage_pct;
    f.properties.mpdOsmMappedPct = m.osm_mapped_pct;
    f.properties.mpdConfidence = m.comparison_confidence;
    f.properties.mpdNotComparableKm2 = m.planned_not_comparable_km2;
    for (const cat of ['residential', 'industrial', 'green_open', 'agriculture']) {
      f.properties['mpdPlanned_' + cat] = m['planned_' + cat + '_share_pct'];
      f.properties['mpdCurrent_' + cat] = m['current_' + cat + '_share_pct'];
      f.properties['mpdDelta_' + cat] = m['delta_' + cat + '_pp'];
    }
  }
  if (joined !== wardsInfra.features.length) {
    throw new Error('MPD-2047 join covered ' + joined + ' of ' + wardsInfra.features.length
      + ' wards. Refusing to build a map with a partial plan join.');
  }
})();

// Join crime/infra stats onto the boundary features by district name.
const statsByDistrict = {};
dashboardFinal.districts.forEach(d => { statsByDistrict[d.district] = d; });
boundaries.features.forEach(f => {
  Object.assign(f.properties, statsByDistrict[f.properties.district] || {});
});
// Footway/sidewalk coverage lives in its own file (not dashboard_final.json) so this new,
// still-exploratory OSM-derived metric can't accidentally corrupt the core, heavily-depended-on
// dashboard dataset -- joined on the same district key, same way as the stats above.
const footwayByDistrict = {};
footwayCoverage.forEach(r => { footwayByDistrict[r.district] = r; });
boundaries.features.forEach(f => {
  Object.assign(f.properties, footwayByDistrict[f.properties.district] || {});
});
// Combined PAPL+OSM streetlight figure -- same "own file, not dashboard_final.json" reasoning as
// footway coverage above. combined_source on every district says whether its number came from the
// PAPL survey or the OSM fallback, so this can never be mistaken for the PAPL-only "Streetlights"
// metric already defined in INFRA[] below (kept unchanged, still PAPL-only).
const streetlightsCombinedByDistrict = {};
streetlightsCombined.forEach(r => { streetlightsCombinedByDistrict[r.district] = r; });
boundaries.features.forEach(f => {
  Object.assign(f.properties, streetlightsCombinedByDistrict[f.properties.district] || {});
});

// Citywide MPD-2047 vs current summary, rendered at build time so the page does no arithmetic.
//
// Only three categories are compared, and the panel says why the rest are not. Deliberately shown
// in km2 rather than as percentages of Delhi: the plan describes about 65% of the city and OSM
// land-use tagging far less, so a percentage-of-Delhi figure would invite subtraction between two
// different denominators. Absolute areas with both totals stated cannot be misread that way.
function mpd2047CitywidePanelHtml() {
  const c = mpd2047.citywide;
  const n = v => (v == null ? '—' : Number(v).toLocaleString('en-IN'));
  const row = (label, planned, current) => {
    const delta = (planned != null && current != null) ? planned - current : null;
    return '<div class="mpd-row"><span>' + label + '</span><span>' + n(planned) + ' km²</span>'
      + '<span>' + n(current) + ' km²</span>'
      + '<span>' + (delta == null ? '—' : (delta > 0 ? '+' : '') + n(Math.round(delta * 10) / 10)) + '</span></div>';
  };
  return '<div class="mpd-panel">'
    + '<div class="mpd-row mpd-head"><span>Land use</span><span>Planned 2047</span><span>Mapped now</span><span>Diff</span></div>'
    + row('Residential', c.planned_residential_km2, c.current_residential_km2)
    + row('Industrial', c.planned_industrial_km2, c.current_industrial_km2)
    + row('Parks / green (excl. farmland)', c.planned_green_open_km2, c.current_green_open_km2)
    + row('Agriculture land (A1)', c.planned_agriculture_km2, c.current_agriculture_km2)
    + '<div class="mpd-row mpd-sub"><span>Other planned designations</span><span>' + n(c.planned_not_comparable_km2) + ' km²</span><span>not comparable</span><span>—</span></div>'
    + '<div class="mpd-note">'
    + 'MPD-2047 describes <b>' + n(c.planned_total_km2) + ' km²</b> of the <b>' + n(c.ward_area_total_km2) + ' km²</b> covered by the 290 wards. '
    + 'The “mapped now” column is OpenStreetMap land-use tagging, which is far less complete — so a difference here is <i>not</i> a measurement of change on the ground. '
    + '<b>' + n(c.wards_low_confidence) + ' of ' + n(c.wards) + '</b> wards are thin on at least one side and are flagged in their popups.'
    + '</div>'
    + '<div class="mpd-note">'
    + 'Only residential, industrial, parks/green and agriculture have counterparts in both sources; parks are compared with parks and farmland with the plan\'s agriculture designation (A1, a zoning category rather than a crop survey). Commercial, public/semi-public, government, transport and utility designations are reported as planned-only area rather than force-matched. '
    + 'A1 is the Green Belt portion of the Low Density Area overlay. '
    + 'MPD-2047 sets no road-safety or accessibility target this dashboard can measure against — its walkability provisions are qualitative.'
    + '</div>'
    + '<div class="mpd-note">Planned land use: Delhi Development Authority, Master Plan for Delhi 2047 (gis.dda.org.in), ' + mpd2047.wards.length + ' wards intersected. Current land use: OpenStreetMap, ODbL.</div>'
    + '</div>';
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Delhi Safety & Infrastructure Explorer</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"/>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
<script src="https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<style>
:root {
  --night: #1c2331; --paper: #edeae2; --paper-raised: #f6f4ee;
  --amber: #e3a13b; --rust: #b14a34; --slate: #626b78; --bone: #e8e4da;
  --bg: var(--paper); --surface: var(--paper-raised); --border: #d8d3c6;
  --text: var(--night); --text-dim: var(--slate); --good: #3f7d52;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #14181f; --surface: #1c2331; --border: #303a4c; --text: var(--bone); --text-dim: #9aa3b2; }
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
body { display: flex; flex-direction: column; }
.seg { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.seg button { font: inherit; font-size: 12px; padding: 6px 10px; border: none; background: var(--bg); color: var(--text-dim); cursor: pointer; border-right: 1px solid var(--border); }
.seg button:last-child { border-right: none; }
.seg button.active { background: var(--rust); color: #fff; }
.seg button:hover:not(.active) { background: var(--paper-raised); color: var(--text); }
#map { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
#mapWrap { position: absolute; top: 0; left: 0; right: 0; bottom: 0; }
.leaflet-popup-content-wrapper { background: var(--surface); color: var(--text); }
.leaflet-popup-tip { background: var(--surface); }
.leaflet-popup-content { font-size: 12.5px; line-height: 1.5; }
.popup-title { font-weight: 800; font-size: 13.5px; margin-bottom: 2px; }
.popup-rank { color: var(--text-dim); font-size: 11.5px; }
.popup-src { color: var(--text-dim); font-size: 11px; margin-top: 6px; border-top: 1px solid var(--border); padding-top: 4px; }
.popup-why-list { margin: 3px 0 0 16px; padding: 0; font-size: 11.5px; }
.popup-why-list li { margin-bottom: 2px; }
.yoy { font-weight: 700; }
.yoy.up { color: var(--rust); }
.yoy.down { color: var(--good); }
.leg { position: absolute; bottom: 20px; left: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 240px; }
.leg b { color: var(--text); display: block; margin-bottom: 4px; font-size: 12px; }
.leg-scale { display: flex; height: 10px; border-radius: 3px; overflow: hidden; margin: 4px 0; }
.leg-scale span { flex: 1; }
.leg-biv-grid { display: grid; grid-template-columns: repeat(3, 16px); grid-template-rows: repeat(3, 16px); gap: 2px; margin: 6px 0; }
.leg-biv-grid div { border-radius: 2px; }
.leg-biv-axes { display: flex; justify-content: space-between; font-size: 11px; }
#searchResults { position: absolute; z-index: 1200; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.2); max-height: 220px; overflow-y: auto; display: none; min-width: 180px; }
#searchResults div { padding: 6px 12px; font-size: 13px; cursor: pointer; }
#searchResults div:hover, #searchResults div.active-hl { background: var(--rust); color: #fff; }
#drawer { position: absolute; top: 0; right: 0; bottom: 0; width: 340px; max-width: 92vw; background: var(--surface); border-left: 1px solid var(--border); box-shadow: -4px 0 16px rgba(0,0,0,.12); transform: translateX(100%); transition: transform .2s ease; z-index: 1100; overflow-y: auto; padding: 16px; }
#drawer.open { transform: translateX(0); }
#drawer .drawer-close { position: absolute; top: 10px; right: 12px; background: none; border: none; font-size: 20px; color: var(--text-dim); cursor: pointer; line-height: 1; }
#drawer h2 { margin: 0 4px 2px; font-size: 19px; font-weight: 800; }
#drawer .drawer-sub { margin: 0 4px 14px; font-size: 12px; color: var(--text-dim); }
#drawer .drawer-section { margin-bottom: 16px; }
#drawer .drawer-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .03em; color: var(--text-dim); margin: 0 0 8px; font-weight: 700; }
#drawer .stat-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
#drawer .stat-row .v { font-weight: 700; }
#drawer .drawer-note { margin-top: 6px; font-size: 11px; color: var(--text-dim); line-height: 1.45; }
#drawer .infra-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 12.5px; }
#drawer .infra-row .badge { font-size: 11px; padding: 1px 6px; border-radius: 8px; }
#drawer .badge.covered { background: rgba(63,125,82,0.18); color: var(--good); }
#drawer .badge.gap { background: rgba(177,74,52,0.18); color: var(--rust); }
#drawer .corr-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; font-size: 12px; font-family: monospace; }
.shape-icon { display: block; }
.shape-icon.sq { border-radius: 2px; }
.shape-icon.tri { width: 0; height: 0; background: none !important; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom-width: 10px; border-bottom-style: solid; }
.shape-icon.dia { transform: rotate(45deg); border-radius: 2px; }
.shape-icon.dot { border-radius: 50%; }
.shape-icon.ring { border-radius: 50%; box-shadow: inset 0 0 0 2px #fff; }
/* ── App shell: slim bar + left control panel + map ─────────────────────────────────────────── */
#appbar { display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--surface); border-bottom: 1px solid var(--border); flex: 0 0 auto; position: relative; z-index: 1600; }
#appbar h1 { font-size: 16px; margin: 0; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
#appbar a.back { font-size: 13px; color: var(--text); text-decoration: none; border: 1px solid var(--border); padding: 6px 12px; border-radius: 8px; background: var(--bg); white-space: nowrap; }
#appbar a.back:hover { border-color: var(--amber); }
.search-wrap { position: relative; margin-left: auto; }
#districtSearch { font: inherit; font-size: 13px; padding: 7px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); width: 230px; }
#searchResults { top: calc(100% + 4px); left: 0; right: 0; }
.appbar-actions { display: flex; align-items: center; gap: 8px; }
.btn, .menu > summary { font: inherit; font-size: 13px; min-height: 34px; padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; list-style: none; }
.menu > summary::-webkit-details-marker { display: none; }
.btn:hover, .menu > summary:hover { border-color: var(--amber); }
.btn.primary { background: var(--amber); border-color: var(--amber); color: var(--night); font-weight: 700; }
.menu { position: relative; }
.menu-pop { position: absolute; right: 0; top: calc(100% + 6px); background: var(--surface); border: 1px solid var(--border); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.28); padding: 6px; min-width: 200px; display: flex; flex-direction: column; z-index: 2000; }
.menu-pop button { font: inherit; font-size: 13px; text-align: left; padding: 9px 10px; border: none; border-radius: 6px; background: transparent; color: var(--text); cursor: pointer; }
.menu-pop button:hover, .menu-link:hover { background: var(--bg); }
.menu-link { display: none; font-size: 13px; padding: 9px 10px; border-radius: 6px; color: var(--text); text-decoration: none; }
.t-short { display: none; }
#appBody { display: flex; flex: 1 1 auto; min-height: 0; }
#panel { width: 340px; flex: 0 0 340px; overflow-y: auto; background: var(--surface); border-right: 1px solid var(--border); }
#mapRegion { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; }
.p-section { padding: 14px 16px; border-bottom: 1px solid var(--border); }
.p-section > h2, .p-head h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-dim); margin: 0 0 10px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
.p-head { display: flex; align-items: baseline; justify-content: space-between; }
.p-head h2 { margin-bottom: 8px; }
.pill { font-size: 11px; font-weight: 700; letter-spacing: 0; text-transform: none; padding: 1px 8px; border-radius: 999px; background: var(--amber); color: var(--night); }
.pill:empty { display: none; }
.link-btn { font: inherit; font-size: 12px; background: none; border: none; color: var(--text-dim); text-decoration: underline; cursor: pointer; padding: 4px; }
.link-btn:hover { color: var(--text); }
.field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; font-size: 12px; color: var(--text-dim); }
.field > span { font-weight: 700; }
#panel select { width: 100%; font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
#panel .seg { width: 100%; }
#panel .seg button { flex: 1; padding: 8px 6px; font-size: 13px; }
.check { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; padding: 6px 0; color: var(--text); cursor: pointer; }
.check input { margin-top: 2px; }
.indent { margin-left: 26px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: var(--text-dim); margin-bottom: 8px; }
.adv-sub { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--text-dim); font-weight: 800; margin: 14px 0 4px; padding-top: 12px; border-top: 1px solid var(--border); }
.quick-views { display: grid; gap: 8px; }
.guided-view { font: inherit; text-align: left; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); cursor: pointer; font-size: 13px; }
.guided-view b { display: block; font-weight: 700; }
.guided-view small { display: block; color: var(--text-dim); font-size: 11.5px; margin-top: 2px; line-height: 1.35; }
.guided-view:hover { border-color: var(--amber); }
.guided-view.active { border-color: var(--amber); box-shadow: inset 3px 0 0 var(--amber); }
/* data status: compact card, collapsible */
.status-panel { border: 1px solid var(--border); border-left: 3px solid var(--amber); border-radius: 8px; background: var(--bg); padding: 8px 10px; display: grid; gap: 6px; font-size: 12px; cursor: pointer; }
.status-panel > b { color: var(--text); font-size: 12.5px; }
.status-panel > b::after { content: ' ▾'; color: var(--text-dim); }
.status-panel.expanded > b::after { content: ' ▴'; }
.status-panel:not(.expanded) > :not(b) { display: none; }
.status-label { color: var(--text-dim); font-size: 11px; text-transform: uppercase; font-weight: 800; letter-spacing: .06em; }
.status-value { color: var(--text); }
.status-badge { border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.status-badge.production { background: rgba(63,125,82,.16); color: var(--good); }
.status-badge.partial { background: rgba(227,161,59,.2); color: #8a5800; }
.status-badge.exploratory { background: rgba(177,74,52,.15); color: var(--rust); }
/* layers: a quiet vertical list */
.point-toggles-row { display: block; }
.layer-group { border-bottom: 1px solid var(--border); }
.layer-group:last-child { border-bottom: none; }
.layer-group summary { cursor: pointer; padding: 10px 2px; font-size: 13px; font-weight: 700; color: var(--text); list-style: none; user-select: none; display: flex; align-items: center; gap: 8px; }
.layer-group summary::-webkit-details-marker { display: none; }
.layer-group summary::before { content: '▸'; color: var(--text-dim); width: 12px; }
.layer-group[open] summary::before { content: '▾'; }
.layer-group summary .grp-count { margin-left: auto; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 999px; background: var(--amber); color: var(--night); }
.layer-group summary .grp-count:empty { display: none; }
.layer-group-body { display: flex; flex-direction: column; gap: 2px; padding: 0 2px 10px 20px; }
.layer-group-body label { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 5px 0; cursor: pointer; }
.layer-group-body .seg { width: auto; }
.layer-group-body .seg button { flex: none; padding: 5px 10px; font-size: 12px; }
details.adv > summary { cursor: pointer; list-style: none; user-select: none; }
details.adv > summary::-webkit-details-marker { display: none; }
details.adv > summary h2 { margin: 0; }
details.adv > summary h2::before { content: '▸'; width: 12px; }
details.adv[open] > summary h2::before { content: '▾'; }
details.adv[open] > summary h2 { margin-bottom: 10px; }
.adv-body .layer-group { border-top: 1px solid var(--border); border-bottom: none; margin-top: 12px; }
.adv-body .layer-group-body { padding-left: 2px; }
/* legends and drawer coexistence on desktop */
.point-legend { right: 10px; }
#mapRegion:has(#drawer.open) .point-legend { right: 356px; }
@media (min-width: 721px) { body.panel-hidden #panel { display: none; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; } }
@media (max-width: 720px) {
  #appbar { flex-wrap: wrap; row-gap: 8px; padding: 8px 10px; }
  #appbar h1 { font-size: 15px; flex: 1 1 0; }
  .t-long { display: none; } .t-short { display: inline; }
  #appbar a.back { display: none; }
  .menu-link { display: block; }
  #mobileFilterToggle { min-width: 40px; padding: 6px 10px; font-size: 16px; }
  .appbar-actions { margin-left: 0; }
  .search-wrap { order: 5; flex: 1 1 100%; margin-left: 0; }
  #districtSearch { width: 100%; font-size: 16px; }
  .appbar-actions { margin-left: auto; }
  .btn, .menu > summary { min-height: 40px; }
  #panel { position: fixed; left: 0; right: 0; bottom: 0; top: auto; width: auto; flex: none; height: 78vh; z-index: 1500; border-right: none; border-top: 1px solid var(--border); border-radius: 14px 14px 0 0; box-shadow: 0 -8px 24px rgba(0,0,0,.35); transform: translateY(105%); transition: transform .2s ease; visibility: hidden; }
  body.mobile-filters-open #panel { transform: translateY(0); visibility: visible; }
  .layer-group summary { padding: 13px 2px; }
  .layer-group-body label, .check { min-height: 40px; }
  .guided-view { padding: 12px; }
  #drawer { top: auto; left: 0; right: 0; width: auto; max-width: none; height: 70vh; bottom: 0; transform: translateY(100%); border-left: none; border-top: 1px solid var(--border); border-radius: 12px 12px 0 0; }
  #drawer.open { transform: translateY(0); }
  .point-legend { right: 10px !important; bottom: 12px; max-width: calc(100vw - 20px); max-height: 34vh; overflow-y: auto; }
  .leg { max-width: calc(100vw - 20px); bottom: 12px; }
  #wardLegend { left: 10px; max-width: calc(100vw - 20px); }
  .leaflet-control-zoom { margin-top: 10px !important; }
}
.layer-count { color: var(--text-dim); font-size: 11px; }
.landuse-legend { display: none; flex-wrap: wrap; gap: 4px 10px; margin: 2px 0 4px 22px; font-size: 11px; color: var(--text-dim); }
.mpd-panel { font-size: 11px; }
.mpd-row { display: grid; grid-template-columns: 1.5fr 1fr 1fr 0.6fr; gap: 4px; padding: 3px 0; border-bottom: 1px solid var(--border); }
.mpd-row span:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
.mpd-head { font-weight: 700; color: var(--text-dim); text-transform: uppercase; letter-spacing: .02em; font-size: 11px; }
.mpd-sub { color: var(--text-dim); font-style: italic; }
.mpd-note { margin-top: 6px; font-size: 11px; color: var(--text-dim); line-height: 1.45; }
.landuse-legend.show { display: flex; }
.landuse-legend span { display: inline-flex; align-items: center; gap: 4px; }
.landuse-legend i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.point-legend { position: absolute; bottom: 20px; right: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 11px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); display: none; }
.point-legend.show { display: block; }
.point-legend .row { display: flex; align-items: center; gap: 7px; padding: 2px 0; }
#wardLegend { position: absolute; bottom: 20px; left: 240px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 240px; display: none; }
#wardLegend.show { display: block; }
.analysis-summary { font-size: 12px; color: var(--text-dim); }
.analysis-summary b { color: var(--text); }
.zone-match-ring { filter: drop-shadow(0 0 3px var(--amber)); }
#nearbyPanel { position: absolute; top: 10px; left: 10px; z-index: 1000; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 10px 14px; font-size: 11.5px; color: var(--text-dim); box-shadow: 0 2px 10px rgba(0,0,0,.15); max-width: 260px; display: none; }
#nearbyPanel.show { display: block; }
#nearbyPanel b { color: var(--text); display: block; margin-bottom: 4px; font-size: 12px; }
#nearbyPanel .nb-row { display: flex; justify-content: space-between; padding: 2px 0; }
.weak-cov-outline { stroke-dasharray: 6 4 !important; }
#methodOverlay { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 1900; display: none; align-items: center; justify-content: center; }
#methodOverlay.show { display: flex; }
#methodPanel2 { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px 24px; max-width: 480px; max-height: 80vh; overflow-y: auto; box-shadow: 0 8px 30px rgba(0,0,0,.3); }
#methodPanel2 h3 { margin: 0 0 10px; font-size: 16px; }
#methodPanel2 p, #methodPanel2 li { font-size: 12.5px; color: var(--text-dim); line-height: 1.6; }
#methodPanel2 button { margin-top: 10px; font: inherit; font-size: 12px; padding: 6px 14px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; }
.unsafe-factor-row { display: flex; justify-content: space-between; font-size: 12px; padding: 3px 0; font-family: monospace; }
</style>
</head>
<body>
<header id="appbar" role="banner">
  <button id="mobileFilterToggle" class="btn" type="button" aria-expanded="true" aria-controls="panel" aria-label="Hide map controls">☰ Controls</button>
  <h1><span class="t-long">Delhi Safety &amp; Infrastructure Explorer</span><span class="t-short">Delhi Safety Explorer</span></h1>
  <a class="back" href="delhi_safety_dashboard.html">← Dashboard</a>
  <div class="search-wrap">
    <input id="districtSearch" type="text" placeholder="Search district…" autocomplete="off" aria-label="Search for a district">
    <div id="searchResults"></div>
  </div>
  <div class="appbar-actions">
    <button id="shareUrlBtn" class="btn primary" type="button">🔗 Share</button>
    <details id="moreMenu" class="menu">
      <summary aria-label="More actions">⋯</summary>
      <div class="menu-pop">
        <a class="menu-link" href="delhi_safety_dashboard.html">← Back to dashboard</a>
        <button id="resetMapBtn" type="button">⟲ Reset map</button>
        <button id="downloadCsvBtn" type="button">⬇ Download CSV</button>
        <button id="downloadGeoJsonBtn" type="button">⬇ Download GeoJSON</button>
      </div>
    </details>
  </div>
</header>
<div id="appBody">
<aside id="panel" aria-label="Map controls">
  <section class="p-section" id="secShow">
    <h2>Show on map</h2>
    <label class="field"><span>Metric</span><select id="metricSelect"></select></label>
    <div class="field"><span>Year</span><div class="seg" id="yearToggle"></div></div>
    <div class="field"><span>Calculation</span><div class="seg" id="rateToggle"></div></div>
    <div class="status-panel" id="dataStatus" aria-live="polite"></div>
  </section>
  <section class="p-section" id="secQuick">
    <h2>Quick views</h2>
    <div class="quick-views" aria-label="Guided map views">
      <button class="guided-view" type="button" data-view="crime-light"><b>High crime + low lighting</b><small>Total IPC crime against combined streetlight coverage</small></button>
      <button class="guided-view" type="button" data-view="fatal-corridors"><b>Fatal-crash corridors</b><small>Fatal crashes in crash-prone zones, 2024</small></button>
      <button class="guided-view" type="button" data-view="transit-gaps"><b>Transit-access gaps</b><small>Total IPC crime against metro-gate density, with bus stops</small></button>
    </div>
  </section>
  <section class="p-section" id="secLayers">
    <div class="p-head"><h2>Map layers <span class="pill" id="layersActive"></span></h2><button id="clearLayersBtn" class="link-btn" type="button">Clear all</button></div>
    <div class="point-toggles-row" id="pointLayerToggles">
    <details class="layer-group">
      <summary>Police &amp; emergency</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkPolice"> Police stations <span class="layer-count" id="cntPolice"></span></label>
        <label><input type="checkbox" id="chkPosts"> Chowkis/posts <span class="layer-count" id="cntPosts"></span></label>
        <label><input type="checkbox" id="chkHospitals"> Hospitals <span class="layer-count" id="cntHospitals"></span></label>
      </div>
    </details>
    <details class="layer-group">
      <summary>Crash zones</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkZones"> Crash zones <span class="layer-count" id="cntZones"></span></label>
        <label>Zone year: <div class="seg" id="zoneYearToggle"><button class="active" data-year="2023">2023</button><button data-year="2024">2024</button></div></label>
        <label><input type="checkbox" id="chkCrashZones2024Approx"> Crash zones 2024 (full, approx.) <span class="layer-count" id="cntCrashZones2024Approx"></span></label>
      </div>
    </details>
    <details class="layer-group">
      <summary>Streetlights (PAPL + OSM)</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkPaplStreetlights" title="PAPL streetlight survey cells; marker labels show recorded light counts"> PAPL survey cells <span class="layer-count" id="cntPaplStreetlights"></span></label>
        <label><input type="checkbox" id="chkStreetLamps" title="OSM-tagged individual street lamps; independent of the PAPL survey"> OSM street lamps <span class="layer-count" id="cntStreetLamps"></span></label>
      </div>
    </details>
    <details class="layer-group">
      <summary>Roads &amp; footpaths</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkTrafficSignals"> Traffic signals <span class="layer-count" id="cntTrafficSignals"></span></label>
        <label><input type="checkbox" id="chkCrossings"> Pedestrian crossings <span class="layer-count" id="cntCrossings"></span></label>
        <label><input type="checkbox" id="chkOverpasses"> Pedestrian overbridges <span class="layer-count" id="cntOverpasses"></span></label>
      </div>
    </details>
    <details class="layer-group">
      <summary>Places</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkBus"> Bus stops <span class="layer-count" id="cntBus"></span></label>
        <label><input type="checkbox" id="chkAtm"> ATMs <span class="layer-count" id="cntAtm"></span></label>
        <label><input type="checkbox" id="chkAlcohol"> Liquor shops <span class="layer-count" id="cntAlcohol"></span></label>
        <label><input type="checkbox" id="chkLiquorVends"> Liquor vends (official, approx.) <span class="layer-count" id="cntLiquorVends"></span></label>
      </div>
    </details>
    <details class="layer-group">
      <summary>Surveillance &amp; CCTV recommendations</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkSurveillance"> CCTV/guards <span class="layer-count" id="cntSurveillance"></span></label>
        <label><input type="checkbox" id="chkCctvPriority"> CCTV priority sites <span class="layer-count" id="cntCctvPriority"></span></label>
        <label><input type="checkbox" id="chkCctvExploratory" title="Project-computed from crash severity, volume, and nearby camera gap — not an official report recommendation"> CCTV recommended, exploratory <span class="layer-count" id="cntCctvExploratory"></span></label>
      </div>
    </details>
    <details class="layer-group">
      <summary>Land use</summary>
      <div class="layer-group-body">
        <label><input type="checkbox" id="chkLanduse" title="OSM-mapped land use — only ~23.4% of Delhi's area is tagged; untagged area is not necessarily vacant"> Land use <span class="layer-count" id="cntLanduse"></span></label>
        <div id="landuseLegend" class="landuse-legend">
          <span><i style="background:#e3a13b;"></i>Residential</span>
          <span><i style="background:#b14a34;"></i>Commercial</span>
          <span><i style="background:#626b78;"></i>Industrial</span>
          <span><i style="background:#3d5a99;"></i>Institutional</span>
          <span><i style="background:#3f7d52;"></i>Green/open</span>
          <span><i style="background:#8b8b8b;"></i>Other</span>
        </div>
      </div>
    </details>
    </div>
  </section>
  <details class="p-section adv" id="advanced">
    <summary><h2>Advanced analysis <span class="pill" id="advActive"></span></h2></summary>
    <div class="adv-body">
      <div class="field"><span>Map style</span><div class="seg" id="displayModeToggle"></div></div>
      <label class="check"><input type="checkbox" id="chkBivariate"> Compare crime with infrastructure (bivariate)</label>
      <label class="indent" id="bivInfraWrap" style="display:none"><span>Infrastructure</span><select id="bivInfraSelect"></select></label>
      <label class="check"><input type="checkbox" id="chkHeatmap"> Crash-zone heatmap</label>
      <label class="check"><input type="checkbox" id="chkUnsafe"> Composite unsafe-areas score</label>
      <span id="unsafeMethodLink" style="display:none; cursor:pointer; text-decoration:underline; color:var(--text-dim); font-size:12px; margin-left:26px;">ⓘ methodology</span>
      <div class="adv-sub">Ward level (290 wards)</div>
      <label class="check"><input type="checkbox" id="chkWardBivariate"> Ward bivariate</label>
      <label class="indent" id="wardInfraWrap" style="display:none"><span>Compare</span><select id="wardInfraXSelect"></select><span>against</span><select id="wardInfraYSelect"></select></label>
      <label class="check"><input type="checkbox" id="chkWardExploratoryIndex"> Liquor-crash exploratory index</label>
      <div class="adv-sub">Spatial analysis</div>
      <label class="field"><span>Analysis</span><select id="analysisSelect">
        <option value="none">None</option>
        <option value="crashesNearLiquor">Crashes near liquor shops</option>
        <option value="crashesNoSurveillance">Crashes without nearby surveillance</option>
        <option value="crashesNearBus">Crashes near bus stops</option>
        <option value="weakPoliceCoverage">High-crime districts, weak police coverage</option>
      </select></label>
      <div class="field"><span>Radius</span><div class="seg" id="radiusToggle"></div></div>
      <div class="analysis-summary" id="analysisSummary"></div>
    <details class="layer-group">
      <summary>Master Plan 2047 vs current</summary>
      <div class="layer-group-body">
        ${mpd2047CitywidePanelHtml()}
      </div>
    </details>
    </div>
  </details>
</aside>
<div id="mapRegion">
  <div id="mapWrap"><div id="map" role="region" aria-label="Map of Delhi police districts with selectable data layers"></div></div>
  <div class="leg" id="legend"></div>
  <div class="point-legend" id="pointLegend"></div>
  <div id="wardLegend"></div>
  <div id="nearbyPanel"></div>
  <div id="drawer" role="complementary" aria-label="District details">
    <button class="drawer-close" id="drawerClose" aria-label="Close">✕</button>
    <div id="drawerBody"></div>
  </div>
</div>
</div>
<div id="methodOverlay">
  <div id="methodPanel2">
    <h3>Composite "Unsafe Areas" — methodology</h3>
    <p>Each district's score is the plain average of five factors, each converted to a 0-1 percentile rank across the 15 districts first (so no single factor's raw scale can dominate the others). No hidden weighting — every factor counts equally.</p>
    <ul>
      <li><b>Total IPC crime density</b> (higher rank = less safe)</li>
      <li><b>Crime against women density</b> (higher rank = less safe)</li>
      <li><b>Fatal crashes (2023) density</b> (higher rank = less safe)</li>
      <li><b>Police infrastructure density</b> (rank inverted — lower coverage = less safe)</li>
      <li><b>Streetlight density</b> (rank inverted — lower coverage = less safe; districts the PAPL survey never covered are excluded from this one factor only, and flagged, rather than silently counted as "no streetlights")</li>
    </ul>
    <p>This is one illustrative composite, not an official risk index — click any district while this mode is on to see its exact factor-by-factor breakdown in the popup.</p>
    <button id="methodCloseBtn" type="button">Close</button>
  </div>
</div>

<script>
const BOUNDARIES = ${JSON.stringify(boundaries)};
const POLICE = ${JSON.stringify(policeMarkers)};
const POI = ${JSON.stringify(poiMarkers)};
const PAPL_STREETLIGHT_POINTS = ${JSON.stringify(paplStreetlightPoints)};
const ZONES_BY_YEAR = { '2023': ${JSON.stringify(crashZones)}, '2024': ${JSON.stringify(crashZones2024)} };
const ZONES = ZONES_BY_YEAR['2023'];
const wardsInfra = ${JSON.stringify(wardsInfra)};
const LIQUOR_VENDS_APPROX = ${JSON.stringify(liquorVendsApprox)};
const CRASH_ZONES_2024_APPROX = ${JSON.stringify(crashZones2024Approx)};
const PEDESTRIAN_OVERPASSES = ${JSON.stringify(pedestrianOverpasses)};
const landuse = ${JSON.stringify(landuse)};

// Crime/road-safety metrics -- mirrors build.js's METRICS[] (year-aware fields, sources) so
// this page's popups/colors carry the same year semantics as the main dashboard instead of
// silently showing a different basis.
const METRICS = [
  { key: 'theft', label: 'Theft', full: 'Theft (Sec. 379 IPC)', prevKey: 'theft2022', key2024: 'theft2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'robbery', label: 'Robbery', full: 'Robbery (Sec. 392/394/397 IPC)', prevKey: 'robbery2022', key2024: 'robbery2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'burglary', label: 'Burglary', full: 'Burglary (Sec. 454-460 IPC)', prevKey: 'burglary2022', key2024: 'burglary2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'totalIPC', label: 'Total IPC', full: 'Total Cognizable IPC Crimes', prevKey: 'totalIPC2022', key2024: 'totalIPC2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'crimeAgainstWomen', label: 'Vs. Women', full: 'Total Crime Against Women', prevKey: 'crimeAgainstWomen2022', key2024: 'crimeAgainstWomen2024', source: 'NCRB Crime in India District-Wise Reports' },
  { key: 'totalSLL', label: 'SLL Crimes', full: 'Total Cognizable SLL Crimes', prevKey: 'totalSLL2022', key2024: 'totalSLL2024', source: 'NCRB Crime in India District-Wise Reports' },
  // 2022-only series: the Delhi Traffic Police report changed format after 2022, so these stay
  // pinned with fixedYear and are NOT folded into the Year selector. Persons Killed is the
  // full-district successor for 2023/2024.
  { key: 'fatalRoadCrashes2022', label: 'Road Deaths', year: '2022', full: 'Fatal Road Crashes', note: 'the source report changed format after 2022; for 2023/2024 use Persons Killed instead', fixedYear: '2022', source: 'Delhi Traffic Police 2022 Report' },
  { key: 'hitAndRunCrashes2022', label: 'Hit & Run', year: '2022', full: 'Hit-and-Run Fatal Crashes', note: 'not published in this district-level form after 2022', fixedYear: '2022', source: 'Delhi Traffic Police 2022 Report' },
  // Road-safety series published for both 2023 and 2024: one consolidated entry each, driven by
  // the Year selector through yearVariants, the same way build.js does it. The per-year duplicates
  // below stay in METRICS (hiddenFromSelector) so already-shared ?crime=...2024 links still resolve.
  // full/note carry no year of their own -- every display site appends the selected year itself.
  { key: 'crashProneZones2023', label: 'Crash Zones', year: '2023', yearVariants: { '2023': 'crashProneZones2023', '2024': 'crashProneZones2024' }, full: 'Crash-Prone Zones', source: 'Delhi Road Crash Report 2023', sourceByYear: { '2023': 'Delhi Road Crash Report 2023', '2024': 'Delhi Road Crash Report 2024, Table 6.31' } },
  { key: 'fatalCrashes2023', label: 'Fatal Crashes', year: '2023', yearVariants: { '2023': 'fatalCrashes2023', '2024': 'fatalCrashes2024' }, full: 'Fatal Crashes', note: 'within identified crash-prone zones, not the full district total', source: 'Delhi Road Crash Report 2023', sourceByYear: { '2023': 'Delhi Road Crash Report 2023', '2024': 'Delhi Road Crash Report 2024, Table 6.31' } },
  { key: 'totalCrashes2023', label: 'Total Crashes', year: '2023', yearVariants: { '2023': 'totalCrashes2023', '2024': 'totalCrashes2024' }, full: 'Total Road Crashes', note: 'within identified crash-prone zones, not the full district total', source: 'Delhi Road Crash Report 2023', sourceByYear: { '2023': 'Delhi Road Crash Report 2023', '2024': 'Delhi Road Crash Report 2024, Table 6.31' } },
  { key: 'personsKilled2023', label: 'Persons Killed', year: '2023', yearVariants: { '2023': 'personsKilled2023', '2024': 'personsKilled2024' }, full: 'Persons Killed in Road Crashes', note: 'full-district total, not limited to crash-prone zones', source: 'Delhi Road Crash Report 2024, Table 6.2' },
  { key: 'personsInjured2023', label: 'Persons Injured', year: '2023', yearVariants: { '2023': 'personsInjured2023', '2024': 'personsInjured2024' }, full: 'Persons Injured in Road Crashes', note: 'full-district total, not limited to crash-prone zones', source: 'Delhi Road Crash Report 2024, Table 6.2' },
  { key: 'crashProneZones2024', hiddenFromSelector: true, label: 'Crash Zones \\'24', year: '2024', full: 'Crash-Prone Zones', fixedYear: '2024', source: 'Delhi Road Crash Report 2024, Table 6.31' },
  { key: 'fatalCrashes2024', hiddenFromSelector: true, label: 'Fatal Crashes \\'24', year: '2024', full: 'Fatal Crashes', note: 'within identified crash-prone zones, not the full district total', fixedYear: '2024', source: 'Delhi Road Crash Report 2024, Table 6.31' },
  { key: 'totalCrashes2024', hiddenFromSelector: true, label: 'Total Crashes \\'24', year: '2024', full: 'Total Road Crashes', note: 'within identified crash-prone zones, not the full district total', fixedYear: '2024', source: 'Delhi Road Crash Report 2024, Table 6.31' },
  { key: 'personsKilled2024', hiddenFromSelector: true, label: 'Persons Killed \\'24', year: '2024', full: 'Persons Killed in Road Crashes', note: 'full-district total, not limited to crash-prone zones', fixedYear: '2024', source: 'Delhi Road Crash Report 2024, Table 6.2' },
  { key: 'personsInjured2024', hiddenFromSelector: true, label: 'Persons Injured \\'24', year: '2024', full: 'Persons Injured in Road Crashes', note: 'full-district total, not limited to crash-prone zones', fixedYear: '2024', source: 'Delhi Road Crash Report 2024, Table 6.2' },
];

const INFRA = [
  { key: 'streetlight', densityKey: 'lightDensityPerKm2', countKey: 'totalLights', label: 'Streetlights', source: 'PAPL Open Transit Survey' },
  { key: 'underpass', densityKey: 'underpassDensity', countKey: 'underpasses', label: 'Underpasses', source: 'PAPL Open Transit Survey' },
  { key: 'pedestrianOverpass', densityKey: 'pedestrianOverpassDensity', countKey: 'pedestrianOverpasses', label: 'Pedestrian Overbridges', source: 'OpenStreetMap Overpass snapshot 2026-08-04 (mapped inventory)' },
  { key: 'metroGate', densityKey: 'metroGateDensity', countKey: 'metroGates', label: 'Metro gates', source: 'OpenStreetMap' },
  { key: 'policeInfra', densityKey: 'policeInfraDensity', countKey: 'policeInfraCount', label: 'Police Infra', source: 'Delhi Police GSDL + OpenStreetMap' },
  { key: 'busStop', densityKey: 'busStopDensity', countKey: 'busStops', label: 'Bus Stops', source: 'OpenStreetMap' },
  { key: 'atm', densityKey: 'atmDensity', countKey: 'atms', label: 'ATMs', source: 'OpenStreetMap (Overpass API)' },
  { key: 'alcoholShop', densityKey: 'alcoholShopDensity', countKey: 'alcoholShops', label: 'Liquor Shops', source: 'OpenStreetMap (Overpass API)' },
  { key: 'surveillance', densityKey: 'surveillanceDensity', countKey: 'surveillanceCameras', label: 'CCTV & Guards', source: 'OpenStreetMap (Overpass API)' },
  { key: 'footway', densityKey: 'footwayDensityKmPerKm2', countKey: 'footwayLengthKm', label: 'Footpath/Sidewalk Coverage (km)', source: 'OpenStreetMap (Overpass API), mapped footway/sidewalk ways, snapshot 2026-08-06 -- not an official completeness register' },
  { key: 'streetlightCombined', densityKey: 'combined_density_per_km2', countKey: 'combined_count', label: 'Streetlights (PAPL + OSM combined)', source: 'PAPL Open Transit Survey where surveyed (9 districts); OpenStreetMap street_lamp count where PAPL has no survey data -- see combined_source per district, never blended into one unattributed number' },
];

// Ward-level metrics available to the bivariate mode, split into two groups so any pairing —
// infra x infra, crime x crime, or infra x crime — is possible, not just infra x infra as before.
// "Infra" fields are OSM/official point layers aggregated onto wards by point-in-polygon (basis:
// exploratory, since the source coordinates for liquor vends are themselves approximate).
// "Crime/incidents" fields are either true ward-level incident counts (2024 crash zones — also
// approximate-coordinate point-in-polygon, basis: exploratory) or a district crime figure copied
// down onto every ward inside it, since NCRB does not publish crime below district level (basis:
// district-inherited). Field names match data/delhi_wards_infra.geojson exactly.
const WARD_INFRA = [
  { key: 'busStops', densityKey: 'busStopsDensity', label: 'Bus Stops', group: 'infra', basis: null },
  { key: 'atms', densityKey: 'atmsDensity', label: 'ATMs', group: 'infra', basis: null },
  { key: 'alcoholShops', densityKey: 'alcoholShopsDensity', label: 'Liquor Shops (OSM)', group: 'infra', basis: null },
  { key: 'surveillance', densityKey: 'surveillanceDensity', label: 'CCTV & Guards', group: 'infra', basis: null },
  { key: 'officialLiquorVends', densityKey: 'officialLiquorVendsDensity', label: 'Liquor Vends (official)', group: 'infra', basis: 'exploratory' },
  { key: 'crashZones2024', densityKey: 'crashZones2024Density', label: 'Crash Zones (2024)', group: 'crime', basis: 'exploratory' },
  { key: 'totalIPCDensity2024Inherited', densityKey: 'totalIPCDensity2024Inherited', label: 'Total IPC Crime Rate (district)', group: 'crime', basis: 'district-inherited' },
  { key: 'crimeAgainstWomenDensity2024Inherited', densityKey: 'crimeAgainstWomenDensity2024Inherited', label: 'Crime vs. Women Rate (district)', group: 'crime', basis: 'district-inherited' },
  // MPD-2047 planned-versus-current shares. These are percentage-point differences, not densities,
  // so densityKey deliberately points at the same field: there is nothing to divide by area.
  { key: 'mpdDelta_residential', densityKey: 'mpdDelta_residential', label: 'Residential: plan − current (pp)', unit: ' pp', group: 'plan', basis: 'plan-vs-mapped' },
  { key: 'mpdDelta_industrial', densityKey: 'mpdDelta_industrial', label: 'Industrial: plan − current (pp)', unit: ' pp', group: 'plan', basis: 'plan-vs-mapped' },
  { key: 'mpdDelta_green_open', densityKey: 'mpdDelta_green_open', label: 'Parks/green (excl. farmland): plan − current (pp)', unit: ' pp', group: 'plan', basis: 'plan-vs-mapped' },
  { key: 'mpdDelta_agriculture', densityKey: 'mpdDelta_agriculture', label: 'Agriculture (A1): plan − current (pp)', unit: ' pp', group: 'plan', basis: 'plan-vs-mapped' },
  { key: 'mpdPlanCoveragePct', densityKey: 'mpdPlanCoveragePct', label: 'MPD-2047 coverage of ward (%)', unit: '%', group: 'plan', basis: null },
];
const WARD_INFRA_BASIS_LABEL = {
  exploratory: 'exploratory — assigned to this ward from an approximate coordinate, not a verified location',
  'district-inherited': "district-inherited — this is the enclosing district's figure, not ward-specific data",
  'plan-vs-mapped': 'plan vs mapped — a statutory designation compared against community mapping, not a measurement of change on the ground. A positive value can mean the plan designates more of this, or that OpenStreetMap has not tagged it yet',
};

// Districts the PAPL survey actually drove through — shared gap for streetlights and
// underpasses. Mirrors build.js's SURVEYED set/infraCovered() exactly.
const SURVEYED = new Set(['Central','East','New Delhi','North','Shahdara','South','South-East','South-West','West']);
function infraCovered(d, infraKey) {
  if (infraKey === 'metroGate' || infraKey === 'busStop' || infraKey === 'atm' || infraKey === 'alcoholShop' || infraKey === 'surveillance' || infraKey === 'pedestrianOverpass' || infraKey === 'footway') return true;
  if (infraKey === 'policeInfra') return d.chowkiPosts > 0;
  if (infraKey === 'streetlightCombined') return d.combined_count != null; // covered whenever either PAPL or the OSM fallback actually has a number
  return SURVEYED.has(d.district) && d[infraKey === 'streetlight' ? 'surveyPoints' : 'underpasses'] >= 10;
}
function pearson(xs, ys) {
  const n = xs.length;
  const mx = xs.reduce((a,b)=>a+b,0)/n, my = ys.reduce((a,b)=>a+b,0)/n;
  let num=0, dx2=0, dy2=0;
  for (let i=0;i<n;i++){ const dx=xs[i]-mx, dy=ys[i]-my; num+=dx*dy; dx2+=dx*dx; dy2+=dy*dy; }
  return num/Math.sqrt(dx2*dy2);
}

let activeYear = '2024'; // most recent year with complete data for all 15 districts on every metric
let rateMode = 'density'; // 'density' (per km²) or 'perCapita' (per 100k residents)
let bivariateMode = false;
let bivariateInfra = 'policeInfra';
let unsafeMode = false; // declared here (not near its own module further below) because
                          // renderChoropleth() references it and runs once during initial
                          // page setup, before later let/const lines would otherwise execute --
                          // referencing a not-yet-initialized let throws and silently halts the
                          // rest of the script, which is exactly what happened before this fix.
let selectedDistrict = null;

const metricSelect = document.getElementById('metricSelect');
// Only consolidated entries are listed; the per-year duplicates stay in METRICS (reachable by
// URL) but would otherwise list the same series twice, once per year. Grouped Crime / Road safety
// to match the main dashboard's selector.
function metricOptionSource(m) {
  // Year-dependent sources are spelled out in full here, since a single option title has to stay
  // correct whichever year is selected.
  return m.sourceByYear ? Object.keys(m.sourceByYear).map(y => y + ': ' + m.sourceByYear[y]).join(' · ') : m.source;
}
(function renderMetricOptions() {
  const visible = METRICS.filter(m => !m.hiddenFromSelector);
  const opt = m => '<option value="' + m.key + '" title="' + (m.full + metricNote(m) + ' — ' + metricOptionSource(m)).replace(/"/g, '&quot;') + '">' + m.label + '</option>';
  metricSelect.innerHTML =
    '<optgroup label="Crime">' + visible.filter(m => m.prevKey).map(opt).join('') + '</optgroup>' +
    '<optgroup label="Road safety">' + visible.filter(m => !m.prevKey).map(opt).join('') + '</optgroup>';
})();
const bivInfraSelect = document.getElementById('bivInfraSelect');
bivInfraSelect.innerHTML = INFRA.map(i => '<option value="' + i.key + '" title="' + (i.label + ' — Source: ' + i.source).replace(/"/g, '&quot;') + '">' + i.label + '</option>').join('');
bivInfraSelect.value = bivariateInfra;

function fmtNum(n) { return n == null ? '—' : n.toLocaleString('en-IN'); }
function currentMetric() { return METRICS.find(m => m.key === metricSelect.value); }
function currentInfra() { return INFRA.find(i => i.key === bivInfraSelect.value); }

function yearFieldKey(m, year) {
  // Road-safety series name their per-year fields explicitly. Fall back to the metric's own base
  // year when the requested year has no variant, so a stale activeYear can never resolve to an
  // undefined field and silently grey out the whole choropleth.
  if (m.yearVariants) return m.yearVariants[year] || m.yearVariants[m.year] || m.key;
  if (!m.prevKey) return m.key;
  if (year === '2022') return m.prevKey;
  if (year === '2024') return m.key2024;
  return m.key;
}
function metricYears(m) {
  if (m.yearVariants) return Object.keys(m.yearVariants);
  if (!m.prevKey) return [m.fixedYear || m.year];
  return ['2022', '2023', '2024'];
}
function metricSupportsYear(m, year) { return metricYears(m).indexOf(year) !== -1; }
function prevYearOf(year) { return year === '2024' ? '2023' : year === '2023' ? '2022' : null; }
function effectiveYear(m) { return m.fixedYear || activeYear; }
// The crash-zone tables are published in a different report per year, so cite the one the
// selected year actually came from instead of a single fixed string.
function metricSource(m) { return (m.sourceByYear && m.sourceByYear[effectiveYear(m)]) || m.source; }
function metricNote(m) { return m.note ? ' — ' + m.note : ''; }
function dataStatusFor(m) {
  const year = effectiveYear(m);
  if (m.prevKey) {
    if (+year < 2022) return { state: 'production', label: 'Production · verified historical', coverage: '15 police districts where published; some early fields intentionally null', comparable: 'Compare only adjacent available years in the same series', source: m.source + ' / verified India Data Portal extract' };
    return { state: 'production', label: 'Production', coverage: 'All 15 Delhi Police districts', comparable: '2022–2024 same district series; 2024 uses BNS-era table numbering', source: metricSource(m) };
  }
  if (m.key === 'fatalRoadCrashes2022' || m.key === 'hitAndRunCrashes2022') return { state: 'partial', label: 'Partial coverage', coverage: '11 Traffic Police reporting districts; four police districts not separately reported', comparable: 'Do not compare as a 15-district series or infer missing districts as zero', source: metricSource(m) };
  if (m.key === 'crashProneZones2023' || m.key === 'fatalCrashes2023' || m.key === 'totalCrashes2023') return { state: 'production', label: 'Production', coverage: 'All 15 police districts; crash-prone-zone scope only', comparable: 'Compare 2023–2024 within this same crash-zone series, not with full district crash totals', source: metricSource(m) };
  return { state: 'production', label: 'Production', coverage: 'All 15 police districts; full district road-crash totals', comparable: 'Compare 2023–2024 within this series', source: metricSource(m) };
}
function renderDataStatus() {
  const s = dataStatusFor(currentMetric());
  const el = document.getElementById('dataStatus');
  el.innerHTML = '<b>Data status · ' + currentMetric().label + ' (' + effectiveYear(currentMetric()) + ')</b>' +
    '<span><span class="status-label">Status</span> <span class="status-badge ' + s.state + '">' + s.label + '</span></span>' +
    '<span><span class="status-label">Coverage</span> <span class="status-value">' + s.coverage + '</span></span>' +
    '<span><span class="status-label">Comparable?</span> <span class="status-value">' + s.comparable + '</span></span>' +
    '<span><span class="status-label">Source</span> <span class="status-value">' + s.source + '</span></span>';
}

function getRateVal(rawCount, d) {
  if (rawCount == null) return null;
  if (rateMode === 'perCapita') return Math.round((rawCount / d.population) * 100000 * 10) / 10;
  return Math.round((rawCount / d.areaSqKm) * 10) / 10;
}
function metricValue(d, m) {
  const val = d[yearFieldKey(m, activeYear)];
  return getRateVal(val, d);
}
function getInfraVal(d, inf) {
  const count = d[inf.countKey];
  if (count == null) return null;
  if (rateMode === 'perCapita') return Math.round((count / d.population) * 100000 * 10) / 10;
  return d[inf.densityKey];
}
function rankOf(propsList, key) {
  const vals = propsList.map(p => p[key]).filter(v => v != null).sort((a,b) => b - a);
  return (d) => vals.indexOf(d[key]) + 1;
}
function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}
function yoyBadge(cur, prev) {
  if (cur == null || prev == null || prev === 0) return '';
  const pct = ((cur - prev) / prev) * 100;
  const cls = pct >= 0 ? 'up' : 'down';
  const arrow = pct >= 0 ? '▲' : '▼';
  return '<span class="yoy ' + cls + '">' + arrow + ' ' + (pct >= 0 ? '+' : '') + pct.toFixed(1) + '% vs ' + prevYearOf(activeYear) + '</span>';
}

// Percentile-rank color scale — same rationale as the main dashboard: an outlier district
// shouldn't wash out the color range for everyone else.
function percentileScale(values) {
  const sorted = [...values].sort((a,b)=>a-b);
  const n = sorted.length;
  return v => {
    if (n <= 1) return 0.5;
    const first = sorted.indexOf(v);
    const last = sorted.length - 1 - [...sorted].reverse().indexOf(v);
    return ((first+last)/2) / (n-1);
  };
}
function rustScale(t) {
  const c1 = [230,214,179], c2 = [177,74,52];
  const r = Math.round(c1[0]+(c2[0]-c1[0])*t), g = Math.round(c1[1]+(c2[1]-c1[1])*t), b = Math.round(c1[2]+(c2[2]-c1[2])*t);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// 3x3 bivariate color matrix — rows = infra density (low→high), columns = crime (low→high).
// Same palette/logic as build.js's BIVARIATE_MATRIX/getTertileIndex/getBivariateColor.
const BIVARIATE_MATRIX = [
  ['#e8e8e8', '#e4acac', '#c85a5a'],
  ['#a0c7c7', '#ad9ea5', '#985356'],
  ['#5b9e9e', '#5d757d', '#574249'],
];
function getTertileIndex(val, sortedArr) {
  if (val == null || sortedArr.length === 0) return 0;
  const q33 = sortedArr[Math.floor(sortedArr.length * 0.33)];
  const q66 = sortedArr[Math.floor(sortedArr.length * 0.66)];
  if (val <= q33) return 0;
  if (val <= q66) return 1;
  return 2;
}
function getBivariateColor(feats, d, m, inf) {
  const validDists = feats.map(f=>f.properties).filter(x => getInfraVal(x, inf) != null && metricValue(x, m) != null);
  if (!validDists.length) return '#999';
  const crimeValues = validDists.map(x => metricValue(x, m)).sort((a,b)=>a-b);
  const infraValues = validDists.map(x => getInfraVal(x, inf)).sort((a,b)=>a-b);
  const currentCrime = metricValue(d, m), currentInfra = getInfraVal(d, inf);
  if (currentCrime == null || currentInfra == null) return '#999';
  const xIndex = getTertileIndex(currentCrime, crimeValues);
  const yIndex = getTertileIndex(currentInfra, infraValues);
  return BIVARIATE_MATRIX[yIndex][xIndex];
}

// ── Ward-level bivariate mode: two WARD_INFRA metrics cross-referenced at ward granularity (290
// wards) instead of the 15 districts — infra x infra, crime x crime, or infra x crime, using the
// same 3x3 tertile-matrix approach as the district bivariate mode above, against WARDS_INFRA's
// per-ward density fields directly.
let wardBivariateMode = false;
let wardInfraX = 'busStops';
let wardInfraY = 'surveillance';
let wardLayer = null;
let wardExploratoryMode = false; // declared here, not near its own section further below, for the
                                   // same TDZ reason as heatLayer/zoneYear above.
// heatLayer and zoneYear are declared here (not near their own sections further below) because
// rebuildZonesLayer()'s initial call, and the first updateUrlState() call inside the initial
// renderChoropleth(), both happen before those sections textually run -- referencing either
// variable before its let executes would throw a TDZ ReferenceError and silently halt the rest
// of the script, the same class of bug already documented on unsafeMode above.
let heatLayer = null;
let zoneYear = '2023';

function getWardBivariateColor(feats, props, xInf, yInf) {
  const valid = feats.map(f => f.properties).filter(p => p[xInf.densityKey] != null && p[yInf.densityKey] != null);
  if (!valid.length) return '#999';
  const xValues = valid.map(p => p[xInf.densityKey]).sort((a,b)=>a-b);
  const yValues = valid.map(p => p[yInf.densityKey]).sort((a,b)=>a-b);
  const xv = props[xInf.densityKey], yv = props[yInf.densityKey];
  if (xv == null || yv == null) return '#999';
  const xIndex = getTertileIndex(xv, xValues);
  const yIndex = getTertileIndex(yv, yValues);
  return BIVARIATE_MATRIX[yIndex][xIndex];
}

function wardMetricLine(p, inf) {
  const sameKey = inf.key === inf.densityKey;
  // Most ward fields are densities, so /km² is the default. The MPD-2047 fields are percentage
  // points and percentages, which /km² would actively misrepresent, so they declare a unit.
  const unit = inf.unit || '/km²';
  const valueHtml = sameKey
    ? '<b>' + fmtNum(p[inf.key]) + '</b>' + unit
    : '<b>' + fmtNum(p[inf.key]) + '</b> (' + fmtNum(p[inf.densityKey]) + unit + ')';
  const caveat = inf.basis ? ' <span style="font-style:italic;">— ' + WARD_INFRA_BASIS_LABEL[inf.basis] + '</span>' : '';
  return '<div>' + inf.label + ': ' + valueHtml + caveat + '</div>';
}
// Shown whenever a Master Plan field is on either axis. A plan-minus-current difference is
// meaningless without knowing how much of the ward each side actually describes, so the two
// coverage denominators are printed next to the numbers every time -- never the delta alone.
function mpdComparisonBlock(p, infs) {
  if (!infs.some(i => i && i.group === 'plan')) return '';
  const cats = [
    ['residential', 'Residential'],
    ['industrial', 'Industrial'],
    ['green_open', 'Parks / green (excl. farmland)'],
    ['agriculture', 'Agriculture land (A1)'],
  ];
  const rows = cats.map(([k, label]) => {
    const planned = p['mpdPlanned_' + k], current = p['mpdCurrent_' + k], delta = p['mpdDelta_' + k];
    if (planned == null && current == null) return '';
    return '<div class="unsafe-factor-row"><span>' + label + '</span><span>'
      + 'plan ' + fmtNum(planned) + '% · now ' + fmtNum(current) + '%'
      + (delta == null ? '' : ' · <b>' + (delta > 0 ? '+' : '') + fmtNum(delta) + ' pp</b>')
      + '</span></div>';
  }).join('');
  const thin = p.mpdConfidence && p.mpdConfidence !== 'ok';
  return '<div style="margin-top:6px;"><b>Master Plan 2047 vs current</b></div>'
    + '<div class="popup-rank">Plan describes ' + fmtNum(p.mpdPlanCoveragePct) + '% of this ward · OpenStreetMap land-use tags cover ' + fmtNum(p.mpdOsmMappedPct) + '%</div>'
    + rows
    + (p.mpdNotComparableKm2 ? '<div class="unsafe-factor-row"><span>Planned, not comparable</span><span>' + fmtNum(p.mpdNotComparableKm2) + ' km²</span></div>' : '')
    + (thin ? '<div class="popup-src" style="color:var(--rust);">Thin coverage on at least one side — treat this difference as indicative only.</div>' : '')
    + '<div class="popup-src">Shares are of each source\\'s own described area, because the plan and OpenStreetMap cover very different fractions of a ward. Only residential, industrial and parks/green are compared; commercial, public/semi-public, government, transport and utility designations have no unambiguous OpenStreetMap counterpart and are reported as planned-only area. Green Belt (A1) is a Low Density Area policy designation that includes village abadi, so it is not counted as green space.</div>';
}

function renderWardLayer() {
  if (wardLayer) { map.removeLayer(wardLayer); wardLayer = null; }
  if (!wardBivariateMode) { renderWardLegend(false); return; }
  const xInf = WARD_INFRA.find(w => w.key === wardInfraX);
  const yInf = WARD_INFRA.find(w => w.key === wardInfraY);
  const feats = wardsInfra.features;
  wardLayer = L.geoJSON(wardsInfra, {
    style: f => ({ fillColor: getWardBivariateColor(feats, f.properties, xInf, yInf), fillOpacity: 0.75, color: '#fff', weight: 0.8 }),
    onEachFeature: (f, layer) => {
      const p = f.properties;
      const body = '<div class="popup-title">' + p.Ward_Name + '</div>' +
        '<div class="popup-rank">Ward — ' + p.areaSqKm + ' km² · enclosing district (approx.): ' + (p.assignedDistrict || 'unassigned') + '</div>' +
        (p.highInjuryNetwork ? '<div style="color:var(--rust);font-weight:700;">⚠ High-Injury Network — #' + p.highInjuryNetworkRank + ' of 18 wards accounting for half of 2024\\'s ward-assigned fatal crashes</div>' : '') +
        wardMetricLine(p, xInf) + wardMetricLine(p, yInf) +
        mpdComparisonBlock(p, [xInf, yInf]) +
        '<div class="popup-src">Ward boundaries: DataMeet Municipal_Spatial_Data (likely pre-2022 delimitation, used for spatial aggregation only) · ' + WARD_INFRA.filter(w=>[xInf.key,yInf.key].includes(w.key)).map(w=>w.label).join(' & ') + ' — see caveats above</div>';
      layer.bindPopup(body);
      layer.on('mouseover', () => layer.setStyle({ weight: 2.5, color: '#1c2331' }));
      layer.on('mouseout', () => layer.setStyle({ weight: 0.8, color: '#fff' }));
    },
  }).addTo(map);
  renderWardLegend(true, xInf, yInf);
}

function renderWardLegend(show, xInf, yInf) {
  const el = document.getElementById('wardLegend');
  if (!show) { el.classList.remove('show'); return; }
  const cells = [];
  for (let row = 2; row >= 0; row--) {
    for (let col = 0; col < 3; col++) cells.push('<div style="background:' + BIVARIATE_MATRIX[row][col] + '"></div>');
  }
  const caveats = [xInf, yInf].filter(inf => inf.basis).map(inf => inf.label + ': ' + WARD_INFRA_BASIS_LABEL[inf.basis]);
  el.innerHTML = '<b>' + xInf.label + ' (' + xInf.group + ') × ' + yInf.label + ' (' + yInf.group + ') — per ward</b>' +
    '<div class="leg-biv-grid">' + cells.join('') + '</div>' +
    '<div class="leg-biv-axes"><span>↑ ' + yInf.label + '</span></div>' +
    '<div class="leg-biv-axes"><span>Low ' + xInf.label + ' →</span><span>High</span></div>' +
    '<div style="margin-top:4px;font-style:italic;">290 wards · tertiles, computed live</div>' +
    (caveats.length ? '<div style="margin-top:4px;font-style:italic;">' + caveats.join('<br>') + '</div>' : '');
  el.classList.add('show');
}

const map = L.map('map', { zoomControl: true }).setView([28.62, 77.21], 11);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
}).addTo(map);

function buildYearToggle() {
  const el = document.getElementById('yearToggle');
  const m = currentMetric();
  // Single-year series (the 2022-only Traffic Police metrics) have nothing to switch between.
  if (!m.prevKey && !m.yearVariants) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = metricYears(m).map(y => '<button class="' + (activeYear===y?'active':'') + '" data-y="' + y + '">' + y + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { activeYear = btn.dataset.y; buildYearToggle(); renderChoropleth(); });
  });
}
function buildRateToggle() {
  const el = document.getElementById('rateToggle');
  el.innerHTML = [['density','Per km²'],['perCapita','Per 100k']].map(([val,label]) =>
    '<button class="' + (rateMode===val?'active':'') + '" data-v="' + val + '">' + label + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { rateMode = btn.dataset.v; buildRateToggle(); renderChoropleth(); });
  });
}

let geoLayer = null;
const districtLayers = {};
function renderChoropleth() {
  renderDataStatus();
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const vals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null);
  const scale = percentileScale(vals);
  const lo = Math.min(...vals), hi = Math.max(...vals);

  if (geoLayer) map.removeLayer(geoLayer);
  Object.keys(districtLayers).forEach(k => delete districtLayers[k]);
  const unsafeScores = unsafeMode ? computeUnsafeScores() : null;
  geoLayer = L.geoJSON(BOUNDARIES, {
    style: f => {
      let fillColor;
      if (unsafeMode) {
        const s = unsafeScores[f.properties.district].score;
        fillColor = s == null ? '#999' : rustScale(s);
      } else if (bivariateMode) {
        fillColor = getBivariateColor(feats, f.properties, m, inf);
      } else {
        const v = metricValue(f.properties, m);
        fillColor = v == null ? '#999' : rustScale(scale(v));
      }
      const isSelected = selectedDistrict === f.properties.district;
      return { fillColor, fillOpacity: displayMode === 'circles' ? 0.12 : 0.65, color: isSelected ? 'var(--amber)' : '#fff', weight: isSelected ? 3.5 : 1.5 };
    },
    onEachFeature: (f, layer) => {
      const d = f.properties;
      districtLayers[d.district] = layer;
      const v = metricValue(d, m);
      // Hover tooltip only. A click opens the district drawer, which is the detail view; the old click
      // popup repeated the same metric, rank and change next to it. Its unique content (source, composite
      // score breakdown, bivariate infrastructure value) now lives in the drawer.
      let tip = '<b>' + d.district + '</b>';
      if (unsafeMode) {
        const us = unsafeScores[d.district];
        tip += '<br>Composite unsafe score: ' + (us.score != null ? (us.score * 100).toFixed(0) + '/100' : '—');
      } else {
        tip += '<br>' + fmtNum(v) + (rateMode === 'perCapita' ? ' per 100k' : ' per km²') + ' · rank ' + ordinal(rank(d)) + ' of 15';
      }
      layer.bindTooltip(tip, { sticky: true });
      layer.on('mouseover', () => { if (selectedDistrict !== d.district) layer.setStyle({ weight: 3, color: '#1c2331' }); });
      layer.on('mouseout', () => { if (selectedDistrict !== d.district) layer.setStyle({ weight: 1.5, color: '#fff' }); });
      layer.on('click', () => selectDistrict(d.district));
    },
  }).addTo(map);

  renderLegend(m, inf, lo, hi);
  renderProportionalCircles(m, inf, feats);
  if (selectedDistrict) renderDrawer(selectedDistrict);
  if (typeof updateUrlState === 'function') updateUrlState();
}

// ── District search + zoom, and the right-side district intelligence drawer ──
function selectDistrict(name, opts) {
  if (!districtLayers[name]) return;
  selectedDistrict = name;
  renderChoropleth(); // rebuilds geoLayer (recolors the selected outline, re-renders the drawer) --
  // districtLayers is repopulated as a side effect, so re-read the layer reference afterwards
  // rather than reusing one captured before the rebuild (the old layer object is detached).
  const layer = districtLayers[name];
  if (!opts || opts.fitBounds !== false) map.fitBounds(layer.getBounds(), { maxZoom: 13, animate: false });
  document.getElementById('drawer').classList.add('open');
}

function renderDrawer(name) {
  const props = BOUNDARIES.features.find(f => f.properties.district === name).properties;
  const allProps = BOUNDARIES.features.map(f => f.properties);
  const m = currentMetric();
  const yKey = yearFieldKey(m, activeYear);
  const rank = rankOf(allProps, yKey)(props);
  const v = metricValue(props, m);
  const prevYear = prevYearOf(activeYear);
  const prevRaw = m.prevKey && prevYear ? props[yearFieldKey(m, prevYear)] : null;
  const prevRate = prevRaw != null ? getRateVal(prevRaw, props) : null;

  const statsHtml =
    '<div class="stat-row"><span>' + m.full + ' (' + effectiveYear(m) + ')</span><span class="v">' + fmtNum(v) + '</span></div>' +
    '<div class="stat-row"><span>Rank of 15</span><span class="v">' + ordinal(rank) + '</span></div>' +
    (prevRate != null ? '<div class="stat-row"><span>Change vs ' + prevYear + '</span><span class="v">' + yoyBadge(v, prevRate) + '</span></div>' : '') +
    '<div class="stat-row"><span>Area</span><span class="v">' + props.areaSqKm + ' km²</span></div>' +
    '<div class="stat-row"><span>Population</span><span class="v">' + fmtNum(props.population) + '</span></div>';

  let modeHtml = '';
  if (unsafeMode) {
    const us = computeUnsafeScores()[name];
    modeHtml += '<div class="stat-row"><span>Composite unsafe score</span><span class="v">' + (us.score != null ? (us.score * 100).toFixed(0) + '/100' : '—') + '</span></div>' +
      us.contributions.map(c => '<div class="stat-row"><span>' + c.label + '</span><span class="v">' + (c.percentile != null ? (c.percentile * 100).toFixed(0) + 'pct' : 'n/a') + '</span></div>').join('') +
      '<div class="drawer-note">Equal-weight average of percentile ranks (' + us.coveredFactors + '/' + us.totalFactors + ' factors covered).</div>';
  }
  if (bivariateMode) {
    const bi = currentInfra();
    modeHtml += '<div class="stat-row"><span>' + bi.label + '</span><span class="v">' + fmtNum(getInfraVal(props, bi)) + (rateMode === 'perCapita' ? '/100k' : '/km²') + '</span></div>';
  }
  const srcHtml = '<div class="drawer-note">Source: ' + metricSource(m) + (bivariateMode ? ' · ' + currentInfra().source : '') + (m.note ? '<br>' + m.note : '') + '</div>';

  const infraHtml = INFRA.map(inf => {
    const covered = infraCovered(props, inf.key);
    const val = getInfraVal(props, inf);
    return '<div class="infra-row"><span>' + inf.label + '</span><span>' +
      (val != null ? fmtNum(val) + (rateMode === 'perCapita' ? '/100k' : '/km²') : '—') +
      ' <span class="badge ' + (covered ? 'covered' : 'gap') + '">' + (covered ? 'covered' : 'gap') + '</span></span></div>';
  }).join('');

  const corrHtml = INFRA.map(inf => {
    const valid = BOUNDARIES.features.map(f=>f.properties).filter(d => infraCovered(d, inf.key) && d[yKey] != null);
    const xs = valid.map(d => getInfraVal(d, inf));
    const ys = valid.map(d => getRateVal(d[yKey], d));
    const r = valid.length >= 2 ? pearson(xs, ys) : 0;
    const color = Math.abs(r) >= 0.5 ? 'var(--rust)' : Math.abs(r) >= 0.25 ? 'var(--amber)' : 'var(--text-dim)';
    return '<div class="corr-row"><span>' + inf.label + '</span><span style="color:' + color + ';font-weight:700;">' + (r>=0?'+':'') + r.toFixed(3) + '</span></div>';
  }).join('');

  document.getElementById('drawerBody').innerHTML =
    '<h2>' + name + '</h2>' +
    '<div class="drawer-sub">District intelligence — ' + effectiveYear(m) + (rateMode==='perCapita' ? ' · per 100k' : ' · per km²') + '</div>' +
    '<div class="drawer-section"><h3>Selected metric</h3>' + statsHtml + modeHtml + srcHtml + '</div>' +
    '<div class="drawer-section"><h3>Infrastructure coverage</h3>' + infraHtml + '</div>' +
    '<div class="drawer-section"><h3>Correlation vs. ' + m.label + ' (citywide, r)</h3>' + corrHtml + '</div>';
}

document.getElementById('drawerClose').addEventListener('click', () => {
  document.getElementById('drawer').classList.remove('open');
  selectedDistrict = null;
  renderChoropleth();
});

const searchInput = document.getElementById('districtSearch');
const searchResults = document.getElementById('searchResults');
const districtNames = BOUNDARIES.features.map(f => f.properties.district).sort();
function showSearchResults(query) {
  const q = query.trim().toLowerCase();
  const matches = q ? districtNames.filter(n => n.toLowerCase().includes(q)) : [];
  if (!matches.length) { searchResults.style.display = 'none'; return; }
  searchResults.innerHTML = matches.map(n => '<div data-name="' + n + '">' + n + '</div>').join('');
  searchResults.style.display = 'block';
  searchResults.querySelectorAll('div').forEach(row => {
    row.addEventListener('click', () => {
      selectDistrict(row.dataset.name);
      searchInput.value = row.dataset.name;
      searchResults.style.display = 'none';
    });
  });
}
searchInput.addEventListener('input', () => showSearchResults(searchInput.value));
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const exact = districtNames.find(n => n.toLowerCase() === searchInput.value.trim().toLowerCase());
    const first = searchResults.querySelector('div');
    const target = exact || (first && first.dataset.name);
    if (target) { selectDistrict(target); searchInput.value = target; searchResults.style.display = 'none'; }
  } else if (e.key === 'Escape') {
    searchResults.style.display = 'none';
  }
});
document.addEventListener('click', (e) => {
  if (e.target !== searchInput && !searchResults.contains(e.target)) searchResults.style.display = 'none';
});

function renderLegend(m, inf, lo, hi) {
  const el = document.getElementById('legend');
  if (unsafeMode) {
    el.innerHTML = '<b>Composite Unsafe Score</b>' +
      '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
      '<div style="display:flex;justify-content:space-between;"><span>Safer</span><span>Less safe</span></div>' +
      '<div style="margin-top:4px;font-style:italic;">equal-weight avg of 5 percentile-ranked factors — click "ⓘ methodology"</div>';
  } else if (bivariateMode) {
    const cells = [];
    for (let row = 2; row >= 0; row--) {
      for (let col = 0; col < 3; col++) cells.push('<div style="background:' + BIVARIATE_MATRIX[row][col] + '"></div>');
    }
    el.innerHTML = '<b>' + m.label + ' × ' + inf.label + '</b>' +
      '<div class="leg-biv-grid">' + cells.join('') + '</div>' +
      '<div class="leg-biv-axes"><span>↑ ' + inf.label + '</span></div>' +
      '<div class="leg-biv-axes"><span>Low crime →</span><span>High crime</span></div>' +
      '<div style="margin-top:4px;font-style:italic;">tertiles, computed live · ' + (rateMode==='perCapita'?'per 100k':'per km²') + '</div>';
  } else {
    el.innerHTML = '<b>' + m.label + ' (' + effectiveYear(m) + ')</b>' +
      '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
      '<div style="display:flex;justify-content:space-between;">' +
        '<span>' + fmtNum(lo) + '</span><span>' + fmtNum(hi) + '</span>' +
      '</div>' +
      '<div style="margin-top:4px;font-style:italic;">ranked, not linear · ' + (rateMode==='perCapita'?'per 100k':'per km²') + '</div>';
  }
}

metricSelect.addEventListener('change', () => {
  // The crash-zone series only exist for 2023/2024, so switching to one while 2022 is selected
  // has to snap the year to one that series actually publishes rather than render an empty map.
  const years = metricYears(currentMetric());
  if (years.indexOf(activeYear) === -1) activeYear = years[years.length - 1];
  buildYearToggle();
  renderChoropleth();
});
document.getElementById('chkBivariate').addEventListener('change', (e) => {
  bivariateMode = e.target.checked;
  document.getElementById('bivInfraWrap').style.display = bivariateMode ? '' : 'none';
  renderChoropleth();
});
bivInfraSelect.addEventListener('change', () => { bivariateInfra = bivInfraSelect.value; renderChoropleth(); });

const wardInfraXSelect = document.getElementById('wardInfraXSelect');
const wardInfraYSelect = document.getElementById('wardInfraYSelect');
function wardInfraOptionsHtml() {
  const groups = [['infra', 'Infrastructure'], ['crime', 'Crime / Incidents'], ['plan', 'Master Plan 2047 vs current']];
  return groups.map(([g, label]) =>
    '<optgroup label="' + label + '">' +
    WARD_INFRA.filter(w => w.group === g).map(w => '<option value="' + w.key + '">' + w.label + '</option>').join('') +
    '</optgroup>'
  ).join('');
}
wardInfraXSelect.innerHTML = wardInfraOptionsHtml();
wardInfraYSelect.innerHTML = wardInfraOptionsHtml();
wardInfraXSelect.value = wardInfraX;
wardInfraYSelect.value = wardInfraY;
document.getElementById('chkWardBivariate').addEventListener('change', (e) => {
  wardBivariateMode = e.target.checked;
  document.getElementById('wardInfraWrap').style.display = wardBivariateMode ? '' : 'none';
  if (wardBivariateMode) {
    wardExploratoryMode = false;
    document.getElementById('chkWardExploratoryIndex').checked = false;
  }
  renderWardLayer();
  updateUrlState();
});
wardInfraXSelect.addEventListener('change', () => { wardInfraX = wardInfraXSelect.value; renderWardLayer(); updateUrlState(); });
wardInfraYSelect.addEventListener('change', () => { wardInfraY = wardInfraYSelect.value; renderWardLayer(); updateUrlState(); });

// ── Proportional-circle display mode -- alternative to the choropleth fill that avoids the
// area bias of coloring physically large/small districts the same way (a small dense district
// and a large sparse one can look equally "intense" under a fill; circle area scales directly
// with the metric instead). Adds circles sized by sqrt(value) (area-proportional, not radius-
// proportional, so visual size fairly reflects magnitude) at each district's polygon centroid.
let displayMode = 'choropleth'; // 'choropleth' | 'circles'
function buildDisplayModeToggle() {
  const el = document.getElementById('displayModeToggle');
  el.innerHTML = [['choropleth','Choropleth'],['circles','Circles']].map(([val,label]) =>
    '<button class="' + (displayMode===val?'active':'') + '" data-v="' + val + '">' + label + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { displayMode = btn.dataset.v; buildDisplayModeToggle(); renderChoropleth(); });
  });
}

let circleLayer = null;
function renderProportionalCircles(m, inf, feats) {
  if (circleLayer) { map.removeLayer(circleLayer); circleLayer = null; }
  if (displayMode !== 'circles') return;
  const vals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null);
  const maxVal = Math.max(...vals) || 1;
  const maxRadiusPx = 42;
  circleLayer = L.layerGroup();
  feats.forEach(f => {
    const d = f.properties;
    const layer = districtLayers[d.district];
    if (!layer) return;
    const center = layer.getBounds().getCenter();
    const v = metricValue(d, m);
    if (v == null) return;
    const radius = Math.max(4, Math.sqrt(v / maxVal) * maxRadiusPx);
    const color = bivariateMode ? getBivariateColor(feats, d, m, inf) : rustScale(percentileScale(vals)(v));
    L.circleMarker(center, { radius, color: '#fff', weight: 1.5, fillColor: color, fillOpacity: 0.75 })
      .bindTooltip(d.district + ': ' + fmtNum(v), { sticky: true })
      .bindPopup('<div class="popup-title">' + d.district + '</div><div>' + fmtNum(v) + ' ' + (rateMode==='perCapita'?'per 100k':'per km²') + '</div>')
      .addTo(circleLayer);
  });
  circleLayer.addTo(map);
}

document.getElementById('resetMapBtn').addEventListener('click', () => {
  map.setView([28.62, 77.21], 11, { animate: false });
  selectedDistrict = null;
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('districtSearch').value = '';
  document.getElementById('searchResults').style.display = 'none';
  bivariateMode = false;
  document.getElementById('chkBivariate').checked = false;
  document.getElementById('bivInfraWrap').style.display = 'none';
  displayMode = 'choropleth';
  buildDisplayModeToggle();
  document.querySelectorAll('#pointLayerToggles input[type=checkbox]').forEach(chk => { const wasChecked = chk.checked; chk.checked = false; if (wasChecked) chk.dispatchEvent(new Event('change')); });
  document.getElementById('chkHeatmap').checked = false;
  rebuildHeatLayer();
  document.getElementById('analysisSelect').value = 'none';
  if (typeof clearAnalysisHighlight === 'function') clearAnalysisHighlight();
  document.getElementById('nearbyPanel').classList.remove('show');
  unsafeMode = false;
  document.getElementById('chkUnsafe').checked = false;
  document.getElementById('unsafeMethodLink').style.display = 'none';
  wardBivariateMode = false;
  document.getElementById('chkWardBivariate').checked = false;
  document.getElementById('wardInfraWrap').style.display = 'none';
  wardExploratoryMode = false;
  document.getElementById('chkWardExploratoryIndex').checked = false;
  renderWardLayer();
  zoneYear = '2023';
  document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear));
  rebuildZonesLayer();
  renderChoropleth();
});

// ── Shareable URL state: ?year=2023&crime=theft&infra=streetlight&district=North&heatmap=1&
// zoneYear=2024&ward=biv&wx=..&wy=..&layers=chkBus,chkAtm ── Read once on load (before the first
// render, so the initial paint already reflects it) and written back via history.replaceState()
// on every relevant control change. Every value read back from the URL is validated against the
// actual known option lists below before being applied -- an unrecognized value is silently
// ignored and the corresponding default is kept, never applied blindly.
const POINT_LAYER_IDS = ['chkPolice', 'chkPosts', 'chkZones', 'chkBus', 'chkAtm', 'chkAlcohol', 'chkSurveillance', 'chkOverpasses', 'chkTrafficSignals', 'chkCrossings', 'chkHospitals', 'chkPaplStreetlights', 'chkStreetLamps', 'chkCctvPriority', 'chkCctvExploratory', 'chkLiquorVends', 'chkCrashZones2024Approx', 'chkLanduse'];
let pendingUrlDistrict = null;
let pendingUrlState = null; // { heatmap, zoneYear, ward, wx, wy, layers } -- applied once every
                              // relevant section has finished wiring its own event listeners (see
                              // applyDeferredUrlState() at the very end of the script).
function applyUrlStateOnLoad() {
  const params = new URLSearchParams(location.search);
  const crime = params.get('crime');
  const year = params.get('year');
  const rate = params.get('rate');
  const bivariate = params.get('bivariate');
  const infra = params.get('infra');
  const district = params.get('district');
  // A ?crime= key naming a per-year duplicate (e.g. personsKilled2024) predates the consolidated
  // selector and no longer exists as an <option>, so assigning it directly would blank the select.
  // Resolve it to the consolidated entry plus the year it encoded; an explicit ?year= still wins.
  if (crime && METRICS.some(m => m.key === crime)) {
    const owner = METRICS.find(m => !m.hiddenFromSelector && m.yearVariants &&
      Object.keys(m.yearVariants).some(y => m.yearVariants[y] === crime));
    if (owner) {
      metricSelect.value = owner.key;
      activeYear = Object.keys(owner.yearVariants).find(y => owner.yearVariants[y] === crime);
    } else if (!METRICS.find(m => m.key === crime).hiddenFromSelector) {
      metricSelect.value = crime;
    }
  }
  if (year && ['2022','2023','2024'].includes(year) && metricSupportsYear(currentMetric(), year)) activeYear = year;
  if (rate === 'perCapita') rateMode = 'perCapita';
  if (infra && INFRA.some(i => i.key === infra)) { bivariateInfra = infra; bivInfraSelect.value = infra; }
  if (bivariate === '1') {
    bivariateMode = true;
    document.getElementById('chkBivariate').checked = true;
    document.getElementById('bivInfraWrap').style.display = '';
  }
  if (district) pendingUrlDistrict = district; // applied after the first render, once districtLayers exists

  const heatmap = params.get('heatmap');
  const zoneYearParam = params.get('zoneYear');
  const ward = params.get('ward');
  const wx = params.get('wx');
  const wy = params.get('wy');
  const layersParam = params.get('layers');
  pendingUrlState = {
    heatmap: heatmap === '1',
    zoneYear: (zoneYearParam && ['2023', '2024'].includes(zoneYearParam)) ? zoneYearParam : null,
    ward: (ward === 'biv' || ward === 'exp') ? ward : null,
    wx: (wx && WARD_INFRA.some(w => w.key === wx)) ? wx : null,
    wy: (wy && WARD_INFRA.some(w => w.key === wy)) ? wy : null,
    layers: layersParam ? layersParam.split(',').filter(id => POINT_LAYER_IDS.includes(id)) : [],
  };
}
function updateUrlState() {
  const m = currentMetric();
  const params = new URLSearchParams();
  if (activeYear !== '2024') params.set('year', activeYear);
  params.set('crime', m.key);
  if (rateMode !== 'density') params.set('rate', rateMode);
  if (bivariateMode) { params.set('bivariate', '1'); params.set('infra', bivariateInfra); }
  if (selectedDistrict) params.set('district', selectedDistrict);
  if (document.getElementById('chkHeatmap').checked) params.set('heatmap', '1');
  if (zoneYear !== '2023') params.set('zoneYear', zoneYear);
  if (wardBivariateMode) { params.set('ward', 'biv'); params.set('wx', wardInfraX); params.set('wy', wardInfraY); }
  else if (wardExploratoryMode) { params.set('ward', 'exp'); }
  const checkedLayers = POINT_LAYER_IDS.filter(id => { const el = document.getElementById(id); return el && el.checked; });
  if (checkedLayers.length) params.set('layers', checkedLayers.join(','));
  const qs = params.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

applyUrlStateOnLoad();
buildYearToggle();
buildRateToggle();
buildDisplayModeToggle();
renderChoropleth();
if (pendingUrlDistrict && districtLayers[pendingUrlDistrict]) {
  selectDistrict(pendingUrlDistrict);
  pendingUrlDistrict = null;
}

// ── CSV / GeoJSON export of the currently filtered map (current metric/year/rate mode) ──
function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function currentStateSuffix() {
  const m = currentMetric();
  return m.key + '_' + activeYear + '_' + rateMode + (bivariateMode ? '_vs_' + bivariateInfra : '');
}
document.getElementById('downloadCsvBtn').addEventListener('click', () => {
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const header = ['district', m.key + '_' + (rateMode==='perCapita'?'per100k':'perKm2'), 'rank_of_15'];
  if (bivariateMode) header.push(inf.key + '_' + (rateMode==='perCapita'?'per100k':'perKm2'));
  const rows = feats.map(f => {
    const d = f.properties;
    const row = [d.district, metricValue(d, m), rank(d)];
    if (bivariateMode) row.push(getInfraVal(d, inf));
    return row.join(',');
  });
  downloadBlob(header.join(',') + '\\n' + rows.join('\\n'), 'delhi_map_' + currentStateSuffix() + '.csv', 'text/csv');
});
document.getElementById('downloadGeoJsonBtn').addEventListener('click', () => {
  const m = currentMetric();
  const inf = currentInfra();
  const feats = BOUNDARIES.features;
  const rank = rankOf(feats.map(f=>f.properties), yearFieldKey(m, activeYear));
  const out = {
    type: 'FeatureCollection',
    metadata: { metric: m.label, year: effectiveYear(m), rateMode, bivariate: bivariateMode ? inf.label : null, source: metricSource(m) },
    features: feats.map(f => {
      const d = f.properties;
      const props = { district: d.district, value: metricValue(d, m), rank: rank(d) };
      if (bivariateMode) props[inf.key] = getInfraVal(d, inf);
      return { type: 'Feature', properties: props, geometry: f.geometry };
    }),
  };
  downloadBlob(JSON.stringify(out, null, 1), 'delhi_map_' + currentStateSuffix() + '.geojson', 'application/geo+json');
});
document.getElementById('shareUrlBtn').addEventListener('click', () => {
  updateUrlState();
  const input = document.createElement('input');
  input.value = location.href;
  document.body.appendChild(input);
  input.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(input);
  const btn = document.getElementById('shareUrlBtn');
  const original = btn.textContent;
  btn.textContent = '✓ Copied';
  setTimeout(() => { btn.textContent = original; }, 1500);
});

// ── Control panel: a left sidebar on desktop (the toggle hides it for more map), a bottom sheet on
// phones (see the matching @media block in <style>). The district drawer is also a bottom sheet there. ──
const mobileFilterToggle = document.getElementById('mobileFilterToggle');
const phoneQuery = window.matchMedia('(max-width: 720px)');
function syncPanelToggle() {
  const phone = phoneQuery.matches;
  const open = phone ? document.body.classList.contains('mobile-filters-open') : !document.body.classList.contains('panel-hidden');
  mobileFilterToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  mobileFilterToggle.setAttribute('aria-label', open ? 'Hide map controls' : 'Show map controls');
  mobileFilterToggle.textContent = phone ? (open ? '✕' : '☰') : '☰ Controls';
}
function setMobileFiltersOpen(open) {
  document.body.classList.toggle('mobile-filters-open', open);
  syncPanelToggle();
}
mobileFilterToggle.addEventListener('click', () => {
  if (phoneQuery.matches) { setMobileFiltersOpen(!document.body.classList.contains('mobile-filters-open')); return; }
  document.body.classList.toggle('panel-hidden');
  syncPanelToggle();
  map.invalidateSize({ animate: false });
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('mobile-filters-open')) setMobileFiltersOpen(false);
});
phoneQuery.addEventListener('change', () => { document.body.classList.remove('mobile-filters-open'); syncPanelToggle(); });
syncPanelToggle();

// ── Point layers, all off by default so the map opens uncluttered ──
// Small colored shape icons (square/triangle/diamond/ring) instead of uniform circles, so
// layers stay visually distinguishable even before checking which color is which.
function shapeIcon(color, shape, size) {
  const s = size || 12;
  const cls = { square: 'sq', triangle: 'tri', diamond: 'dia', dot: 'dot', ring: 'ring' }[shape] || 'dot';
  const style = shape === 'triangle'
    ? 'border-bottom-color:' + color + ';'
    : 'width:' + s + 'px;height:' + s + 'px;background:' + color + ';border:1.5px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.25)' + (shape==='ring' ? ',inset 0 0 0 2px #fff' : '') + ';';
  return L.divIcon({ className: 'shape-icon ' + cls, html: '<div class="shape-icon ' + cls + '" style="' + style + '"></div>', iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -s/2] });
}

function makeShapeLayer(points, color, shape, size) {
  const group = L.layerGroup();
  points.forEach(([lat, lng, name]) => {
    L.marker([lat, lng], { icon: shapeIcon(color, shape, size) })
      .bindTooltip(name, { sticky: true })
      .bindPopup(name + '<div class="popup-src">Source: see footer citation on the main dashboard</div>').addTo(group);
  });
  return group;
}
// Dense layers (thousands of points) get marker clustering instead of individual shape icons —
// rendering 3,151 bus stops or 649 ATMs unclustered would be unreadable and slow to pan/zoom.
function makeClusterLayer(points, color, popupLabel) {
  const cluster = L.markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true });
  points.forEach(([lat, lng, name]) => {
    L.marker([lat, lng], { icon: shapeIcon(color, 'dot', 8) })
      .bindTooltip(name || popupLabel, { sticky: true })
      .bindPopup((name || popupLabel) + '<div class="popup-src">Source: see footer citation on the main dashboard</div>').addTo(cluster);
  });
  return cluster;
}

const policeStationLayer = makeShapeLayer(POLICE.stations, '#3d5a99', 'square', 13);
const policePostLayer = makeShapeLayer(POLICE.posts, '#7c3aed', 'triangle', 13);
const busStopLayer = makeClusterLayer(POI.busStops, '#3f7d52', 'Bus Stop');
const atmLayer = makeClusterLayer(POI.atms, '#d4af37', 'ATM');
const alcoholLayer = makeShapeLayer(POI.alcoholShops, '#8b2f5e', 'diamond', 12);
const surveillanceLayer = makeShapeLayer(POI.surveillance, '#0891b2', 'ring', 11);
const trafficSignalLayer = makeClusterLayer(POI.trafficSignals, '#1d4ed8', 'Traffic signal');
const crossingLayer = makeClusterLayer(POI.pedestrianCrossings, '#059669', 'Pedestrian crossing');
const hospitalLayer = makeClusterLayer(POI.hospitals, '#dc2626', 'Hospital');
const paplStreetlightLayer = makeClusterLayer(PAPL_STREETLIGHT_POINTS, '#eab308', 'PAPL streetlight survey cell');
const streetLampLayer = makeClusterLayer(POI.streetLamps, '#22b8cf', 'OSM street lamp');
const overpassLayer = L.markerClusterGroup({ maxClusterRadius: 42, spiderfyOnMaxZoom: true });
PEDESTRIAN_OVERPASSES.features.forEach(f => { const p=f.properties, c=f.geometry.coordinates; L.marker([c[1],c[0]], {icon:shapeIcon('#e3a13b','square',10)}).bindTooltip(p.name, { sticky: true }).bindPopup('<div class="popup-title">'+p.name+'</div><div>'+p.district+' District</div><div>'+(p.crossesMajorRoad ? '<b>Crosses a major road</b> (motorway/trunk/primary/secondary) — a foot-over-bridge in the sense PWD Delhi and press coverage use the term.' : 'Does not cross a major road in this check — likely a footbridge over a drain, canal, or park path rather than live traffic.')+'</div><div class="popup-src">Mapped pedestrian bridge/overpass &middot; OSM snapshot '+p.sourceSnapshot+' &middot; <a href="'+p.osmUrl+'" target="_blank" rel="noopener">OpenStreetMap object</a><br>'+p.coverageNote+'</div>').addTo(overpassLayer); });

// ── Official liquor vends (approximate coordinates) — independent point layer, not the OSM-
// derived "Liquor Shops" layer above. Faded/hollow diamond styling signals "approximate, not a
// verified location" at a glance, matching this project's established approximate-vs-exact
// visual convention. Includes both the 374 official DSCSC/DCCWS records and the 13 OSM-only ones
// already present in the source file, distinguished in the popup by record_source.
const liquorVendsLayer = L.layerGroup();
LIQUOR_VENDS_APPROX.features.forEach(f => {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const isOfficial = p.record_source !== 'OpenStreetMap';
  L.marker([lat, lng], { icon: shapeIcon(isOfficial ? '#8b2f5e' : '#b98cae', 'diamond', 11) })
    .bindTooltip(p.name + (isOfficial ? ' (official)' : ' (OSM-only)'), { sticky: true })
    .bindPopup('<div class="popup-title">' + p.name + '</div>' +
      '<div class="popup-rank">' + (isOfficial ? 'Official liquor vend' : 'OSM-only record') + (p.vend_category ? ' — ' + p.vend_category : '') + '</div>' +
      '<div style="font-style:italic;">Approximate coordinate (' + (p.coordinate_confidence || 'unknown') + ' confidence, ±' + fmtNum(p.estimated_accuracy_m) + 'm) — ' + (p.coordinate_warning || 'not a verified vend entrance') + '</div>' +
      '<div class="popup-src">Source: ' + (p.operator || 'DSCSC/DCCWS official list') + '</div>')
    .addTo(liquorVendsLayer);
});

// ── 2024 crash zones, full 93-zone approximate-coordinate pass — a separate, richer dataset from
// the "Crash zones" layer's 2024 option above (which uses only the 54/93 Nominatim-geocoded
// subset). Every one of these 93 has a coordinate, but every coordinate is an approximation
// (landmark/intersection/locality centre), never a surveyed crash location — labeled as such in
// every popup, not just a tooltip.
const crashZones2024ApproxLayer = L.layerGroup();
CRASH_ZONES_2024_APPROX.features.forEach(f => {
  const p = f.properties;
  const [lng, lat] = f.geometry.coordinates;
  const fatal = p.all_fatal_crashes, total = p.all_total_crashes;
  const t = fatal != null ? Math.max(0, Math.min(1, (fatal - 1) / 6)) : 0.3;
  L.circleMarker([lat, lng], { radius: 4 + t * 4, color: '#e3a13b', weight: 1.5, dashArray: '3 2', fillColor: '#b14a34', fillOpacity: 0.5 + t * 0.35 })
    .bindTooltip(p.location_name + (fatal != null ? ' — ' + fatal + ' fatal, ' + total + ' total (2024)' : ' — not tabulated'), { sticky: true })
    .bindPopup('<div class="popup-title">' + p.location_name + '</div>' +
      '<div class="popup-rank">' + (p.road_name || '') + '</div>' +
      '<div>' + (fatal != null ? fatal + ' fatal, ' + total + ' total crashes, 2024' : 'Not individually tabulated in Table 6.29 — no crash counts available') + '</div>' +
      '<div style="font-style:italic;">Approximate coordinate (' + p.coordinate_method + ', ' + p.coordinate_confidence + ' confidence, ±' + fmtNum(p.estimated_accuracy_m) + 'm) — ' + p.coordinate_warning + '</div>' +
      '<div class="popup-src">Source: Delhi Road Crash Report 2024, Delhi Traffic Police. Full 93-zone approximate-coordinate pass — distinct from the 54/93 geocoded subset in the "Crash zones" layer.</div>')
    .addTo(crashZones2024ApproxLayer);
});

// ── Land use — real OSM landuse=* polygons, grouped into 6 categories and simplified for map
// rendering (full precision would add ~3.4MB to the page). Only ~23.4% of Delhi's area carries an
// OSM landuse tag; every popup and the legend both say so, so the untagged remainder is never
// misread as "vacant land" rather than "not tagged." An official Delhi ward-wise land-use dataset
// was searched for and deliberately not used -- see data/source/README.md.
const LANDUSE_LABELS = { residential: 'Residential', commercial: 'Commercial', industrial: 'Industrial', institutional: 'Institutional', green_open: 'Green/open (parks, farmland, forest)', other: 'Other/unclassified' };
const landuseLayer = L.geoJSON(landuse, {
  style: f => ({ color: f.properties.color, weight: 0.5, fillColor: f.properties.color, fillOpacity: 0.35 }),
  onEachFeature: (f, layer) => {
    const p = f.properties;
    const areaKm2 = p.area_km2;
    layer.bindTooltip((LANDUSE_LABELS[p.category] || p.category) + (p.landuse !== p.category ? ' (' + p.landuse + ')' : ''), { sticky: true });
    layer.bindPopup('<div class="popup-title">' + (LANDUSE_LABELS[p.category] || p.category) + '</div>' +
      '<div class="popup-rank">OSM tag: landuse=' + p.landuse + '</div>' +
      '<div>' + (areaKm2 < 0.01 ? Math.round(areaKm2 * 1e6).toLocaleString('en-IN') + ' m²' : areaKm2.toFixed(3) + ' km²') + '</div>' +
      '<div class="popup-src">OpenStreetMap-mapped land use — only ~23.4% of Delhi\\'s area carries a landuse tag in OSM; the untagged rest is not necessarily vacant, just not tagged. Not an official Delhi land-use survey.</div>');
  },
});

// Crash zones support a year toggle (2023/2024) -- rebuildZonesLayer() clears and repopulates
// zonesGroup/zoneMarkers from whichever year is selected, so every spatial-analysis tool already
// built around zoneMarkers (runAnalysis(), showNearbyInfra()) automatically operates on the
// selected year without needing its own year-awareness.
const zonesGroup = L.layerGroup();
let zoneMarkers = []; // { zone, marker, baseStyle } -- kept so spatial-analysis highlighting and the
                        // click-for-nearby-infra panel can restyle/query individual zone markers.
function richBreakdownLine(z) {
  const parts = [];
  if (z.pedestrian_crash_prone) parts.push('Pedestrian: ' + z.pedestrian_fatal_crashes + ' fatal / ' + z.pedestrian_total_crashes + ' total');
  if (z.two_wheeler_crash_prone) parts.push('Two-wheeler: ' + z.two_wheeler_fatal_crashes + ' fatal / ' + z.two_wheeler_total_crashes + ' total');
  if (z.htv_crash_prone) parts.push('HTV: ' + z.htv_fatal_crashes + ' fatal / ' + z.htv_total_crashes + ' total');
  if (z.hit_and_run_crash_prone) parts.push('Hit-and-run: ' + z.hit_and_run_fatal_crashes + ' fatal / ' + z.hit_and_run_total_crashes + ' total');
  return parts.length ? '<div class="popup-src">' + parts.join(' · ') + '</div>' : '';
}
function rebuildZonesLayer() {
  zonesGroup.clearLayers();
  zoneMarkers = [];
  const wasOnMap = map.hasLayer(zonesGroup);
  ZONES_BY_YEAR[zoneYear].filter(z => z.lat != null && z.lng != null).forEach(z => {
    const t = Math.max(0, Math.min(1, (z.fatal - 1) / 6));
    const baseStyle = { radius: 4 + t * 4, color: '#fff', weight: 1, fillColor: '#b14a34', fillOpacity: 0.55 + t * 0.4 };
    const marker = L.circleMarker([z.lat, z.lng], baseStyle)
      .bindTooltip(z.name + ' — ' + z.fatal + ' fatal, ' + z.total + ' total (' + zoneYear + ')', { sticky: true })
      .bindPopup('<b>' + z.name + '</b> (' + z.road + ')<br>' + z.fatal + ' fatal, ' + z.total + ' total crashes, ' + zoneYear +
        richBreakdownLine(z) +
        '<div class="popup-src">Source: Delhi Road Crash Report ' + zoneYear + '</div>')
      .addTo(zonesGroup);
    marker.on('click', () => showNearbyInfra(z));
    zoneMarkers.push({ zone: z, marker, baseStyle });
  });
  document.getElementById('cntZones').textContent = '(' + zoneMarkers.length.toLocaleString('en-IN') + ')';
  if (wasOnMap && !map.hasLayer(zonesGroup)) zonesGroup.addTo(map);
  if (typeof rebuildHeatLayer === 'function') rebuildHeatLayer();
}
rebuildZonesLayer();

// CCTV priority-candidate locations (report-recommended sites, not an existing camera inventory)
// -- pooled across both years' geocoded zones, grouped by name since a location can recur across
// report years. Every year a location was recommended in is shown in its popup, rather than
// keeping only the first year seen and silently dropping the rest.
const cctvPriorityLayer = L.layerGroup();
const cctvByName = new Map();
['2023', '2024'].forEach(year => {
  ZONES_BY_YEAR[year].filter(z => z.lat != null && z.cctvPriorityCandidate).forEach(z => {
    if (!cctvByName.has(z.name)) cctvByName.set(z.name, { name: z.name, lat: z.lat, lng: z.lng, years: [] });
    cctvByName.get(z.name).years.push({ year, fatal: z.fatal, total: z.total });
  });
});
cctvByName.forEach(site => {
  const yearsLine = site.years.map(y => y.year + ' (' + y.fatal + ' fatal / ' + y.total + ' total)').join(', ');
  L.marker([site.lat, site.lng], { icon: shapeIcon('#0891b2', 'ring', 13) })
    .bindTooltip(site.name + ' — recommended CCTV site', { sticky: true })
    .bindPopup('<div class="popup-title">' + site.name + '</div>' +
      '<div class="popup-rank">Recommended CCTV site — ' + site.years.length + ' report year' + (site.years.length > 1 ? 's' : '') + '</div>' +
      '<div>Recommended in: <b>' + yearsLine + '</b></div>' +
      '<div class="popup-src">Report recommendation, not a verified existing camera — see the "CCTV/guards" layer for OSM-mapped existing cameras nearby. Source: Delhi Road Crash Report(s), Table 6.37.</div>')
    .addTo(cctvPriorityLayer);
});

// ── Exploratory CCTV/guard-post recommendation layer — project-computed, distinct from the
// official Table 6.37 picks above. Candidate "sites" are still real, addressable point locations
// (pooled crash zones, 2023+2024, deduped by name, excluding any zone already an official
// CCTV-priority site so the two layers never double-recommend the same spot) -- this project has
// no point-level crime location data to invent a separate "high-crime site" marker from, since
// NCRB only publishes crime at district granularity. Instead, each candidate's surrounding
// district's crime rate is joined in as a scoring factor, so "high crime and other things" (not
// just crash severity) drives which sites surface, without fabricating a false-precision crime
// coordinate. Uses the same tested computeExploratoryScore helper as the district "unsafe areas"
// and ward liquor-crash indices rather than a fifth ad-hoc implementation.
//
// Methodology basis (not an arbitrary weighting):
//   - Severity-weighted micro-place prioritization: WHO's "Save LIVES" road safety technical
//     package and the iRAP/Safe System approach both direct limited countermeasure budgets
//     (engineering, enforcement, monitoring) at the specific highest-risk locations identified
//     from crash data, weighted toward fatal/serious-injury outcomes rather than raw crash counts.
//     Mirrored here by weighting fatal crashes above total crashes.
//   - Weisburd, D. (2015), "The Law of Crime Concentration and the Criminology of Place",
//     Journal of Quantitative Criminology 31(2) -- crime and severe-crash risk concentrate at a
//     small number of micro-places, so concentrating a fixed camera/guard budget at the top-ranked
//     locations outperforms spreading it evenly. Extended here to justify folding in district-level
//     crime rate: a crash site inside an already high-crime district is a higher-value location for
//     a shared CCTV/guard investment than an identical crash site in a low-crime district.
//   - Welsh, B.C. & Farrington, D.P. (2009), "Public Area CCTV and Crime Prevention: An Updated
//     Systematic Review and Meta-Analysis", Justice Quarterly 26(4) -- CCTV's measured effect is
//     concentrated in already-monitored areas; the marginal value of a new camera is highest where
//     existing coverage is weakest, hence the inverted "existing CCTV/guards nearby" factor here.
// This is a project-computed prioritization, not a certified engineering study or a substitute for
// a site visit -- every popup spells out exactly which factors drove the score and why, matching
// this project's exploratory-score convention elsewhere on this page.
const CCTV_EXPLORATORY_TOP_N = 15;
const CCTV_EXPLORATORY_RADIUS_M = 300; // identification/deterrence range per Welsh & Farrington's review of CCTV studies
const cctvExploratoryLayer = L.layerGroup();
const districtByName = new Map(BOUNDARIES.features.map(f => [f.properties.district, f.properties]));
function computeCctvExploratoryCandidates() {
  const pooled = new Map();
  ['2023', '2024'].forEach(year => {
    ZONES_BY_YEAR[year].filter(z => z.lat != null && z.lng != null).forEach(z => {
      const existing = pooled.get(z.name);
      if (!existing || (z.fatal || 0) > (existing.fatal || 0)) {
        pooled.set(z.name, { name: z.name, road: z.road, lat: z.lat, lng: z.lng, fatal: z.fatal, total: z.total, year, district: z.district });
      }
    });
  });
  const surveillancePts = POI.surveillance.map(p => [p[0], p[1]]);
  const candidates = Array.from(pooled.values())
    .filter(z => !cctvByName.has(z.name))
    .map(z => {
      const d = districtByName.get(z.district);
      return Object.assign({}, z, {
        nearbySurveillance: pointsWithin(z.lat, z.lng, surveillancePts, CCTV_EXPLORATORY_RADIUS_M).length,
        districtTotalIPCDensity: d && d.totalIPC != null ? d.totalIPC / d.areaSqKm : null,
        districtCrimeAgainstWomenDensity: d && d.crimeAgainstWomen != null ? d.crimeAgainstWomen / d.areaSqKm : null,
      });
    });
  const factors = [
    { key: 'fatal', label: 'Fatal crashes at this site', invert: false, get: c => c.fatal },
    { key: 'total', label: 'Total crashes at this site', invert: false, get: c => c.total },
    { key: 'nearbySurveillance', label: 'Existing CCTV/guards within ' + CCTV_EXPLORATORY_RADIUS_M + 'm', invert: true, get: c => c.nearbySurveillance },
    { key: 'districtTotalIPCDensity', label: 'District overall crime rate (Total IPC density)', invert: false, get: c => c.districtTotalIPCDensity },
    { key: 'districtCrimeAgainstWomenDensity', label: 'District crime-against-women rate', invert: false, get: c => c.districtCrimeAgainstWomenDensity },
  ];
  // Severity-weighted (per WHO/iRAP hotspot practice): this specific site's crash record still
  // carries the most weight, since that is direct evidence of danger at this exact point; district
  // crime rate and the camera-coverage gap are real but secondary factors, not the primary driver.
  const weights = { fatal: 0.35, total: 0.15, nearbySurveillance: 0.2, districtTotalIPCDensity: 0.15, districtCrimeAgainstWomenDensity: 0.15 };
  const { scores } = computeExploratoryScore(candidates, factors, weights);
  candidates.forEach(c => { c.result = scores.get(c); });
  return candidates.filter(c => c.result.score != null).sort((a, b) => b.result.score - a.result.score).slice(0, CCTV_EXPLORATORY_TOP_N);
}
function percentileLabel(pct) {
  if (pct == null) return 'no data';
  const level = pct >= 0.75 ? 'high' : pct >= 0.4 ? 'moderate' : 'low';
  return level + ' (' + ordinal(Math.round(pct * 100)) + ' percentile among candidate sites)';
}
computeCctvExploratoryCandidates().forEach(c => {
  const whyLines = c.result.contributions
    .filter(ct => ct.percentile != null)
    .sort((a, b) => b.weight - a.weight)
    .map(ct => '<li><b>' + ct.label + ':</b> ' + fmtNum(ct.value) + ' — ' + percentileLabel(ct.percentile) + ', weighted ' + Math.round(ct.weight * 100) + '% of the score</li>')
    .join('');
  L.marker([c.lat, c.lng], { icon: shapeIcon('#c026d3', 'diamond', 13) })
    .bindTooltip(c.name + ' — exploratory CCTV/guard recommendation, score ' + c.result.score, { sticky: true })
    .bindPopup('<div class="popup-title">' + c.name + '</div>' +
      '<div class="popup-rank">Exploratory CCTV/guard-post recommendation — score ' + c.result.score + '/100</div>' +
      '<div>Why this site: <ul class="popup-why-list">' + whyLines + '</ul></div>' +
      '<div class="popup-src">Project-computed, percentile-ranked across the ' + CCTV_EXPLORATORY_TOP_N + ' candidates shown here: crash severity at this exact site (WHO Safe System / iRAP hotspot-prioritization practice; Weisburd 2015 on crime/crash concentration at micro-places), the surrounding district\\'s overall crime and crime-against-women rate, and the camera-coverage gap nearby (Welsh &amp; Farrington 2009 CCTV meta-analysis). <b>Not</b> an official Delhi Police or Delhi Traffic Police recommendation, and not a substitute for a site visit — see the "CCTV priority sites" layer for the report\\'s own Table 6.37 picks.</div>')
    .addTo(cctvExploratoryLayer);
});

const toggles = [
  ['chkPolice', policeStationLayer, 'cntPolice'], ['chkPosts', policePostLayer, 'cntPosts'], ['chkZones', zonesGroup, 'cntZones'],
  ['chkBus', busStopLayer, 'cntBus'], ['chkAtm', atmLayer, 'cntAtm'], ['chkAlcohol', alcoholLayer, 'cntAlcohol'], ['chkSurveillance', surveillanceLayer, 'cntSurveillance'], ['chkOverpasses', overpassLayer, 'cntOverpasses'],
  ['chkTrafficSignals', trafficSignalLayer, 'cntTrafficSignals'], ['chkCrossings', crossingLayer, 'cntCrossings'], ['chkHospitals', hospitalLayer, 'cntHospitals'], ['chkPaplStreetlights', paplStreetlightLayer, 'cntPaplStreetlights'], ['chkStreetLamps', streetLampLayer, 'cntStreetLamps'],
  ['chkCctvPriority', cctvPriorityLayer, 'cntCctvPriority'], ['chkCctvExploratory', cctvExploratoryLayer, 'cntCctvExploratory'],
  ['chkLiquorVends', liquorVendsLayer, 'cntLiquorVends'], ['chkCrashZones2024Approx', crashZones2024ApproxLayer, 'cntCrashZones2024Approx'],
  ['chkLanduse', landuseLayer, 'cntLanduse'],
];
const layerCounts = { cntPolice: POLICE.stations.length, cntPosts: POLICE.posts.length, cntZones: zoneMarkers.length, cntBus: POI.busStops.length, cntAtm: POI.atms.length, cntAlcohol: POI.alcoholShops.length, cntSurveillance: POI.surveillance.length, cntOverpasses: PEDESTRIAN_OVERPASSES.features.length, cntTrafficSignals: POI.trafficSignals.length, cntCrossings: POI.pedestrianCrossings.length, cntHospitals: POI.hospitals.length, cntPaplStreetlights: PAPL_STREETLIGHT_POINTS.length, cntStreetLamps: POI.streetLamps.length, cntCctvPriority: cctvPriorityLayer.getLayers().length, cntCctvExploratory: cctvExploratoryLayer.getLayers().length, cntLiquorVends: liquorVendsLayer.getLayers().length, cntCrashZones2024Approx: crashZones2024ApproxLayer.getLayers().length, cntLanduse: landuse.features.length };
toggles.forEach(([id, layer, countId]) => {
  document.getElementById(countId).textContent = '(' + layerCounts[countId].toLocaleString('en-IN') + ')';
  document.getElementById(id).addEventListener('change', (e) => {
    if (e.target.checked) layer.addTo(map); else map.removeLayer(layer);
    updatePointLegend();
    updateUrlState();
  });
});
document.getElementById('chkLanduse').addEventListener('change', (e) => {
  document.getElementById('landuseLegend').classList.toggle('show', e.target.checked);
});

function setPointLayer(id, on) {
  const input = document.getElementById(id);
  if (!input || input.checked === on) return;
  input.checked = on;
  input.dispatchEvent(new Event('change'));
}
function applyGuidedView(view) {
  document.querySelectorAll('.guided-view').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  // A quick view is a curated state, not an add-on: start from no point layers so the previous view's
  // layers do not linger (e.g. streetlights staying on in the fatal-crash view).
  document.querySelectorAll('#pointLayerToggles input[type=checkbox]:checked').forEach(c => { c.checked = false; c.dispatchEvent(new Event('change')); });
  if (view === 'crime-light') {
    metricSelect.value = 'totalIPC'; activeYear = '2024'; rateMode = 'density'; bivariateMode = true; bivariateInfra = 'streetlightCombined'; bivInfraSelect.value = bivariateInfra;
    document.getElementById('chkBivariate').checked = true; document.getElementById('bivInfraWrap').style.display = '';
    setPointLayer('chkPaplStreetlights', true); setPointLayer('chkStreetLamps', true);
  } else if (view === 'fatal-corridors') {
    metricSelect.value = 'fatalCrashes2023'; activeYear = '2024'; bivariateMode = false; document.getElementById('chkBivariate').checked = false; document.getElementById('bivInfraWrap').style.display = 'none';
    zoneYear = '2024'; document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear)); rebuildZonesLayer(); setPointLayer('chkZones', true);
  } else if (view === 'transit-gaps') {
    metricSelect.value = 'totalIPC'; activeYear = '2024'; rateMode = 'density'; bivariateMode = true; bivariateInfra = 'metroGate'; bivInfraSelect.value = bivariateInfra;
    document.getElementById('chkBivariate').checked = true; document.getElementById('bivInfraWrap').style.display = ''; setPointLayer('chkBus', true);
  }
  buildYearToggle(); buildRateToggle(); renderChoropleth(); updateUrlState();
}
document.querySelectorAll('.guided-view').forEach(btn => btn.addEventListener('click', () => applyGuidedView(btn.dataset.view)));
document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(btn => {
  btn.addEventListener('click', () => {
    zoneYear = btn.dataset.year;
    document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear));
    rebuildZonesLayer();
    updateUrlState();
  });
});

const POINT_LEGEND_ITEMS = [
  ['chkPolice', '#3d5a99', 'square', 'Police stations'], ['chkPosts', '#7c3aed', 'triangle', 'Chowkis/posts'],
  ['chkZones', '#b14a34', 'dot', 'Crash zones (size = fatal crashes)'], ['chkBus', '#3f7d52', 'dot', 'Bus stops (clustered)'],
  ['chkAtm', '#d4af37', 'dot', 'ATMs (clustered)'], ['chkAlcohol', '#8b2f5e', 'diamond', 'Liquor shops'], ['chkSurveillance', '#0891b2', 'ring', 'CCTV/guards'], ['chkOverpasses', '#e3a13b', 'square', 'Pedestrian overbridges (OSM mapped)'],
  ['chkTrafficSignals', '#1d4ed8', 'dot', 'Traffic signals (clustered)'], ['chkCrossings', '#059669', 'dot', 'Pedestrian crossings (clustered)'], ['chkHospitals', '#dc2626', 'dot', 'Hospitals (clustered)'], ['chkPaplStreetlights', '#eab308', 'dot', 'Streetlights, PAPL survey cells (clustered)'], ['chkStreetLamps', '#22b8cf', 'dot', 'Street lamps, OSM (clustered)'],
  ['chkCctvPriority', '#0891b2', 'ring', 'CCTV priority candidates (recommended, not existing)'],
  ['chkCctvExploratory', '#c026d3', 'diamond', 'CCTV/guard recommended, exploratory (project-computed, top 15)'],
  ['chkLiquorVends', '#8b2f5e', 'diamond', 'Liquor vends, official (approx. coordinates)'],
  ['chkCrashZones2024Approx', '#b14a34', 'dot', 'Crash zones 2024, full 93 (approx. coordinates)'],
];
function updatePointLegend() {
  const active = POINT_LEGEND_ITEMS.filter(([id]) => document.getElementById(id).checked);
  const el = document.getElementById('pointLegend');
  if (!active.length) { el.classList.remove('show'); return; }
  el.innerHTML = '<b style="color:var(--text);display:block;margin-bottom:4px;">Point layers</b>' + active.map(([id, color, shape, label]) =>
    '<div class="row"><span class="shape-icon ' + ({square:'sq',triangle:'tri',diamond:'dia',dot:'dot',ring:'ring'}[shape]) + '" style="width:10px;height:10px;background:' + (shape==='triangle'?'transparent':color) + ';' + (shape==='triangle' ? 'border-bottom-color:' + color + ';border-bottom-width:9px;' : 'border:1px solid #fff;') + '"></span>' + label + '</div>'
  ).join('');
  el.classList.add('show');
}

// ── Heatmap mode (Leaflet.heat) — crash zones weighted by fatal-crash count, as an alternative
// to plotting each zone as a discrete circle. Density heatmaps read more naturally than dozens
// of overlapping circles when zooming out to see citywide crash concentration at a glance.
// rebuildHeatLayer() is the single place that ever creates/replaces heatLayer, called both from
// this checkbox and from rebuildZonesLayer()/the reset button, so switching the crash-zone year
// while the heatmap is on refreshes it in place instead of leaving stale points on screen, and at
// most one heatLayer instance ever exists on the map at a time.
function rebuildHeatLayer() {
  if (heatLayer) { map.removeLayer(heatLayer); heatLayer = null; }
  if (!document.getElementById('chkHeatmap').checked) return;
  const points = ZONES_BY_YEAR[zoneYear].filter(z => z.lat != null && z.lng != null).map(z => [z.lat, z.lng, Math.min(1, z.fatal / 10)]);
  heatLayer = L.heatLayer(points, { radius: 28, blur: 20, maxZoom: 15, gradient: { 0.2: '#e8d6b3', 0.5: '#d48a5a', 0.8: '#b14a34', 1: '#7a2515' } });
  heatLayer.addTo(map);
}
document.getElementById('chkHeatmap').addEventListener('change', () => { rebuildHeatLayer(); updateUrlState(); });

// ── Spatial-intersection analysis tools ──
// Haversine great-circle distance in meters -- accurate enough at Delhi's scale (city spans
// ~50km, well within the range where the spherical-earth approximation's error is negligible).
function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
function pointsWithin(lat, lng, points, radiusM) {
  return points.filter(p => haversineMeters(lat, lng, p[0], p[1]) <= radiusM);
}

let analysisRadius = 250;
function buildRadiusToggle() {
  const el = document.getElementById('radiusToggle');
  el.innerHTML = [100, 250, 500, 1000].map(r =>
    '<button class="' + (analysisRadius===r?'active':'') + '" data-r="' + r + '">' + (r>=1000 ? (r/1000)+'km' : r+'m') + '</button>').join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { analysisRadius = Number(btn.dataset.r); buildRadiusToggle(); runAnalysis(); });
  });
}
buildRadiusToggle();

const weakCoverageLayer = L.layerGroup();
function clearAnalysisHighlight() {
  zoneMarkers.forEach(({ marker, baseStyle }) => marker.setStyle(Object.assign({}, baseStyle, { className: '' })));
  map.removeLayer(weakCoverageLayer);
  weakCoverageLayer.clearLayers();
  document.getElementById('analysisSummary').textContent = '';
}

function runAnalysis() {
  const type = document.getElementById('analysisSelect').value;
  clearAnalysisHighlight();
  const summaryEl = document.getElementById('analysisSummary');
  if (type === 'none') return;

  if (type === 'weakPoliceCoverage') {
    // District-level, not radius-based: districts in the top tertile for the selected crime
    // metric AND the bottom tertile for police infrastructure density -- high crime, thin cover.
    const m = currentMetric();
    const feats = BOUNDARIES.features;
    const crimeVals = feats.map(f => metricValue(f.properties, m)).filter(v => v != null).sort((a,b)=>a-b);
    const policeVals = feats.map(f => f.properties.policeInfraDensity).filter(v => v != null).sort((a,b)=>a-b);
    const matches = feats.filter(f => {
      const crime = metricValue(f.properties, m), police = f.properties.policeInfraDensity;
      if (crime == null || police == null) return false;
      return getTertileIndex(crime, crimeVals) === 2 && getTertileIndex(police, policeVals) === 0;
    });
    matches.forEach(f => {
      L.geoJSON(f, { style: { fillColor: 'transparent', fillOpacity: 0, color: 'var(--rust)', weight: 3, className: 'weak-cov-outline' } })
        .bindTooltip(f.properties.district + ' — high ' + m.label.toLowerCase() + ', weak police coverage', { sticky: true })
        .addTo(weakCoverageLayer);
    });
    weakCoverageLayer.addTo(map);
    summaryEl.innerHTML = '<b>' + matches.length + ' of 15</b> districts: top-tertile ' + m.label + ' + bottom-tertile Police Infra density (dashed rust outline).';
    return;
  }

  // Point-radius analyses over the 107 geocoded crash zones.
  const liquorPts = POI.alcoholShops.map(p => [p[0], p[1]]);
  const survPts = POI.surveillance.map(p => [p[0], p[1]]);
  const busPts = POI.busStops.map(p => [p[0], p[1]]);
  let matchCount = 0, label = '';
  zoneMarkers.forEach(({ zone, marker, baseStyle }) => {
    let isMatch = false;
    if (type === 'crashesNearLiquor') { isMatch = pointsWithin(zone.lat, zone.lng, liquorPts, analysisRadius).length > 0; label = 'have a liquor shop within'; }
    else if (type === 'crashesNoSurveillance') { isMatch = pointsWithin(zone.lat, zone.lng, survPts, analysisRadius).length === 0; label = 'have NO surveillance point within'; }
    else if (type === 'crashesNearBus') { isMatch = pointsWithin(zone.lat, zone.lng, busPts, analysisRadius).length > 0; label = 'have a bus stop within'; }
    if (isMatch) {
      matchCount++;
      marker.setStyle(Object.assign({}, baseStyle, { color: 'var(--amber)', weight: 3 }));
    } else {
      marker.setStyle(Object.assign({}, baseStyle, { fillOpacity: 0.15, color: '#fff' }));
    }
  });
  if (!map.hasLayer(zonesGroup)) { zonesGroup.addTo(map); document.getElementById('chkZones').checked = true; }
  summaryEl.innerHTML = '<b>' + matchCount + ' of ' + zoneMarkers.length + '</b> crash zones ' + label + ' ' + (analysisRadius>=1000 ? analysisRadius/1000+'km' : analysisRadius+'m') + '. Amber ring = match, faded = no match.';
}
document.getElementById('analysisSelect').addEventListener('change', runAnalysis);

// Click a crash zone → nearby-infrastructure panel, counting each POI type within the current
// analysis radius (defaults to 250m if no radius has been picked via the analysis tools yet).
function showNearbyInfra(zone) {
  const r = analysisRadius;
  const counts = {
    'Liquor shops': pointsWithin(zone.lat, zone.lng, POI.alcoholShops.map(p=>[p[0],p[1]]), r).length,
    'CCTV/guards': pointsWithin(zone.lat, zone.lng, POI.surveillance.map(p=>[p[0],p[1]]), r).length,
    'Bus stops': pointsWithin(zone.lat, zone.lng, POI.busStops.map(p=>[p[0],p[1]]), r).length,
    'ATMs': pointsWithin(zone.lat, zone.lng, POI.atms.map(p=>[p[0],p[1]]), r).length,
    'Pedestrian overbridges': pointsWithin(zone.lat, zone.lng, PEDESTRIAN_OVERPASSES.features.map(f=>[f.geometry.coordinates[1],f.geometry.coordinates[0]]), r).length,
    'Police stations': pointsWithin(zone.lat, zone.lng, POLICE.stations.map(p=>[p[0],p[1]]), r).length,
    'Chowkis/posts': pointsWithin(zone.lat, zone.lng, POLICE.posts.map(p=>[p[0],p[1]]), r).length,
  };
  const el = document.getElementById('nearbyPanel');
  el.innerHTML = '<b>' + zone.name + ' — within ' + (r>=1000 ? r/1000+'km' : r+'m') + '</b>' +
    Object.entries(counts).map(([label, n]) => '<div class="nb-row"><span>' + label + '</span><span><b>' + n + '</b></span></div>').join('') +
    '<div style="margin-top:6px;font-style:italic;">Change the Radius control above to adjust.</div>';
  el.classList.add('show');
}

// ── Shared, validated exploratory-scoring helper — one implementation reused by every composite
// score on this page, instead of each score reinventing its own weighting/NaN-handling. Given a
// list of items and factors (each { key, label, invert, get(item) -> number|null }) and an
// optional weight map:
//   - Weights are normalized to sum to 1. If none are supplied, or any is missing/negative/non-
//     finite, or they sum to 0, falls back to equal weighting across all factors (never silently
//     drops a factor to weight 0 due to a bad input).
//   - A missing (null) factor value for an item is excluded from that item's score and its
//     weight is redistributed across the item's remaining covered factors — never coerced to 0,
//     so missing data cannot masquerade as "safest possible" or "worst possible".
//   - The result is always finite and clamped to [0, 100], or null if an item has zero covered
//     factors (never NaN).
//   - This only ever returns a percentile-based score — it never infers or displays a count (e.g.
//     "N cameras") from the score itself.
function normalizeExploratoryWeights(factorKeys, weights) {
  const equal = () => { const out = {}; factorKeys.forEach(k => { out[k] = 1 / factorKeys.length; }); return out; };
  if (!weights) return equal();
  const raw = factorKeys.map(k => weights[k]);
  const allValid = raw.every(w => typeof w === 'number' && Number.isFinite(w) && w >= 0);
  if (!allValid) return equal();
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= 0) return equal();
  const out = {};
  factorKeys.forEach((k, i) => { out[k] = raw[i] / sum; });
  return out;
}
function computeExploratoryScore(items, factors, weights) {
  const normWeights = normalizeExploratoryWeights(factors.map(f => f.key), weights);
  const factorScales = factors.map(f => {
    const vals = items.map(f.get).filter(v => v != null && Number.isFinite(v));
    return { factor: f, scale: percentileScale(vals) };
  });
  const results = new Map();
  items.forEach(item => {
    const contributions = factorScales.map(({ factor, scale }) => {
      const v = factor.get(item);
      const weight = normWeights[factor.key];
      if (v == null || !Number.isFinite(v)) return { key: factor.key, label: factor.label, value: null, percentile: null, weight };
      const pct = factor.invert ? 1 - scale(v) : scale(v);
      return { key: factor.key, label: factor.label, value: v, percentile: pct, weight };
    });
    const covered = contributions.filter(c => c.percentile != null);
    const coveredWeightSum = covered.reduce((a, c) => a + c.weight, 0);
    let score = null;
    if (covered.length && coveredWeightSum > 0) {
      const weighted = covered.reduce((a, c) => a + (c.percentile * c.weight) / coveredWeightSum, 0);
      score = Math.max(0, Math.min(100, Math.round(weighted * 1000) / 10));
      if (!Number.isFinite(score)) score = null; // defensive: never surface a non-finite score
    }
    results.set(item, { score, contributions, coveredFactors: covered.length, totalFactors: factors.length });
  });
  return { scores: results, weights: normWeights };
}

// ── Composite "unsafe areas" layer — transparent methodology: plain average of five equally-
// weighted, percentile-ranked factors (see #methodOverlay for the full writeup, shown to the
// user via the "ⓘ methodology" link rather than left undocumented). No hidden weighting, no
// black-box scoring — every factor and its direction is spelled out and re-derivable from the
// same district fields already used elsewhere on this page. Uses computeExploratoryScore with no
// explicit weights, which falls back to the same equal-weighting this always used.
const UNSAFE_FACTORS = [
  { key: 'totalIPCDensity', label: 'Total IPC crime density', invert: false, get: d => d.totalIPC != null ? d.totalIPC / d.areaSqKm : null },
  { key: 'crimeAgainstWomenDensity', label: 'Crime against women density', invert: false, get: d => d.crimeAgainstWomen != null ? d.crimeAgainstWomen / d.areaSqKm : null },
  { key: 'fatalCrashDensity', label: 'Fatal crashes (2023) density', invert: false, get: d => d.fatalCrashes2023 != null ? d.fatalCrashes2023 / d.areaSqKm : null },
  { key: 'policeInfraDensity', label: 'Police infrastructure density', invert: true, get: d => d.policeInfraDensity },
  { key: 'lightDensityPerKm2', label: 'Streetlight density', invert: true, get: d => (SURVEYED.has(d.district) ? d.lightDensityPerKm2 : null) },
];
function computeUnsafeScores() {
  const allProps = BOUNDARIES.features.map(f => f.properties);
  const { scores: scoreMap } = computeExploratoryScore(allProps, UNSAFE_FACTORS, null);
  const scores = {};
  allProps.forEach(d => {
    const r = scoreMap.get(d);
    scores[d.district] = {
      score: r.score != null ? r.score / 100 : null, // kept on this page's existing 0-1 convention (popup multiplies by 100)
      contributions: r.contributions.map(c => ({ label: c.label, value: c.value, percentile: c.percentile })),
      coveredFactors: r.coveredFactors,
      totalFactors: r.totalFactors,
    };
  });
  return scores;
}

document.getElementById('chkUnsafe').addEventListener('change', (e) => {
  unsafeMode = e.target.checked;
  document.getElementById('unsafeMethodLink').style.display = unsafeMode ? '' : 'none';
  renderChoropleth();
});
document.getElementById('unsafeMethodLink').addEventListener('click', () => document.getElementById('methodOverlay').classList.add('show'));
document.getElementById('methodCloseBtn').addEventListener('click', () => document.getElementById('methodOverlay').classList.remove('show'));
document.getElementById('methodOverlay').addEventListener('click', (e) => { if (e.target.id === 'methodOverlay') e.currentTarget.classList.remove('show'); });

// ── Ward liquor-crash exploratory risk index — a new, ward-level composite distinct from both
// the district "unsafe areas" score above and the CCTV-priority-candidate layer (which is a
// report recommendation, not a model score). Explicitly exploratory: built from approximate-
// coordinate ward aggregates (2024 crash-zone density + official liquor-vend density), not an
// official Delhi Police index, and never attributes camera counts or any other inference beyond
// the percentile score itself.
const WARD_EXPLORATORY_FACTORS = [
  { key: 'crashZones2024Density', label: '2024 crash-zone density', invert: false, get: p => p.crashZones2024Density },
  { key: 'officialLiquorVendsDensity', label: 'Official liquor-vend density', invert: false, get: p => p.officialLiquorVendsDensity },
];
const WARD_EXPLORATORY_WEIGHTS = { crashZones2024Density: 0.6, officialLiquorVendsDensity: 0.4 };
let wardExploratoryScores = null;
function computeWardExploratoryScores() {
  const { scores } = computeExploratoryScore(wardsInfra.features.map(f => f.properties), WARD_EXPLORATORY_FACTORS, WARD_EXPLORATORY_WEIGHTS);
  return scores;
}

function renderWardExploratoryLayer() {
  if (wardLayer) { map.removeLayer(wardLayer); wardLayer = null; }
  if (!wardExploratoryMode) { renderWardLegend(false); return; }
  wardExploratoryScores = computeWardExploratoryScores();
  wardLayer = L.geoJSON(wardsInfra, {
    style: f => {
      const s = wardExploratoryScores.get(f.properties);
      return { fillColor: s.score == null ? '#999' : rustScale(s.score / 100), fillOpacity: 0.75, color: '#fff', weight: 0.8, dashArray: '4 2' };
    },
    onEachFeature: (f, layer) => {
      const p = f.properties;
      const s = wardExploratoryScores.get(p);
      const body = '<div class="popup-title">' + p.Ward_Name + '</div>' +
        (p.highInjuryNetwork ? '<div style="color:var(--rust);font-weight:700;">⚠ High-Injury Network — #' + p.highInjuryNetworkRank + ' of 18 wards accounting for half of 2024\\'s ward-assigned fatal crashes</div>' : '') +
        '<div class="popup-rank">Liquor-crash exploratory index: <b>' + (s.score != null ? s.score.toFixed(0) + '/100' : '—') + '</b> (' + s.coveredFactors + '/' + s.totalFactors + ' factors covered)</div>' +
        s.contributions.map(c => '<div class="unsafe-factor-row"><span>' + c.label + '</span><span>' + (c.percentile != null ? (c.percentile * 100).toFixed(0) + 'pct' : 'n/a') + '</span></div>').join('') +
        '<div class="popup-src">Exploratory index only — not an official Delhi Police score, not a camera-placement recommendation. Weighted average of percentile-ranked, approximate-coordinate ward aggregates (' + WARD_INFRA_BASIS_LABEL.exploratory + ').</div>';
      layer.bindPopup(body);
      layer.on('mouseover', () => layer.setStyle({ weight: 2.5, color: '#1c2331' }));
      layer.on('mouseout', () => layer.setStyle({ weight: 0.8, color: '#fff' }));
    },
  }).addTo(map);
  const el = document.getElementById('wardLegend');
  el.innerHTML = '<b>Liquor-Crash Exploratory Index (per ward)</b>' +
    '<div class="leg-scale">' + Array.from({length:8}, (_,i) => '<span style="background:' + rustScale(i/7) + '"></span>').join('') + '</div>' +
    '<div style="display:flex;justify-content:space-between;"><span>Lower</span><span>Higher</span></div>' +
    '<div style="margin-top:4px;font-style:italic;">0-100, exploratory — not an official score. Weighted avg: crash-zone density 60%, liquor-vend density 40%.</div>';
  el.classList.add('show');
}
document.getElementById('chkWardExploratoryIndex').addEventListener('change', (e) => {
  wardExploratoryMode = e.target.checked;
  if (wardExploratoryMode) {
    wardBivariateMode = false;
    document.getElementById('chkWardBivariate').checked = false;
    document.getElementById('wardInfraWrap').style.display = 'none';
  }
  renderWardExploratoryLayer();
  updateUrlState();
});

// ── Apply the deferred parts of the shared URL state (heatmap, zone year, ward mode/selectors,
// point layers) now that every section above has finished wiring its own event listeners --
// checking a box and dispatching 'change' here reaches the same code path a real click would.
function applyDeferredUrlState() {
  const s = pendingUrlState;
  if (!s) return;
  if (s.zoneYear && s.zoneYear !== zoneYear) {
    zoneYear = s.zoneYear;
    document.getElementById('zoneYearToggle').querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.year === zoneYear));
    rebuildZonesLayer();
  }
  if (s.layers.length) {
    s.layers.forEach(id => {
      const chk = document.getElementById(id);
      if (chk && !chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
    });
  }
  if (s.heatmap) {
    const chk = document.getElementById('chkHeatmap');
    if (!chk.checked) { chk.checked = true; rebuildHeatLayer(); }
  }
  if (s.ward === 'biv') {
    if (s.wx) { wardInfraX = s.wx; wardInfraXSelect.value = s.wx; }
    if (s.wy) { wardInfraY = s.wy; wardInfraYSelect.value = s.wy; }
    document.getElementById('chkWardBivariate').checked = true;
    wardBivariateMode = true;
    document.getElementById('wardInfraWrap').style.display = '';
    renderWardLayer();
  } else if (s.ward === 'exp') {
    document.getElementById('chkWardExploratoryIndex').checked = true;
    wardExploratoryMode = true;
    renderWardExploratoryLayer();
  }
  updateUrlState();
}
// Segmented controls show state only by colour; mirror it into aria-pressed for assistive tech.
// Observing #panel only (not the whole page) keeps this off Leaflet's hot hover path.
let segAriaQueued = false;
function syncSegAria() {
  segAriaQueued = false;
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', b.classList.contains('active') ? 'true' : 'false'));
}
new MutationObserver(() => { if (!segAriaQueued) { segAriaQueued = true; setTimeout(syncSegAria, 0); } })
  .observe(document.getElementById('panel'), { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
syncSegAria();
// Data status: a compact card in the panel. Open by default on desktop, collapsed on phones; a tap or
// Enter/Space toggles it. The container persists across re-renders, so the state survives metric changes.
(function () {
  const el = document.getElementById('dataStatus');
  const phone = window.matchMedia('(max-width: 720px)');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  function sync() { el.setAttribute('aria-expanded', el.classList.contains('expanded') ? 'true' : 'false'); }
  function toggle() { el.classList.toggle('expanded'); sync(); }
  if (!phone.matches) el.classList.add('expanded');
  el.addEventListener('click', toggle);
  el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  sync();
})();
// Panel feedback: active counts on each layer group and on Advanced, Clear all, the overflow menu, and
// keeping the map sized to its container.
(function () {
  const groups = Array.from(document.querySelectorAll('#pointLayerToggles .layer-group'));
  groups.forEach(g => {
    const badge = document.createElement('span');
    badge.className = 'grp-count';
    badge.setAttribute('aria-hidden', 'true');
    g.querySelector('summary').appendChild(badge);
  });
  const pointBoxes = () => Array.from(document.querySelectorAll('#pointLayerToggles input[type=checkbox]'));
  function refresh() {
    let total = 0;
    groups.forEach(g => {
      const n = g.querySelectorAll('input[type=checkbox]:checked').length;
      total += n;
      g.querySelector('.grp-count').textContent = n ? String(n) : '';
    });
    document.getElementById('layersActive').textContent = total ? total + ' on' : '';
    document.getElementById('clearLayersBtn').style.visibility = total ? 'visible' : 'hidden';
    const advOn = ['chkBivariate', 'chkHeatmap', 'chkUnsafe', 'chkWardBivariate', 'chkWardExploratoryIndex']
      .filter(id => document.getElementById(id).checked).length
      + (document.getElementById('analysisSelect').value !== 'none' ? 1 : 0)
      + (displayMode !== 'choropleth' ? 1 : 0);
    document.getElementById('advActive').textContent = advOn ? advOn + ' on' : '';
  }
  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; refresh(); }, 0);
  }
  window.schedulePanelBadges = schedule;
  document.addEventListener('change', schedule);
  document.addEventListener('click', schedule);
  document.getElementById('clearLayersBtn').addEventListener('click', () => {
    pointBoxes().forEach(chk => { if (chk.checked) { chk.checked = false; chk.dispatchEvent(new Event('change')); } });
    schedule();
  });
  const menu = document.getElementById('moreMenu');
  document.addEventListener('click', e => {
    if (menu.open && (!menu.contains(e.target) || e.target.closest('.menu-pop button'))) menu.open = false;
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') menu.open = false; });
  if (window.ResizeObserver) new ResizeObserver(() => map.invalidateSize({ animate: false })).observe(document.getElementById('mapRegion'));
  refresh();
})();
applyDeferredUrlState();
if (window.schedulePanelBadges) window.schedulePanelBadges();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'interactive_map.html'), html);
console.log('Written interactive_map.html. Size:', (html.length/1024).toFixed(1), 'KB');
