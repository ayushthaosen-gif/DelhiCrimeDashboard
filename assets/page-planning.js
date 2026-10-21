/* Planning mode: pick a layer, read the ward map with its coverage and uncertainty stated beside it, select a ward, see "Why this place?",
   and export an evidence pack. Wards are the legacy 290 (before the 2022 delimitation), not the current 250. Reads DSO_PLAN and DSO_PROFILES. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h, PL = window.DSO_PLAN, P = window.DSO_PROFILES;
  if (!PL || !P || !D.why) return;

  var cols = PL.cols, ci = {}; cols.forEach(function (c, i) { ci[c] = i; });
  var wards = PL.wards.map(function (w) { var row = {}; cols.forEach(function (c, i) { row[c] = w.v[i]; }); return { no: w.no, path: w.path, row: row, zones: w.zones }; });
  var byNo = {}; wards.forEach(function (w) { byNo[w.no] = w; });

  var LAYERS = [
    { k: 'zfatal', g: 'Crash severity', label: 'Fatal crashes within crash-prone zones (2024)', field: 'crash_zone_fatal_crashes_2024', unit: 'fatal crashes', zero: 'no zone placed in the ward' },
    { k: 'zones', g: 'Crash severity', label: 'Crash-prone zones placed in the ward (2024)', field: 'crash_zones_2024', unit: 'zones', zero: 'no zone placed in the ward' },
    { k: 'zped', g: 'Crash severity', label: 'Pedestrian fatal crashes within zones (2024)', field: 'crash_zone_pedestrian_fatal_crashes_2024', unit: 'fatal crashes', zero: 'no zone placed in the ward' },
    { k: 'foot', g: 'Pedestrian infrastructure', label: 'Footway mapped', field: 'footway_km', rate: 'footway_km_per_km2', unit: 'km', zero: 'none mapped (may be unmapped)' },
    { k: 'cross', g: 'Pedestrian infrastructure', label: 'Pedestrian crossings mapped', field: 'pedestrian_crossings', rate: 'pedestrian_crossings_per_km2', unit: 'crossings', zero: 'none mapped (may be unmapped)' },
    { k: 'sig', g: 'Pedestrian infrastructure', label: 'Traffic signals mapped', field: 'traffic_signals', rate: 'traffic_signals_per_km2', unit: 'signals', zero: 'none mapped (may be unmapped)' },
    { k: 'bus', g: 'Transit', label: 'Bus stops mapped', field: 'bus_stops', rate: 'bus_stops_per_km2', unit: 'stops', zero: 'none mapped (may be unmapped)' },
    { k: 'lamp', g: 'Street lighting', label: 'Street lamps mapped (not a survey)', field: 'street_lamps_mapped', rate: 'street_lamps_mapped_per_km2', unit: 'lamps', zero: 'none mapped (may be unmapped)' },
    { k: 'hosp', g: 'Services', label: 'Hospitals mapped', field: 'hospitals', rate: 'hospitals_per_km2', unit: 'hospitals', zero: 'none mapped (may be unmapped)' },
    { k: 'pol', g: 'Services', label: 'Police stations', field: 'police_stations', unit: 'stations', zero: 'none placed in the ward' },
    { k: 'post', g: 'Services', label: 'Police posts mapped', field: 'police_posts', unit: 'posts', zero: 'none mapped (may be unmapped)' },
    { k: 'res', g: 'Land use', label: 'Residential land cover', field: 'residential_pct', unit: '% of mapped area', zero: 'none mapped as residential' },
    { k: 'com', g: 'Land use', label: 'Commercial land cover', field: 'commercial_pct', unit: '% of mapped area', zero: 'none mapped as commercial' },
    { k: 'ind', g: 'Land use', label: 'Industrial land cover', field: 'industrial_pct', unit: '% of mapped area', zero: 'none mapped as industrial' },
    { k: 'ins', g: 'Land use', label: 'Institutional land cover', field: 'institutional_pct', unit: '% of mapped area', zero: 'none mapped as institutional' },
    { k: 'grn', g: 'Land use', label: 'Green and open land cover', field: 'green_open_pct', unit: '% of mapped area', zero: 'none mapped as green or open' }
  ];
  var st = { layer: 'zfatal', calc: 'count', sel: null, hover: null, zones: false };

  function layerOf(k) { return LAYERS.filter(function (l) { return l.k === k; })[0] || LAYERS[0]; }
  function fieldOf(l) { return st.calc === 'rate' && l.rate ? l.rate : l.field; }
  function valueOf(w, l) { var v = w.row[fieldOf(l)]; return v == null ? null : v; }
  function fmtV(v, l) {
    if (v == null) return 'no figure';
    var rate = st.calc === 'rate' && l.rate;
    if (rate) return (Math.round(v * 100) / 100).toLocaleString('en-IN') + ' per km²';
    if (l.field === 'footway_km') return (Math.round(v * 10) / 10).toLocaleString('en-IN') + ' km';
    if (/%/.test(l.unit)) return (Math.round(v * 10) / 10).toLocaleString('en-IN') + '%';
    return D.n(v);
  }

  // ---------- URL hash ----------
  function readHash() {
    var p = D.parseHash();
    if (p.layer && LAYERS.some(function (l) { return l.k === p.layer; })) st.layer = p.layer;
    if (p.calc === 'rate' || p.calc === 'count') st.calc = p.calc;
    if (p.ward && byNo[p.ward]) st.sel = p.ward;
    if (p.zones === '1') st.zones = true;
  }
  function hashNow() { return D.hashOf({ layer: st.layer, calc: layerOf(st.layer).rate ? st.calc : 'count', ward: st.sel, zones: st.zones ? '1' : '' }); }
  function syncHash() { try { history.replaceState(null, '', hashNow()); } catch (e) { /* the link just will not update */ } }

  // ---------- state helpers ----------
  var root = { toolbar: D.$('#plToolbar'), work: D.$('#plWork') };
  function keepFocus(fn) {
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-key');
    fn();
    if (key) { var el = document.querySelector('[data-key="' + key + '"]'); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  }
  function set(o) { for (var k in o) st[k] = o[k]; keepFocus(render); syncHash(); }

  // ---------- ranking and colours ----------
  var cache = null;
  function ranking() {
    var l = layerOf(st.layer), key = l.k + '|' + st.calc;
    if (cache && cache.key === key) return cache;
    var rows = wards.map(function (w) { return { name: w.no, w: w, v: valueOf(w, l) }; }).filter(function (r) { return r.v != null && r.v > 0; }).sort(function (a, b) { return b.v - a.v; });
    var rank = {}; rows.forEach(function (r, i) { rank[r.name] = i + 1; });
    cache = { key: key, rows: rows, bin: D.bands(rows), rank: rank };
    return cache;
  }
  function fillOf(w, l, rk) {
    var v = valueOf(w, l);
    if (v == null) return 'url(#plHatch)';
    if (v <= 0) return 'var(--surface2)';
    return D.rampVars[rk.bin[w.no]];
  }
  function coverageClass(l) { var s = P.schema.ward[fieldOf(l)]; return s ? s[2] : null; }

  // ---------- toolbar ----------
  function renderToolbar() {
    var l = layerOf(st.layer), groups = [];
    LAYERS.forEach(function (x) { if (groups.indexOf(x.g) < 0) groups.push(x.g); });
    var sel = h('select', { id: 'plLayer', 'aria-label': 'Layer', 'data-key': 'layer', onchange: function (e) { set({ layer: e.target.value }); } },
      groups.map(function (g) { return h('optgroup', { label: g }, LAYERS.filter(function (x) { return x.g === g; }).map(function (x) { return h('option', { value: x.k, selected: x.k === l.k }, x.label); })); }));
    var calc = h('div', { class: 'seg', role: 'group', 'aria-label': 'Show as' }, [['count', 'Count'], ['rate', 'Per km²']].map(function (c) {
      var ok = c[0] === 'count' || !!l.rate;
      return h('button', { type: 'button', 'aria-pressed': String(layerOf(st.layer).rate ? st.calc === c[0] : c[0] === 'count'), disabled: !ok, title: ok ? null : 'Not available for this layer', 'data-key': 'calc-' + c[0], onclick: function () { set({ calc: c[0] }); } }, c[1]);
    }));
    var s = P.schema.ward[fieldOf(l)];
    var cls = s ? s[2] : null;
    D.clear(root.toolbar).appendChild(h('div', { class: 'row' }, h('label', { for: 'plLayer', class: 'label' }, 'Layer'), sel, h('span', { class: 'group' }, h('span', { class: 'label' }, 'Show as'), calc),
      h('div', { class: 'actions' },
        h('label', { class: 'btn', style: 'display:flex;gap:6px;align-items:center' }, h('input', { type: 'checkbox', checked: st.zones, 'data-key': 'zonesToggle', onchange: function (e) { set({ zones: e.target.checked }); } }), 'Show 2024 crash-prone zones'),
        h('button', { type: 'button', class: 'btn', 'data-key': 'copy', onclick: function (e) { D.copy(location.href.split('#')[0] + hashNow(), e.currentTarget, 'Link copied', 'Copy link to view'); } }, 'Copy link to view'))));
    root.toolbar.appendChild(h('div', { class: 'pl-badges' },
      cls ? h('span', { class: 'why-chip', title: P.uncertaintyClasses[cls].meaning }, P.uncertaintyClasses[cls].label) : null,
      s ? h('span', null, 'Data year: ' + s[4] + ' · Source: ' + s[3]) : null,
      D.tip('About this layer', [s ? s[2] === 'mapped_osm' ? P.uncertaintyClasses.mapped_osm.meaning : P.uncertaintyClasses[s[2]].meaning : '', 'Zero here means: ' + l.zero + '.'])));
  }

  // ---------- map ----------
  var mapEls = null;
  function renderMap(rk, l) {
    var svg = h('svg', { viewBox: PL.viewBox, role: 'group', 'aria-label': 'Map of the 290 legacy wards' });
    svg.appendChild(h('defs', null, h('pattern', { id: 'plHatch', patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, h('rect', { class: 'hatch-bg', width: 6, height: 6 }), h('line', { class: 'hatch-ln', x1: 0, y1: 0, x2: 0, y2: 6 }))));
    var paths = {};
    wards.forEach(function (w) {
      var v = valueOf(w, l);
      var p = h('path', { class: 'wpath', d: w.path, tabindex: 0, role: 'button', 'data-key': 'w-' + w.no, style: 'fill:' + fillOf(w, l, rk),
        'aria-label': w.row.ward_name + ' (' + (w.row.assigned_district || 'no district') + '): ' + fmtV(v, l) + (v === 0 ? ', ' + l.zero : '') + (st.sel === w.no ? ', selected' : ''),
        onmouseenter: function () { setHover(w.no); }, onfocus: function () { setHover(w.no); }, onblur: function () { setHover(null); },
        onclick: function () { set({ sel: st.sel === w.no ? null : w.no }); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set({ sel: st.sel === w.no ? null : w.no }); } } });
      paths[w.no] = p; svg.appendChild(p);
    });
    var hov = h('path', { class: 'whov', d: '' }), sel = h('path', { class: 'wsel', d: st.sel ? byNo[st.sel].path : '' });
    svg.appendChild(hov); svg.appendChild(sel);
    if (st.zones) {
      var zl = h('g', null);
      PL.zonePoints.forEach(function (z) {
        var accU = z[5] == null ? 0 : z[5] / PL.metersPerUnit;
        var inSel = st.sel && byNo[st.sel].zones.some(function (q) { return q.name === z[0]; });
        if (inSel && accU > 0) zl.appendChild(h('circle', { class: 'zring', cx: z[7], cy: z[8], r: Math.max(accU, 2) }));
        zl.appendChild(h('circle', { class: 'zdot', cx: z[7], cy: z[8], r: 3.2 }, h('title', null, z[0] + (z[3] != null ? ': ' + z[3] + ' fatal crashes' : '') + (z[5] != null ? '; position accurate to about ' + D.n(z[5]) + ' m' : ''))));
      });
      svg.appendChild(zl);
    }
    var card = h('div', { class: 'hover-card', hidden: true });
    var box = h('div', { class: 'map-box' }, svg, card);
    box.addEventListener('mousemove', function (e) { var r = box.getBoundingClientRect(); card._x = e.clientX - r.left; card._y = e.clientY - r.top; card._w = r.width; place(); });
    box.addEventListener('mouseleave', function () { setHover(null); });
    mapEls = { paths: paths, hov: hov, card: card, l: l, rk: rk };

    var ranges = [0, 1, 2, 3, 4].map(function (b) {
      var vs = rk.rows.filter(function (r, i) { return 4 - Math.floor(i * 5 / Math.max(rk.rows.length, 1)) === b; }).map(function (r) { return r.v; });
      var lo = vs.length ? Math.min.apply(null, vs) : null, hi = vs.length ? Math.max.apply(null, vs) : null, short = function (v) { return fmtV(v, l).replace(/ per km²| km|%/, ''); };
      return h('div', { class: 'step' }, h('i', { style: 'background:' + D.rampVars[b] }), h('span', null, vs.length ? (lo === hi || short(lo) === short(hi) ? short(lo) : short(lo) + '–' + short(hi)) : ''));
    });
    var legend = h('div', { class: 'legend' },
      h('div', null, h('div', { class: 't' }, 'Colour = rank among wards with a value above zero', D.tip('About the colour scale', 'Wards with a value above zero are split into five groups by rank, so one extreme ward cannot wash out the rest. Colours are not comparable between layers.')), h('div', { class: 'steps' }, ranges)),
      h('div', { class: 'none' }, h('i', { style: 'width:22px;height:12px;border-radius:2px;background:var(--surface2);border:1px solid var(--line)' }), 'Zero: ' + l.zero),
      h('div', { class: 'none' }, h('svg', { width: 22, height: 12, 'aria-hidden': 'true' }, h('rect', { width: 22, height: 12, rx: 2, style: 'fill:url(#plHatch)' })), 'No figure'));
    var s = P.schema.ward[fieldOf(l)];
    var warn = (l.g === 'Crash severity') ? 'Crash-zone positions were placed by hand (accurate to 150 m up to 5 km), so a zone can belong to a neighbouring ward. Counts are within zones, not ward totals.' : (s && s[2] === 'mapped_osm') ? 'Mapped in OpenStreetMap: a low or zero value often means the area is not mapped.' : '';
    return h('section', { class: 'panel map pl-map', 'aria-label': 'Ward map' }, h('div', { class: 'map-body' }, box, legend, warn ? h('p', { class: 'callout warn', style: 'font-size:13.5px' }, warn) : null,
      h('p', { class: 'pl-note' }, 'Legacy ward geography (290 wards, before the 2022 delimitation), not the current 250 MCD wards. Boundaries are simplified for display.')));
  }
  function place() {
    if (!mapEls || !st.hover) return;
    var c = mapEls.card;
    c.style.left = Math.max(0, Math.min((c._x || 0) + 16, (c._w || 600) - 220)) + 'px'; c.style.top = Math.max(0, (c._y || 0) + 16) + 'px';
  }
  function setHover(no) {
    st.hover = no;
    if (!mapEls) return;
    mapEls.hov.setAttribute('d', no && no !== st.sel ? byNo[no].path : '');
    var c = mapEls.card;
    if (no) {
      var w = byNo[no], v = valueOf(w, mapEls.l);
      D.clear(c).appendChild(h('b', null, w.row.ward_name));
      c.appendChild(h('span', null, w.row.assigned_district || 'No assigned district'));
      c.appendChild(h('span', { class: 'v' }, fmtV(v, mapEls.l)));
      c.appendChild(h('span', null, v > 0 ? D.ord(mapEls.rk.rank[no]) + ' of ' + mapEls.rk.rows.length + ' wards with a value' : v === 0 ? mapEls.l.zero : 'no figure'));
      c.hidden = false; place();
    } else c.hidden = true;
  }

  // ---------- ranked list and search ----------
  function renderList(rk, l) {
    var top = rk.rows.slice(0, 15);
    var datalist = h('datalist', { id: 'plWards' }, wards.map(function (w) { return h('option', { value: w.row.ward_name + ' (' + w.no + ')' }); }));
    var input = h('input', { type: 'search', list: 'plWards', placeholder: 'Find a ward by name or number', 'aria-label': 'Find a ward', onchange: function (e) {
      var q = e.target.value.trim().toLowerCase(), m = q.match(/\(([^)]+)\)\s*$/), hit = m ? byNo[m[1]] : wards.filter(function (w) { return w.row.ward_name.toLowerCase() === q || w.no.toLowerCase() === q; })[0];
      if (hit) set({ sel: hit.no }); else e.target.setCustomValidity('No ward matches'); } });
    return h('section', { class: 'panel list', 'aria-label': 'Highest wards' },
      h('div', { class: 'list-head' }, h('h2', null, 'Highest, ' + (st.calc === 'rate' && l.rate ? 'per km²' : 'count')), h('span', null, rk.rows.length + ' wards above zero')),
      h('div', { style: 'padding:0 12px 8px' }, h('div', { class: 'pl-search' }, input, datalist)),
      h('ol', { class: 'rank-list' }, top.map(function (r, i) {
        return h('li', null, h('button', { type: 'button', 'data-name': r.w.no, 'data-key': 'row-' + r.w.no, 'aria-pressed': String(st.sel === r.w.no), onclick: function () { set({ sel: st.sel === r.w.no ? null : r.w.no }); }, onmouseenter: function () { setHover(r.w.no); }, onmouseleave: function () { setHover(null); } },
          h('span', { class: 'r' }, i + 1), h('span', { class: 'n' }, r.w.row.ward_name), h('span', { class: 'v' }, fmtV(r.v, l)),
          h('span', { class: 'b' }, h('i', { style: 'width:' + Math.max(2, r.v / top[0].v * 100) + '%;background:' + D.rampVars[rk.bin[r.w.no]] }))));
      })),
      h('p', { class: 'pl-note', style: 'padding:0 14px 12px' }, 'Not available by ward: metro entrances and the streetlight survey are published by district only (see Explore).'));
  }

  // ---------- detail: Why this place? and the evidence pack ----------
  function ctxFor(w) {
    var fatal = ranking_for('crash_zone_fatal_crashes_2024');
    return { row: w.row, zones: w.zones, rank: { fatal: fatal.rank[w.no] ? [fatal.rank[w.no], fatal.n] : null } };
  }
  function ranking_for(field) {
    var rows = wards.filter(function (w) { return w.row[field] != null && w.row[field] > 0; }).sort(function (a, b) { return b.row[field] - a.row[field]; });
    var rank = {}; rows.forEach(function (w, i) { rank[w.no] = i + 1; });
    return { rank: rank, n: rows.length };
  }
  function profileCsv(w) {
    return D.csv([cols, cols.map(function (c) { return w.row[c]; })]);
  }
  function fetchText(path) { return fetch(path).then(function (r) { if (!r.ok) throw new Error(path + ' ' + r.status); return r.text(); }); }
  function evidencePack(w, btn) {
    var why = D.why.buildWard(ctxFor(w)), restore = btn.textContent;
    btn.textContent = 'Preparing…'; btn.disabled = true;
    Promise.all([fetchText('data/profiles/ward_profiles.geojson').catch(function () { return null; }), fetchText('data/profiles/schema.json').catch(function () { return null; }), fetchText('data/profiles/manifest.json').catch(function () { return null; })]).then(function (r) {
      var missing = [], files = [];
      var feature = null;
      if (r[0]) { try { var g = JSON.parse(r[0]); feature = g.features.filter(function (f) { return f.properties.ward_no === w.no; })[0]; } catch (e) { /* reported below */ } }
      files.push({ name: 'why_this_place.md', text: D.why.markdown(why) });
      files.push({ name: 'ward_profile.csv', text: profileCsv(w) });
      files.push({ name: 'ward_profile.json', text: JSON.stringify(Object.assign({ dataVersion: P.dataVersion, geography: 'legacy_290_wards' }, w.row, { zones: w.zones }), null, 2) + String.fromCharCode(10) });
      if (feature) files.push({ name: 'ward_boundary.geojson', text: JSON.stringify({ type: 'FeatureCollection', features: [feature] }) + String.fromCharCode(10) }); else missing.push('ward_boundary.geojson');
      if (r[1]) files.push({ name: 'field_contract.json', text: r[1] }); else missing.push('field_contract.json');
      if (r[2]) files.push({ name: 'provenance_manifest.json', text: r[2] }); else missing.push('provenance_manifest.json');
      var NL = String.fromCharCode(10);
      files.unshift({ name: 'README.txt', text: ['Evidence pack: ' + w.row.ward_name + ' (ward ' + w.no + ')', '',
        'Data version ' + P.dataVersion + '. Legacy 290-ward geography (before the 2022 delimitation), not the current 250 MCD wards.',
        'This is evidence for a field audit, not a finding. Read why_this_place.md first: it states what each figure is, its year and source, how uncertain it is, and what the data cannot establish.', '',
        'Files:', '  why_this_place.md        the panel as text', '  ward_profile.csv / .json  every field for this ward (a blank means the source holds no figure; never zero)', '  ward_boundary.geojson     the ward outline (CC-BY-SA 2.5 India, DataMeet)',
        '  field_contract.json       what every column means, its source, data year and uncertainty class', '  provenance_manifest.json  input and output hashes, licences, method notes',
        '', 'OpenStreetMap-derived figures: OpenStreetMap contributors, ODbL. No open reuse licence has been verified for the official source documents.',
        missing.length ? '' : null, missing.length ? 'Not included because it could not be loaded here: ' + missing.join(', ') + '. Download it from data/profiles/ on the site.' : null].filter(function (x) { return x !== null; }).join(NL) + NL });
      D.downloadBlob('delhi_ward_' + w.no + '_evidence_pack.zip', D.zip(files));
    }).then(function () { btn.textContent = 'Evidence pack downloaded'; btn.disabled = false; setTimeout(function () { btn.textContent = restore; }, 2000); }, function () { btn.textContent = restore; btn.disabled = false; });
  }
  function renderDetail() {
    var sec = h('section', { class: 'panel detail', 'aria-label': 'Ward detail' }), body = h('div', { class: 'detail-body' });
    if (st.sel == null) {
      body.appendChild(h('div', { class: 'prompt' }, 'Select a ward on the map or in the list to see what the data shows there, how sure it is, and what it cannot tell you. Then download an evidence pack to take into a field visit.'));
      body.appendChild(h('div', { class: 'pl-note' }, 'Bulk downloads: ', h('a', { href: 'data/profiles/ward_profiles.csv' }, 'all wards (CSV)'), ' · ', h('a', { href: 'data/profiles/ward_profiles.geojson' }, 'GeoJSON'), ' · ', h('a', { href: 'data/profiles/district_profiles.csv' }, 'districts (CSV)'), ' · ', h('a', { href: 'data/profiles/schema.json' }, 'field contract'), ' · ', h('a', { href: 'data/profiles/manifest.json' }, 'provenance manifest')));
      sec.appendChild(body); return sec;
    }
    var w = byNo[st.sel], why = D.why.buildWard(ctxFor(w));
    body.appendChild(h('div', { class: 'head' }, h('div', null, h('span', { class: 'eyebrow' }, 'Ward ' + w.no), h('h2', null, why.title), h('div', { class: 'muted', style: 'font-size:13px' }, why.subtitle)),
      h('button', { type: 'button', class: 'pill-btn', 'data-key': 'clear', 'aria-label': 'Clear selection', onclick: function () { set({ sel: null }); } }, 'Clear')));
    body.appendChild(h('div', { class: 'pl-actions' },
      h('button', { type: 'button', class: 'btn primary', 'data-key': 'pack', onclick: function (e) { evidencePack(w, e.currentTarget); } }, 'Download evidence pack (ZIP)'),
      h('button', { type: 'button', class: 'btn', 'data-key': 'wcsv', onclick: function () { D.download('delhi_ward_' + w.no + '_profile.csv', profileCsv(w)); } }, 'Ward profile (CSV)')));
    body.appendChild(D.why.render(why));
    sec.appendChild(body); return sec;
  }

  function render() {
    var l = layerOf(st.layer);
    if (!l.rate) st.calc = 'count';
    var rk = ranking();
    renderToolbar();
    D.clear(root.work);
    root.work.appendChild(renderList(rk, l));
    root.work.appendChild(renderMap(rk, l));
    root.work.appendChild(renderDetail());
    if (st.hover) setHover(st.hover);
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
