/* Road safety, citywide: headline figures, 2011-2024 trend, deaths by mode of travel, enforcement, crash-prone zones and the roads with most zones.
   All figures are citywide counts from Delhi Traffic Police; none is split by district in the source. Reads window.DSO_DATA. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h, n = D.n;
  var data = D.data();
  if (!data) return;
  var S = data.SITE, R = data.ROADS, T = S.trends, E = S.enforcement, V = S.victims;
  var last = T[T.length - 1], prev = T[T.length - 2];
  var YEARS_PAGE = [2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  var st = { measure: 'killed', index: false, hy: null, year: 2024, query: '', allZones: false };

  function seg(items, cur, pick, key) {
    return h('div', { class: 'seg' }, items.map(function (it) {
      return h('button', { type: 'button', 'aria-pressed': String(it[0] === cur), 'data-key': key + '-' + it[0], onclick: function () { pick(it[0]); } }, it[1]);
    }));
  }
  function shareUrl() { return location.href.split('#')[0] + D.hashOf({ y: st.year, dm: hs.measure, tm: st.measure === 'killed' ? null : st.measure, ti: st.index ? '1' : null }); }
  function syncHash() { try { history.replaceState(null, '', shareUrl().slice(location.href.split('#')[0].length)); } catch (e) { /* the link just will not update */ } }
  function scopeLine(text) { return h('p', { class: 'scope-line' }, text); }
  function setYear(y) { keepFocus(function () { st.year = y; st.hy = null; st.query = ''; renderAll(); syncHash(); }); }
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

  // ---- one year for the whole page ----
  function renderYearBar() {
    var sec = D.clear(D.$('#yearBar'));
    sec.appendChild(h('div', { class: 'row-between' },
      h('div', { class: 'title-row' }, h('strong', null, 'Year in view'), D.tip('About the year', 'One year for every section below, so they can be read together. A section with no figure for that year says so and why, instead of showing a different year. The headline figures above are always the latest year, 2024. Each section also has its own year buttons; they change this one too.')),
      h('button', { type: 'button', class: 'btn', 'data-key': 'ycopy', onclick: function (e) { D.copy(shareUrl(), e.currentTarget, 'Link copied', 'Copy link to view'); } }, 'Copy link to view')));
    sec.appendChild(h('div', { class: 'years', role: 'group', 'aria-label': 'Year in view' }, YEARS_PAGE.map(function (y) {
      return h('button', { type: 'button', 'aria-pressed': String(y === st.year), 'data-key': 'yb-' + y, onclick: function () { setYear(y); } }, y);
    })));
  }

  // ---- trend ----
  var LAB = { crashes: 'total crashes', fatalCrashes: 'fatal crashes', killed: 'persons killed' };
  function renderTrend() {
    var sec = D.clear(D.$('#trend'));
    var mk = st.measure, b0 = T[0][mk];
    var vals = T.map(function (r) { return st.index ? r[mk] / b0 * 100 : r[mk]; });
    var maxV = Math.max.apply(null, vals.concat(st.index ? [100] : [0])) * 1.08;
    var hy = hyIndex(), hr = T[hy];
    sec.appendChild(h('div', { class: 'row-between' },
      h('div', { class: 'title-row' }, h('h2', null, 'Trend, 2011–2024'),
        D.tip('About this trend', 'Counts, not rates: traffic and population changed over the period. Fatal crashes and persons killed are different counts. Injury figures differ by source edition and are excluded. The early reports\' 30-day fatality definition could not be confirmed.')),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px' },
        seg([['killed', 'Persons killed'], ['fatalCrashes', 'Fatal crashes'], ['crashes', 'All crashes']], mk, function (k) { st.measure = k; keepFocus(renderTrend); }, 'measure'),
        seg([[false, 'Counts'], [true, 'Index']].map(function (o) { return [o[0], o[1]]; }), st.index, function (k) { st.index = k; keepFocus(renderTrend); }, 'scale'))));
    sec.appendChild(scopeLine('Counts per year · Delhi as a whole · 2011 to 2024 · counts, not rates · highlighted: ' + st.year));
    sec.appendChild(h('div', { class: 'readout', 'aria-live': 'polite' }, h('span', { class: 'v big' }, st.index ? String(Math.round(vals[hy])) : n(hr[mk])),
      h('span', null, st.index ? hr.year + ' · index of ' + LAB[mk] + ' (2011 = 100) · ' + n(hr[mk]) + ' counted' : LAB[mk] + ' in ' + hr.year)));
    var bars = h('div', { class: 'bars' });
    if (st.index) bars.appendChild(h('div', { class: 'base', style: 'bottom:' + (100 / maxV * 100) + '%' }, h('span', null, '2011 = 100')));
    T.forEach(function (r, i) {
      bars.appendChild(h('button', { type: 'button', 'aria-pressed': String(i === hy), 'aria-label': r.year + ': ' + n(r[mk]) + ' ' + LAB[mk],
        onmouseenter: function () { setHy(i); }, onfocus: function () { setHy(i); } }, h('span', { class: 'b', style: 'height:' + (vals[i] / maxV * 100) + '%' })));
    });
    bars.addEventListener('mouseleave', function () { setHy(null); });
    syncHash();
    sec.appendChild(bars);
    sec.appendChild(h('div', { class: 'bar-labels' }, T.map(function (r) { return h('span', null, "'" + String(r.year).slice(2)); })));
    sec.appendChild(h('details', { class: 'plain' }, h('summary', null, 'Show annual counts'),
      h('div', { class: 'overflow', style: 'margin-top:10px' }, h('table', { class: 'tbl', style: 'min-width:420px' },
        h('thead', null, h('tr', null, h('th', null, 'Year'), h('th', null, 'Total crashes'), h('th', null, 'Fatal crashes'), h('th', null, 'Persons killed'))),
        h('tbody', null, T.map(function (r) { return h('tr', null, h('td', null, r.year), h('td', null, n(r.crashes)), h('td', null, n(r.fatalCrashes)), h('td', null, n(r.killed))); }))))));
  }
  function hyIndex() { if (st.hy != null) return st.hy; for (var k = 0; k < T.length; k++) if (T[k].year === st.year) return k; return T.length - 1; }
  // hovering a bar updates the readout and highlight without rebuilding the page
  function setHy(i) {
    st.hy = i;
    var sec = D.$('#trend'), mk = st.measure, b0 = T[0][mk], hy = i == null ? hyIndex() : i, hr = T[hy];
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
    var v = V[st.year];
    if (!v) {
      sec.appendChild(h('h2', { style: 'font-size:18px;font-weight:600' }, 'Who is killed, by mode of travel'));
      sec.appendChild(scopeLine('Persons killed by mode of travel · Delhi as a whole · year in view: ' + st.year));
      sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, st.year + ': no figure. '), 'Deaths by mode of travel are held for 2019 to 2024 only; earlier years are not collected here.'));
      return;
    }
    var ML = [['pedestrian', 'Pedestrians'], ['twoWheeler', 'Two-wheeler riders'], ['other', 'Other'], ['cyclist', 'Cyclists'], ['car', 'Car occupants'], ['slowMoving', 'Slow-moving vehicles'], ['animal', 'Animal-drawn'], ['bus', 'Bus passengers']];
    var mmax = Math.max.apply(null, ML.map(function (m) { return v[m[0]]; }));
    var rows = ML.map(function (m) { return { k: m[0], l: m[1], v: v[m[0]] }; }).sort(function (a, b) { return b.v - a.v; });
    sec.appendChild(h('div', { class: 'row-between' }, h('h2', { style: 'font-size:18px;font-weight:600' }, 'Who is killed, by mode of travel'),
      h('div', { class: 'years' }, Object.keys(V).map(Number).map(function (y) {
        return h('button', { type: 'button', 'aria-pressed': String(y === st.year), 'data-key': 'my-' + y, onclick: function () { setYear(y); } }, y);
      }))));
    sec.appendChild(scopeLine('Persons killed by mode of travel · Delhi as a whole · counts of people, with each mode\'s share of the total · ' + st.year));
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
    sec.appendChild(scopeLine('Counts per year · Delhi as a whole · 2019 to 2024 · ' + (EYEARS.indexOf(st.year) >= 0 ? 'year in view: ' + st.year + ' (highlighted)' : 'no figures for ' + st.year + ' (the table starts in 2019)')));
    var head = h('tr', null, h('th', { scope: 'col' }, 'Measure'), EYEARS.map(function (y) { return h('th', { scope: 'col', class: y === st.year ? 'yr-col' : null }, y); }));
    var any = false;
    var body = ENF_ROWS.map(function (row) {
      return h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, row.label),
        EYEARS.map(function (y) { var c = enfCell(row, y); if (c.derived) any = true; return h('td', { class: (c.none ? 'muted' : '') + (y === st.year ? ' yr-col' : ''), title: c.o ? 'Delhi Road Crash Report ' + c.o.reportYear + ', PDF page ' + c.o.pdfPage : null }, c.text, c.derived ? h('sup', null, '†') : null); }));
    });
    sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:560px' }, h('caption', { class: 'sr-only' }, 'Enforcement figures by year, citywide'), h('thead', null, head), h('tbody', null, body))));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'A dash means the report gives no figure on a consistent basis, not zero. † Computed here (668 of 1,428 fatal crashes in 2022; the report says about 47%). The 2019 over-speeding figure is the one the 2020 report prints for 2019. Sources: Delhi Road Crash Reports 2019 to 2024; pages, hashes and review status are in the CSV and the ',
      h('a', { href: 'data/releases/road_enforcement_2019_2022/manifest.json' }, 'release manifest'), '. Not independently reviewed.'));
  }

  // ---- crash-prone zones, 2016 to 2024 ----
  var YEARS_ALL = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  var YEARS_ZONES = [2013, 2014, 2015].concat(YEARS_ALL);
  var ZONE_TABLE = { 2013: 'PWD compilation, PDF pages 133-141', 2014: 'PWD compilation, PDF pages 142-150', 2015: 'Table 10.1', 2016: 'Table 10.1', 2017: 'Table 10.1(a)', 2018: 'Table 10.2', 2019: 'Table 10.2', 2020: 'Table 7.2', 2021: 'Table 6.28' };
  function zoneTip(y) {
    var n = (R['zones' + y] || []).length, tail = ' Zones differ from year to year, so a change in a count is not a change in risk.';
    if (y === 2022) return 'The official Delhi Traffic Police list of 117 zones in the 2022 report (Table 6.41), sorted by fatal crashes as in the source. That table prints no road and no coordinates. A road is shown (marked †) only where a later report assigns one to the same place name; otherwise it is blank, and none is plotted on the map.' + tail;
    if (y === 2024) return 'The 93 named zones of the 2024 report. The 88 ranked in Table 6.29 are sorted by fatal crashes as in the source; the other 5 appear only in the report\'s category lists (pedestrian, two-wheeler and so on), so their crash counts are blank, not zero. The report\'s district table counts 111 zones, more than the 93 names recovered.' + tail;
    if (y === 2023) return 'The official Delhi Traffic Police list of 107 zones, sorted by fatal crashes as in the source. 105 of 107 fall inside a district and are plotted on the map; 2 sit just outside the simplified boundaries. The 2024 list names different zones, so a change in the count is not a change in risk.';
    if (y === 2013 || y === 2014) return 'The ' + n + ' named zones of ' + y + ' from the Delhi PWD compilation of the Traffic Police accident-prone locations (' + ZONE_TABLE[y] + '), in the order printed (descending by fatal crashes). This is an official compilation, not a recovered annual report; it prints no grand total, so sums are the sum of the rows. ' + (y === 2013 ? 'Two rows print no road. ' : 'One row prints no road. ') + 'The compilation gives district and circle names, kept in the download; they are not mapped to later districts. No coordinates.' + tail;
    if (y === 2015) return 'The ' + n + ' named zones of the 2015 report (' + ZONE_TABLE[y] + '), listed alphabetically as printed (the number is the list position, not a rank), with the road printed beside each. The report confirms 176 zones and 552 fatal crashes. No coordinates.' + tail;
    if (y === 2016) return 'The ' + n + ' named zones of the 2016 report (' + ZONE_TABLE[y] + '), listed alphabetically as printed (the number is the list position, not a rank), with the road printed beside each. No coordinates are given.' + tail;
    return 'The ' + n + ' named zones of the ' + y + ' report (' + ZONE_TABLE[y] + '), sorted by fatal crashes as printed. ' + (y === 2021 ? 'That table prints no road, so the road column is blank. ' : 'The road is the one printed beside each zone. ') + 'No coordinates are given.' + tail;
  }
  function renderZones() {
    var sec = D.$('#zones');
    var q = st.query.trim().toLowerCase();
    var list = R['zones' + st.year] || [], count0 = list.length;
    var all = list.map(function (z, i) { return { rank: i + 1, name: z[0], road: z[1], fatal: z[2], total: z[3], derived: z[4] === 1 }; });
    var filt = q ? all.filter(function (z) { return (z.name + ' ' + (z.road || '')).toLowerCase().indexOf(q) >= 0; }) : all;
    var zones = st.allZones || q ? filt : filt.slice(0, 10);
    var body = sec.querySelector('tbody'), count = sec.querySelector('.zcount'), toggle = sec.querySelector('.ztoggle');
    if (!body) {
      D.clear(sec);
      var input = h('input', { type: 'search', class: 'search', placeholder: 'Search location or road', 'aria-label': 'Search crash-prone zones', oninput: function (e) { st.query = e.target.value; renderZones(); } });
      sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', { class: 'ztitle' }), h('span', { class: 'ztip' }),
        seg(YEARS_ZONES.map(function (y) { return [y, String(y)]; }), st.year, function (y) { input.value = ''; setYear(y); }, 'zy')), input));
      sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl zone-tbl', style: 'min-width:480px' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, '#'), h('th', { scope: 'col' }, 'Location'), h('th', { scope: 'col' }, 'Road'), h('th', { scope: 'col', class: 'n' }, 'Fatal'), h('th', { scope: 'col', class: 'n' }, 'All crashes'))),
        h('tbody', null))));
      sec.appendChild(h('div', { class: 'row-between' }, h('span', { class: 'zcount muted', style: 'font-size:13px', 'aria-live': 'polite' }),
        h('button', { type: 'button', class: 'btn ztoggle', onclick: function () { st.allZones = !st.allZones; renderZones(); } })));
      body = sec.querySelector('tbody'); count = sec.querySelector('.zcount'); toggle = sec.querySelector('.ztoggle');
    }
    sec.querySelector('.ztitle').textContent = 'Crash-prone zones, ' + st.year;
    var zl = sec.querySelector('.zscope');
    if (!zl) { zl = scopeLine(''); zl.classList.add('zscope'); sec.insertBefore(zl, sec.children[1]); }
    var ze = sec.querySelector('.zempty');
    if (!ze) { ze = h('p', { class: 'callout warn zempty', role: 'status' }); ze.hidden = true; sec.appendChild(ze); }
    ze.hidden = !!list.length;
    D.clear(ze).appendChild(h('strong', null, st.year + ': no named zone list. ')); ze.appendChild(document.createTextNode(st.year < 2013 ? 'No zone list was found for 2011 or 2012 (source not found); only the highway and ring-road stretches below are printed for those years.' : 'No zone list is held for this year.'));
    var ztbl = sec.querySelector('.overflow'); if (ztbl) ztbl.hidden = !list.length;
    zl.textContent = list.length ? 'Crashes within the named crash-prone zones of the ' + st.year + ' report · ' + list.length + ' zones · not all crashes, and each year lists different zones' : 'No named zone list for ' + st.year;
    var tipHost = sec.querySelector('.ztip');
    if (tipHost.getAttribute('data-year') !== String(st.year)) {
      tipHost.setAttribute('data-year', String(st.year));
      D.clear(tipHost).appendChild(D.tip('About crash-prone zones', zoneTip(st.year)));
    }
    D.clear(body);
    zones.forEach(function (z) { body.appendChild(h('tr', null, h('td', { class: 'rk' }, z.rank), h('td', { style: 'font-weight:500' }, z.name), h('td', { class: 'muted', title: z.derived ? 'Road identified from a later report; the 2022 table prints no road' : null }, z.road == null ? '—' : z.road, z.derived ? h('sup', null, '†') : null), h('td', { class: 'n' }, z.fatal == null ? '—' : z.fatal), h('td', { class: 'n' }, z.total == null ? '—' : z.total))); });
    count.textContent = (q ? filt.length + ' of ' + count0 + ' zones match' : 'Showing ' + zones.length + ' of ' + count0 + ' zones') + (st.year === 2016 || st.year === 2015 ? ' · listed alphabetically' : '') + (st.year === 2022 ? ' · † road from a later report' : '');
    toggle.hidden = !!q;
    toggle.textContent = st.allZones ? 'Show top 10' : 'Show all ' + count0;
  }

  // ---- roads with most zones ----
  function renderRoads() {
    var sec = D.clear(D.$('#roads'));
    sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', null, 'Roads with most zones'),
      D.tip('About this table', 'Crashes recorded within the identified zones on each road, not the road\'s full crash count. The road-wise zone table of each report (Table 10.5 in 2017, 10.6 in 2018 and 2019, 7.6 in 2020, 6.32 in 2021, 6.45 in 2022, 6.33 in 2023 and 2024), sorted by fatal crashes here; the top 12 are shown. The 2016 report prints no road table. For 2015 the groups are calculated here by exact printed road label from the zone table (Table 10.1), so spelling variants of one road stay separate.', { right: true })),
      seg(YEARS_ZONES.map(function (y) { return [y, String(y)]; }), st.year, function (y) { setYear(y); }, 'ry')));
    sec.appendChild(scopeLine('Selected crash-prone zones grouped by road · ' + st.year + ' · counts within zones, not whole-road counts'));
    if (!R.roads[st.year] && st.year < 2013) { sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, st.year + ': no road table. '), 'No zone list was found for 2011 or 2012 (source not found), so there is nothing to group by road. The highway and ring-road stretches printed for those years are in the table below.')); return; }
    if (!R.roads[st.year] && st.year < 2016) { sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, st.year + ': no road table. '), 'The 2013 compilation prints no road-wise summary (not printed), so none is shown. The road printed beside each zone is in the zone table.')); return; }
    if (!R.roads[st.year]) { sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, st.year + ': no road table. '), 'The 2016 report prints no road-wise table of crash-prone zones, so none is shown. Its text names the roads with most zones (Ring Road 27, Outer Ring Road 17, GTK Road 11, Wazirabad Road 6, Mathura Road 6); the road printed beside each 2016 zone is in the zone table above.')); return; }
    sec.appendChild(h('div', { style: 'display:flex;flex-direction:column' },
      h('div', { class: 'road-row h' }, h('span', null, 'Road'), h('span', null, 'Zones'), h('span', null, 'Fatal'), h('span', null, 'All')),
      R.roads[st.year].map(function (r) { return h('div', { class: 'road-row' }, h('span', { title: r[0] }, r[0]), h('span', null, r[1]), h('span', null, r[2]), h('span', null, r[3])); })));
    if (R.roadsDerived && R.roadsDerived[st.year]) { sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, 'Calculated, not printed. '), 'The ' + st.year + ' report prints no road-wise table. These ' + R.roadRows[st.year] + ' groups add up the zones that print the same road label in ' + (st.year === 2014 ? 'the 2014 zone table' : 'Table 10.1') + ', so they are not necessarily ' + R.roadRows[st.year] + ' different roads' + (st.year === 2014 ? ' (one zone prints no road and is left out)' : '') + '. Top 12 by fatal crashes.')); return; }
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Top 12 of ' + R.roadRows[st.year] + ' roads printed in the ' + st.year + ' report. Selected zones on each road, not whole-road counts.'));
  }

  // ---- highway and ring-road stretches, 2011 and 2012 (retrospective table in the 2015 report) ----
  function renderStretches() {
    var sec = D.clear(D.$('#stretches')), rows = R.stretches[st.year];
    sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', null, 'Highway and ring-road stretches, 2011, 2012 and 2014'),
      D.tip('About this table', 'Thirteen printed stretches (six national highways, four Ring Road stretches, three Outer Ring Road stretches) from Table 6.5 of the Road Accidents in Delhi 2015 report, which looks back to 2011, 2012 and 2014 (2013 was not recovered). These are stretch statistics, not sums of selected zones, and not comparable with the zone tables above. Simple injury and non-injury crashes are separate columns here. The original 2011 and 2012 annual reports and zone lists were not located. Two 2014 rows do not add up in the source: the printed total is shown with the sum of its parts, and no change figure should be made from them. The same stretches may not cover identical extents in every year.')),
      seg([[2011, '2011'], [2012, '2012'], [2014, '2014']], st.year, function (y) { setYear(y); }, 'sy')));
    if (!rows) {
      sec.appendChild(scopeLine('Printed highway and ring-road stretches · whole-stretch counts · year in view: ' + st.year));
      sec.appendChild(h('p', { class: 'callout warn', role: 'status' }, h('strong', null, st.year + ': no stretch table. '), 'Stretch statistics were recovered for 2011, 2012 and 2014 only (Table 6.5 of the 2015 report). Choose one of those years above to see them.'));
      return;
    }
    sec.appendChild(scopeLine('Printed highway and ring-road stretches · whole-stretch counts, not selected zones · ' + st.year));
    sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:480px' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Stretch'), h('th', { scope: 'col', class: 'n' }, 'Fatal'), h('th', { scope: 'col', class: 'n' }, 'Simple'), h('th', { scope: 'col', class: 'n' }, 'Non-injury'), h('th', { scope: 'col', class: 'n' }, 'All'))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, h('td', null, h('span', { style: 'font-weight:500' }, r[1]), h('span', { class: 'muted', style: 'font-size:12px;display:block' }, r[0])), h('td', { class: 'n' }, r[2]), h('td', { class: 'n' }, r[3]), h('td', { class: 'n' }, r[4]), h('td', { class: 'n' }, r[5], r[6] != null ? h('sup', { title: 'The source prints ' + r[5] + ' but its parts add up to ' + r[6] }, '‡') : null)); })))));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Printed in the 2015 report (Table 6.5, page 42), as a retrospective table. Counts for the stretch, not for selected zones. ' + (st.year === 2014 ? '‡ The source total does not equal the sum of its parts (printed total shown; the sum is in the tooltip); these two rows are on hold for source review. ' : ''), h('a', { href: st.year === 2014 ? 'data/releases/road_zones_roads_2011_2015/road_stretches_2014_retrospective.csv' : 'data/releases/road_zones_roads_2011_2015/roads_2011_2012_retrospective.csv' }, 'Download (CSV)'), ' · ', h('a', { href: 'data/releases/road_zones_roads_2011_2015/manifest.json' }, 'sources and checks'), '.'));
  }

  // ---- district tables, 2016 to 2024: whole-district crashes and crashes within selected zones ----
  // Each year keeps its own printed districts (11, 12 or 15 traffic districts); nothing is allocated to other districts, and no change
  // figures are calculated here. Totals are printed separately and are never rows. A district missing from a printed table is "not in the table", not zero.
  var HIST = R.history, CH = data.CONTINUITY.roadHistory;
  var HYEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
  var hs = { measure: 'zones' };
  (function () {
    var p = D.parseHash();
    if (p.dm === 'zones' || p.dm === 'whole') hs.measure = p.dm;
    // one year for the whole page; dy is the old district-only link parameter
    var y = +(p.y || p.dy);
    if (YEARS_PAGE.indexOf(y) >= 0) st.year = y;
    if (p.tm === 'crashes' || p.tm === 'fatalCrashes') st.measure = p.tm;
    if (p.ti === '1') st.index = true;
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
    if (y < 2016) return 'The district tables start in 2016. Earlier reports are not collected here at district level (not extracted).';
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
    var m = hs.measure, y = st.year, t = histTable(m, y), notes = histNotes(m, y);
    syncHash();
    sec.appendChild(h('div', { class: 'row-between' },
      h('div', { class: 'title-row' }, h('h2', null, 'Districts, 2016 to 2024'),
        D.tip('About these tables', 'Each year shows the districts printed in that year\'s Traffic Police report: 11, 12 or 15 traffic districts, with their printed names. They are not today\'s 15 police districts, so they are not drawn on the map and nothing is allocated between years. No change figures are calculated here. Fatal crashes are events, not people killed; simple crashes are the report\'s category, not injury crashes.')),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:8px' },
        h('button', { type: 'button', class: 'btn', 'data-key': 'hcopy', onclick: function (e) { D.copy(shareUrl(), e.currentTarget, 'Link copied', 'Copy link to view'); } }, 'Copy link to view'),
        h('button', { type: 'button', class: 'btn primary', 'data-key': 'hcsv', onclick: function () { D.download('delhi_road_' + m + '_' + y + '.csv', histCsv(m, y)); } }, 'Download CSV'))));
    sec.appendChild(h('div', { style: 'display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center' },
      seg([['zones', 'Crashes within selected zones'], ['whole', 'Whole-district crashes']], m, function (k) { hs.measure = k; keepFocus(renderDistrictTables); }, 'hm'),
      h('div', { class: 'years', role: 'group', 'aria-label': 'Year' }, HYEARS.map(function (yr) {
        return h('button', { type: 'button', 'aria-pressed': String(yr === y), 'data-key': 'hy-' + yr, title: histTable(m, yr) ? String(yr) : yr + ': no table for this measure', onclick: function () { setYear(yr); } }, yr);
      }))));
    var scopeNote = m === 'zones'
      ? 'These are crashes within the zones identified that year, not all crashes in the district or on the road. The selected locations can change each year. Simple crashes are the report\'s category, not injury crashes.'
      : 'All crash events in each district, as printed in the report\'s district table. Fatal, injury and non-injury are crash events, not people killed or injured.';
    sec.appendChild(scopeLine((m === 'zones' ? 'Crashes within selected zones' : 'Whole-district crash events') + ' · traffic districts as printed in the ' + y + ' report' + (t ? ' (' + t.geography + ')' : '') + ' · ' + y));
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
    D.$('#zones').querySelectorAll('[data-key^="zy-"]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-key') === 'zy-' + st.year)); });
  }
  function renderAll() { renderYearBar(); renderTrend(); renderModes(); renderEnforcement(); renderDistrictTables(); renderZones(); syncZoneSeg(); renderRoads(); renderStretches(); }
  renderAll();
})();
