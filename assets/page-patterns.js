/* Trends and patterns: registered crime over time with its comparison states, where district crime rates are higher, and the places and roads
   the annual crash-prone-zone lists keep naming. Describes what is reported or listed; it does not explain it. Reads DSO_PATTERNS. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h, PT = window.DSO_PATTERNS;
  if (!PT) return;
  var st = { measure: 'totalIPC' };

  // ---------- crime over time ----------
  var MEASURES = [['totalIPC', 'All IPC/BNS'], ['theft', 'Theft'], ['crimeAgainstWomen', 'Crimes against women']];
  function crimeChart(key) {
    var S = PT.crime.series[key], years = PT.crime.years, vals = S.values;
    var W = 640, H = 260, L = 70, R = 14, T = 14, B = 30;
    var max = Math.max.apply(null, vals.filter(function (v) { return v != null; })) * 1.08;
    var x = function (i) { return L + i / (years.length - 1) * (W - L - R); }, y = function (v) { return T + (1 - v / max) * (H - T - B); };
    var svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': S.label + ' by year, with comparison states', style: 'width:100%;height:auto;display:block' });
    [0, 0.5, 1].forEach(function (f) {
      var v = max / 1.08 * f;
      svg.appendChild(h('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
      svg.appendChild(h('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', style: 'font:11px var(--mono);fill:var(--ink3)' }, D.n(v)));
    });
    years.forEach(function (yr, i) {
      if (i % 2 === 0 || i === years.length - 1) svg.appendChild(h('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', style: 'font:11px var(--mono);fill:var(--ink3)' }, String(yr)));
    });
    S.pairs.forEach(function (p, i) {
      var a = vals[i], b = vals[i + 1];
      if (a == null || b == null || p.state === 'not_comparable' || p.state === 'unavailable') return;
      svg.appendChild(h('line', { x1: x(i), y1: y(a), x2: x(i + 1), y2: y(b), stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-dasharray': p.state === 'caution' ? '5 4' : null }));
    });
    vals.forEach(function (v, i) {
      if (v == null) return;
      svg.appendChild(h('circle', { cx: x(i), cy: y(v), r: 3.6, fill: 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2 }, h('title', null, years[i] + ': ' + D.n(v))));
    });
    return svg;
  }
  function stateWord(s) { return { comparable: 'comparable', caution: 'compare with caution', not_comparable: 'not comparable', unavailable: 'no figure' }[s]; }
  function renderCrime() {
    var sec = D.clear(D.$('#ptCrime')), S = PT.crime.series[st.measure], F = PT.crime.facts;
    sec.appendChild(h('div', { class: 'row-between' }, h('div', { class: 'title-row' }, h('h2', null, 'Registered crime in Delhi, 2011 to 2024'),
      D.tip('About this chart', 'Delhi-wide totals as printed by NCRB, not a sum of districts. Solid line: the two years can be compared. Dashed: compare with caution. A gap: the two years cannot be compared, or a figure is not collected yet. The rules come from data/continuity.json, the same file the other pages use. These are cases registered with the police, so they also reflect how readily people report and how the police register.')),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Measure' }, MEASURES.map(function (m) {
        return h('button', { type: 'button', 'aria-pressed': String(st.measure === m[0]), onclick: function () { st.measure = m[0]; renderCrime(); } }, m[1]);
      }))));
    sec.appendChild(crimeChart(st.measure));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, S.label + ' (counts). Solid line: comparable years. Dashed: compare with caution. Gap: not comparable or no figure.'));
    var plain = h('details', { class: 'plain' }, h('summary', null, 'Show annual counts and what each step can be compared on'),
      h('div', { class: 'overflow', style: 'margin-top:10px' }, h('table', { class: 'tbl', style: 'min-width:420px' },
        h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Year'), h('th', { scope: 'col', class: 'n' }, 'Count'), h('th', { scope: 'col' }, 'Compared with the year before'))),
        h('tbody', null, PT.crime.years.map(function (yr, i) {
          var p = i ? S.pairs[i - 1] : null;
          return h('tr', null, h('td', null, yr), h('td', { class: 'n' }, S.values[i] == null ? '—' : D.n(S.values[i])), h('td', { class: 'muted', style: 'font-size:13px' }, p ? stateWord(p.state) + (p.reason ? ': ' + p.reason : '') : ''));
        })))));
    sec.appendChild(plain);
    sec.appendChild(h('div', { class: 'callout warn pl-cau' }, h('ul', { class: 'why-list' },
      h('li', null, 'All registered IPC/BNS cases rose from ' + D.n(F.ipc2016) + ' in 2016 to ' + D.n(F.ipc2019) + ' in 2019, fell to ' + D.n(F.ipc2020) + ' in 2020 (pandemic restrictions), and reached ' + D.n(F.ipc2023) + ' in 2023.'),
      h('li', null, '2024 reads ' + D.n(F.ipc2024) + '. That is not a fall in crime: the Bharatiya Nyaya Sanhita replaced the IPC on 1 July 2024, so 2023 to 2024 is compare-with-caution.'),
      h('li', null, 'The 2013 to 2014 step is not comparable (NCRB changed its reporting format), so the 2011 to 2013 and 2014 onward lines are not joined.'),
      h('li', null, 'Theft is about ' + F.theftShare2023 + '% of registered cases in 2023. Delhi-wide theft for 2016 to 2020 has not been extracted yet, so that line has a gap, not zeros.'),
      h('li', null, 'Crimes against women were ' + D.n(F.women2016) + ' in 2016 and ' + D.n(F.women2024) + ' in 2024, with a dip to ' + D.n(F.women2020) + ' in 2020. How readily these cases are reported and registered matters a great deal here, so a change may not be a change in what happens.'))));
  }

  // ---------- districts ----------
  function bars(rows, valueKey, labelKey, extra) {
    var max = Math.max.apply(null, rows.map(function (r) { return r[valueKey]; }));
    return h('div', { class: 'pt-bars' }, rows.map(function (r) {
      return h('div', { class: 'pt-row' }, h('span', { class: 'pt-l' }, r[labelKey]), h('span', { class: 'pt-b' }, h('i', { style: 'width:' + Math.max(2, r[valueKey] / max * 100) + '%' })), h('span', { class: 'pt-v' }, D.n(r[valueKey]) + (extra ? extra(r) : '')));
    }));
  }
  function renderDistricts() {
    var sec = D.clear(D.$('#ptDistricts')), Dd = PT.districts;
    sec.appendChild(h('div', { class: 'title-row' }, h('h2', null, 'Where registered crime is higher, ' + Dd.year),
      D.tip('About this ranking', 'Registered IPC/BNS cases per 1 lakh residents, by Delhi Police district. ' + Dd.populationNote + ' A district with many visitors, markets or transport hubs can rank high on this measure without having more crime per person present.')));
    sec.appendChild(bars(Dd.ranked, 'perLakh', 'district', function (r) { return ' per lakh · ' + D.n(r.count) + ' cases'; }));
    sec.appendChild(h('h3', { style: 'margin-top:8px' }, 'Does anything mapped line up with it?'));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:14px' }, 'Rank correlation (Spearman) between each district\'s crime rate and a mapped density, across the 15 districts. With 15 districts a value between about −0.5 and +0.5 cannot be told apart from chance.'));
    sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:420px' },
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Compared with crime per lakh'), h('th', { scope: 'col', class: 'n' }, 'Districts'), h('th', { scope: 'col', class: 'n' }, 'Rank correlation'))),
      h('tbody', null, Dd.correlations.map(function (c) { return h('tr', null, h('td', null, c.label), h('td', { class: 'n' }, c.n), h('td', { class: 'n' }, (c.rho > 0 ? '+' : c.rho < 0 ? '−' : '') + Math.abs(c.rho).toFixed(2))); })))));
    sec.appendChild(h('div', { class: 'callout warn pl-cau' }, h('ul', { class: 'why-list' },
      h('li', null, 'None of these lines up with the crime rate at a level that is distinguishable from chance. This data does not show that any of them drives crime.'),
      h('li', null, 'The likelier reasons are not in this data: daytime population (for example, Central and North have old markets and large transport hubs, so more people are present than live there), how crimes are reported and registered in each district, and how district boundaries are drawn.'),
      h('li', null, 'Testing them would need police-station or ward crime counts, footfall or commuter data, and registration practice. District totals for 15 units cannot settle it.'))));
  }

  // ---------- roads ----------
  function renderRoads() {
    var sec = D.clear(D.$('#ptRoads')), Rd = PT.roads, A = Rd.areas2024;
    sec.appendChild(h('div', { class: 'title-row' }, h('h2', null, 'Places and roads that keep appearing in the crash reports'),
      D.tip('About these lists', 'The Traffic Police report names crash-prone zones every year, and the list changes every year. A place counts here when the same printed name appears in several of the nine lists (2016 to 2024; names matched after ignoring case and punctuation, plus 12 reviewed spelling pairs). A repeated name does not prove an identical footprint, and the lists show where crashes are counted within selected zones, not why.')));
    sec.appendChild(h('p', null, Rd.placesInFiveOrMoreLists + ' of ' + Rd.totalPlaces + ' named places appear in five or more of the nine lists; ' + Rd.placesInSevenOrMoreLists + ' appear in seven or more. By the road printed beside them:'));
    sec.appendChild(bars(Rd.byRoad, 'places', 'road', function () { return ' places'; }));
    sec.appendChild(h('div', { class: 'kpis', style: 'margin-top:6px' },
      h('div', { class: 'kpi' }, h('h3', null, D.n(Rd.fatal2023.top3) + ' of ' + D.n(Rd.fatal2023.total)), h('span', { class: 'period' }, 'fatal crashes in the 2023 zone list were on Ring Road, Outer Ring Road or GTK Road (' + Rd.fatal2023.byRoad.map(function (r) { return r.road + ' ' + r.fatal; }).join(', ') + ').')),
      h('div', { class: 'kpi' }, h('h3', null, A.tier1or2 + ' of ' + A.zones), h('span', { class: 'period' }, 'named 2024 zones are in evidence tiers 1 and 2 and hold ' + D.n(A.fatalTier1or2) + ' of the ' + D.n(A.fatalAll) + ' fatal crashes counted in the 2024 zones.')),
      h('div', { class: 'kpi' }, h('h3', null, A.pedestrianZones + ' zones'), h('span', { class: 'period' }, 'are pedestrian crash-prone in 2024, with ' + A.pedestrianFatal + ' pedestrian fatal crashes counted in them.'))));
    sec.appendChild(h('div', { class: 'callout warn pl-cau' }, h('ul', { class: 'why-list' },
      h('li', null, 'These are major arterial roads, so they may simply carry far more traffic than other roads; the reports give no traffic volumes, speeds or crash causes. This shows where to look first, not why.'),
      h('li', null, 'For ' + A.sparselyMapped + ' of the ' + A.zones + ' named 2024 zones nothing is mapped nearby (no crossing or signal within 250 m, little footway). That can mean the area is unmapped.'),
      h('li', null, 'Zone positions are hand-placed (150 m to 5 km), and counts are within each year\'s selected zones, not all crashes.'))));
    sec.appendChild(h('p', null, h('a', { href: 'planning.html' }, 'Open Planning mode'), ' to see these areas by ward with their evidence packs, or ', h('a', { href: 'planner-brief.html' }, 'read the one-page planner brief'), '.'));
  }

  // ---------- what tends to help ----------
  function renderHelp() {
    var sec = D.clear(D.$('#ptHelp'));
    sec.appendChild(h('div', { class: 'title-row' }, h('h2', null, 'What tends to help, and how to check'),
      D.tip('About this section', 'General road-safety practice (the "Safe System" approach used in international guidance). It is not derived from this data and nothing here shows any measure would work at a given place in Delhi.')));
    sec.appendChild(h('p', { class: 'muted' }, 'General practice, not a finding from this data.'));
    sec.appendChild(h('ol', { class: 'why-list', style: 'list-style:decimal' },
      h('li', null, 'Audit the highest-evidence areas on the ground first, with the Traffic Police: positions, crossings, speeds, lighting, sight lines, informal crossings.'),
      h('li', null, 'On fast arterial roads, give pedestrians safe crossings where they actually cross (signalised or grade-separated, with fencing so people use them) and manage speed through design as well as enforcement.'),
      h('li', null, 'Redesign problem junctions and the placement of bus stops and crossings; check street lighting.'),
      h('li', null, 'Protect two-wheeler riders (helmets, safer turning and merging) and manage heavy vehicles at peak times.'),
      h('li', null, 'Measure before and after at the same locations. The zone lists change every year, so a changing count in the reports does not show whether a measure worked.')));
  }

  renderCrime(); renderDistricts(); renderRoads(); renderHelp();
})();
