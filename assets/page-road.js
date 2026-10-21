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

  // ---- enforcement, 2019 to 2024 (citywide; 2019 to 2022 are read from the annual reports, 2023 and 2024 from the road-crash-report release) ----
  var EH = S.enforcementHistory, EYEARS = [2019, 2020, 2021, 2022, 2023, 2024];
  function ehGet(measure, y) { return EH.filter(function (r) { return r.measure === measure && r.year === y; })[0] || null; }
  var ENF_ROWS = [
    { label: 'Hit-and-run fatal crashes', key: 'hit_and_run_fatal_crashes', modern: 'hitAndRunFatal', fmt: n },
    { label: 'Hit-and-run share of fatal crashes', key: 'hit_and_run_share_of_fatal_crashes_percent', modern: 'hitAndRunShare', fmt: function (v) { return v.toFixed(1) + '%'; } },
    { label: 'Drink-driving prosecutions', key: 'drink_driving_prosecutions', modern: 'drinkDriving', fmt: n, flag: 'drink' },
    { label: 'Over-speeding notices', key: 'overspeed_notices', modern: 'overspeed', fmt: n },
    { label: 'Red-light cameras (junctions)', modern: 'rlvd', pair: 'rlvdJunctions' },
    { label: 'Speed cameras (locations)', modern: 'osvd', pair: 'osvdLocations' }
  ];
  function enfCell(row, y) {
    if (y >= 2023) {
      var e = E[y];
      if (row.pair) return { text: e[row.modern] + ' (' + e[row.pair] + ')' };
      return { text: row.fmt(e[row.modern]) };
    }
    if (!row.key) return { text: '—', none: true };
    var o = ehGet(row.key, y);
    return o ? { text: row.fmt(o.value), derived: o.kind === 'derived', o: o } : { text: '—', none: true };
  }
  function enfCsv() {
    var head = ['measure', 'reference_year', 'value', 'unit', 'value_kind', 'source_report_year', 'source_pdf_page', 'source_printed_page', 'source_url', 'source_sha256', 'review_status', 'note', 'data_version'];
    var rows = [head];
    var UNITS = { hit_and_run_fatal_crashes: 'fatal crashes', hit_and_run_share_of_fatal_crashes_percent: 'percent of fatal crashes', drink_driving_prosecutions: 'persons prosecuted', overspeed_notices: 'notices' };
    EYEARS.forEach(function (y) {
      ENF_ROWS.forEach(function (row) {
        if (row.pair) {
          var vals = y >= 2023 ? [[row.modern === 'rlvd' ? 'red_light_camera_systems' : 'speed_camera_systems', E[y][row.modern]], [row.modern === 'rlvd' ? 'red_light_junctions' : 'speed_camera_locations', E[y][row.pair]]] : [[row.modern === 'rlvd' ? 'red_light_camera_systems' : 'speed_camera_systems', null], [row.modern === 'rlvd' ? 'red_light_junctions' : 'speed_camera_locations', null]];
          vals.forEach(function (v) { rows.push([v[0], y, v[1] == null ? '' : v[1], v[0].indexOf('systems') > 0 ? 'camera systems' : v[0].indexOf('junctions') > 0 ? 'junctions' : 'locations', y >= 2023 ? 'printed' : '', y >= 2023 ? y : '', '', '', '', '', y >= 2023 ? 'production release (data/road_safety_extra_2023_2024.json)' : '', v[1] == null ? 'Not given on a consistent basis in the report for this year.' : '', data.updated]); });
          return;
        }
        if (y >= 2023) { rows.push([row.key, y, E[y][row.modern], UNITS[row.key], 'printed', y, '', '', '', '', 'production release (data/road_safety_extra_2023_2024.json)', '', data.updated]); return; }
        var o = ehGet(row.key, y);
        rows.push([row.key, y, o ? o.value : '', UNITS[row.key], o ? o.kind : '', o ? o.reportYear : '', o ? o.pdfPage : '', o && o.printedPage != null ? o.printedPage : '', o ? o.url : '', o ? o.sha256 : '', o ? o.review : '', o ? o.note : '', data.updated]);
      });
    });
    return D.csv(rows);
  }
  function renderEnforcement() {
    var sec = D.clear(D.$('#enforcement'));
    sec.appendChild(h('div', { class: 'row-between' },
      h('div', { class: 'title-row' }, h('h2', null, 'Enforcement, 2019 to 2024'),
        D.tip('About these figures', ['Citywide counts from the Traffic Police annual reports, not split by district. Prosecutions and notices depend on enforcement effort and on how many cameras were working, not only on behaviour.',
          'Drink-driving prosecutions fell from 36,065 to 3,986 in 2020, when alcometer tests were reduced because of the pandemic. The 2023 and 2024 figures are about seven times the 2022 one, and it has not been established that they are counted the same way: do not read the jump as a change in drinking and driving.',
          'Camera counts are given only for 2023 and 2024: the older reports give inconsistent installation counts.'], { right: true })),
      h('button', { type: 'button', class: 'btn', 'data-key': 'enfcsv', onclick: function () { D.download('delhi_road_enforcement_2019_2024.csv', enfCsv()); } }, 'Download CSV')));
    var head = h('tr', null, h('th', { scope: 'col' }, 'Measure'), EYEARS.map(function (y) { return h('th', { scope: 'col' }, y); }));
    var any = false;
    var body = ENF_ROWS.map(function (row) {
      return h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, row.label),
        EYEARS.map(function (y) { var c = enfCell(row, y); if (c.derived) any = true; return h('td', { class: c.none ? 'muted' : null, title: c.o ? 'Delhi Road Crash Report ' + c.o.reportYear + ', PDF page ' + c.o.pdfPage : null }, c.text, c.derived ? h('sup', null, '†') : null); }));
    });
    sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:560px' }, h('caption', { class: 'sr-only' }, 'Enforcement figures by year, citywide'), h('thead', null, head), h('tbody', null, body))));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'A dash means the report gives no figure on a consistent basis, not zero. † Computed here (668 of 1,428 fatal crashes in 2022; the report says about 47%). The 2019 over-speeding figure is the one the 2020 report prints for 2019. Sources: Delhi Road Crash Reports 2019 to 2024; pages, hashes and review status are in the CSV and the ',
      h('a', { href: 'data/releases/road_enforcement_2019_2022/manifest.json' }, 'release manifest'), '. Not independently reviewed.'));
  }

  // ---- crash-prone zones (2023 list, 107 zones, sorted as in the source) ----
  function renderZones() {
    var sec = D.$('#zones');
    var q = st.query.trim().toLowerCase();
    var list = R['zones' + st.zoneYear], count0 = list.length;
    var all = list.map(function (z, i) { return { rank: i + 1, name: z[0], road: z[1], fatal: z[2], total: z[3] }; });
    var filt = q ? all.filter(function (z) { return (z.name + ' ' + z.road).toLowerCase().indexOf(q) >= 0; }) : all;
    var zones = st.allZones || q ? filt : filt.slice(0, 10);
    var body = sec.querySelector('tbody'), count = sec.querySelector('.zcount'), toggle = sec.querySelector('.ztoggle');
    if (!body) {
      D.clear(sec);
      var input = h('input', { type: 'search', class: 'search', placeholder: 'Search location or road', 'aria-label': 'Search crash-prone zones', oninput: function (e) { st.query = e.target.value; renderZones(); } });
      sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', { class: 'ztitle' }), h('span', { class: 'ztip' }),
        seg([[2022, '2022'], [2023, '2023'], [2024, '2024']], st.zoneYear, function (y) { st.zoneYear = y; st.query = ''; input.value = ''; renderZones(); syncZoneSeg(); }, 'zy')), input));
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
        : st.zoneYear === 2024
        ? 'The 93 named zones of the 2024 report. The 88 ranked in Table 6.29 are sorted by fatal crashes as in the source; the other 5 appear only in the report\'s category lists (pedestrian, two-wheeler and so on), so their crash counts are blank, not zero. The report\'s district table counts 111 zones, more than the 93 names recovered. Zones differ from year to year, so a change in a count is not a change in risk.'
        : 'The official Delhi Traffic Police list of 107 zones, sorted by fatal crashes as in the source. 105 of 107 fall inside a district and are plotted on the map; 2 sit just outside the simplified boundaries. The 2024 list names different zones, so a change in the count is not a change in risk.'));
    }
    D.clear(body);
    zones.forEach(function (z) { body.appendChild(h('tr', null, h('td', { class: 'rk' }, z.rank), h('td', { style: 'font-weight:500' }, z.name), h('td', { class: 'muted' }, z.road == null ? '—' : z.road), h('td', { class: 'n' }, z.fatal == null ? '—' : z.fatal), h('td', { class: 'n' }, z.total == null ? '—' : z.total))); });
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

  // ---- district tables, 2016 to 2024: whole-district crashes and crashes within selected zones ----
  // Each year keeps its own printed districts (11, 12 or 15 traffic districts); nothing is allocated to other districts, and no change
  // figures are calculated here. Totals are printed separately and are never rows. A district missing from a printed table is "not in the table", not zero.
  var HIST = R.history, CH = data.CONTINUITY.roadHistory;
  var HYEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  var hs = { measure: 'zones', year: 2022 };
  (function () {
    var p = D.parseHash();
    if (p.dm === 'zones' || p.dm === 'whole') hs.measure = p.dm;
    if (HYEARS.indexOf(+p.dy) >= 0) hs.year = +p.dy;
  })();
  var STATE_LABEL = { not_comparable: 'Not compared', caution: 'Compare with caution', unavailable: 'No comparison' };
  var COLS = {
    whole: ['Fatal', 'Injury', 'Non-injury', 'Total'],
    zones: ['Zones', 'Simple', 'Fatal', 'Total']
  };
  var CSV_COLS = {
    whole: ['fatal_crashes', 'injury_crashes', 'non_injury_crashes', 'total_crashes'],
    zones: ['crash_prone_zones', 'simple_crashes_at_zones', 'fatal_crashes_at_zones', 'total_crashes_at_zones']
  };
  function histTable(m, y) { var t = (m === 'whole' ? HIST.whole : HIST.zones)[y]; return t && !t.unavailable ? t : null; }
  function histNotes(m, y) {
    var out = [];
    if (y === 2016) return [{ state: 'unavailable', text: 'First year in this table.' }];
    if (!histTable(m, y - 1)) out.push({ state: 'unavailable', text: 'The previous year has no district table for this measure, so there is nothing to compare with.' });
    else {
      var b = CH.breaks.filter(function (x) { return x.between[1] === y; })[0];
      out.push(b ? { state: b.state, text: b.reason } : { state: 'caution', text: CH.sameSetReason });
    }
    if (m === 'zones') out.push({ state: 'caution', text: CH.zoneReason });
    if (CH.pandemicYears.indexOf(y) >= 0 || CH.pandemicYears.indexOf(y - 1) >= 0) out.push({ state: 'caution', text: CH.pandemicReason });
    return out;
  }
  function histUnavailable(m, y) {
    if (m === 'whole') return 'Whole-district crash counts are shown for 2016 to 2022. For ' + y + ' this dashboard holds the district tables for crashes within selected zones (choose that measure above) and persons killed by district (in Explore), not whole-district crash counts.';
    var z = HIST.zones[y];
    return z && z.unavailable ? z.unavailable : 'No district table is available for ' + y + '.';
  }
  function histSource(t) {
    var s = t.source, bits = ['Delhi Road Crash Report ' + s.reportYear];
    if (s.table) bits.push('Table ' + s.table);
    if (s.pdfPage) bits.push('PDF page ' + s.pdfPage);
    if (s.printedPage) bits.push('printed page ' + s.printedPage);
    return bits.join(', ');
  }
  function histCsv(m, y) {
    var t = histTable(m, y), notes = histNotes(m, y);
    var cmpState = notes.some(function (x) { return x.state === 'not_comparable'; }) ? 'not_comparable' : notes[0].state;
    var cmpText = notes.map(function (x) { return x.text; }).join(' ');
    var head = ['row_type', 'reference_year', 'report_year', 'measure_scope', 'geography', 'reporting_unit_as_printed'].concat(CSV_COLS[m], ['missing_reason', 'comparison_with_previous_year', 'comparison_reason', 'source_table', 'source_pdf_page', 'source_printed_page', 'source_url', 'source_sha256', 'review_status', 'data_version']);
    var scope = m === 'whole' ? 'whole traffic district' : 'selected crash-prone zones only';
    var rows = [head];
    var blank = ['', '', '', ''];
    if (!t) { rows.push(['unavailable', y, '', scope, '', ''].concat(blank, [histUnavailable(m, y), '', '', '', '', '', '', '', '', data.updated])); return D.csv(rows); }
    var s = t.source;
    function meta(extra, src) { return [extra, src.table || '', src.pdfPage == null ? '' : src.pdfPage, src.printedPage == null ? '' : src.printedPage, src.url || '', src.sha256 || '', src.review, data.updated]; }
    t.rows.forEach(function (r) { rows.push(['district', y, s.reportYear, scope, t.geography, r[0]].concat(r.slice(1), [''], [cmpState, cmpText], meta(null, s).slice(1))); });
    (t.omitted || []).forEach(function (n) { rows.push(['district_not_in_table', y, s.reportYear, scope, t.geography, n].concat(blank, ['Not in the printed table for this year; unreported, not zero.', cmpState, cmpText], meta(null, s).slice(1))); });
    if (t.total) rows.push(['printed_total', y, s.reportYear, scope, t.geography, 'Printed total'].concat(t.total, ['', '', ''], meta(null, t.totalSource).slice(1)));
    return D.csv(rows);
  }
  function renderDistrictTables() {
    var sec = D.clear(D.$('#district-tables'));
    var m = hs.measure, y = hs.year, t = histTable(m, y), notes = histNotes(m, y);
    try { history.replaceState(null, '', D.hashOf({ dm: m, dy: y })); } catch (e) { /* the link just will not update */ }
    sec.appendChild(h('div', { class: 'row-between' },
      h('div', { class: 'title-row' }, h('h2', null, 'Districts, 2016 to 2024'),
        D.tip('About these tables', 'Each year shows the districts printed in that year\'s Traffic Police report: 11, 12 or 15 traffic districts, with their printed names. They are not today\'s 15 police districts, so they are not drawn on the map and nothing is allocated between years. No change figures are calculated here. Fatal crashes are events, not people killed; simple crashes are the report\'s category, not injury crashes.')),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' },
        h('button', { type: 'button', class: 'btn', 'data-key': 'hcopy', onclick: function (e) { D.copy(location.href.split('#')[0] + D.hashOf({ dm: m, dy: y }), e.currentTarget, 'Link copied', 'Copy link to view'); } }, 'Copy link to view'),
        h('button', { type: 'button', class: 'btn primary', 'data-key': 'hcsv', onclick: function () { D.download('delhi_road_' + m + '_' + y + '.csv', histCsv(m, y)); } }, 'Download CSV'))));
    sec.appendChild(h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center' },
      seg([['zones', 'Crashes within selected zones'], ['whole', 'Whole-district crashes']], m, function (k) { hs.measure = k; keepFocus(renderDistrictTables); }, 'hm'),
      h('div', { class: 'years', role: 'group', 'aria-label': 'Year' }, HYEARS.map(function (yr) {
        return h('button', { type: 'button', 'aria-pressed': String(yr === y), 'data-key': 'hy-' + yr, title: histTable(m, yr) ? String(yr) : yr + ': no table for this measure', onclick: function () { hs.year = yr; keepFocus(renderDistrictTables); } }, yr);
      }))));
    var scopeNote = m === 'zones'
      ? 'These are crashes within the zones identified that year, not all crashes in the district or on the road. The selected locations can change each year. Simple crashes are the report\'s category, not injury crashes.'
      : 'All crash events in each district, as printed in the report\'s district table. Fatal, injury and non-injury are crash events, not people killed or injured.';
    sec.appendChild(h('p', { class: 'callout' }, h('strong', null, m === 'zones' ? 'Crashes within selected zones. ' : 'Whole-district crashes. '), scopeNote));
    if (!t) {
      sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, y + ': no district table. '), histUnavailable(m, y)));
      var z = HIST.zones[y];
      if (m === 'zones' && z && z.total) sec.appendChild(h('p', { class: 'muted' }, 'Citywide selected-zone total for ' + y + ' (not a district row): ' + z.total[0] + ' zones, ' + n(z.total[1]) + ' simple, ' + n(z.total[2]) + ' fatal, ' + n(z.total[3]) + ' crashes in all. ' + histSource({ source: z.totalSource }) + '.'));
      return;
    }
    sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:480px' },
      h('caption', { class: 'muted', style: 'text-align:left;padding-bottom:8px' }, (m === 'zones' ? 'Crashes within selected zones' : 'Whole-district crashes') + ', ' + y + ' · ' + t.geography + ' as printed'),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Reporting unit as printed'), COLS[m].map(function (c) { return h('th', { scope: 'col' }, c); }))),
      h('tbody', null,
        t.rows.map(function (r) { return h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, r[0]), r.slice(1).map(function (v) { return h('td', null, v == null ? '—' : n(v)); })); }),
        (t.omitted || []).map(function (nm) { return h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, nm), h('td', { colspan: 4, class: 'muted', style: 'text-align:left' }, 'Not in the printed table for this year (unreported, not zero)')); })),
      t.total ? h('tfoot', null, h('tr', null, h('th', { scope: 'row', style: 'text-align:left' }, 'Printed total (not a district)'), t.total.map(function (v) { return h('td', { style: 'font-weight:700' }, n(v)); }))) : null)));
    var blocked = notes.some(function (x) { return x.state === 'not_comparable'; });
    sec.appendChild(h('div', { class: 'callout' + (blocked ? ' warn' : ''), style: 'font-size:13.5px' },
      h('strong', null, y === 2016 ? 'Comparison' : 'Compared with ' + (y - 1) + (blocked ? ': district counts are not compared' : ': compare with caution')),
      h('ul', { style: 'margin:4px 0 0 18px;list-style:disc' }, notes.map(function (x) { return h('li', null, h('strong', null, STATE_LABEL[x.state] + '. '), x.text); }))));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Source: ' + histSource(t) + '. ' + t.source.review + (t.source.url ? ' ' : ''), t.source.url ? h('a', { href: t.source.url }, 'Report file') : null,
      '. Page, hash and review status are in the CSV. No open reuse licence has been verified for these reports.'));
  }

  // the zone-year buttons are built once with the section; keep their pressed state in step with the choice
  function syncZoneSeg() {
    D.$('#zones').querySelectorAll('[data-key^="zy-"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-key') === 'zy-' + st.zoneYear)); });
  }
  renderTrend(); renderModes(); renderEnforcement(); renderDistrictTables(); renderZones(); renderRoads();
})();
