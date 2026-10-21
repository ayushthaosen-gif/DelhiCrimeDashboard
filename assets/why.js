/* "Why this place?": for a selected ward or district, what is observed, the infrastructure around it, the data year and source of every figure,
   how uncertain each is, and what the data cannot establish. The same structure renders as a panel and as plain text for the evidence pack.
   Reads window.DSO_PROFILES (field contract, district rows) and, for wards, window.DSO_PLAN. Builds the DOM with text nodes only. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h;
  var W = {};
  var P = window.DSO_PROFILES;
  if (!P) return;

  function sch(kind, id) { var s = P.schema[kind][id]; return s ? { label: s[0], unit: s[1], cls: s[2], source: s[3], year: s[4], blank: s[5], group: s[6] } : null; }
  function clsLabel(c) { return P.uncertaintyClasses[c] ? P.uncertaintyClasses[c].label : c; }
  function fmt(v, unit) {
    if (v == null) return 'no figure';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (/per km²|km per km²/.test(unit)) return (Math.round(v * 100) / 100).toLocaleString('en-IN');
    if (unit === 'km' || /%/.test(unit)) return (Math.round(v * 10) / 10).toLocaleString('en-IN');
    return D.n(v);
  }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  // ---------- ward ----------
  // ctx: { row: {field: value}, zones: [...], rank: {fatal: [rank, of], zones: [rank, of]} }
  W.buildWard = function (ctx) {
    var r = ctx.row, z = ctx.zones || [], used = {}, provenance = [], flags = [], issue = [];
    function use(id) { var s = sch('ward', id); if (s) { used[s.cls] = true; if (!provenance.some(function (p) { return p.id === id; })) provenance.push({ id: id, label: s.label, source: s.source, year: s.year, cls: s.cls }); } return s; }
    ['ward_no', 'area_km2', 'crash_zones_2024', 'crash_zone_fatal_crashes_2024', 'crash_zone_total_crashes_2024'].forEach(use);

    if (r.crash_zones_2024 > 0) {
      var names = z.map(function (q) { return q.name; }).join(', ');
      var s1 = plural(r.crash_zones_2024, 'crash-prone zone is', 'crash-prone zones are') + ' placed in this ward (2024): ' + names + '.';
      issue.push(s1);
      var fatalTxt = r.crash_zone_fatal_crashes_2024 == null ? 'The report prints no crash count for these zones.' : 'Within them the report counts ' + D.n(r.crash_zone_fatal_crashes_2024) + ' fatal crashes' + (r.crash_zone_total_crashes_2024 != null ? ' and ' + D.n(r.crash_zone_total_crashes_2024) + ' crashes in all' : '') + (r.crash_zones_without_printed_counts_2024 > 0 ? ' (a lower bound: ' + plural(r.crash_zones_without_printed_counts_2024, 'zone prints', 'zones print') + ' no count)' : '') + '.';
      issue.push(fatalTxt.replace(r.crash_zones_2024 === 1 ? 'Within them' : 'Within them', r.crash_zones_2024 === 1 ? 'Within it' : 'Within them'));
      if (ctx.rank && ctx.rank.fatal && r.crash_zone_fatal_crashes_2024 > 0) issue.push('By fatal crashes within zones this ward ranks ' + D.ord(ctx.rank.fatal[0]) + ' of ' + ctx.rank.fatal[1] + ' wards that have any.');
      if (r.crash_zone_pedestrian_fatal_crashes_2024 > 0) { use('crash_zone_pedestrian_fatal_crashes_2024'); issue.push(D.n(r.crash_zone_pedestrian_fatal_crashes_2024) + ' of the fatal crashes in these zones involved pedestrians.'); }
      if (r.high_injury_network) { use('high_injury_network'); issue.push('It is in the smallest set of wards that together hold half of 2024\'s zone fatal crashes (number ' + r.high_injury_network_rank + ' in that set).'); }
    } else {
      issue.push('No 2024 crash-prone zone is placed in this ward. Only locations above the report\'s threshold (three or more fatal crashes, or ten or more in all, within 500 m) are listed, so this does not mean no crashes happened here.');
    }

    var nearby = [];
    [['bus_stops', 'bus_stops_per_km2'], ['traffic_signals', 'traffic_signals_per_km2'], ['pedestrian_crossings', 'pedestrian_crossings_per_km2'], ['pedestrian_overpasses', null], ['footway_km', 'footway_km_per_km2'],
      ['street_lamps_mapped', 'street_lamps_mapped_per_km2'], ['hospitals', 'hospitals_per_km2'], ['surveillance_points_mapped', 'surveillance_points_mapped_per_km2'], ['police_stations', null], ['police_posts', null]].forEach(function (pair) {
      var s = use(pair[0]); if (!s) return;
      var dens = pair[1] ? r[pair[1]] : null;
      nearby.push({ label: s.label, value: fmt(r[pair[0]], s.unit) + (s.unit === 'km' ? ' km' : ''), sub: dens != null ? fmt(dens, 'per km²') + ' per km²' : '', cls: s.cls, zero: r[pair[0]] === 0 });
    });
    var land = [];
    [['residential_pct', 'Residential'], ['commercial_pct', 'Commercial'], ['industrial_pct', 'Industrial'], ['institutional_pct', 'Institutional'], ['green_open_pct', 'Green and open']].forEach(function (p) {
      use(p[0]); if (r[p[0]] != null) land.push(p[1] + ' ' + fmt(r[p[0]], '%') + '%');
    });
    use('landuse_mapped_pct');
    var landuse = r.landuse_mapped_pct == null ? null : 'Land cover mapped for ' + fmt(r.landuse_mapped_pct, '%') + '% of the ward: ' + (land.length ? land.join(', ') + ' (shares of the mapped part).' : 'no shares.');
    if (r.official_liquor_vends != null) use('official_liquor_vends');
    if (r.district_ipc_density_2024_per_km2 != null) use('district_ipc_density_2024_per_km2');

    // flags
    if (r.low_landuse_coverage) flags.push('Land use is mapped for under a quarter of this ward, so the land-use shares describe little of it and other OpenStreetMap counts deserve the same caution.');
    if (r.no_mapped_infrastructure) flags.push('No bus stop, signal, crossing, hospital or footway is mapped here. This is most likely an unmapped area, not an area without them.');
    var maxAcc = 0; z.forEach(function (q) { if (q.position_accuracy_m != null) maxAcc = Math.max(maxAcc, q.position_accuracy_m); });
    if (z.length) flags.push('Zone positions were placed by hand at landmark centres, with estimated accuracy ' + (z.length > 1 ? 'up to ' : '') + D.n(maxAcc) + ' m. A zone near the boundary may belong to a neighbouring ward.');
    if (r.crash_zones_without_printed_counts_2024 > 0) flags.push(plural(r.crash_zones_without_printed_counts_2024, 'zone here prints', 'zones here print') + ' no crash count (it appears only in the report\'s category lists), so the crash totals are lower bounds.');
    flags.push('The district\'s crime density' + (r.assigned_district ? ' (' + r.assigned_district + ')' : '') + ' is the same for every ward in it and says nothing about this ward.');

    var uncertainty = Object.keys(used).filter(function (c) { return c !== 'identifier'; }).map(function (c) { return { cls: c, label: clsLabel(c), meaning: P.uncertaintyClasses[c].meaning }; });
    var cannot = P.cannotEstablish.general.slice();
    Object.keys(used).forEach(function (c) { var t = P.cannotEstablish.byClass[c]; if (t && cannot.indexOf(t) < 0) cannot.push(t); });

    return { kind: 'ward', title: r.ward_name, subtitle: (r.assigned_district || 'No assigned district') + ' district · ' + fmt(r.area_km2, 'km²') + ' km² · legacy 290-ward geography (not the current 250 wards)', issue: issue, nearby: nearby, landuse: landuse, zones: z, provenance: provenance, uncertainty: uncertainty, flags: flags, cannot: cannot, dataVersion: P.dataVersion };
  };

  // ---------- district ----------
  W.buildDistrict = function (r) {
    var used = {}, provenance = [], issue = [], flags = [], nearby = [];
    function use(id) { var s = sch('district', id); if (s) { used[s.cls] = true; if (!provenance.some(function (p) { return p.id === id; })) provenance.push({ id: id, label: s.label, source: s.source, year: s.year, cls: s.cls }); } return s; }
    ['total_ipc_bns_2024', 'theft_2024', 'crashes_in_zones_2024', 'fatal_crashes_in_zones_2024', 'crash_prone_zones_2024', 'persons_killed_2024'].forEach(use);
    issue.push('In 2024 the police stations of this district registered ' + D.n(r.total_ipc_bns_2024) + ' IPC/BNS cases, including ' + D.n(r.theft_2024) + ' thefts. These are registered cases, which depend on reporting as well as on crime.');
    issue.push(plural(r.crash_prone_zones_2024, 'crash-prone zone', 'crash-prone zones') + ' in 2024, with ' + D.n(r.fatal_crashes_in_zones_2024) + ' fatal crashes and ' + D.n(r.crashes_in_zones_2024) + ' crashes within those zones (not all crashes in the district). ' + D.n(r.persons_killed_2024) + ' people were killed in road crashes in the whole district.');
    use('crime_comparison_2023_2024'); use('road_comparison_2023_2024');
    issue.push('Compared with 2023: ' + (r.crime_comparison_2023_2024 === 'caution' ? 'compare crime with caution (the Bharatiya Nyaya Sanhita replaced the IPC in July 2024)' : r.crime_comparison_2023_2024) + '; zone counts ' + (r.road_comparison_2023_2024 === 'caution' ? 'compare with caution (the zone list differs every year)' : r.road_comparison_2023_2024) + '. No change figure is shown here.');
    [['police_stations', null], ['police_posts', null], ['metro_gates', null], ['bus_stops', null], ['surveillance_points_mapped', null], ['pedestrian_overpasses', null], ['footway_km', 'footway_km_per_km2']].forEach(function (p) {
      var s = use(p[0]); if (!s) return;
      nearby.push({ label: s.label, value: fmt(r[p[0]], s.unit) + (s.unit === 'km' ? ' km' : ''), sub: p[1] && r[p[1]] != null ? fmt(r[p[1]], 'per km²') + ' km per km²' : '', cls: s.cls, zero: r[p[0]] === 0 });
    });
    var s1 = use('streetlights_per_km2'), s2 = use('underpasses');
    nearby.push({ label: s1.label, value: r.papl_surveyed ? fmt(r.streetlights_per_km2, 'per km²') : 'not surveyed', sub: '', cls: s1.cls, zero: false });
    nearby.push({ label: s2.label, value: r.papl_surveyed ? fmt(r.underpasses, '') : 'not surveyed', sub: '', cls: s2.cls, zero: false });
    if (!r.papl_surveyed) flags.push('The streetlight and underpass survey did not cover this district: a blank, not zero.');
    if (r.district === 'Outer') flags.push('Police posts are undercounted in Outer.');
    flags.push('Boundaries are simplified (about 165 m) and population is approximate; neither is survey-grade.');
    var uncertainty = Object.keys(used).map(function (c) { return { cls: c, label: clsLabel(c), meaning: P.uncertaintyClasses[c].meaning }; });
    var cannot = P.cannotEstablish.general.slice();
    Object.keys(used).forEach(function (c) { var t = P.cannotEstablish.byClass[c]; if (t && cannot.indexOf(t) < 0) cannot.push(t); });
    return { kind: 'district', title: r.district + ' district', subtitle: fmt(r.area_km2, 'km²') + ' km² · ' + D.n(r.population) + ' people (approximate)', issue: issue, nearby: nearby, landuse: null, zones: [], provenance: provenance, uncertainty: uncertainty, flags: flags, cannot: cannot, dataVersion: P.dataVersion };
  };

  // ---------- render ----------
  function list(items, cls) { return h('ul', { class: cls || 'why-list' }, items.map(function (t) { return h('li', null, t); })); }
  W.render = function (w, opts) {
    opts = opts || {};
    var root = h('div', { class: 'why', role: 'region', 'aria-label': 'Why this place?' });
    root.appendChild(h('div', { class: 'eyebrow' }, 'Why this place?'));
    root.appendChild(h('div', { class: 'why-sec' }, h('h3', null, 'Observed issue'), list(w.issue)));
    root.appendChild(h('div', { class: 'why-sec' }, h('h3', null, w.kind === 'ward' ? 'Infrastructure in the ward' : 'Infrastructure in the district'),
      h('div', { class: 'why-grid' }, w.nearby.map(function (n) {
        return h('div', { class: 'why-cell' + (n.zero ? ' zero' : ''), title: P.uncertaintyClasses[n.cls] ? clsLabel(n.cls) : '' }, h('span', { class: 'l' }, n.label), h('span', { class: 'v num' }, n.value), n.sub ? h('span', { class: 's' }, n.sub) : null,
          n.zero && n.cls === 'mapped_osm' ? h('span', { class: 's' }, 'may be unmapped') : null);
      })), w.landuse ? h('p', { class: 'muted', style: 'font-size:13px' }, w.landuse) : null));
    if (w.zones.length) {
      root.appendChild(h('div', { class: 'why-sec' }, h('h3', null, 'Around each crash-prone zone'),
        h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:520px' },
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Zone'), h('th', { scope: 'col' }, 'Fatal / all'), h('th', { scope: 'col' }, 'Position ±'), h('th', { scope: 'col' }, 'Crossings 250 / 500 m'), h('th', { scope: 'col' }, 'Signals 250 / 500 m'), h('th', { scope: 'col' }, 'Footway 250 m'))),
          h('tbody', null, w.zones.map(function (q) {
            var f = function (v) { return v == null ? '—' : D.n(v); };
            return h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, q.name), h('td', null, f(q.fatal_crashes) + ' / ' + f(q.total_crashes)), h('td', null, q.position_accuracy_m == null ? '—' : D.n(q.position_accuracy_m) + ' m'),
              h('td', null, f(q.crossings_250m) + ' / ' + f(q.crossings_500m)), h('td', null, f(q.signals_250m) + ' / ' + f(q.signals_500m)), h('td', null, q.footway_km_250m == null ? '—' : (Math.round(q.footway_km_250m * 10) / 10) + ' km'));
          }))), h('p', { class: 'muted', style: 'font-size:12.5px' }, 'Mapped in OpenStreetMap: a zero or a low figure often means the area is not mapped. "Position ±" is the estimated accuracy of the hand-placed zone centre.'))));
    }
    root.appendChild(h('div', { class: 'why-sec' }, h('h3', null, 'Uncertainty'),
      h('div', { class: 'chips' }, w.uncertainty.map(function (u) { return h('span', { class: 'why-chip', title: u.meaning }, u.label); })),
      list(w.uncertainty.map(function (u) { return u.label + ': ' + u.meaning; }), 'why-list small'), w.flags.length ? h('div', { class: 'callout warn', style: 'font-size:13.5px;margin-top:8px' }, list(w.flags)) : null));
    root.appendChild(h('details', { class: 'why-sec why-src' }, h('summary', null, 'Data year and source of each figure (' + w.provenance.length + ')'),
      h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:480px' }, h('thead', null, h('tr', null, h('th', null, 'Figure'), h('th', null, 'Year'), h('th', null, 'Source'), h('th', null, 'Class'))),
        h('tbody', null, w.provenance.map(function (p) { return h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, p.label), h('td', { style: 'text-align:left' }, p.year), h('td', { style: 'text-align:left;font:13px var(--sans)' }, p.source), h('td', { style: 'text-align:left;font:13px var(--sans)' }, clsLabel(p.cls))); }))))));
    root.appendChild(h('div', { class: 'why-sec' }, h('h3', null, 'What this data cannot establish'), list(w.cannot)));
    root.appendChild(h('p', { class: 'muted', style: 'font-size:12.5px' }, 'Data version ' + w.dataVersion + '. Evidence for a field audit, not a finding.'));
    return root;
  };

  // ---------- plain text (Markdown) for the evidence pack ----------
  W.markdown = function (w) {
    var L = ['# ' + w.title, '', w.subtitle, '', '_Data version ' + w.dataVersion + '. Evidence for a field audit, not a finding._', '', '## Observed issue', ''];
    w.issue.forEach(function (t) { L.push('- ' + t); });
    L.push('', '## Infrastructure', '');
    w.nearby.forEach(function (n) { L.push('- ' + n.label + ': ' + n.value + (n.sub ? ' (' + n.sub + ')' : '') + (n.zero && n.cls === 'mapped_osm' ? ' (may be unmapped)' : '')); });
    if (w.landuse) L.push('', w.landuse);
    if (w.zones.length) {
      L.push('', '## Around each crash-prone zone (mapped in OpenStreetMap; zero often means unmapped)', '', '| Zone | Fatal / all | Position accuracy | Crossings 250 / 500 m | Signals 250 / 500 m | Footway 250 m |', '|---|---|---|---|---|---|');
      w.zones.forEach(function (q) {
        var f = function (v) { return v == null ? '–' : v; };
        L.push('| ' + q.name + ' | ' + f(q.fatal_crashes) + ' / ' + f(q.total_crashes) + ' | ' + (q.position_accuracy_m == null ? '–' : q.position_accuracy_m + ' m') + ' | ' + f(q.crossings_250m) + ' / ' + f(q.crossings_500m) + ' | ' + f(q.signals_250m) + ' / ' + f(q.signals_500m) + ' | ' + (q.footway_km_250m == null ? '–' : q.footway_km_250m + ' km') + ' |');
      });
    }
    L.push('', '## Uncertainty', '');
    w.uncertainty.forEach(function (u) { L.push('- **' + u.label + '.** ' + u.meaning); });
    w.flags.forEach(function (t) { L.push('- ' + t); });
    L.push('', '## Data year and source of each figure', '');
    w.provenance.forEach(function (p) { L.push('- ' + p.label + ' — ' + p.year + ' — ' + p.source + ' (' + clsLabel(p.cls) + ')'); });
    L.push('', '## What this data cannot establish', '');
    w.cannot.forEach(function (t) { L.push('- ' + t); });
    L.push('');
    return L.join(String.fromCharCode(10));
  };

  D.why = W;
})();
