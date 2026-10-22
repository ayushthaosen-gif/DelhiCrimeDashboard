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


  // ---- coverage by year, breaks, versioned bundles (read data/coverage_matrix.json and data/bundles/manifest.json) ----
  var GLYPH = { available: '●', partial: '◐', staged: '▫', provisional: '◔', not_printed: '–', not_extracted: '○', source_not_found: '?', not_collected: '·', not_published: '…' };
  var CM = null, BM = null, cmSel = null;
  function getJson(path) { return fetch(path).then(function (r) { if (!r.ok) throw new Error(path); return r.json(); }); }
  function renderMatrix() {
    var box = D.clear(D.$('#matrixBox'));
    if (!CM) { box.appendChild(h('p', { class: 'muted' }, 'Loading coverage…')); return; }
    var legend = h('ul', { class: 'cm-legend' }, Object.keys(CM.states).map(function (k) { return h('li', null, h('span', { class: 'cm-g cm-' + k, 'aria-hidden': 'true' }, GLYPH[k]), CM.states[k]); }));
    var head = h('tr', null, h('th', { scope: 'col' }, 'Series'), CM.years.map(function (y) { return h('th', { scope: 'col', class: 'cm-y' }, String(y).slice(2)); }));
    var body = []; var group = null;
    CM.rows.forEach(function (r) {
      if (r.group !== group) { group = r.group; body.push(h('tr', { class: 'cm-grp' }, h('th', { colspan: CM.years.length + 1, scope: 'colgroup' }, group))); }
      body.push(h('tr', null, h('th', { scope: 'row' }, r.series), CM.years.map(function (y) {
        var c = r.cells[y], on = cmSel && cmSel[0] === r.id && cmSel[1] === y;
        return h('td', null, h('button', { type: 'button', class: 'cm-g cm-' + c.state + (on ? ' on' : ''), 'aria-pressed': String(!!on), 'aria-label': r.series + ', ' + y + ': ' + CM.states[c.state],
          onclick: function () { cmSel = [r.id, y]; renderMatrix(); } }, GLYPH[c.state]));
      })));
    });
    var info = h('div', { class: 'callout', role: 'status', 'aria-live': 'polite' });
    if (cmSel) {
      var row = CM.rows.filter(function (r) { return r.id === cmSel[0]; })[0], c = row.cells[cmSel[1]];
      info.appendChild(h('strong', null, row.series + ', ' + cmSel[1] + ': '));
      info.appendChild(document.createTextNode(CM.states[c.state] + '. ' + (c.note || '') + ' '));
      if (c.evidence) info.appendChild(h('span', { class: 'muted' }, 'Evidence: ' + c.evidence));
      info.appendChild(h('div', { class: 'muted', style: 'font-size:13px' }, row.unit + ' · ' + row.geography));
    } else info.appendChild(document.createTextNode('Select a cell to see what it means for that series and year.'));
    box.appendChild(legend);
    box.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'cm' }, h('caption', { class: 'sr-only' }, 'Coverage by series and year, 2011 to 2026'), h('thead', null, head), h('tbody', null, body))));
    box.appendChild(info);
  }
  function renderBreaks() {
    var box = D.clear(D.$('#breaksBox'));
    if (!CM) return;
    var by = {};
    CM.comparison.forEach(function (c) { (by[c.applies_to] = by[c.applies_to] || []).push(c); });
    Object.keys(by).forEach(function (k) {
      box.appendChild(h('details', { class: 'plain' }, h('summary', null, k + ' (' + by[k].length + ')'), h('ul', { class: 'why-list' }, by[k].map(function (c) {
        return h('li', null, h('strong', null, c.between[0] + ' to ' + c.between[1] + ' · ' + ({ not_comparable: 'not comparable', caution: 'compare with caution', unavailable: 'no figure' }[c.state] || c.state) + '. '), c.measures && c.measures.length < 6 ? '(' + c.measures.join(', ') + ') ' : '', c.reason);
      }))));
    });
  }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha(text) { return window.crypto && crypto.subtle ? crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(hex) : Promise.resolve(null); }
  function bundleReadme(b, results) {
    var bad = results.filter(function (r) { return r.actual && r.actual !== r.expected; }).length, unverified = results.filter(function (r) { return !r.actual; }).length;
    var rows = CM.rows.filter(function (r) { return b.series.indexOf(r.id) >= 0; });
    var L = ['# ' + b.title, '', 'Delhi Urban Safety Observatory · bundle version ' + b.version + ' · data version ' + BM.dataVersion, '', b.description, '',
      '## Geography', '', b.geography, '', '## Definitions', ''].concat(b.definitions.map(function (d) { return '- ' + d; }));
    L.push('', '## Coverage and gaps', '', 'Year by year for the series in this bundle (full table: COVERAGE.csv). A blank is never a zero.', '');
    rows.forEach(function (r) {
      var runs = [], cur = null;
      CM.years.forEach(function (y) { var s = r.cells[y].state; if (cur && cur.s === s) cur.to = y; else { cur = { s: s, from: y, to: y }; runs.push(cur); } });
      L.push('- ' + r.series + ' (' + r.unit + '): ' + runs.map(function (x) { return (x.from === x.to ? x.from : x.from + '-' + x.to) + ' ' + CM.states[x.s].toLowerCase(); }).join('; '));
    });
    L.push('', '## What is inside', '');
    b.files.forEach(function (f) { L.push('- ' + f.path + ' (' + f.bytes + ' bytes)'); });
    L.push('', '## Provenance', '', 'Every release folder has a manifest.json with source URLs, page references, SHA-256 checksums, extraction method and review status. Transcriptions made from page images were read by one agent and are not independently reviewed. No explicit open licence has been verified for the agency reports; cite the original agency for any figure.',
      '', '## Integrity check made when this bundle was built', '', bad ? bad + ' file(s) differ from the published checksum: see BUNDLE_MANIFEST.json.' : (unverified ? 'The browser could not compute checksums; the expected values are in BUNDLE_MANIFEST.json.' : 'All ' + results.length + ' files match the published SHA-256.'),
      '', '## Comparing years', '', 'See COMPARABILITY.md. Do not compute a change across a break without reading it.');
    return L.join('\n') + '\n';
  }
  function bundleComparability() {
    var L = ['# Why years can\'t always be compared', ''];
    CM.comparison.forEach(function (c) { L.push('- ' + c.applies_to + (c.measures && c.measures.length < 6 ? ' [' + c.measures.join(', ') + ']' : '') + ', ' + c.between[0] + ' to ' + c.between[1] + ' (' + c.state.replace('_', ' ') + '): ' + c.reason); });
    return L.join('\n') + '\n';
  }
  function covCsv(b) {
    var rows = [['series_id', 'series', 'year', 'state', 'meaning', 'note', 'evidence']];
    CM.rows.filter(function (r) { return b.series.indexOf(r.id) >= 0; }).forEach(function (r) { CM.years.forEach(function (y) { var c = r.cells[y]; rows.push([r.id, r.series, y, c.state, CM.states[c.state], c.note || '', c.evidence || '']); }); });
    return D.csv(rows);
  }
  function makeBundle(b, btn) {
    btn.disabled = true; btn.textContent = 'Building…';
    Promise.all(b.files.map(function (f) { return fetch(f.path).then(function (r) { if (!r.ok) throw new Error(f.path); return r.text(); }).then(function (t) { return sha(t).then(function (a) { return { path: f.path, text: t, expected: f.sha256, actual: a }; }); }); }))
      .then(function (results) {
        var folder = 'delhi_observatory_' + b.id + '_' + b.version + '/';
        var items = results.map(function (r) { return { name: folder + r.path, text: r.text }; });
        var manifest = { bundle: b.id, version: b.version, dataVersion: BM.dataVersion, builtInBrowserAt: new Date().toISOString(), files: results.map(function (r) { return { path: r.path, expectedSha256: r.expected, fetchedSha256: r.actual, matches: r.actual ? r.actual === r.expected : null }; }) };
        items.push({ name: folder + 'README.md', text: bundleReadme(b, results) }, { name: folder + 'COVERAGE.csv', text: covCsv(b) }, { name: folder + 'COMPARABILITY.md', text: bundleComparability() }, { name: folder + 'BUNDLE_MANIFEST.json', text: JSON.stringify(manifest, null, 2) + '\n' });
        D.downloadBlob(folder.slice(0, -1) + '.zip', D.zip(items));
        var bad = results.filter(function (r) { return r.actual && r.actual !== r.expected; }).length;
        btn.textContent = bad ? 'Downloaded (' + bad + ' checksum difference)' : 'Downloaded';
      })
      .catch(function () { btn.textContent = 'Could not build the bundle'; })
      .then(function () { setTimeout(function () { btn.disabled = false; btn.textContent = 'Download ZIP'; }, 2500); });
  }
  function renderBundles() {
    var box = D.clear(D.$('#bundleBox'));
    if (!BM) { box.appendChild(h('p', { class: 'muted' }, 'Loading…')); return; }
    box.appendChild(h('div', { class: 'dl-grid' }, BM.bundles.map(function (b) {
      return h('div', { class: 'dl-card', style: 'cursor:default' }, h('span', { class: 'k' }, 'ZIP · ' + b.files.length + ' files · ' + Math.round(b.bytes / 1024) + ' KB'), h('strong', null, b.title), h('span', null, b.description), h('span', { class: 'muted', style: 'font-size:12.5px' }, 'Version ' + b.version),
        h('button', { type: 'button', class: 'btn primary', 'data-key': 'bundle-' + b.id, onclick: function (e) { makeBundle(b, e.currentTarget); } }, 'Download ZIP'));
    })));
  }
  getJson('data/coverage_matrix.json').then(function (m) { CM = m; renderMatrix(); renderBreaks(); }).catch(function () { D.clear(D.$('#matrixBox')).appendChild(h('p', { class: 'muted' }, 'The coverage table could not be loaded; the CSV link above has the same data.')); });
  getJson('data/bundles/manifest.json').then(function (m) { BM = m; renderBundles(); }).catch(function () { D.clear(D.$('#bundleBox')).appendChild(h('p', { class: 'muted' }, 'The bundle list could not be loaded.')); });

  renderMatrix(); renderBundles();
  renderChecker();
  renderSeries();
})();
