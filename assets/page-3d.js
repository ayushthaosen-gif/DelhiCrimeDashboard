/* 3D ward view (MapLibre GL). Height and colour show the selected measure on the legacy 290-ward geography.
   Ward crash and infrastructure counts are exploratory (approximate coordinates); crime is published per police district only, so every ward
   shows its district's value. Data comes from the repo's data/ files by relative path. Reads window.DSO_DATA. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h;
  var data = D.data();
  if (!data) return;
  var districts = {}; data.DELHI.districts.forEach(function (d) { districts[d.name] = d; });

  var HOME = { center: [77.15, 28.63], zoom: 9.6, pitch: 58, bearing: -18 };
  var YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  var MAXH = 5000;
  var METRICS = [
    { key: 'crashZones2024FatalSum', label: 'Fatal crashes in 2024 crash zones', g: 'road' },
    { key: 'crashZones2024Density', label: 'Crash zones per km² (2024)', g: 'road' },
    { key: 'gapIndex', label: 'Crash zones with few cameras (gap index)', kind: 'gap', g: 'road' },
    { key: 'surveillanceDensity', label: 'Surveillance cameras per km²', g: 'infra' },
    { key: 'busStopsDensity', label: 'Bus stops per km²', g: 'infra' },
    { key: 'atmsDensity', label: 'ATMs per km²', g: 'infra' },
    { key: 'officialLiquorVendsDensity', label: 'Official liquor vends per km²', g: 'infra' },
    { key: 'totalIPCDensity2024Inherited', label: 'IPC/BNS crime per km², 2024', g: 'crime' },
    { key: 'crimeAgainstWomenDensity2024Inherited', label: 'Crime against women per km², 2024', g: 'crime' },
    { key: 'theft', label: 'Theft per km², by year', kind: 'year', g: 'crime' },
    { key: 'robbery', label: 'Robbery per km², by year', kind: 'year', g: 'crime' },
    { key: 'burglary', label: 'Burglary per km², by year', kind: 'year', g: 'crime' }
  ];
  var GROUPS = [
    { k: 'road', title: 'Road safety · ward', note: 'Exploratory: crash zones are placed at approximate coordinates. The gap index multiplies how high a ward ranks for crash-zone density by how low it ranks for camera density (0 to 1); cameras are only one kind of safety infrastructure.' },
    { k: 'infra', title: 'Infrastructure · ward', note: 'OpenStreetMap is community-mapped: a low value can mean little mapping, not little infrastructure. Liquor vend positions are mostly approximate.' },
    { k: 'crime', title: 'Crime · district figure', note: 'Crime is published per police district only. Every ward shows its district\'s rate, so wards in one district look the same. Years with no comparable figure show grey.' }
  ];
  var RAMP = { light: ['#d8d3ca', '#f3e4cc', '#ecc093', '#df8f5e', '#c25a3b', '#8a2c22'], dark: ['#3a3f4a', '#5b4a3e', '#8a5a3c', '#c0703f', '#e2904f', '#f6bb7e'] };
  var LAYERS = [['cams', 'Surveillance cameras', 'OpenStreetMap points; no video', '#4dd0e1'], ['pol', 'Police stations and posts', 'GSDL stations and OpenStreetMap posts', '#6fa8dc'], ['liq', 'Liquor vends', 'Official lists; positions mostly approximate', '#c77dff']];

  var st = { metric: 0, year: 2024, playing: false, basemap: 'osm', height: 55, labels: true, buildings: false, cams: false, pol: false, liq: false, sel: null, tour: null, pitched: true, anyNull: false };
  var map = null, ready = false, wards = null, gap = [], yearMax = {}, zones = [], pts = {}, saved = null, playT = null, tourT = null;
  var ui = {};
  var overlays = D.$('#m3overlays');

  function theme() { return D.theme(); }
  function json(u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); }); }
  var fmt = function (v) { return v == null ? 'No figure' : (Math.round(v * 100) / 100).toLocaleString('en-IN'); };

  // ---------- panel ----------
  function buildPanel() {
    var p = D.clear(D.$('#m3panel'));
    ui.search = h('input', { id: 'wardSearch', type: 'search', list: 'wardNames', placeholder: 'e.g. Timarpur or Rohini', onkeydown: function (e) { if (e.key === 'Enter') goSearch(); }, onchange: function () { goSearch(); } });
    ui.names = h('datalist', { id: 'wardNames' });
    ui.msg = h('span', { class: 'msg', role: 'status' });
    p.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
      h('div', { style: 'display:flex;align-items:center;gap:8px' }, h('h1', null, '3D ward view'), h('span', null, 'Prototype')),
      h('p', { class: 'muted', style: 'font-size:14px' }, 'Height and colour show the selected measure. Wards with zero stay flat. Uses the legacy 290-ward geography, from before the 2022 delimitation.')));
    p.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:6px' },
      h('label', { for: 'wardSearch', style: 'font-weight:700;font-size:15px' }, 'Find a ward or district'),
      h('div', { class: 'search3' }, ui.search, h('button', { type: 'button', onclick: goSearch }, 'Go')), ui.names, ui.msg));

    ui.radios = [];
    var fs = h('fieldset', null, h('legend', null, 'Measure'));
    GROUPS.forEach(function (g) {
      var grp = h('div', { style: 'display:flex;flex-direction:column;gap:2px' }, h('div', { class: 'group-title' }, g.title, D.tip('About these measures', g.note)));
      METRICS.forEach(function (m, i) {
        if (m.g !== g.k) return;
        var input = h('input', { type: 'radio', name: 'metric3d', onchange: function () { if (st.tour != null) stopTour(); st.metric = i; applyMetric(); sync(); } });
        var lab = h('label', { class: 'opt' }, input, h('span', null, m.label));
        ui.radios[i] = { input: input, lab: lab };
        grp.appendChild(lab);
      });
      fs.appendChild(grp);
    });
    p.appendChild(fs);

    ui.yearVal = h('b', null, ''); ui.play = h('button', { type: 'button', onclick: togglePlay }, '▶ Play');
    ui.slider = h('input', { type: 'range', min: 2016, max: 2024, step: 1, 'aria-label': 'Year', oninput: function (e) { clearInterval(playT); st.playing = false; st.year = +e.target.value; applyMetric(); sync(); } });
    ui.yearbox = h('div', { class: 'yearbox' },
      h('div', { class: 'top' }, h('b', null, 'Year'), ui.yearVal),
      h('div', { class: 'ctl' }, ui.play, ui.slider),
      h('span', { class: 'small' }, 'Same scale every year, so heights can be compared over time. Not every year can be compared: ', h('a', { href: 'data-methods.html#compare' }, 'check before reading a change'), '.'));
    p.appendChild(ui.yearbox);

    var lf = h('fieldset', null, h('legend', null, 'Points on the map'));
    LAYERS.forEach(function (l) {
      var input = h('input', { type: 'checkbox', onchange: function (e) { st[l[0]] = e.target.checked; applyLayers(); } });
      lf.appendChild(h('label', { class: 'opt', style: 'padding:5px 0;margin:0' }, input, h('span', null, h('span', { style: 'display:flex;align-items:center' }, h('i', { class: 'dot', style: 'background:' + l[3] }), l[1]), h('small', null, l[2]))));
      ui['chk_' + l[0]] = input;
    });
    p.appendChild(lf);

    ui.bm = {};
    var bm = h('div', { class: 'bm' }, [['osm', 'Streets'], ['sat', 'Satellite'], ['none', 'None']].map(function (b) {
      var btn = h('button', { type: 'button', onclick: function () { st.basemap = b[0]; applyBasemap(); sync(); } }, b[1]); ui.bm[b[0]] = btn; return btn;
    }));
    ui.height = h('input', { type: 'range', min: 0, max: 100, oninput: function (e) { st.height = +e.target.value; updateHeight(); } });
    ui.labels = h('input', { type: 'checkbox', onchange: function (e) { st.labels = e.target.checked; applyLabels(); } });
    ui.buildings = h('input', { type: 'checkbox', onchange: function (e) { st.buildings = e.target.checked; applyBuildings(); } });
    ui.tilt = h('button', { type: 'button', onclick: function () { if (map) map.easeTo({ pitch: st.pitched ? 0 : 58, duration: 800 }); st.pitched = !st.pitched; sync(); } }, 'Top-down view');
    ui.copy = h('button', { type: 'button', onclick: function (e) { D.copy(location.href.split('#')[0] + '#m=' + METRICS[st.metric].key + '&y=' + st.year, e.currentTarget, 'Link copied', 'Copy link'); } }, 'Copy link');
    p.appendChild(h('div', { class: 'view' }, h('h2', null, 'View'), bm,
      h('label', { class: 'col' }, 'Extrusion height', ui.height),
      h('label', { class: 'check' }, ui.labels, 'Place and ward names'),
      h('label', { class: 'check' }, ui.buildings, '3D buildings when zoomed in'),
      h('div', { class: 'grid2' }, ui.tilt, h('button', { type: 'button', onclick: function () { if (map) map.flyTo({ center: HOME.center, zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing, duration: 1500 }); st.pitched = true; sync(); } }, 'Reset view'),
        h('button', { type: 'button', onclick: function () { if (map) map.easeTo({ bearing: 0, duration: 600 }); } }, 'North up'), ui.copy)));

    ui.tourBtn = h('button', { type: 'button', disabled: true, onclick: function () { if (st.tour != null) stopTour(); else startTour(); } }, 'Loading zones…');
    p.appendChild(h('div', { class: 'tour' }, h('strong', { style: 'font-size:15px' }, 'Tour the 10 worst crash zones'),
      h('span', { style: 'font-size:13.5px;color:var(--ink2)' }, 'Flies to each 2024 crash-prone zone in 3D satellite view with its crash figures and nearby cameras and police.'), ui.tourBtn));
    p.appendChild(h('p', { class: 'small' }, 'Ward crash and infrastructure counts are exploratory (approximate coordinates). Crime is published per police district only, so every ward shows its district\'s value. ',
      h('a', { href: 'map_3d_mpd.html' }, 'Master Plan 2047 comparison')));
  }

  function sync() {
    var m = METRICS[st.metric];
    ui.radios.forEach(function (r, i) { if (!r) return; r.input.checked = i === st.metric; r.lab.classList.toggle('on', i === st.metric); });
    ui.yearbox.hidden = m.kind !== 'year';
    ui.yearVal.textContent = st.year; ui.slider.value = st.year;
    ui.play.textContent = st.playing ? 'Pause' : '▶ Play';
    Object.keys(ui.bm).forEach(function (k) { ui.bm[k].setAttribute('aria-pressed', String(st.basemap === k)); });
    ui.height.value = st.height; ui.labels.checked = st.labels; ui.buildings.checked = st.buildings;
    LAYERS.forEach(function (l) { ui['chk_' + l[0]].checked = st[l[0]]; });
    ui.tilt.textContent = st.pitched ? 'Top-down view' : '3D view';
    ui.tourBtn.textContent = st.tour != null ? 'Stop tour' : zones.length ? 'Start tour' : 'Loading zones…';
    ui.tourBtn.disabled = !zones.length;
    renderLegend(); renderDetail(); renderTour();
  }

  // ---------- values and colours ----------
  function valueOf(f, m) {
    if (m.kind === 'gap') return gap[f.properties._id] || 0;
    if (m.kind === 'year') { var d = districts[f.properties.assignedDistrict]; if (!d) return null; var v = d.s[m.key][st.year]; return v == null ? null : v / d.area; }
    var v2 = f.properties[m.key]; return v2 == null ? 0 : Number(v2) || 0;
  }
  function applyMetric() {
    if (!wards || !ready) return;
    var m = METRICS[st.metric], ramp = RAMP[theme()];
    var vals = wards.features.map(function (f) { return valueOf(f, m); });
    var r;
    if (m.kind === 'year') { var mx = yearMax[m.key] || 1; r = function (v) { return v <= 0 ? 0 : 0.1 + 0.9 * Math.sqrt(v / mx); }; }
    else {
      var s = vals.filter(function (v) { return v > 0; }).sort(function (a, b) { return a - b; });
      r = function (v) { if (v <= 0) return 0; var lo = s.indexOf(v), hi = s.lastIndexOf(v); return 0.15 + 0.85 * (((lo + hi) / 2 + 1) / s.length); };
    }
    var anyNull = false;
    wards.features.forEach(function (f, i) {
      var v = vals[i], p = f.properties; p._v = v;
      if (v === null) { anyNull = true; p._r = 0; p._color = '#6b7280'; }
      else { p._r = r(v); p._color = p._r === 0 ? ramp[0] : ramp[Math.min(5, 1 + Math.floor(p._r * 4.999))]; }
    });
    map.getSource('wards').setData(wards);
    updateHeight();
    st.anyNull = anyNull;
    renderLegend(); renderDetail();
  }
  function updateHeight() {
    if (!ready) return;
    var sc = st.height / 100 * MAXH, b = st.buildings;
    map.setPaintProperty('wards-3d', 'fill-extrusion-height', b ? ['interpolate', ['linear'], ['zoom'], 12.5, ['*', ['get', '_r'], sc], 14.5, 0] : ['*', ['get', '_r'], sc]);
    map.setPaintProperty('wards-3d', 'fill-extrusion-opacity', b ? ['interpolate', ['linear'], ['zoom'], 12.5, 0.9, 14.5, 0.3, 15.4, 0] : 0.9);
  }
  function applyBasemap() { if (!ready) return; ['osm', 'sat'].forEach(function (k) { map.setLayoutProperty('bm-' + k, 'visibility', k === st.basemap ? 'visible' : 'none'); }); }
  function applyLabels() { if (!ready) return; ['place-labels', 'ward-labels'].forEach(function (id) { map.setLayoutProperty(id, 'visibility', st.labels ? 'visible' : 'none'); }); }
  function applyBuildings() { if (!ready) return; map.setLayoutProperty('buildings-3d', 'visibility', st.buildings ? 'visible' : 'none'); updateHeight(); }
  function applyLayers() {
    if (!ready) return;
    [['cams', 'cameras-pt'], ['pol', 'police-pt'], ['liq', 'liquor-pt']].forEach(function (a) { map.setLayoutProperty(a[1], 'visibility', st[a[0]] ? 'visible' : 'none'); if (st[a[0]]) loadPoints(a[0]); });
  }

  // ---------- overlays ----------
  function renderLegend() {
    var m = METRICS[st.metric], ramp = RAMP[theme()];
    if (!ui.legend) { ui.legend = h('div', { class: 'm3-legend', 'aria-live': 'polite' }); overlays.appendChild(ui.legend); }
    D.clear(ui.legend).appendChild(h('b', { style: 'font-size:13.5px' }, m.label + (m.kind === 'year' ? ', ' + st.year : '')));
    ui.legend.appendChild(h('div', { class: 'ramp' }, ramp.map(function (c) { return h('span', { style: 'background:' + c }); })));
    ui.legend.appendChild(h('div', { class: 'ends' }, h('span', null, 'Zero (flat)'), h('span', null, 'Low'), h('span', null, 'High')));
    if (st.anyNull) ui.legend.appendChild(h('span', { class: 'nodata' }, h('i'), 'No comparable figure'));
  }
  function renderStatus(text) {
    if (ui.status) { ui.status.remove(); ui.status = null; }
    if (text) { ui.status = h('div', { class: 'm3-status', role: 'status' }, h('span', null, text)); overlays.appendChild(ui.status); }
  }
  function showHover(id, x, y) {
    if (!ui.hover) { ui.hover = h('div', { class: 'm3-hover', hidden: true }); overlays.appendChild(ui.hover); }
    if (id == null || st.tour != null) { ui.hover.hidden = true; return; }
    var f = wards.features[id], p = f.properties, m = METRICS[st.metric];
    D.clear(ui.hover).appendChild(h('b', null, p.Ward_Name));
    ui.hover.appendChild(h('span', { style: 'opacity:.8' }, (p.assignedDistrict || 'Unassigned') + ' district'));
    ui.hover.appendChild(h('span', null, m.label + ': ' + (p._v == null ? 'no comparable figure' : fmt(p._v))));
    ui.hover.appendChild(h('span', { style: 'opacity:.7;font-size:12px' }, 'Click for details'));
    ui.hover.style.left = (x + 14) + 'px'; ui.hover.style.top = (y + 14) + 'px'; ui.hover.hidden = false;
  }
  function renderDetail() {
    if (ui.detail) { ui.detail.remove(); ui.detail = null; }
    if (st.sel == null || !wards || st.tour != null) return;
    var f = wards.features[st.sel], p = f.properties;
    var rows = METRICS.map(function (x, i) {
      var v = valueOf(f, x), rank = '';
      if (v > 0) { var hi = 0, tot = 0; wards.features.forEach(function (g) { var u = valueOf(g, x); if (u > 0) { tot++; if (u > v) hi++; } }); rank = '#' + (hi + 1) + ' of ' + tot; }
      return h('div', { class: 'r' + (i === st.metric ? ' on' : '') }, h('span', null, x.label + (x.kind === 'year' ? ' (' + st.year + ')' : '')), h('span', null, h('span', { class: 'v' }, fmt(v)), ' ', h('small', null, rank)));
    });
    var hin = p.highInjuryNetwork === true || p.highInjuryNetwork === 'true';
    ui.detail = h('div', { class: 'm3-card', role: 'region', 'aria-label': 'Selected ward' },
      h('div', { class: 'between', style: 'align-items:flex-start' }, h('div', null, h('h2', null, p.Ward_Name), h('span', { class: 'sub' }, (p.assignedDistrict || 'Unassigned') + ' district · ' + p.areaSqKm + ' km²')),
        h('button', { type: 'button', class: 'x', 'aria-label': 'Close ward details', onclick: function () { selectWard(null); } }, '×')),
      hin ? h('span', { class: 'hin' }, 'High-injury network #' + p.highInjuryNetworkRank) : null,
      h('div', null, rows),
      h('span', { class: 'src' }, 'Rank is among wards with a value above zero. Crime figures are district-level, not ward-level.'),
      p.assignedDistrict ? h('a', { href: 'explore.html' + D.hashOf({ topic: 'crime', metric: 'theft', year: 2024, district: p.assignedDistrict }), style: 'font-size:14px' }, 'See ' + p.assignedDistrict + ' district in Explore') : null);
    overlays.appendChild(ui.detail);
  }
  function selectWard(id) {
    st.sel = id;
    if (ready) map.setFilter('wards-pin', ['==', ['get', '_id'], id == null ? -1 : id]);
    renderDetail();
  }

  // ---------- points (cameras, police, liquor): loaded when first switched on ----------
  function loadPoints(k) {
    if (pts[k]) return Promise.resolve(pts[k]);
    var src = {
      cams: ['data/poi_markers_latlng.json', 'cameras', function (j) { return (j.surveillance || []).map(function (c) { return { lat: +c[0], lng: +c[1] }; }); }],
      pol: ['data/police_markers_latlng.json', 'police', function (j) { return (j.stations || []).map(function (c) { return { lat: +c[0], lng: +c[1], name: String(c[2] || ''), kind: 'station' }; }).concat((j.posts || []).map(function (c) { return { lat: +c[0], lng: +c[1], name: String(c[2] || ''), kind: 'post' }; })); }],
      liq: ['data/delhi_liquor_vends_all_coordinates_approx.geojson', 'liquor', function (j) { return j.features.filter(function (f) { return f.geometry && f.geometry.type === 'Point'; }).map(function (f) { return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }; }); }]
    }[k];
    return json(src[0]).then(function (j) {
      var list = src[2](j).filter(function (c) { return isFinite(c.lat) && isFinite(c.lng); });
      pts[k] = list;
      if (map) map.getSource(src[1]).setData({ type: 'FeatureCollection', features: list.map(function (c) { return { type: 'Feature', properties: { kind: c.kind || '' }, geometry: { type: 'Point', coordinates: [c.lng, c.lat] } }; }) });
      if (st.tour != null) renderTour();
      return list;
    }).catch(function () { return null; });
  }
  function meters(lat1, lng1, lat2, lng2) { var R = 6371000, r = Math.PI / 180, a = Math.pow(Math.sin((lat2 - lat1) * r / 2), 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin((lng2 - lng1) * r / 2), 2); return 2 * R * Math.asin(Math.sqrt(a)); }

  // ---------- search ----------
  function bbox(fs) {
    var x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    function walk(c) { if (typeof c[0] === 'number') { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); } else c.forEach(walk); }
    fs.forEach(function (f) { walk(f.geometry.coordinates); });
    return [[x0, y0], [x1, y1]];
  }
  function goSearch() {
    if (!wards || !ready) return;
    var raw = ui.search.value, q = raw.trim().toLowerCase(); if (!q) return;
    var dq = q.replace(/\s*\(district\)$/, ''), F = wards.features;
    var hit = F.filter(function (f) { return f.properties.Ward_Name.toLowerCase() === q; })[0];
    function go(fs) { map.fitBounds(bbox(fs), { padding: 80, pitch: 58, maxZoom: fs.length === 1 ? 12.6 : 12, duration: 1600 }); }
    if (hit) { go([hit]); selectWard(hit.properties._id); ui.msg.textContent = ''; return; }
    var m = F.filter(function (f) { return (f.properties.assignedDistrict || '').toLowerCase() === dq; });
    if (!m.length) m = F.filter(function (f) { return f.properties.Ward_Name.toLowerCase().indexOf(q) >= 0; });
    if (!m.length) { ui.msg.textContent = 'No ward or district matches "' + raw + '"'; return; }
    go(m); if (m.length === 1) selectWard(m[0].properties._id); ui.msg.textContent = '';
  }

  // ---------- play ----------
  function togglePlay() {
    if (st.playing) { clearInterval(playT); st.playing = false; sync(); return; }
    if (st.year >= 2024) st.year = 2016;
    st.playing = true; applyMetric(); sync();
    playT = setInterval(function () {
      if (st.year >= 2024) { clearInterval(playT); st.playing = false; sync(); return; }
      st.year++; applyMetric(); sync();
    }, 1100);
  }

  // ---------- tour of the 10 worst 2024 crash zones ----------
  function circle(lng, lat, rm) { var p = [], dLat = rm / 111320, dLng = rm / (111320 * Math.cos(lat * Math.PI / 180)); for (var k = 0; k <= 64; k++) { var a = k / 64 * 2 * Math.PI; p.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]); } return p; }
  function tourStep(i) {
    clearTimeout(tourT);
    if (!zones.length || i >= zones.length) { stopTour(); return; }
    i = Math.max(0, i);
    var z = zones[i], c = z.geometry.coordinates;
    map.getSource('tour').setData({ type: 'FeatureCollection', features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [circle(c[0], c[1], z.properties.zone_radius_m || 250)] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }] });
    var wide = window.innerWidth >= 760;
    map.flyTo({ center: c, zoom: 16.2, pitch: 64, bearing: -35 + i * 38, padding: wide ? { right: 360, top: 0, bottom: 0, left: 0 } : { top: 0, bottom: 0, left: 0, right: 0 }, duration: 4500, essential: false });
    st.tour = i; st.sel = null; selectWard(null); renderTour(); ui.tourBtn.textContent = 'Stop tour';
    tourT = setTimeout(function () { tourStep(i + 1); }, 9000);
  }
  function startTour() {
    saved = { basemap: st.basemap, buildings: st.buildings, cams: st.cams, pol: st.pol, metric: st.metric };
    clearInterval(playT);
    st.basemap = 'sat'; st.buildings = true; st.cams = true; st.pol = true; st.metric = 0; st.playing = false;
    applyBasemap(); applyBuildings(); applyLayers(); applyMetric(); sync();
    tourStep(0);
  }
  function stopTour() {
    clearTimeout(tourT);
    if (map && map.getSource('tour')) map.getSource('tour').setData({ type: 'FeatureCollection', features: [] });
    if (map) map.flyTo({ center: HOME.center, zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 2000 });
    st.tour = null;
    if (saved) { for (var k in saved) st[k] = saved[k]; saved = null; applyBasemap(); applyBuildings(); applyLayers(); applyMetric(); }
    sync();
  }
  function renderTour() {
    if (ui.tour) { ui.tour.remove(); ui.tour = null; }
    if (st.tour == null || !zones.length) return;
    var z = zones[st.tour], p = z.properties, c = z.geometry.coordinates, lat = c[1], lng = c[0];
    var nv = function (v) { return v == null ? 'n/a' : v; };
    var cams = pts.cams, pol = pts.pol, camTxt = 'Loading…', polTxt = 'Loading…', c250 = null;
    if (cams) { var a = 0, b = 0; cams.forEach(function (q) { var d = meters(lat, lng, q.lat, q.lng); if (d <= 500) { b++; if (d <= 250) a++; } }); c250 = a; camTxt = a + ' / ' + b; }
    if (pol) { var best = null; pol.forEach(function (q) { if (q.kind !== 'station') return; var d = meters(lat, lng, q.lat, q.lng); if (!best || d < best.d) best = { d: d, name: q.name }; }); if (best) polTxt = best.name.replace(/^PS /i, '') + ', ' + (best.d >= 1000 ? (best.d / 1000).toFixed(1) + ' km' : Math.round(best.d) + ' m'); }
    var rows = [['Fatal / all crashes', nv(p.all_fatal_crashes) + ' / ' + nv(p.all_total_crashes)], ['Persons killed / injured', nv(p.blackspot_persons_killed) + ' / ' + nv(p.blackspot_persons_injured)], ['Mapped cameras within 250 m / 500 m', camTxt], ['Nearest police station', polTxt], ['Report recommends CCTV', p.cctv_priority_candidate ? 'Yes' : 'No']];
    ui.tour = h('div', { class: 'm3-card tour-card', 'aria-live': 'polite' },
      h('div', { class: 'between' }, h('span', { class: 'step' }, 'Stop ' + (st.tour + 1) + ' of ' + zones.length),
        h('div', { class: 'nav' }, h('button', { type: 'button', 'aria-label': 'Previous stop', onclick: function () { tourStep((st.tour || 0) - 1); } }, '◀'), h('button', { type: 'button', 'aria-label': 'Next stop', onclick: function () { tourStep((st.tour || 0) + 1); } }, '▶'), h('button', { type: 'button', 'aria-label': 'Stop tour', onclick: stopTour }, '×'))),
      h('div', null, h('strong', { class: 'tt' }, '#' + p.table_6_29_rank + ' ' + p.location_name), h('div', { class: 'sub' }, p.road_name || '')),
      h('div', null, rows.map(function (r) { return h('div', { class: 'r' }, h('span', null, r[0]), h('span', { class: 'v' }, r[1])); })),
      p.cctv_priority_candidate && c250 === 0 ? h('span', { class: 'flag' }, 'The report recommends CCTV here, and no camera is mapped within 250 m (OpenStreetMap may be incomplete).') : null,
      h('a', { href: 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=' + lat + ',' + lng, target: '_blank', rel: 'noopener', style: 'font-size:14px' }, 'Street view near here ↗'),
      h('span', { class: 'src' }, 'Delhi Road Crash Report 2024, Table 6.29 rank. The ring is the report\'s 250 m crash-prone zone; the position is approximate, not a surveyed crash site. Cameras are mapped OpenStreetMap points, not a complete list.'));
    overlays.appendChild(ui.tour);
  }

  // ---------- map ----------
  function initMap() {
    var ml = window.maplibregl;
    if (!ml) { renderStatus('The map library could not be loaded. Check your connection and reload.'); return; }
    var light = theme() === 'light';
    var BM = { osm: { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], attr: '© OpenStreetMap contributors', max: 19 }, sat: { tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attr: 'Imagery © Esri', max: 18 } };
    var style = { version: 8, glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf', sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': light ? '#dfe5ee' : '#10151f' } }] };
    Object.keys(BM).forEach(function (k) {
      style.sources['bm-' + k] = { type: 'raster', tiles: BM[k].tiles, tileSize: 256, maxzoom: BM[k].max, attribution: BM[k].attr };
      style.layers.push({ id: 'bm-' + k, type: 'raster', source: 'bm-' + k, layout: { visibility: k === st.basemap ? 'visible' : 'none' }, paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.85 } });
    });
    try { map = new ml.Map({ container: 'map', style: style, center: HOME.center, zoom: HOME.zoom, pitch: HOME.pitch, bearing: HOME.bearing, maxPitch: 75, attributionControl: { compact: true } }); }
    catch (e) { renderStatus('This browser cannot draw the 3D map (WebGL is unavailable).'); return; }
    map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.on('error', function (e) { if (window.console) console.warn('map:', e && e.error && e.error.message || e); });
    map.once('style.load', function () {
      map.addSource('wards', { type: 'geojson', data: wards });
      map.addSource('buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet', attribution: '© OpenFreeMap © OpenMapTiles' });
      map.addLayer({ id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', 'source-layer': 'building', minzoom: 14, layout: { visibility: 'none' }, paint: { 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0], 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6], 'fill-extrusion-color': '#b9bfca', 'fill-extrusion-opacity': 0.85 } });
      map.addLayer({ id: 'wards-3d', type: 'fill-extrusion', source: 'wards', paint: { 'fill-extrusion-color': ['get', '_color'], 'fill-extrusion-height': 0, 'fill-extrusion-opacity': 0.9, 'fill-extrusion-vertical-gradient': true } });
      map.addLayer({ id: 'wards-outline', type: 'line', source: 'wards', paint: { 'line-color': '#ffffff', 'line-opacity': 0.45, 'line-width': 0.6 } });
      map.addLayer({ id: 'wards-pin', type: 'line', source: 'wards', filter: ['==', ['get', '_id'], -1], paint: { 'line-color': '#ffdd00', 'line-width': 4 } });
      var halo = { 'text-color': '#ffffff', 'text-halo-color': 'rgba(10,14,22,0.92)', 'text-halo-width': 1.8 };
      map.addLayer({ id: 'place-labels', type: 'symbol', source: 'buildings', 'source-layer': 'place', minzoom: 8, filter: ['in', ['get', 'class'], ['literal', ['city', 'town', 'suburb', 'quarter', 'neighbourhood', 'village']]], layout: { 'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 8, 11, 14, 14], 'text-max-width': 8 }, paint: halo });
      map.addLayer({ id: 'ward-labels', type: 'symbol', source: 'wards', minzoom: 11.2, layout: { 'text-field': ['get', 'Ward_Name'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10, 16, 13], 'text-max-width': 6 }, paint: Object.assign({}, halo, { 'text-color': '#ffe9b3' }) });
      var empty = { type: 'FeatureCollection', features: [] };
      [['cameras', 'cameras-pt', '#4dd0e1'], ['police', 'police-pt', '#6fa8dc'], ['liquor', 'liquor-pt', '#c77dff']].forEach(function (a) {
        map.addSource(a[0], { type: 'geojson', data: empty });
        map.addLayer({ id: a[1], type: 'circle', source: a[0], minzoom: 9, layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 2, 14, 4.5, 17, 7], 'circle-color': a[2], 'circle-stroke-color': '#0b1220', 'circle-stroke-width': 1, 'circle-opacity': 0.95 } });
      });
      map.addSource('tour', { type: 'geojson', data: empty });
      map.addLayer({ id: 'tour-zone', type: 'fill', source: 'tour', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': '#f0a63c', 'fill-opacity': 0.2 } });
      map.addLayer({ id: 'tour-ring', type: 'line', source: 'tour', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'line-color': '#f0a63c', 'line-width': 3 } });
      map.addLayer({ id: 'tour-pt', type: 'circle', source: 'tour', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#c4252d', 'circle-stroke-width': 3 } });
      ready = true;
      applyMetric(); applyBasemap(); applyLabels(); applyBuildings(); applyLayers();
      renderStatus('');
      map.on('mousemove', 'wards-3d', function (e) { map.getCanvas().style.cursor = 'pointer'; showHover(e.features[0].properties._id, e.point.x, e.point.y); });
      map.on('mouseleave', 'wards-3d', function () { map.getCanvas().style.cursor = ''; showHover(null); });
      map.on('click', function (e) { var hit = map.queryRenderedFeatures(e.point, { layers: ['wards-3d'] })[0]; selectWard(hit ? Number(hit.properties._id) : null); });
    });
  }

  document.addEventListener('dso-theme', function () {
    if (!ready) return;
    map.setPaintProperty('bg', 'background-color', theme() === 'light' ? '#dfe5ee' : '#10151f');
    applyMetric();
  });

  // ---------- boot ----------
  var hash = D.parseHash();
  if (hash.m) { var mi = METRICS.map(function (m) { return m.key; }).indexOf(hash.m); if (mi >= 0) st.metric = mi; }
  if (hash.y && YEARS.indexOf(+hash.y) >= 0) st.year = +hash.y;
  buildPanel(); sync();
  renderStatus('Loading map…');
  json('data/delhi_wards_infra.geojson').then(function (g) {
    wards = g;
    g.features.forEach(function (f, i) { f.properties._id = i; });
    var pct = function (key) { var v = g.features.map(function (f) { return Number(f.properties[key]) || 0; }), s = v.slice().sort(function (a, b) { return a - b; }); return v.map(function (x) { var lo = s.indexOf(x), hi = s.lastIndexOf(x); return (lo + (hi - lo) / 2) / (s.length - 1); }); };
    var need = pct('crashZones2024Density'), cover = pct('surveillanceDensity');
    gap = g.features.map(function (f, i) { return (Number(f.properties.crashZones2024Density) || 0) > 0 ? Math.round(need[i] * (1 - cover[i]) * 1000) / 1000 : 0; });
    METRICS.filter(function (m) { return m.kind === 'year'; }).forEach(function (m) {
      var mx = 0; data.DELHI.districts.forEach(function (d) { YEARS.forEach(function (y) { var v = d.s[m.key][y]; if (v != null) mx = Math.max(mx, v / d.area); }); }); yearMax[m.key] = mx;
    });
    var names = {}; g.features.forEach(function (f) { names[f.properties.Ward_Name] = 1; if (f.properties.assignedDistrict) names[f.properties.assignedDistrict + ' (district)'] = 1; });
    Object.keys(names).sort().forEach(function (nm) { ui.names.appendChild(h('option', { value: nm })); });
    initMap();
  }).catch(function (e) { renderStatus('Could not load ward data: ' + e.message); });
  json('data/delhi_crash_prone_zones_2024_all_named_approx.geojson').then(function (g) {
    zones = g.features.filter(function (f) { return f.properties.table_6_29_rank && f.geometry && f.geometry.type === 'Point'; }).sort(function (a, b) { return a.properties.table_6_29_rank - b.properties.table_6_29_rank; }).slice(0, 10);
    sync();
  }).catch(function () { /* the tour stays disabled */ });
})();
