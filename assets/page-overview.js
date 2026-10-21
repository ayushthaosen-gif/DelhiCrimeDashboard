/* Overview: headline figures, two district maps, topic cards with citywide sparklines. Reads window.DSO_DATA. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h, n = D.n;
  var data = D.data();
  if (!data) return;
  var ds = data.DELHI.districts, S = data.SITE, T = S.trends, V = S.victims;
  var last = T[T.length - 1], prev = T[T.length - 2];

  function sum(key, y) { return ds.reduce(function (a, d) { return a + (d.s[key][y] || 0); }, 0); }
  function change(cur, before, label) {
    var d = cur - before, p = d / before * 100, up = d > 0;
    return {
      arrow: d === 0 ? '→' : up ? '▲' : '▼',
      badge: n(Math.abs(d)) + ' (' + Math.abs(p).toFixed(1) + '%)',
      sentence: d === 0 ? 'No change compared with ' + label + '.' : 'There has been ' + (up ? 'an increase' : 'a decrease') + ' of ' + n(Math.abs(d)) + ' (' + Math.abs(p).toFixed(1) + '%) compared with ' + label + '.'
    };
  }
  // The comparison engine says whether 2023 and 2024 may be joined; a caution is shown in words, never hidden.
  function caution(key) {
    var c = data.compareYears(data.CONTINUITY, key, 2023, 2024);
    return c.state === 'caution' ? 'Compare with caution: ' + c.reasons.join(' ') : '';
  }

  // ---- headline figures ----
  var kpis = [
    { label: 'IPC/BNS cases registered', cur: sum('totalIPC', 2024), before: sum('totalIPC', 2023), caution: caution('totalIPC'),
      note: 'Summed across the 15 police districts. Registered cases depend on reporting and registration as well as on crime.', href: 'explore.html#topic=crime&metric=totalIPC&year=2024', cta: 'All IPC/BNS crime by district' },
    { label: 'Theft cases registered', cur: sum('theft', 2024), before: sum('theft', 2023), caution: caution('theft'),
      note: 'NCRB district-wise tables, summed across the 15 police districts.', href: 'explore.html#topic=crime&metric=theft&year=2024', cta: 'Theft by district' },
    { label: 'People killed in road crashes', cur: last.killed, before: prev.killed, caution: '',
      note: 'Delhi Traffic Police citywide counts. Counts, not rates: not adjusted for population or traffic.', href: 'road-safety.html#trend', cta: 'Road deaths since 2011' },
    { label: 'Pedestrians killed', cur: V[2024].pedestrian, before: V[2023].pedestrian, caution: '',
      note: 'Pedestrians were ' + Math.round(V[2024].pedestrian / V[2024].total * 100) + '% of all road deaths in 2024. Citywide only.', href: 'road-safety.html#modes', cta: 'Road deaths by mode of travel' }
  ];
  var kpiBox = D.clear(D.$('#kpis'));
  kpis.forEach(function (k) {
    var c = change(k.cur, k.before, '2023');
    kpiBox.appendChild(h('article', { class: 'kpi' },
      h('div', { class: 'top' }, h('h3', null, k.label), D.tip('About this figure', k.note, { right: true })),
      h('span', { class: 'period' }, 'Calendar year 2024'),
      h('span', { class: 'value' }, n(k.cur)),
      h('span', { class: 'badge' }, c.arrow + ' ' + c.badge),
      h('p', null, c.sentence),
      k.caution ? h('p', { class: 'caution' }, k.caution) : null,
      h('a', { href: k.href }, k.cta)));
  });

  // ---- districts at a glance ----
  var vb = (function () {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    ds.forEach(function (d) { var m = d.path.match(/-?\d+(?:\.\d+)?/g).map(Number); for (var i = 0; i < m.length; i += 2) { x0 = Math.min(x0, m[i]); x1 = Math.max(x1, m[i]); y0 = Math.min(y0, m[i + 1]); y1 = Math.max(y1, m[i + 1]); } });
    return (x0 - 8) + ' ' + (y0 - 8) + ' ' + (x1 - x0 + 16) + ' ' + (y1 - y0 + 16);
  })();
  function tile(title, sub, fn, href, fmt) {
    var rk = ds.map(function (d) { return { name: d.name, d: d, v: fn(d) }; }).filter(function (r) { return r.v != null; }).sort(function (a, b) { return b.v - a.v; });
    var bin = D.bands(rk);
    return h('a', { class: 'tile', href: href, 'aria-label': title + '. ' + sub },
      h('div', { class: 'head' }, h('b', null, title), h('span', null, sub)),
      h('svg', { viewBox: vb, 'aria-hidden': 'true' }, ds.map(function (d) { return h('path', { d: d.path, style: 'fill:' + (bin[d.name] == null ? 'var(--surface2)' : D.rampVars[bin[d.name]]) }); })),
      h('ol', null, rk.slice(0, 5).map(function (r) {
        return h('li', null, h('span', { class: 'n' }, h('i', { style: 'background:' + D.rampVars[bin[r.name]] }), h('span', null, r.name)), h('span', { class: 'v' }, fmt(r.v)));
      })));
  }
  var tiles = D.clear(D.$('#tiles'));
  tiles.appendChild(tile('Theft rate by district', 'Cases per 1 lakh residents, 2024 · top 5', function (d) { return d.s.theft[2024] == null ? null : d.s.theft[2024] / d.pop * 1e5; }, 'explore.html#topic=crime&metric=theft&year=2024&calc=pop', n));
  tiles.appendChild(tile('Road deaths by district', 'Persons killed, 2024 · top 5', function (d) { return d.s.personsKilled[2024]; }, 'explore.html#topic=road&metric=personsKilled&year=2024', n));

  // ---- topics: citywide totals over time. A sparkline joins only the years the data can honestly join. ----
  function crimeCard(key, title, desc) {
    // years in which every district that exists has a figure, and which are not cut by a documented break for the whole city
    var years = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].filter(function (y) { return ds.every(function (d) { return d.s[key][y] != null; }); });
    var seg = data.segmentOf(data.CONTINUITY, key, years[years.length - 1]);
    years = years.filter(function (y) { return y >= seg[0] && y <= seg[1]; });
    return { title: title, sub: 'Registered cases by year', desc: desc, note: 'Shows ' + years[0] + ' onward, the years that share the same districts and definitions. Earlier years are not joined to them.', pts: years.map(function (y) { return [y, sum(key, y)]; }), href: 'explore.html#topic=crime&metric=' + key + '&year=2024' };
  }
  function roadCard(title, sub, pts, desc, href) { return { title: title, sub: sub, desc: desc, pts: pts, href: href }; }
  var groups = [
    { title: 'Crime', cards: [
      crimeCard('theft', 'Theft', 'Annual theft cases across Delhi\'s police districts.'),
      crimeCard('robbery', 'Robbery', 'Annual robbery cases across Delhi\'s police districts.'),
      crimeCard('burglary', 'Burglary', 'Annual burglary cases across the 15 police districts.'),
      crimeCard('totalIPC', 'All IPC/BNS crime', 'All cognisable crime under the IPC, and the BNS from July 2024.'),
      crimeCard('crimeAgainstWomen', 'Crime against women', 'Crimes against women, from NCRB district-wise tables.'),
      crimeCard('totalSLL', 'Special & local laws', 'Cases under laws such as the Arms Act, NDPS Act and Excise Act.')
    ] },
    { title: 'Road safety', cards: [
      roadCard('Road deaths', 'Persons killed by year', T.map(function (r) { return [r.year, r.killed]; }), 'People killed in road crashes in Delhi, citywide.', 'road-safety.html#trend'),
      roadCard('Road crashes', 'All recorded crashes by year', T.map(function (r) { return [r.year, r.crashes]; }), 'Every road crash recorded by Delhi Traffic Police.', 'road-safety.html#trend'),
      roadCard('Pedestrian deaths', 'Pedestrians killed by year', Object.keys(V).map(function (y) { return [+y, V[y].pedestrian]; }), 'Pedestrians are unprotected road users; their deaths are tracked separately.', 'road-safety.html#modes')
    ] }
  ];
  var box = D.clear(D.$('#topicGroups'));
  groups.forEach(function (g) {
    box.appendChild(h('div', { class: 'topic-group' }, h('h3', null, g.title), h('div', { class: 'topic-cards' }, g.cards.map(function (c) {
      var s = D.spark(c.pts), first = c.pts[0], end = c.pts[c.pts.length - 1];
      return h('article', { class: 'topic-card' },
        h('h4', null, c.title), h('span', { class: 'sub' }, c.sub),
        h('svg', { viewBox: '0 0 260 72', role: 'img', 'aria-label': c.title + ', ' + first[0] + ' to ' + end[0] + ': ' + n(first[1]) + ' to ' + n(end[1]) },
          h('line', { class: 'axis', x1: 0, y1: 70, x2: 260, y2: 70 }),
          h('polygon', { class: 'area', points: s.area }), h('polyline', { class: 'line', points: s.line }),
          h('circle', { class: 'dot', cx: s.lx, cy: s.ly, r: 4 })),
        h('div', { class: 'ends' }, h('span', null, first[0]), h('span', null, end[0] + ': ' + n(end[1]))),
        h('p', null, c.desc),
        c.note ? h('p', { class: 'note' }, c.note + ' ', h('a', { href: 'data-methods.html#geography' }, 'Why?')) : null,
        h('a', { href: c.href }, 'Visit ' + c.title + ' to find out more'));
    }))));
  });
})();
