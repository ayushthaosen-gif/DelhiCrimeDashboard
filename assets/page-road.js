/* Road safety, citywide: headline figures, 2011-2024 trend, deaths by mode of travel, enforcement, crash-prone zones and the roads with most zones.
   All figures are citywide counts from Delhi Traffic Police; none is split by district in the source. Reads window.DSO_DATA. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h, n = D.n;
  var data = D.data();
  if (!data) return;
  var S = data.SITE, R = data.ROADS, T = S.trends, E = S.enforcement, V = S.victims;
  var last = T[T.length - 1], prev = T[T.length - 2];
  var st = { measure: 'killed', index: false, hy: null, modeYear: 2024, roadYear: 2024, zoneYear: 2023, query: '', allZones: false };

  function seg(items, cur, pick, key) {
    return h('div', { class: 'seg' }, items.map(function (it) {
      return h('button', { type: 'button', 'aria-pressed': String(it[0] === cur), 'data-key': key + '-' + it[0], onclick: function () { pick(it[0]); } }, it[1]);
    }));
  }
  function keepFocus(fn) {
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-key');
    fn();
    if (key) { var el = document.querySelector('[data-key="' + key + '"]'); if (el) el.focus({ preventScroll: true }); }
  }

  // ---- headline ----
  function ch(a, b) { var p = Math.round((a - b) / b * 100); return (p > 0 ? '+' : p < 0 ? '−' : '±') + Math.abs(p) + '% vs 2023'; }
  var kpis = [
    ['Road crashes, 2024', n(last.crashes), ch(last.crashes, prev.crashes)],
    ['Fatal crashes, 2024', n(last.fatalCrashes), ch(last.fatalCrashes, prev.fatalCrashes)],
    ['Persons killed, 2024', n(last.killed), ch(last.killed, prev.killed)],
    ['Hit-and-run share of fatal crashes', E[2024].hitAndRunShare.toFixed(1) + '%', n(E[2024].hitAndRunFatal) + ' crashes · ' + E[2023].hitAndRunShare.toFixed(1) + '% in 2023']
  ];
  var kb = D.clear(D.$('#rsKpis'));
  kpis.forEach(function (k) { kb.appendChild(h('div', { class: 'rs-kpi' }, h('span', { class: 'l' }, k[0]), h('span', { class: 'v big' }, k[1]), h('span', { class: 's' }, k[2]))); });

  // ---- trend ----
  var LAB = { crashes: 'total crashes', fatalCrashes: 'fatal crashes', killed: 'persons killed' };
  function renderTrend() {
    var sec = D.clear(D.$('#trend'));
    var mk = st.measure, b0 = T[0][mk];
    var vals = T.map(function (r) { return st.index ? r[mk] / b0 * 100 : r[mk]; });
    var maxV = Math.max.apply(null, vals.concat(st.index ? [100] : [0])) * 1.08;
    var hy = st.hy == null ? T.length - 1 : st.hy, hr = T[hy];
    sec.appendChild(h('div', { class: 'row-between' },
      h('div', { class: 'title-row' }, h('h2', null, 'Trend, 2011–2024'),
        D.tip('About this trend', 'Counts, not rates: traffic and population changed over the period. Fatal crashes and persons killed are different counts. Injury figures differ by source edition and are excluded. The early reports\' 30-day fatality definition could not be confirmed.')),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' },
        seg([['killed', 'Persons killed'], ['fatalCrashes', 'Fatal crashes'], ['crashes', 'All crashes']], mk, function (k) { st.measure = k; keepFocus(renderTrend); }, 'measure'),
        seg([[false, 'Counts'], [true, 'Index']].map(function (o) { return [o[0], o[1]]; }), st.index, function (k) { st.index = k; keepFocus(renderTrend); }, 'scale'))));
    sec.appendChild(h('div', { class: 'readout', 'aria-live': 'polite' }, h('span', { class: 'v big' }, st.index ? String(Math.round(vals[hy])) : n(hr[mk])),
      h('span', null, st.index ? hr.year + ' · index of ' + LAB[mk] + ' (2011 = 100) · ' + n(hr[mk]) + ' counted' : LAB[mk] + ' in ' + hr.year)));
    var bars = h('div', { class: 'bars' });
    if (st.index) bars.appendChild(h('div', { class: 'base', style: 'bottom:' + (100 / maxV * 100) + '%' }, h('span', null, '2011 = 100')));
    T.forEach(function (r, i) {
      bars.appendChild(h('button', { type: 'button', 'aria-pressed': String(i === hy), 'aria-label': r.year + ': ' + n(r[mk]) + ' ' + LAB[mk],
        onmouseenter: function () { setHy(i); }, onfocus: function () { setHy(i); } }, h('span', { class: 'b', style: 'height:' + (vals[i] / maxV * 100) + '%' })));
    });
    bars.addEventListener('mouseleave', function () { setHy(null); });
    sec.appendChild(bars);
    sec.appendChild(h('div', { class: 'bar-labels' }, T.map(function (r) { return h('span', null, "'" + String(r.year).slice(2)); })));
    sec.appendChild(h('details', { class: 'plain' }, h('summary', null, 'Show annual counts'),
      h('div', { class: 'overflow', style: 'margin-top:10px' }, h('table', { class: 'tbl', style: 'min-width:420px' },
        h('thead', null, h('tr', null, h('th', null, 'Year'), h('th', null, 'Total crashes'), h('th', null, 'Fatal crashes'), h('th', null, 'Persons killed'))),
        h('tbody', null, T.map(function (r) { return h('tr', null, h('td', null, r.year), h('td', null, n(r.crashes)), h('td', null, n(r.fatalCrashes)), h('td', null, n(r.killed))); }))))));
  }
  // hovering a bar updates the readout and highlight without rebuilding the page
  function setHy(i) {
    st.hy = i;
    var sec = D.$('#trend'), mk = st.measure, b0 = T[0][mk], hy = i == null ? T.length - 1 : i, hr = T[hy];
    var btns = sec.querySelectorAll('.bars button');
    btns.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === hy)); });
    var vals = T.map(function (r) { return st.index ? r[mk] / b0 * 100 : r[mk]; });
    var ro = sec.querySelector('.readout');
    ro.firstChild.textContent = st.index ? String(Math.round(vals[hy])) : n(hr[mk]);
    ro.lastChild.textContent = st.index ? hr.year + ' · index of ' + LAB[mk] + ' (2011 = 100) · ' + n(hr[mk]) + ' counted' : LAB[mk] + ' in ' + hr.year;
  }

  // ---- mode of travel ----
  function renderModes() {
    var sec = D.clear(D.$('#modes'));
    var v = V[st.modeYear];
    var ML = [['pedestrian', 'Pedestrians'], ['twoWheeler', 'Two-wheeler riders'], ['other', 'Other'], ['cyclist', 'Cyclists'], ['car', 'Car occupants'], ['slowMoving', 'Slow-moving vehicles'], ['animal', 'Animal-drawn'], ['bus', 'Bus passengers']];
    var mmax = Math.max.apply(null, ML.map(function (m) { return v[m[0]]; }));
    var rows = ML.map(function (m) { return { k: m[0], l: m[1], v: v[m[0]] }; }).sort(function (a, b) { return b.v - a.v; });
    sec.appendChild(h('div', { class: 'row-between' }, h('h2', { style: 'font-size:18px;font-weight:600' }, 'Who is killed, by mode of travel'),
      h('div', { class: 'years' }, Object.keys(V).map(Number).map(function (y) {
        return h('button', { type: 'button', 'aria-pressed': String(y === st.modeYear), 'data-key': 'my-' + y, onclick: function () { st.modeYear = y; keepFocus(renderModes); } }, y);
      }))));
    sec.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, rows.map(function (r) {
      return h('div', { class: 'mode-row' + (r.k === 'pedestrian' ? ' ped' : '') }, h('span', null, r.l),
        h('span', { class: 'track' }, h('i', { style: 'width:' + (r.v / mmax * 100) + '%' })),
        h('span', { class: 'v' }, n(r.v) + ' ', h('span', null, Math.round(r.v / v.total * 100) + '%')));
    })));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Pedestrians are unprotected road users, which makes their share relevant to walkability. Delhi Traffic Police, 2019–2024, citywide.'));
  }

  // ---- enforcement ----
  function renderEnforcement() {
    var sec = D.clear(D.$('#enforcement'));
    var rows = [
      ['Hit-and-run fatal crashes', n(E[2023].hitAndRunFatal), n(E[2024].hitAndRunFatal)],
      ['Drink-driving prosecutions', n(E[2023].drinkDriving), n(E[2024].drinkDriving)],
      ['Over-speeding notices', n(E[2023].overspeed), n(E[2024].overspeed)],
      ['Red-light cameras (junctions)', E[2023].rlvd + ' (' + E[2023].rlvdJunctions + ')', E[2024].rlvd + ' (' + E[2024].rlvdJunctions + ')'],
      ['Speed cameras (locations)', E[2023].osvd + ' (' + E[2023].osvdLocations + ')', E[2024].osvd + ' (' + E[2024].osvdLocations + ')']
    ];
    sec.appendChild(h('div', { class: 'title-row' }, h('h2', null, 'Enforcement, 2023 and 2024')));
    sec.appendChild(h('div', { style: 'display:flex;flex-direction:column' },
      h('div', { class: 'enf-row h' }, h('span', null, 'Measure'), h('span', null, '2023'), h('span', null, '2024')),
      rows.map(function (r) { return h('div', { class: 'enf-row' }, h('span', null, r[0]), h('span', null, r[1]), h('span', null, r[2])); })));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Citywide totals from the Delhi Road Crash Report 2023 and 2024; not split by district in the source.'));
  }

  // ---- crash-prone zones (2023 list, 107 zones, sorted as in the source) ----
  function renderZones() {
    var sec = D.$('#zones');
    var q = st.query.trim().toLowerCase();
    var list = st.zoneYear === 2022 ? R.zones2022 : R.zones2023, count0 = list.length;
    var all = list.map(function (z, i) { return { rank: i + 1, name: z[0], road: z[1], fatal: z[2], total: z[3] }; });
    var filt = q ? all.filter(function (z) { return (z.name + ' ' + z.road).toLowerCase().indexOf(q) >= 0; }) : all;
    var zones = st.allZones || q ? filt : filt.slice(0, 10);
    var body = sec.querySelector('tbody'), count = sec.querySelector('.zcount'), toggle = sec.querySelector('.ztoggle');
    if (!body) {
      D.clear(sec);
      var input = h('input', { type: 'search', class: 'search', placeholder: 'Search location or road', 'aria-label': 'Search crash-prone zones', oninput: function (e) { st.query = e.target.value; renderZones(); } });
      sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', { class: 'ztitle' }), h('span', { class: 'ztip' }),
        seg([[2022, '2022'], [2023, '2023']], st.zoneYear, function (y) { st.zoneYear = y; st.query = ''; input.value = ''; renderZones(); syncZoneSeg(); }, 'zy')), input));
      sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl zone-tbl', style: 'min-width:480px' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Location'), h('th', { scope: 'col' }, 'Road'), h('th', { scope: 'col', class: 'n' }, 'Fatal'), h('th', { scope: 'col', class: 'n' }, 'All crashes'))),
        h('tbody', null))));
      sec.appendChild(h('div', { class: 'row-between' }, h('span', { class: 'zcount muted', style: 'font-size:13px', 'aria-live': 'polite' }),
        h('button', { type: 'button', class: 'btn ztoggle', onclick: function () { st.allZones = !st.allZones; renderZones(); } })));
      body = sec.querySelector('tbody'); count = sec.querySelector('.zcount'); toggle = sec.querySelector('.ztoggle');
    }
    sec.querySelector('.ztitle').textContent = 'Crash-prone zones, ' + st.zoneYear;
    var tipHost = sec.querySelector('.ztip');
    if (tipHost.getAttribute('data-year') !== String(st.zoneYear)) {
      tipHost.setAttribute('data-year', String(st.zoneYear));
      D.clear(tipHost).appendChild(D.tip('About crash-prone zones', st.zoneYear === 2022
        ? 'The official Delhi Traffic Police list of 117 zones in the 2022 report (Table 6.41), sorted by fatal crashes as in the source. That table gives no road and no coordinates, so the road column is blank and none is plotted on the map. Zones differ from year to year, so a change in a count is not a change in risk.'
        : 'The official Delhi Traffic Police list of 107 zones, sorted by fatal crashes as in the source. 105 of 107 fall inside a district and are plotted on the map; 2 sit just outside the simplified boundaries. The 2024 list names different zones, so a change in the count is not a change in risk.'));
    }
    D.clear(body);
    zones.forEach(function (z) { body.appendChild(h('tr', null, h('td', { class: 'rk' }, z.rank), h('td', { style: 'font-weight:500' }, z.name), h('td', { class: 'muted' }, z.road == null ? '—' : z.road), h('td', { class: 'n' }, z.fatal), h('td', { class: 'n' }, z.total))); });
    count.textContent = q ? filt.length + ' of ' + count0 + ' zones match' : 'Showing ' + zones.length + ' of ' + count0 + ' zones';
    toggle.hidden = !!q;
    toggle.textContent = st.allZones ? 'Show top 10' : 'Show all ' + count0;
  }

  // ---- roads with most zones ----
  function renderRoads() {
    var sec = D.clear(D.$('#roads'));
    sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', null, 'Roads with most zones'),
      D.tip('About this table', 'Crashes recorded within the identified zones on each road, not the road\'s full crash count. Table 6.33 of the 2023 and 2024 reports, Table 6.45 of the 2022 report. Sorted by fatal crashes; top 12 shown.', { right: true })),
      seg([[2022, '2022'], [2023, '2023'], [2024, '2024']], st.roadYear, function (y) { st.roadYear = y; keepFocus(renderRoads); }, 'ry')));
    sec.appendChild(h('div', { style: 'display:flex;flex-direction:column' },
      h('div', { class: 'road-row h' }, h('span', null, 'Road'), h('span', null, 'Zones'), h('span', null, 'Fatal'), h('span', null, 'All')),
      R.roads[st.roadYear].map(function (r) { return h('div', { class: 'road-row' }, h('span', { title: r[0] }, r[0]), h('span', null, r[1]), h('span', null, r[2]), h('span', null, r[3])); })));
  }

  // the zone-year buttons are built once with the section; keep their pressed state in step with the choice
  function syncZoneSeg() {
    D.$('#zones').querySelectorAll('[data-key^="zy-"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-key') === 'zy-' + st.zoneYear)); });
  }
  renderTrend(); renderModes(); renderEnforcement(); renderZones(); renderRoads();
})();
