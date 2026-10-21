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

  // ---- a minimal ZIP writer (stored, no compression) for the evidence pack: files = [{ name, text }] ----
  var crcTable = null;
  function crc32(bytes) {
    if (!crcTable) { crcTable = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  D.zip = function (files) {
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    var dosTime = 0, dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var local = [].concat([0x50, 0x4b, 3, 4], u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(local), name, data);
      central.push({ name: name, crc: crc, size: data.length, offset: offset });
      offset += local.length + name.length + data.length;
    });
    var cdStart = offset, cdSize = 0;
    central.forEach(function (e) {
      var rec = [].concat([0x50, 0x4b, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime), u16(dosDate), u32(e.crc), u32(e.size), u32(e.size), u16(e.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.offset));
      parts.push(new Uint8Array(rec), e.name); cdSize += rec.length + e.name.length;
    });
    parts.push(new Uint8Array([].concat([0x50, 0x4b, 5, 6], u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0))));
    return new Blob(parts, { type: 'application/zip' });
  };
  D.downloadBlob = function (name, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  };
  D.crc32 = crc32;

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
