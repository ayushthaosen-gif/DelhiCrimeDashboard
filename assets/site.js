/* Delhi Urban Safety Observatory: shared helpers for every page (theme, element builder, "i" tooltips, number format, hash, CSV).
   Hand-written, no framework. Page scripts read the generated data from assets/site-data.js (window.DSO_DATA). */
(function () {
  'use strict';
  var D = window.DSO = {};

  // ---- theme: shared by every page through localStorage['dso-theme'] (light | dark). Light is the default. ----
  D.theme = function () { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; };
  D.setTheme = function (t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('dso-theme', t); } catch (e) { /* private mode: the choice just lasts for this page */ }
    var b = document.getElementById('themeBtn');
    if (b) b.lastChild.textContent = (t === 'dark' ? 'Light' : 'Dark') + ' theme';
    document.dispatchEvent(new CustomEvent('dso-theme', { detail: t }));
  };
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('themeBtn');
    if (b) {
      b.lastChild.textContent = (D.theme() === 'dark' ? 'Light' : 'Dark') + ' theme';
      b.addEventListener('click', function () { D.setTheme(D.theme() === 'dark' ? 'light' : 'dark'); });
    }
  });

  // ---- small DOM builder: h('div', {class:'x', onclick: fn, 'aria-label': 'y'}, child, [children], 'text') ----
  D.h = function (tag, props) {
    var el = tag === 'svg' || tag === 'path' || tag === 'g' || tag === 'text' || tag === 'rect' || tag === 'line' || tag === 'polyline' || tag === 'polygon' || tag === 'circle' || tag === 'defs' || tag === 'pattern' || tag === 'title'
      ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
    var i, k, v;
    if (props) {
      for (k in props) {
        v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.setAttribute('class', v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'text') el.textContent = v;
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (i = 2; i < arguments.length; i++) D.append(el, arguments[i]);
    return el;
  };
  D.append = function (el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { for (var i = 0; i < c.length; i++) D.append(el, c[i]); return; }
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  };
  D.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  D.$ = function (sel, root) { return (root || document).querySelector(sel); };

  // ---- numbers: lakh grouping; true minus sign; signed percentages "+12%", "−12%", "±0%" ----
  D.n = function (v) { return v == null ? '—' : Math.round(v).toLocaleString('en-IN'); };
  D.pct = function (p) { if (p == null || !isFinite(p)) return '—'; var r = Math.round(p); return (r > 0 ? '+' : r < 0 ? '−' : '±') + Math.abs(r) + '%'; };
  D.ord = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  // ---- "i" tooltip: opens on hover, on focus, or on click (click toggles); Escape and outside click close it ----
  var openTip = null, tipId = 0;
  function closeTip() { if (openTip) { openTip.pop.hidden = true; openTip.btn.setAttribute('aria-expanded', 'false'); openTip = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeTip(); });
  document.addEventListener('click', function (e) { if (openTip && !openTip.wrap.contains(e.target)) closeTip(); });
  D.tip = function (label, content, opts) {
    opts = opts || {};
    var id = 'tip' + (++tipId);
    var paras = Array.isArray(content) ? content : [content];
    var pop = D.h('span', { class: 'tooltip' + (opts.right ? ' right' : ''), role: 'tooltip', id: id, hidden: true }, paras.map(function (t, i) { return D.h('p', null, t); }));
    var btn = D.h('button', { type: 'button', class: 'info', 'aria-label': label, 'aria-expanded': 'false', 'aria-describedby': id }, 'i');
    var wrap = D.h('span', { class: 'info-wrap' }, btn, pop);
    var state = { wrap: wrap, btn: btn, pop: pop };
    function open() {
      if (openTip && openTip !== state) closeTip();
      pop.hidden = false; btn.setAttribute('aria-expanded', 'true'); openTip = state;
      var r = btn.getBoundingClientRect();
      pop.classList.toggle('up', r.bottom > window.innerHeight - 180 && r.top > 200);
    }
    function close() { if (openTip === state) closeTip(); }
    btn.addEventListener('mouseenter', open); btn.addEventListener('mouseleave', close);
    btn.addEventListener('focus', open); btn.addEventListener('blur', close);
    btn.addEventListener('click', function (e) { e.stopPropagation(); if (openTip === state && btn.dataset.pinned === '1') { btn.dataset.pinned = ''; close(); } else { btn.dataset.pinned = '1'; open(); } });
    return wrap;
  };

  // ---- URL hash state: #a=1&b=two ----
  D.parseHash = function () {
    var p = {};
    (location.hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* ignore a malformed value */ } }
    });
    return p;
  };
  D.hashOf = function (o) { return '#' + Object.keys(o).filter(function (k) { return o[k] != null && o[k] !== ''; }).map(function (k) { return k + '=' + encodeURIComponent(o[k]); }).join('&'); };

  // ---- CSV: a cell with a comma, quote or newline is quoted; null stays empty, never zero ----
  D.csvCell = function (v) { if (v == null) return ''; var s = String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  D.csv = function (rows) { return rows.map(function (r) { return r.map(D.csvCell).join(','); }).join('\r\n') + '\r\n'; };
  D.download = function (name, text) {
    var url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };
  D.copy = function (text, button, done, idle) {
    function flash() { button.textContent = done; clearTimeout(button._t); button._t = setTimeout(function () { button.textContent = idle; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(flash, function () { window.prompt('Copy this link', text); });
    else window.prompt('Copy this link', text);
  };

  // ---- the data every page shares ----
  D.data = function () { return window.DSO_DATA; };
  D.rampVars = ['var(--r0)', 'var(--r1)', 'var(--r2)', 'var(--r3)', 'var(--r4)'];
  // Five rank bands, highest first = darkest. Districts with no figure are not ranked.
  D.bands = function (rows) {
    var n = rows.length, out = {};
    rows.forEach(function (r, i) { out[r.name] = 4 - Math.floor(i * 5 / Math.max(n, 1)); });
    return out;
  };
  // Sparkline over [year, value] points: the same 260 x 72 box on every card.
  D.spark = function (pts) {
    var vs = pts.map(function (p) { return p[1]; }), mx = Math.max.apply(null, vs), mn = Math.min.apply(null, vs) * 0.85, W = 260, H = 64, top = 6;
    var xy = pts.map(function (p, i) { return [Math.round(i / Math.max(pts.length - 1, 1) * (W - 8) + 4), Math.round(top + (1 - (p[1] - mn) / (mx - mn || 1)) * (H - top))]; });
    var line = xy.map(function (p) { return p.join(','); }).join(' ');
    return { line: line, area: xy[0][0] + ',70 ' + line + ' ' + xy[xy.length - 1][0] + ',70', lx: xy[xy.length - 1][0], ly: xy[xy.length - 1][1] };
  };
})();
