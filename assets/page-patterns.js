/* Trends and patterns: registered crime over time with its comparison states, where district crime rates are higher, and the places and roads
   the annual crash-prone-zone lists keep naming. Describes what is reported or listed; it does not explain it. Reads DSO_PATTERNS. */
(function () {
  'use strict';
  var D = window.DSO, h = D.h, PT = window.DSO_PATTERNS;
  if (!PT) return;
  var B = PT.crime.bnsHurt;
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
      h('li', null, '2024 reads ' + D.n(F.ipc2024) + ', lower than 2023, but this data cannot show whether that is a real fall. The Bharatiya Nyaya Sanhita replaced the IPC on 1 July 2024, so 2023 to 2024 is compare-with-caution.'),
      h('li', null, 'Hurt is counted under different heads: the 2023 table\'s head is "Hurt" and the 2024 head "Hurt or Grievous Hurt", so the two are not a like-for-like count. Press reports of the NCRB 2024 report give a national fall in hurt cases (about ' + D.n(B.national.hurtCases2023 / 1e5 * 100) / 100 + ' lakh to ' + D.n(B.national.hurtCases2024 / 1e5 * 100) / 100 + ' lakh, ' + Math.abs(B.national.hurtChangePct) + '%; rounded, not checked against the NCRB report here) and attribute it to the BNS, but the mechanism is not confirmed: simple hurt was already non-cognisable under IPC section 323 and is under BNS section 115(2), so a new change of cognisability is not supported. In Delhi the hurt head fell from ' + D.n(B.delhi.hurt2023) + ' to ' + D.n(B.delhi.hurt2024) + ' (' + Math.abs(B.delhi.hurtChangePct) + '%), about ' + Math.round(B.delhi.hurtShareOfTotalFallPct) + '% of Delhi\'s fall of ' + D.n(-B.delhi.totalChange) + '. Theft fell by ' + D.n(-B.delhi.theftChange) + ', about ' + Math.round(B.delhi.theftShareOfTotalFallPct) + '% of the fall, and the hurt change does not cover theft.'),
      h('li', null, 'Every district fell, so a change in how cases are registered or classified is one explanation, a real fall is another, and the data cannot separate them. Monthly registrations around July 2024, Delhi Police\'s own 2024 figures and the 2025 data would help.'),
      h('li', null, 'The 2013 to 2014 step is not comparable (NCRB changed its reporting format), so the 2011 to 2013 and 2014 onward lines are not joined.'),
      h('li', null, 'Theft is about ' + F.theftShare2023 + '% of registered cases in 2023. Delhi-wide theft for 2016 to 2020 comes from a different NCRB table in each year and the 2016 and 2017 headings differ (Sec 379 to 382 and Sec 379), so those steps carry a caution.'),
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
    sec.appendChild(h('div', { class: 'callout warn pl-cau' }, h('ul', { class: 'why-list' },
      h('li', null, 'None of these lines up with the crime rate at a level that is distinguishable from chance. This data does not show that any of them drives crime.'),
      h('li', null, 'The likelier reasons are not in this data: daytime population (for example, Central and North have old markets and large transport hubs, so more people are present than live there), how crimes are reported and registered in each district, and how district boundaries are drawn.'),
      h('li', null, 'Testing them would need police-station or ward crime counts, footfall or commuter data, and registration practice. District totals for 15 units cannot settle it.'))));
  }

  // ---------- infrastructure and crime: the matrix ----------
  var MX = PT.matrix, mst = { coeff: 'spearman', mode: 'density', mi: null, ii: null };
  function sgn(v, d) { return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d == null ? 2 : d); }
  function pTxt(p) { return p < 0.001 ? '<0.001' : p.toFixed(3); }
  function cellBadge(c) { return c.q < 0.05 ? '★' : c.p < 0.05 ? '†' : ''; }
  function scatter(c, mname, iname) {
    var W = 560, H = 340, L = 54, R = 16, T = 14, B = 40, xs = c.x, ys = c.y;
    var xmax = Math.max.apply(null, xs) * 1.1 || 1, ymax = Math.max.apply(null, ys) * 1.1 || 1;
    var px = function (v) { return L + v / xmax * (W - L - R); }, py = function (v) { return H - B - v / ymax * (H - T - B); };
    var svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Scatterplot of ' + mname + ' against ' + iname + ' across ' + c.n + ' districts', style: 'width:100%;height:auto;display:block' });
    [0, 0.5, 1].forEach(function (f) {
      svg.appendChild(h('line', { x1: L, x2: W - R, y1: py(ymax / 1.1 * f), y2: py(ymax / 1.1 * f), stroke: 'var(--line)', 'stroke-width': 1 }));
      svg.appendChild(h('text', { x: L - 6, y: py(ymax / 1.1 * f) + 4, 'text-anchor': 'end', style: 'font:11px var(--mono);fill:var(--ink3)' }, D.n(ymax / 1.1 * f)));
    });
    svg.appendChild(h('text', { x: W / 2, y: H - 6, 'text-anchor': 'middle', style: 'font:12px var(--sans);fill:var(--ink3)' }, iname + (mst.mode === 'density' ? ' per km²' : ' per 100k residents') + ' →'));
    var n = xs.length, mx = xs.reduce(function (a, b) { return a + b; }, 0) / n, my = ys.reduce(function (a, b) { return a + b; }, 0) / n, nu = 0, de = 0, i;
    for (i = 0; i < n; i++) { nu += (xs[i] - mx) * (ys[i] - my); de += (xs[i] - mx) * (xs[i] - mx); }
    if (de) { var sl = nu / de, ic = my - sl * mx; svg.appendChild(h('line', { x1: px(0), y1: py(Math.max(0, ic)), x2: px(xmax), y2: py(Math.max(0, ic + sl * xmax)), stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '5 4' })); }
    for (i = 0; i < n; i++) {
      svg.appendChild(h('circle', { cx: px(xs[i]), cy: py(ys[i]), r: 5, fill: 'var(--bar)' }, h('title', null, MX.districts[c.idx[i]] + ': ' + xs[i] + ', ' + ys[i])));
      svg.appendChild(h('text', { x: px(xs[i]) + 7, y: py(ys[i]) + 4, style: 'font:10.5px var(--sans);fill:var(--ink2)' }, MX.districts[c.idx[i]]));
    }
    return svg;
  }
  function renderMatrixDetail(box) {
    D.clear(box);
    if (mst.mi == null) { box.appendChild(h('p', { class: 'muted', style: 'font-size:14px' }, 'Select a cell to see its scatterplot, the districts used and the exact p-value.')); return; }
    var c = MX.modes[mst.mode].cells[mst.mi][mst.ii], k = c[mst.coeff], sym = mst.coeff === 'spearman' ? 'ρ' : 'r';
    var mname = MX.metrics[mst.mi].label, iname = MX.infra[mst.ii].label;
    box.appendChild(h('h3', null, mname + ' against ' + iname));
    box.appendChild(h('div', { class: 'overflow' }, scatter(c, mname, iname)));
    box.appendChild(h('ul', { class: 'why-list' },
      h('li', null, sym + ' = ' + sgn(k.r, 3) + ' over ' + c.n + ' districts (t = ' + k.t.toFixed(2) + ', ' + k.df + ' degrees of freedom).'),
      h('li', null, 'Exact two-tailed p = ' + pTxt(k.p) + '. Adjusted for ' + MX.modes[mst.mode].tests + ' tests at once (Benjamini–Hochberg): q = ' + pTxt(k.q) + (k.q < 0.05 ? ', which survives the correction.' : k.p < 0.05 ? ', which does not survive the correction.' : '.')),
      h('li', null, k.partial == null ? 'Too few districts to control for residents per km².' : 'Controlling for residents per km²: ' + sym + ' = ' + sgn(k.partial, 3) + '. With this few districts this is indicative only.'),
      h('li', null, 'The other coefficient: ' + (mst.coeff === 'spearman' ? 'Pearson r' : 'Spearman ρ') + ' = ' + sgn(c[mst.coeff === 'spearman' ? 'pearson' : 'spearman'].r, 3) + '. If the two differ a lot, one or two districts are doing the work.'),
      h('li', null, 'Districts used: ' + c.idx.map(function (i) { return MX.districts[i]; }).join(', ') + '.' + (MX.infra[mst.ii].mapped ? ' This layer is mapped (OpenStreetMap), so a low count can mean unmapped, not absent.' : ''))));
  }
  function renderMatrix() {
    var sec = D.clear(D.$('#ptMatrix')), X = MX.modes[mst.mode], k = mst.coeff;
    sec.appendChild(h('div', { class: 'title-row' }, h('h2', null, 'Infrastructure and recorded crime: associations across districts, ' + MX.year),
      D.tip('How to read this', 'Each cell compares one measure with one infrastructure layer across the Delhi Police districts that have data for both. The coefficient is a rank correlation (Spearman) or a straight-line correlation (Pearson). P-values are exact Student t tests. Because ' + X.tests + ' cells are tested at once, all p-values are adjusted together (Benjamini–Hochberg). ★ survives that adjustment; † is below 0.05 only before it.')));
    sec.appendChild(h('div', { class: 'callout warn pl-cau' }, h('ul', { class: 'why-list' },
      h('li', null, 'These are geographic associations across at most 15 districts. They do not establish causation, and with so many comparisons they are leads to check, not findings.'),
      h('li', null, 'Both sides of each cell are divided by the same thing (district area, or population). That alone can create a correlation: a very small or very large district moves both numbers together. Spearman and the partial value in each cell are the checks on this; the per 100k view is the most exposed (New Delhi has about 142,000 residents).'),
      h('li', null, 'Police posts follow crime and population rather than cause them. Mapped layers (OpenStreetMap) may be incomplete. A district\'s total includes visitors and commuters who are not in its resident count.'))));
    var ctr = h('div', { style: 'display:flex;gap:14px;flex-wrap:wrap;margin:12px 0' },
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Correlation type' },
        [['spearman', 'Rank (Spearman ρ)'], ['pearson', 'Straight-line (Pearson r)']].map(function (o) { return h('button', { type: 'button', 'aria-pressed': k === o[0] ? 'true' : 'false', onclick: function () { mst.coeff = o[0]; renderMatrix(); } }, o[1]); })),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Basis' },
        [['density', 'Per km²'], ['perCapita', 'Per 100k residents']].map(function (o) { return h('button', { type: 'button', 'aria-pressed': mst.mode === o[0] ? 'true' : 'false', onclick: function () { mst.mode = o[0]; renderMatrix(); } }, o[1]); })));
    sec.appendChild(ctr);
    var head = h('tr', null, h('th', { scope: 'col', style: 'text-align:left' }, 'Measure'), MX.infra.map(function (i) { return h('th', { scope: 'col' }, i.label); }));
    var lastGroup = null, rows = [];
    MX.metrics.forEach(function (m, mi) {
      if (m.group !== lastGroup) { rows.push(h('tr', { class: 'cm-group' }, h('th', { scope: 'rowgroup', colspan: MX.infra.length + 1, style: 'text-align:left' }, m.group))); lastGroup = m.group; }
      rows.push(h('tr', null, h('th', { scope: 'row', style: 'text-align:left;font-weight:500' }, m.label), MX.infra.map(function (inf, ii) {
        var c = X.cells[mi][ii], s = c[k];
        if (!s) return h('td', { class: 'n' }, 'n/a');
        var on = mst.mi === mi && mst.ii === ii, strong = Math.abs(s.r) >= 0.4;
        return h('td', { class: 'n' }, h('button', { type: 'button', class: 'cm-cell' + (strong ? ' cm-strong' : '') + (on ? ' cm-on' : ''), 'aria-label': m.label + ' against ' + inf.label + ': ' + (k === 'spearman' ? 'rho ' : 'r ') + s.r.toFixed(2) + ', ' + c.n + ' districts, p ' + pTxt(s.p) + (s.q < 0.05 ? ', survives correction' : '') + '. Open scatterplot', onclick: function () { mst.mi = mi; mst.ii = ii; renderMatrix(); var d = D.$('#cmDetail'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, sgn(s.r) + (cellBadge(s) ? ' ' + cellBadge(s) : '')));
      })));
    });
    sec.appendChild(h('div', { class: 'overflow' }, h('table', { class: 'tbl', style: 'min-width:760px' }, h('thead', null, head), h('tbody', null, rows))));
    sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Of ' + X.tests + ' cells, ' + X.raw[k] + ' are below p = 0.05 before adjustment (†) and ' + X.adjusted[k] + ' after it (★). Cells share districts and measures, so they are not independent tests. With 15 districts, a value between about −0.5 and +0.5 cannot be told apart from chance. Blank metrics for a district are left out, not counted as zero; the streetlight and underpass layers cover 9 of 15 districts.'));
    var box = h('div', { id: 'cmDetail', class: 'cm-detail' });
    sec.appendChild(box);
    renderMatrixDetail(box);
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

  // ---------- change between two years, only where the pair can be compared ----------
  var CD = D.data(), CONT = CD && CD.CONTINUITY, VM = CD ? Object.assign({}, CD.SITE.victimsEarly, CD.SITE.victims) : {};
  function mapOf(list, yk, vk) { var o = {}; list.forEach(function (r) { if (r[vk] != null) o[r[yk]] = r[vk]; }); return o; }
  function catalogue() {
    var G = [];
    G.push({ g: 'Crime, Delhi as a whole (printed totals)', items: ['totalIPC', 'theft', 'crimeAgainstWomen'].map(function (k) {
      var S = PT.crime.series[k], v = {}; PT.crime.years.forEach(function (y, i) { if (S.values[i] != null) v[y] = S.values[i]; });
      return { id: 'c-' + k, label: S.label, unit: 'registered cases', spec: { kind: 'crime', key: k, scope: CONT.utSeries.scopeName, values: v } };
    }) });
    G.push({ g: 'Road, Delhi as a whole', items: [['crashes', 'Road crashes'], ['fatalCrashes', 'Fatal crashes'], ['killed', 'Persons killed']].map(function (m) {
      return { id: 't-' + m[0], label: m[1], unit: m[0] === 'killed' ? 'persons killed' : m[0] === 'fatalCrashes' ? 'fatal crashes' : 'crashes', spec: { kind: 'trend', key: m[0], values: mapOf(CD.SITE.trends, 'year', m[0]) } };
    }) });
    G.push({ g: 'Persons killed by mode of travel', items: [['pedestrian', 'Pedestrians'], ['twoWheeler', 'Two-wheeler riders'], ['cyclist', 'Cyclists'], ['car', 'Car occupants'], ['bus', 'Bus passengers'], ['slowMoving', 'Slow-moving vehicles'], ['other', 'Other'], ['total', 'All persons killed']].map(function (m) {
      var v = {}; Object.keys(VM).forEach(function (y) { if (VM[y][m[0]] != null) v[y] = VM[y][m[0]]; });
      return { id: 'm-' + m[0], label: m[1], unit: 'persons killed', spec: { kind: 'mode', key: m[0], values: v } };
    }) });
    return G;
  }
  var CAT = CD && CONT ? catalogue() : [], cs = { id: 'c-totalIPC', a: 2016, b: 2023 };
  function findItem(id) { var f = null; CAT.forEach(function (g) { g.items.forEach(function (i) { if (i.id === id) f = i; }); }); return f; }
  function yearsOfItem(it) { return Object.keys(it.spec.values).map(Number).sort(function (a, b) { return a - b; }); }
  function sign(v) { return v > 0 ? '+' : v < 0 ? '−' : '±'; }
  function stateWord2(s) { return { comparable: 'Comparable', caution: 'Compare with caution', not_comparable: 'Not comparable', unavailable: 'No figure' }[s]; }
  function miniChart(it, view) {
    var ys = yearsOfItem(it).filter(function (y) { return y >= view.from && y <= view.to; });
    var W = 640, H = 200, L = 70, Rr = 14, T = 12, B = 26, vals = ys.map(function (y) { return it.spec.values[y]; }), max = Math.max.apply(null, vals) * 1.08 || 1;
    var x = function (y) { return L + (view.to === view.from ? 0.5 : (y - view.from) / (view.to - view.from)) * (W - L - Rr); }, yy = function (v) { return T + (1 - v / max) * (H - T - B); };
    var svg = h('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': it.label + ' from ' + view.from + ' to ' + view.to, style: 'width:100%;height:auto;display:block' });
    [0, 1].forEach(function (f) { var v = max / 1.08 * f; svg.appendChild(h('line', { x1: L, x2: W - Rr, y1: yy(v), y2: yy(v), stroke: 'var(--line)' })); svg.appendChild(h('text', { x: L - 6, y: yy(v) + 4, 'text-anchor': 'end', style: 'font:11px var(--mono);fill:var(--ink3)' }, D.n(v))); });
    [view.from, view.to].forEach(function (y) { svg.appendChild(h('text', { x: x(y), y: H - 8, 'text-anchor': y === view.from ? 'start' : 'end', style: 'font:11px var(--mono);fill:var(--ink3)' }, String(y))); });
    view.steps.forEach(function (s) {
      var a = it.spec.values[s.from], b = it.spec.values[s.to];
      if (a == null || b == null || s.state === 'not_comparable' || s.state === 'unavailable') return;
      svg.appendChild(h('line', { x1: x(s.from), y1: yy(a), x2: x(s.to), y2: yy(b), stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-dasharray': s.state === 'caution' ? '5 4' : null }));
    });
    ys.forEach(function (y) { svg.appendChild(h('circle', { cx: x(y), cy: yy(it.spec.values[y]), r: y === view.from || y === view.to ? 5 : 3, fill: y === view.from || y === view.to ? 'var(--accent)' : 'var(--surface)', stroke: 'var(--accent)', 'stroke-width': 2 }, h('title', null, y + ': ' + D.n(it.spec.values[y])))); });
    return svg;
  }
  function renderChange() {
    var sec = D.clear(D.$('#ptChange'));
    if (!CAT.length) return;
    var it = findItem(cs.id), ys = yearsOfItem(it);
    if (ys.indexOf(cs.a) < 0) cs.a = ys[0];
    if (ys.indexOf(cs.b) < 0) cs.b = ys[ys.length - 1];
    var v = CD.changeView(CONT, it.spec, cs.a, cs.b);
    var sel = function (label, value, options, fn) { return h('label', null, label, h('select', { 'data-key': 'chg-' + label, onchange: function (e) { fn(e.target.value); } }, options)); };
    sec.appendChild(h('div', { class: 'title-row' }, h('h2', null, 'Change between two years'),
      D.tip('About this view', 'A change figure is made only where the two years can be compared. Compare with caution gives the figure with the reasons beside it. Not comparable keeps both values and gives no change, because a difference could come from a change of definition, source or geography, not from what happened. The rules are the ones in data/continuity.json that the other pages use.')));
    sec.appendChild(h('div', { class: 'checker', style: 'display:flex;flex-wrap:wrap;gap:10px 16px;align-items:end' },
      sel('Series', cs.id, CAT.map(function (g) { return h('optgroup', { label: g.g }, g.items.map(function (i) { return h('option', { value: i.id, selected: i.id === cs.id }, i.label); })); }), function (val) { cs.id = val; renderChange(); }),
      sel('From', cs.a, ys.map(function (y) { return h('option', { value: y, selected: y === cs.a }, y); }), function (val) { cs.a = +val; renderChange(); }),
      sel('To', cs.b, ys.map(function (y) { return h('option', { value: y, selected: y === cs.b }, y); }), function (val) { cs.b = +val; renderChange(); }),
      h('span', { class: 'verdict ' + v.state, role: 'status' }, v.from === v.to ? 'Pick two different years' : stateWord2(v.state))));
    if (v.from !== v.to) {
      var big = v.pct == null ? null : sign(v.pct) + Math.abs(Math.round(v.pct * 10) / 10) + '%';
      sec.appendChild(h('div', { class: 'readout', 'aria-live': 'polite' }, h('span', { class: 'v big' }, big || 'No change figure'),
        h('span', null, it.label + ' · ' + v.from + ': ' + (v.fromValue == null ? '—' : D.n(v.fromValue)) + ' → ' + v.to + ': ' + (v.toValue == null ? '—' : D.n(v.toValue)) + (v.abs != null ? ' (' + sign(v.abs) + D.n(Math.abs(v.abs)) + ' ' + it.unit + ')' : ''))));
      if (v.state !== 'comparable') sec.appendChild(h('div', { class: 'callout warn pl-cau', style: 'font-size:13.5px' }, h('strong', null, v.pct == null ? 'Not turned into a change: ' : 'Read with caution: '), h('ul', { class: 'why-list' }, v.reasons.map(function (r) { return h('li', null, r); }))));
      sec.appendChild(miniChart(it, v));
      var broken = v.steps.filter(function (s) { return s.state !== 'comparable'; });
      if (broken.length) sec.appendChild(h('details', { class: 'plain' }, h('summary', null, broken.length + ' step' + (broken.length > 1 ? 's' : '') + ' between ' + v.from + ' and ' + v.to + ' are not plainly comparable'),
        h('ul', { class: 'why-list' }, broken.map(function (s) { return h('li', null, h('strong', null, s.from + ' to ' + s.to + ' · ' + stateWord2(s.state).toLowerCase() + '. '), s.reason || ''); }))));
      var multi = v.ranges.filter(function (r) { return r.to > r.from; });
      sec.appendChild(h('p', { class: 'muted', style: 'font-size:13px' }, 'Years of this series that can be read together (comparable or with caution): ' + (multi.length ? multi.map(function (r) { return r.from + ' to ' + r.to; }).join('; ') : 'none') + '. Counts, not rates; registered or printed figures, not a measure of risk.'));
    }
  }

  renderCrime(); renderChange(); renderDistricts(); renderMatrix(); renderRoads(); renderHelp();
})();
