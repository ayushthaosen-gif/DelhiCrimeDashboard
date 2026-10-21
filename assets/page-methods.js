/* Data & methods: the "can I compare these years?" checker and the series-status list. Both read the same rules the charts use
   (data/continuity.json through compareYears, data/series_status.json). Reads window.DSO_DATA. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h;
  var data = D.data();
  if (!data) return;
  var CONT = data.CONTINUITY, S = data.SITE;
  var LBL = { comparable: 'Comparable', caution: 'Compare with caution', not_comparable: 'Not comparable', unavailable: 'Unavailable' };
  var MS = [['theft', 'Theft'], ['robbery', 'Robbery'], ['burglary', 'Burglary'], ['totalIPC', 'All IPC/BNS crime'], ['crimeAgainstWomen', 'Crime against women'], ['totalSLL', 'Special & local laws']];
  var YEARS = []; for (var y = CONT.yearRange[0]; y <= CONT.yearRange[1]; y++) YEARS.push(y);
  var SCOPES = [['districts', 'Police districts (the map)'], ['delhi', 'Delhi as a whole (printed totals)']];
  var st = { measure: 'theft', a: 2016, b: 2024, scope: 'districts', status: 'all' };

  function select(label, value, options, onchange, mono) {
    return h('label', null, label, h('select', { 'data-key': 'sel-' + label, onchange: function (e) { onchange(e.target.value); }, style: mono ? 'font-family:var(--mono)' : null },
      options.map(function (o) { return h('option', { value: o[0], selected: String(o[0]) === String(value) }, o[1]); })));
  }
  function kf(fn) {
    var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-key');
    fn();
    if (key) { var el = document.querySelector('[data-key="' + key + '"]'); if (el) el.focus({ preventScroll: true }); }
  }
  function run(key, from, to) { return data.compareYears(CONT, key, from, to, st.scope === 'delhi' ? CONT.utSeries.scopeName : undefined); }

  function renderChecker() {
    var box = D.clear(D.$('#checker'));
    var lo = Math.min(st.a, st.b), hi = Math.max(st.a, st.b);
    var overall = lo === hi ? null : run(st.measure, lo, hi);
    var steps = [];
    if (lo !== hi) {
      for (var y = lo; y < hi; y++) {
        var c = run(st.measure, y, y + 1);
        if (c.state === 'comparable') continue;
        var reason = c.reasons.join(' '), prev = steps[steps.length - 1];
        // consecutive pairs with the same state and reason are one span, not a repeated line
        if (prev && prev.state === c.state && prev.reason === reason && prev.to === y) { prev.to = y + 1; prev.when = prev.from + '→' + prev.to; }
        else steps.push({ from: y, to: y + 1, when: y + '→' + (y + 1), state: c.state, reason: reason });
      }
    }
    var verdict = overall ? overall.state : 'none';
    box.appendChild(h('div', { class: 'checker' },
      select('Geography', st.scope, SCOPES, function (v) { st.scope = v; kf(renderChecker); }),
      select('Measure', st.measure, MS, function (v) { st.measure = v; kf(renderChecker); }),
      select('From', st.a, YEARS.map(function (y) { return [y, y]; }), function (v) { st.a = +v; kf(renderChecker); }, true),
      select('To', st.b, YEARS.map(function (y) { return [y, y]; }), function (v) { st.b = +v; kf(renderChecker); }, true),
      h('span', { class: 'verdict ' + verdict, role: 'status' }, overall ? LBL[overall.state] : 'Pick two different years')));
    var reasons = h('div', { class: 'reasons' });
    if (lo !== hi && !steps.length) reasons.appendChild(h('div', { class: 'reason' }, h('b', { class: 'w' }, lo + '→' + hi), h('span', null, h('strong', null, 'No documented breaks.'), ' Same source, definitions and districts across this span.')));
    steps.forEach(function (s) { reasons.appendChild(h('div', { class: 'reason' }, h('b', { class: 'w' }, s.when), h('span', null, h('strong', null, LBL[s.state] + '.'), ' ' + s.reason))); });
    box.appendChild(reasons);
  }

  // ---- series status ----
  function renderSeries() {
    var all = S.series;
    var statuses = ['all'].concat(all.map(function (s) { return s.status; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    var chips = D.clear(D.$('#statusChips'));
    statuses.forEach(function (k) {
      var count = k === 'all' ? all.length : all.filter(function (s) { return s.status === k; }).length;
      chips.appendChild(h('button', { type: 'button', class: 'chip', 'aria-pressed': String(k === st.status), onclick: function () { st.status = k; renderSeries(); } }, (k === 'all' ? 'All' : k.charAt(0).toUpperCase() + k.slice(1)) + ' · ' + count));
    });
    var list = D.clear(D.$('#seriesList'));
    all.filter(function (s) { return st.status === 'all' || s.status === st.status; }).forEach(function (s) {
      list.appendChild(h('div', { class: 'series-row' }, h('span', { style: 'font-weight:500' }, s.name),
        h('span', { class: 'st' }, h('span', { class: 'status-pill ' + s.status.replace(/ /g, '-') }, s.status.charAt(0).toUpperCase() + s.status.slice(1)), h('span', { class: 'latest' }, 'Latest: ' + (s.latest || 'none'))),
        h('span', { class: 'geo' }, s.geo)));
    });
  }

  renderChecker();
  renderSeries();
})();
