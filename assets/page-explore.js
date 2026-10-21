/* Explore: crime and road crashes by police district. Toolbar (topic, measure, year, show-as), map, table, about, district detail and ranked list.
   State lives in the URL hash (#topic=&metric=&year=&calc=&district=) so a view can be shared. Reads window.DSO_DATA. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h;
  var data = D.data();
  if (!data) return;
  var ds = data.DELHI.districts, CONT = data.CONTINUITY, VERSION = data.updated;
  var NS = 'http://www.w3.org/2000/svg';

  var M = {
    crime: [
      { k: 'theft', label: 'Theft', note: 'Theft cases registered under the IPC (BNS numbering from 2024; the offence category carries over).' },
      { k: 'robbery', label: 'Robbery', note: 'Robbery cases registered under the IPC (BNS from 2024).' },
      { k: 'burglary', label: 'Burglary', note: 'Burglary cases. 2016 is omitted: the older category schema could not be validated, and 2016→2017 is a definition break.' },
      { k: 'totalIPC', label: 'All IPC/BNS crime', note: 'All cognisable crime registered under the IPC (BNS from 2024). 2017–2021 is reconstructed from offence-category tables and verified against the official 2022 totals.' },
      { k: 'crimeAgainstWomen', label: 'Crime against women', note: 'Crimes against women, NCRB district-wise table.' },
      { k: 'totalSLL', label: 'Special & local laws', note: 'Cases under Special and Local Laws, such as the Arms Act, NDPS Act and Excise Act.' }
    ],
    road: [
      { k: 'totalCrashes', label: 'Total crashes', note: 'All road crashes recorded by Delhi Traffic Police in the district.', unit: 'crashes' },
      { k: 'fatalCrashes', label: 'Fatal crashes', note: 'Crashes with at least one death. Not the same as persons killed: one crash can kill several people.', unit: 'fatal crashes' },
      { k: 'personsKilled', label: 'Persons killed', note: 'People killed in road crashes in the district.', unit: 'people killed' },
      { k: 'crashProneZones', label: 'Crash-prone zones', note: 'Locations on the Traffic Police crash-prone zone (blackspot) list.', unit: 'crash-prone zones' }
    ]
  };
  var YEARS = { crime: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024], road: [2023, 2024] };
  var UNSURVEYED = ['Dwarka', 'North-East', 'North-West', 'Outer', 'Outer North', 'Rohini'];
  var SHORT = { 'North-East': 'NE', 'North-West': 'NW', 'South-East': 'SE', 'South-West': 'SW', 'Outer North': 'Outer N' };
  var CALCS = [['count', 'Count'], ['pop', 'Per 1 lakh people'], ['area', 'Per km²']];

  var st = { topic: 'crime', metric: 'theft', year: 2024, calc: 'count', sel: null, view: 'map', hover: null };

  // ---------- derived values ----------
  function metricOf() { return M[st.topic].filter(function (m) { return m.k === st.metric; })[0] || M[st.topic][0]; }
  function val(d, mk, y) {
    var s = d.s[mk], v = s ? s[y] : null;
    if (v == null) return null;
    return st.calc === 'count' ? v : st.calc === 'pop' ? v / d.pop * 1e5 : v / d.area;
  }
  function fmt(v) {
    if (v == null) return '—';
    if (st.calc === 'count' || v >= 100) return Math.round(v).toLocaleString('en-IN');
    return v >= 10 ? v.toFixed(1) : v.toFixed(2);
  }
  function avail(mk, y) { return ds.some(function (d) { return d.s[mk] && d.s[mk][y] != null; }); }
  function pickYear(topic, mk, y) {
    var ys = YEARS[topic].filter(function (x) { return avail(mk, x); });
    if (ys.indexOf(y) >= 0) return y;
    return ys.filter(function (x) { return x <= y; }).pop() || ys[ys.length - 1];
  }
  function unitFor(metric) {
    var base = st.topic === 'crime' ? 'registered cases' : metric.unit;
    return st.calc === 'count' ? base : st.calc === 'pop' ? base + ' per 1 lakh residents' : base + ' per km²';
  }
  function rankList(mk, y) {
    return ds.map(function (d) { return { name: d.name, d: d, v: val(d, mk, y) }; }).filter(function (r) { return r.v != null; }).sort(function (a, b) { return b.v - a.v; });
  }
  // The comparison engine (data/continuity.json, the same code the tests run) decides whether year-1 and year may be joined.
  function cmp(mk, y0, y1, name) { return data.compareYears(CONT, mk === 'crashProneZones' ? 'crashProneZones2023' : mk, y0, y1, name); }
  function joinable(c) { return c.state === 'comparable' || c.state === 'caution'; }
  function bbox() {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, p = 12;
    ds.forEach(function (d) { var m = d.path.match(/-?\d+(?:\.\d+)?/g).map(Number); for (var i = 0; i < m.length; i += 2) { x0 = Math.min(x0, m[i]); x1 = Math.max(x1, m[i]); y0 = Math.min(y0, m[i + 1]); y1 = Math.max(y1, m[i + 1]); } });
    return (x0 - p) + ' ' + (y0 - p) + ' ' + (x1 - x0 + 2 * p) + ' ' + (y1 - y0 + 2 * p);
  }
  var VIEWBOX = bbox();

  function sourceNote() {
    return st.topic === 'crime' ? 'NCRB, Crime in India, district-wise tables (' + st.year + ')' : 'Delhi Traffic Police, Delhi Road Crash Report ' + st.year;
  }
  function caseNote() {
    return st.topic === 'crime' ? 'Registered cases are not crime levels: counts depend on reporting and registration as well as on crime.' : 'Counts, not risk rates. Not adjusted for traffic volume.';
  }

  // ---------- URL hash ----------
  function readHash() {
    var p = D.parseHash();
    if (p.topic && M[p.topic]) {
      st.topic = p.topic;
      st.metric = p.metric && M[p.topic].some(function (m) { return m.k === p.metric; }) ? p.metric : M[p.topic][0].k;
      var y = p.year ? +p.year : (p.topic === 'road' ? 2024 : st.year);
      st.year = YEARS[p.topic].indexOf(y) >= 0 ? y : YEARS[p.topic][YEARS[p.topic].length - 1];
      st.year = pickYear(st.topic, st.metric, st.year);
      if (['count', 'pop', 'area'].indexOf(p.calc) >= 0) st.calc = p.calc;
      st.sel = p.district && ds.some(function (d) { return d.name === p.district; }) ? p.district : null;
    }
  }
  function hashNow() { return D.hashOf({ topic: st.topic, metric: st.metric, year: st.year, calc: st.calc, district: st.sel }); }
  function syncHash() { try { history.replaceState(null, '', hashNow()); } catch (e) { /* file:// or sandbox: the link just won't update */ } }

  // ---------- rendering ----------
  var root = { toolbar: D.$('#toolbarInner'), title: D.$('#exTitle'), work: D.$('#workspace') };
  var mapEls = null; // handles to the SVG paths, kept so hover does not rebuild the page

  function keepFocus(fn) {
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-key');
    fn();
    if (key) { var el = document.querySelector('[data-key="' + key + '"]'); if (el && !el.disabled) el.focus({ preventScroll: true }); }
  }
  function set(o) { for (var k in o) st[k] = o[k]; keepFocus(render); syncHash(); }

  function seg(items, cur, pick, opts) {
    opts = opts || {};
    return h('div', { class: 'seg' + (opts.lg ? ' lg' : ''), role: opts.tabs ? 'tablist' : null, 'aria-label': opts.label },
      items.map(function (it) {
        var on = it[0] === cur;
        return h('button', { type: 'button', role: opts.tabs ? 'tab' : null, 'aria-selected': opts.tabs ? String(on) : null, 'aria-pressed': opts.tabs ? null : String(on), 'data-key': (opts.key || 'seg') + '-' + it[0], onclick: function () { pick(it[0]); } }, it[1]);
      }));
  }

  function renderToolbar() {
    var metric = metricOf();
    var topics = seg([['crime', 'Crime'], ['road', 'Road crashes']], st.topic, function (t) { if (t === st.topic) return; var m = M[t][0].k; set({ topic: t, metric: m, year: pickYear(t, m, st.year) }); }, { tabs: true, lg: true, label: 'Topic', key: 'topic' });
    var chips = h('div', { class: 'chips' }, M[st.topic].map(function (m) {
      return h('button', { type: 'button', class: 'chip', 'aria-pressed': String(m.k === metric.k), 'data-key': 'metric-' + m.k, onclick: function () { set({ metric: m.k, year: pickYear(st.topic, m.k, st.year) }); } }, m.label);
    }));
    var years = h('div', { class: 'years', role: 'group', 'aria-label': 'Year' }, YEARS[st.topic].map(function (y) {
      var ok = avail(metric.k, y);
      return h('button', { type: 'button', 'aria-pressed': String(y === st.year), disabled: !ok, title: ok ? String(y) : 'No figure for ' + y, 'data-key': 'year-' + y, onclick: function () { set({ year: y }); } }, y);
    }));
    var calc = seg(CALCS, st.calc, function (c) { set({ calc: c }); }, { label: 'Show as', key: 'calc' });
    var copy = h('button', { type: 'button', class: 'btn', 'data-key': 'copy', onclick: function (e) { D.copy(location.href.split('#')[0] + hashNow(), e.currentTarget, 'Link copied', 'Copy link to view'); } }, 'Copy link to view');
    var dl = h('button', { type: 'button', class: 'btn primary', 'data-key': 'csv', onclick: downloadCsv }, 'Download CSV');
    D.clear(root.toolbar).appendChild(h('div', { class: 'row' }, topics, chips));
    root.toolbar.appendChild(h('div', { class: 'row two' },
      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Year'), years,
        D.tip('About comparing years', 'Crossed-out years have no figure for this measure. A change is only shown when the year before used the same definition and districts. Rohini, Shahdara and Dwarka were created in 2016–17; Outer North in 2019.')),
      h('div', { class: 'group' }, h('span', { class: 'label' }, 'Show as'), calc,
        D.tip('About this calculation', 'Per 1 lakh residents divides by an approximate district population. Per km² divides by district area. Rates help compare districts of very different size, but daytime population (commuters, markets) is not counted.')),
      h('div', { class: 'actions' }, copy, dl)));
  }

  function renderTitle() {
    var metric = metricOf(), unit = unitFor(metric);
    D.clear(root.title).appendChild(h('h1', null, metric.label + ' by police district, ' + st.year));
    root.title.appendChild(h('div', { class: 'unit' }, unit.charAt(0).toUpperCase() + unit.slice(1),
      D.tip('About this measure', [metric.note, caseNote(), 'Source: ' + sourceNote()])));
  }

  function renderMapCard(ranked, bin, metric, unit) {
    var card = h('section', { class: 'panel map', 'aria-label': 'Map' });
    var tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'View' }, [['map', 'Map'], ['table', 'Table'], ['about', 'About']].map(function (v) {
      return h('button', { type: 'button', role: 'tab', 'aria-selected': String(st.view === v[0]), 'data-key': 'view-' + v[0], onclick: function () { set({ view: v[0] }); } }, v[1]);
    }));
    card.appendChild(tabs);
    mapEls = null;
    if (st.view === 'table') { card.appendChild(tableView(ranked, metric, unit)); return card; }
    if (st.view === 'about') { card.appendChild(aboutView()); return card; }

    var svg = h('svg', { viewBox: VIEWBOX, role: 'group', 'aria-label': 'Map of Delhi police districts' });
    svg.appendChild(h('defs', null, h('pattern', { id: 'dsoHatch', patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(45)' },
      h('rect', { class: 'hatch-bg', width: 7, height: 7 }), h('line', { class: 'hatch-ln', x1: 0, y1: 0, x2: 0, y2: 7 }))));
    var paths = {};
    ds.forEach(function (d) {
      var v = val(d, metric.k, st.year), b = bin[d.name];
      var p = h('path', { class: 'dpath', d: d.path, 'data-key': 'path-' + d.name, tabindex: 0, role: 'button', 'aria-label': d.name + ': ' + (v == null ? 'no figure' : fmt(v) + ' ' + unit) + (st.sel === d.name ? ', selected' : ''),
        style: 'fill:' + (b == null ? 'url(#dsoHatch)' : D.rampVars[b]),
        onmouseenter: function () { setHover(d.name); }, onfocus: function () { setHover(d.name); }, onblur: function () { setHover(null); },
        onclick: function () { select(d.name); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(d.name); } } });
      paths[d.name] = p; svg.appendChild(p);
    });
    var hov = h('path', { class: 'dhover', d: '' }), sel = h('path', { class: 'dsel', d: '' });
    svg.appendChild(hov); svg.appendChild(sel);
    ds.forEach(function (d) { svg.appendChild(h('text', { class: 'dlabel', x: d.cx, y: d.cy + 5 }, SHORT[d.name] || d.name)); });
    var box = h('div', { class: 'map-box' }, svg);
    var cardEl = h('div', { class: 'hover-card', hidden: true });
    box.appendChild(cardEl);
    box.addEventListener('mousemove', function (e) { var r = box.getBoundingClientRect(); cardEl._x = e.clientX - r.left; cardEl._y = e.clientY - r.top; cardEl._w = r.width; placeCard(); });
    box.addEventListener('mouseleave', function () { setHover(null); });
    mapEls = { paths: paths, hov: hov, sel: sel, card: cardEl, ranked: ranked, metric: metric, unit: unit, bin: bin };

    var nulls = ranked.length < ds.length;
    var steps = [0, 1, 2, 3, 4].map(function (b) {
      var vs = ranked.filter(function (r, i) { return 4 - Math.floor(i * 5 / Math.max(ranked.length, 1)) === b; }).map(function (r) { return r.v; });
      var range = vs.length ? (vs.length > 1 ? fmt(Math.min.apply(null, vs)) + '–' + fmt(Math.max.apply(null, vs)) : fmt(vs[0])) : '';
      return h('div', { class: 'step' }, h('i', { style: 'background:' + D.rampVars[b] }), h('span', null, range));
    });
    var legend = h('div', { class: 'legend' },
      h('div', null, h('div', { class: 't' }, 'Colour = rank this year', D.tip('About the colour scale', 'Districts are split into five groups of three by rank, so one very high district can\'t wash out the rest. Colours are not comparable across years; use the numbers for that.')), h('div', { class: 'steps' }, steps)),
      nulls ? h('div', { class: 'none' }, h('svg', { width: 22, height: 12, 'aria-hidden': 'true' }, h('rect', { width: 22, height: 12, rx: 2, style: 'fill:url(#dsoHatch)' })), 'No figure for this year') : null);
    card.appendChild(h('div', { class: 'map-body' }, box, legend));
    updateHighlights();
    return card;
  }

  function tableView(ranked, metric, unit) {
    var yrs = YEARS[st.topic].filter(function (y) { return avail(metric.k, y); });
    var names = ranked.map(function (r) { return r.d; }).concat(ds.filter(function (d) { return !ranked.some(function (r) { return r.d === d; }); }));
    var tbl = h('table', null,
      h('caption', null, metric.label + ', ' + unit + ', by year. Sorted by ' + st.year + '; the selected year is highlighted. A dash means no figure.'),
      h('thead', null, h('tr', null, h('th', { scope: 'col', style: 'text-align:left' }, 'District'), yrs.map(function (y) { return h('th', { scope: 'col', class: y === st.year ? 'sel' : null }, y); }))),
      h('tbody', null, names.map(function (d) {
        return h('tr', null, h('th', { scope: 'row' }, d.name), yrs.map(function (y) { return h('td', { class: y === st.year ? 'sel' : null }, fmt(val(d, metric.k, y))); }));
      })));
    return h('div', { class: 'table-wrap' }, tbl);
  }

  function aboutView() {
    var metric = metricOf();
    return h('div', { class: 'about-body' },
      h('div', null, h('h3', null, 'What this measures'), h('p', null, metric.note)),
      h('div', null, h('h3', null, 'How to read it'), h('p', null, caseNote() + ' Colours group districts into five bands of three by rank within the selected year, so they can\'t be compared across years; use the Table tab for that.')),
      h('div', null, h('h3', null, 'Source'), h('p', null, sourceNote() + '. ', h('a', { href: 'data-methods.html#compare' }, 'Check which years can be compared'), '.')));
  }

  function placeCard() {
    if (!mapEls || !st.hover) return;
    var c = mapEls.card;
    c.style.left = Math.max(0, Math.min((c._x || 0) + 16, (c._w || 600) - 220)) + 'px';
    c.style.top = Math.max(0, (c._y || 0) + 16) + 'px';
  }
  function setHover(name) {
    st.hover = name;
    updateHighlights();
    var rows = root.work.querySelectorAll('.rank-list button');
    rows.forEach(function (b) { b.classList.toggle('hov', b.getAttribute('data-name') === name); });
  }
  function updateHighlights() {
    if (!mapEls) return;
    var byName = {}; ds.forEach(function (d) { byName[d.name] = d; });
    var rank = {}; mapEls.ranked.forEach(function (r, i) { rank[r.name] = i + 1; });
    for (var name in mapEls.paths) {
      var dim = st.hover && st.hover !== name && st.sel !== name;
      mapEls.paths[name].style.opacity = dim ? 0.55 : 1;
    }
    mapEls.hov.setAttribute('d', st.hover && st.hover !== st.sel ? byName[st.hover].path : '');
    mapEls.sel.setAttribute('d', st.sel ? byName[st.sel].path : '');
    var c = mapEls.card;
    if (st.hover) {
      var d = byName[st.hover], v = val(d, mapEls.metric.k, st.year);
      D.clear(c).appendChild(h('b', null, d.name));
      c.appendChild(h('span', { class: 'v' }, fmt(v)));
      c.appendChild(h('span', null, v == null ? 'No figure for ' + st.year : D.ord(rank[d.name]) + ' of ' + mapEls.ranked.length + ' · ' + mapEls.unit));
      c.hidden = false; placeCard();
    } else c.hidden = true;
  }
  function select(name) { set({ sel: st.sel === name ? null : name }); }

  function totalOf(mk, y) {
    var rows = ds.filter(function (d) { return d.s[mk] && d.s[mk][y] != null; });
    if (!rows.length) return null;
    var sum = rows.reduce(function (a, d) { return a + d.s[mk][y]; }, 0);
    var pop = rows.reduce(function (a, d) { return a + d.pop; }, 0), area = rows.reduce(function (a, d) { return a + d.area; }, 0);
    return { v: st.calc === 'count' ? sum : st.calc === 'pop' ? sum / pop * 1e5 : sum / area, n: rows.length };
  }

  function cautionNote(c) { return c.state === 'caution' ? 'Compare with caution: ' + c.reasons[0] : ''; }

  function renderDetail(ranked, metric, unit) {
    var sec = h('section', { class: 'panel detail', 'aria-label': 'District detail' });
    var yrs = YEARS[st.topic], prevY = st.year - 1;
    var sd = ds.filter(function (d) { return d.name === st.sel; })[0];
    var body = h('div', { class: 'detail-body' });
    if (!sd) {
      var cur = totalOf(metric.k, st.year), prev = yrs.indexOf(prevY) >= 0 ? totalOf(metric.k, prevY) : null, change = '', warn = '';
      if (cur && prev) {
        var c = cmp(metric.k, prevY, st.year);
        if (joinable(c) && prev.n === cur.n && prev.v) { change = D.pct((cur.v - prev.v) / prev.v * 100) + ' compared with ' + prevY + ' (' + fmt(prev.v) + ')'; warn = cautionNote(c); }
        else change = 'Not directly comparable with ' + prevY + ': districts or definitions changed.';
      }
      body.appendChild(h('div', null, h('span', { class: 'eyebrow' }, 'All of Delhi · ' + st.year), h('div', { class: 'big-v' }, cur ? fmt(cur.v) : '—'),
        h('span', { class: 'unit' }, unit + (cur && cur.n < ds.length ? ' · ' + cur.n + ' of ' + ds.length + ' districts reported' : ''))));
      if (change) body.appendChild(h('div', { class: 'sentence' }, change));
      if (warn) body.appendChild(h('div', { class: 'sentence caution' }, warn));
      var top = ranked[0], bottom = ranked[ranked.length - 1];
      if (top) body.appendChild(h('div', { class: 'stats', style: 'grid-template-columns:1fr 1fr' }, h('div', { class: 'stat' }, h('span', null, 'Highest'), h('span', null, top.name + ' · ' + fmt(top.v))), h('div', { class: 'stat' }, h('span', null, 'Lowest'), h('span', null, bottom.name + ' · ' + fmt(bottom.v)))));
      body.appendChild(h('div', { class: 'prompt' }, 'Select a district on the map or in the ranking to see its trend, its rank on other measures and the infrastructure around it.'));
      sec.appendChild(body);
      return sec;
    }
    var v = val(sd, metric.k, st.year), n = ranked.length;
    var rankIdx = ranked.findIndex ? ranked.findIndex(function (r) { return r.name === sd.name; }) : -1;
    var mean = n ? ranked.reduce(function (a, r) { return a + r.v; }, 0) / n : null;
    var pv = yrs.indexOf(prevY) >= 0 ? val(sd, metric.k, prevY) : null;
    var c2 = yrs.indexOf(prevY) >= 0 ? cmp(metric.k, prevY, st.year, sd.name) : null;
    var changeTxt = '—', sentence = '', warn2 = '';
    if (v != null && pv != null && c2) {
      if (joinable(c2) && pv) {
        changeTxt = D.pct((v - pv) / pv * 100);
        sentence = v === pv ? 'No change compared with ' + prevY + '.' : 'There has been ' + (v > pv ? 'an increase' : 'a decrease') + ' of ' + fmt(Math.abs(v - pv)) + ' (' + Math.abs((v - pv) / pv * 100).toFixed(1) + '%) compared with ' + prevY + '.';
        warn2 = cautionNote(c2);
      } else { changeTxt = 'Not comparable'; sentence = st.year + ' is not directly comparable with ' + prevY + ' for this district. ' + (c2.reasons[0] || ''); }
    }
    body.appendChild(h('div', { class: 'head' }, h('div', null, h('span', { class: 'eyebrow' }, 'Police district'), h('h2', null, sd.name)),
      h('button', { type: 'button', class: 'pill-btn', 'aria-label': 'Back to all of Delhi', 'data-key': 'clear', onclick: function () { set({ sel: null }); } }, 'All Delhi')));
    body.appendChild(h('div', null, h('div', { class: 'big-v' }, fmt(v)), h('span', { class: 'unit' }, v == null ? 'No figure for ' + st.year : unit + ', ' + st.year)));
    body.appendChild(h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('span', null, 'Rank'), h('span', null, v == null || rankIdx < 0 ? '—' : D.ord(rankIdx + 1) + ' of ' + n)),
      h('div', { class: 'stat' }, h('span', null, 'vs district avg'), h('span', null, v == null || !mean ? '—' : D.pct((v - mean) / mean * 100))),
      h('div', { class: 'stat' }, h('span', null, prevY && yrs.indexOf(prevY) >= 0 ? 'vs ' + prevY : 'Change'), h('span', null, changeTxt))));
    if (sentence) body.appendChild(h('p', { class: 'sentence' }, sentence));
    if (warn2) body.appendChild(h('p', { class: 'sentence caution' }, warn2));

    // trend: a gap before a bar marks a break in definition or boundaries
    var tv = yrs.map(function (y) { return val(sd, metric.k, y); });
    var tmax = Math.max.apply(null, [1].concat(tv.filter(function (x) { return x != null; })));
    var hasBreak = false;
    var bars = yrs.map(function (y, i) {
      var x = tv[i], brk = false;
      if (i > 0 && x != null && tv[i - 1] != null) { brk = !joinable(cmp(metric.k, y - 1, y, sd.name)); if (brk) hasBreak = true; }
      return h('button', { type: 'button', 'aria-pressed': String(y === st.year), disabled: x == null, title: y + ': ' + (x == null ? 'no figure' : fmt(x)), 'aria-label': y + ': ' + (x == null ? 'no figure' : fmt(x)), style: brk ? 'margin-left:10px' : null, onclick: function () { set({ year: y }); } },
        h('span', { class: 'b', style: 'height:' + (x == null ? 0 : x / tmax * 100) + '%' }), h('span', { class: 'l' }, "'" + String(y).slice(2)));
    });
    body.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, h('span', { class: 'sub-h' }, 'Trend · tap a year'), h('div', { class: 'trend' }, bars),
      hasBreak ? h('span', { class: 'note-s' }, 'A gap between bars marks a change in definition or boundaries. Don\'t compare across it.') : null));

    // other measures for this district
    body.appendChild(h('div', { style: 'display:flex;flex-direction:column;gap:6px' }, h('span', { class: 'sub-h' }, 'Other measures · ' + st.year),
      h('div', { class: 'others' }, M[st.topic].map(function (m) {
        var rl = rankList(m.k, st.year), ix = rl.findIndex(function (r) { return r.name === sd.name; });
        return h('button', { type: 'button', 'aria-current': String(m.k === metric.k), onclick: function () { set({ metric: m.k, year: pickYear(st.topic, m.k, st.year) }); } },
          h('span', null, m.label), h('span', { class: 'v' }, ix < 0 ? '—' : fmt(rl[ix].v)), h('span', { class: 'r' }, ix < 0 ? '' : D.ord(ix + 1)));
      }))));

    var I = sd.infra, uns = UNSURVEYED.indexOf(sd.name) >= 0;
    var rows = [
      { label: 'Streetlights', src: 'PAPL', value: uns ? '—' : I.lights.toLocaleString('en-IN') + ' /km²', flag: uns ? 'Not surveyed' : '' },
      { label: 'Underpasses', src: 'PAPL', value: uns ? '—' : String(I.underpasses), flag: uns ? 'Not surveyed' : '' },
      { label: 'Police stations · posts', src: 'GSDL+OSM', value: I.police + ' · ' + I.posts, flag: sd.name === 'Outer' ? 'Posts undercounted' : '' },
      { label: 'Metro gates', src: 'OSM', value: String(I.metro), flag: '' },
      { label: 'Foot overbridges', src: 'OSM', value: String(I.overbridges), flag: '' },
      { label: 'CCTV & guard posts', src: 'OSM', value: String(I.cctv), flag: '' }
    ];
    body.appendChild(h('div', { style: 'display:flex;flex-direction:column' },
      h('div', { class: 'sub-h', style: 'padding-bottom:6px' }, 'Infrastructure in this district',
        D.tip('About infrastructure data', 'A current snapshot, not matched to the selected year. Streetlights and underpasses come from a PAPL survey that skipped six districts. OSM layers are community-mapped: a low count can mean little mapping, not little infrastructure. Patterns here describe, they don\'t show cause.', { right: true, })),
      rows.map(function (r) {
        return h('div', { class: 'infra-row' }, h('span', null, r.label, h('span', { class: 'src' }, r.src)), h('span', null, r.flag ? h('span', { class: 'flag' }, r.flag) : null, h('span', { class: 'v' }, r.value)));
      })));
    sec.appendChild(body);
    return sec;
  }

  function renderList(ranked, bin) {
    var maxV = ranked.length ? ranked[0].v : 1;
    var rows = ranked.map(function (r, i) { return { name: r.name, v: r.v, rank: i + 1 }; })
      .concat(ds.filter(function (d) { return !ranked.some(function (r) { return r.name === d.name; }); }).map(function (d) { return { name: d.name, v: null, rank: '–' }; }));
    return h('section', { class: 'panel list', 'aria-label': 'Ranked districts' },
      h('div', { class: 'list-head' }, h('h2', null, 'Ranked, highest first'), h('span', null, ranked.length + ' of ' + ds.length + ' districts')),
      h('ol', { class: 'rank-list' }, rows.map(function (r) {
        return h('li', null, h('button', { type: 'button', 'data-name': r.name, 'aria-pressed': String(st.sel === r.name), 'data-key': 'row-' + r.name, onclick: function () { select(r.name); }, onmouseenter: function () { setHover(r.name); }, onmouseleave: function () { setHover(null); } },
          h('span', { class: 'r' }, r.rank), h('span', { class: 'n' }, r.name), h('span', { class: 'v' }, r.v == null ? 'No figure' : fmt(r.v)),
          h('span', { class: 'b' }, r.v == null ? null : h('i', { style: 'width:' + Math.max(2, r.v / maxV * 100) + '%;background:' + D.rampVars[bin[r.name]] }))));
      })));
  }

  function render() {
    var metric = metricOf(), unit = unitFor(metric);
    var ranked = rankList(metric.k, st.year), bin = D.bands(ranked);
    renderToolbar(); renderTitle();
    D.clear(root.work);
    root.work.appendChild(renderMapCard(ranked, bin, metric, unit));
    root.work.appendChild(renderDetail(ranked, metric, unit));
    root.work.appendChild(renderList(ranked, bin));
  }

  function downloadCsv() {
    var metric = metricOf(), unit = unitFor(metric), ranked = rankList(metric.k, st.year), yrs = YEARS[st.topic];
    var rows = [['rank', 'district', 'value', 'measure', 'year', 'unit', 'change_vs_previous_year_percent', 'comparability_with_previous_year', 'source', 'data_version']];
    ranked.forEach(function (r, i) {
      var pv = yrs.indexOf(st.year - 1) >= 0 ? val(r.d, metric.k, st.year - 1) : null, c = yrs.indexOf(st.year - 1) >= 0 ? cmp(metric.k, st.year - 1, st.year, r.name) : null;
      var change = c && joinable(c) && pv ? ((r.v - pv) / pv * 100).toFixed(1) : '';
      rows.push([i + 1, r.name, st.calc === 'count' ? r.v : r.v.toFixed(2), metric.label, st.year, unit, change, c ? c.state : 'first year', sourceNote(), VERSION]);
    });
    ds.forEach(function (d) { if (!ranked.some(function (r) { return r.name === d.name; })) rows.push(['', d.name, '', metric.label, st.year, unit, '', 'no figure', sourceNote(), VERSION]); });
    D.download('delhi_' + metric.k + '_' + st.year + '_' + st.calc + '.csv', D.csv(rows));
  }

  readHash();
  render();
  window.addEventListener('hashchange', function () { readHash(); render(); });
})();
