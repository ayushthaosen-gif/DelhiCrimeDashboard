// Figures for the "Trends and patterns" page and the planner brief, computed from committed data files. Nothing is typed in.
//
//   crime     Delhi-wide registered crime by year with the comparison state of every adjacent pair (data/continuity.json, Delhi UT scope)
//   districts 2024 registered crime per lakh residents by police district, and rank correlations with mapped infrastructure densities (15 districts)
//   roads     where the nine annual crash-prone-zone lists keep pointing: persistent places by printed road, the 2023 fatal crashes by road,
//             and how concentrated the 2024 areas are
//
// These describe patterns in what is reported or listed. They do not explain them, and no rate is made where the data holds no denominator.

const fs = require('fs');
const path = require('path');
const { compareYears } = require('./continuity');

const ROOT = path.join(__dirname, '..', '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const numOrNull = v => (v === '' || v == null ? null : Number(v));

function utRows() {
  const [head, ...lines] = fs.readFileSync(path.join(ROOT, 'data/releases/delhi_ut_series/delhi_ut_crime.csv'), 'utf8').trim().split(/\r?\n/);
  const cols = head.split(',');
  return lines.map(line => {
    const v = []; let cur = '', q = false;
    for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { v.push(cur); cur = ''; } else cur += ch; }
    v.push(cur);
    const o = {}; cols.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}

function averageRanks(a) {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = rank;
    i = j + 1;
  }
  return r;
}
function spearman(a, b) {
  const ra = averageRanks(a), rb = averageRanks(b), n = a.length, m = (n + 1) / 2;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { s += (ra[i] - m) * (rb[i] - m); sa += (ra[i] - m) ** 2; sb += (rb[i] - m) ** 2; }
  return s / Math.sqrt(sa * sb);
}

const roadKey = r => String(r || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/^G ?T ?K? ?ROAD.*$/, 'GTK ROAD').replace(/^GTK ROAD.*$/, 'GTK ROAD').trim() || 'ROAD NOT PRINTED';
const prettyRoad = { 'RING ROAD': 'Ring Road', 'OUTER RING ROAD': 'Outer Ring Road', 'GTK ROAD': 'GTK Road', 'ROHTAK ROAD': 'Rohtak Road', 'WAZIRABAD ROAD': 'Wazirabad Road', 'NH24': 'NH-24', 'NH8': 'NH-8', 'MATHURA ROAD': 'Mathura Road' };

function build() {
  const c = read('data/continuity.json');
  const ut = utRows();
  const years = ut.map(r => Number(r.year));
  const pair = key => years.slice(0, -1).map((y, i) => { const r = compareYears(c, key, y, years[i + 1], c.utSeries.scopeName); return { from: y, to: years[i + 1], state: r.state, reason: r.reasons[0] || null }; });
  const crime = {
    years,
    series: {
      totalIPC: { label: 'All registered IPC/BNS cases', values: ut.map(r => numOrNull(r.total_ipc_bns)), pairs: pair('totalIPC') },
      theft: { label: 'Theft', values: ut.map(r => numOrNull(r.theft)), pairs: pair('theft') },
      crimeAgainstWomen: { label: 'Crimes against women', values: ut.map(r => numOrNull(r.total_crimes_against_women)), pairs: pair('crimeAgainstWomen') }
    }
  };
  const t = crime.series.totalIPC.values, yi = y => years.indexOf(y);
  crime.facts = {
    ipc2016: t[yi(2016)], ipc2019: t[yi(2019)], ipc2020: t[yi(2020)], ipc2023: t[yi(2023)], ipc2024: t[yi(2024)],
    theftShare2023: Math.round(crime.series.theft.values[yi(2023)] / t[yi(2023)] * 100),
    women2016: crime.series.crimeAgainstWomen.values[yi(2016)], women2024: crime.series.crimeAgainstWomen.values[yi(2024)], women2020: crime.series.crimeAgainstWomen.values[yi(2020)]
  };

  const dist = read('data/dashboard_final.json').districts.filter(d => d.population && d.totalIPC2024 != null);
  const rate = d => d.totalIPC2024 / d.population * 1e5;
  const ranked = dist.map(d => ({ district: d.district || d.name, perLakh: Math.round(rate(d)), theftPerLakh: Math.round(d.theft2024 / d.population * 1e5), count: d.totalIPC2024, population: d.population, popDensity: Math.round(d.population / d.areaSqKm) }))
    .sort((a, b) => b.perLakh - a.perLakh);
  const cov = [
    ['Residents per km²', d => d.population / d.areaSqKm],
    ['Bus stops per km² (mapped)', d => d.busStopDensity],
    ['Metro gates per km² (mapped)', d => d.metroGateDensity],
    ['ATMs per km² (mapped)', d => d.atmDensity],
    ['Liquor shops per km² (mapped)', d => d.alcoholShopDensity],
    ['Police stations per km²', d => d.policeStationDensity],
    ['Surveillance points per km² (mapped)', d => d.surveillanceDensity]
  ];
  const correlations = cov.map(([label, f]) => {
    const ok = dist.filter(d => f(d) != null);
    return { label, n: ok.length, rho: Math.round(spearman(ok.map(rate), ok.map(f)) * 100) / 100 };
  });
  const districts = { year: 2024, ranked, correlations, populationNote: 'Approximate resident population used by this project; excludes daytime visitors and commuters.' };

  const rec = read('data/profiles/recurring_locations.json').places;
  const aud = read('data/profiles/audit_candidates_2024.json').rows;
  const raw23 = read('data/crash_zones_2023_raw.json');
  const persistent = rec.filter(p => p.reports_listed_of_9 >= 5);
  const byRoad = {};
  persistent.forEach(p => { const k = roadKey(p.roads_printed && p.roads_printed[0]); byRoad[k] = (byRoad[k] || 0) + 1; });
  const byRoadList = Object.entries(byRoad).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8).map(([k, n]) => ({ road: prettyRoad[k] || k, places: n }));
  const f23 = {}; let t23 = 0;
  raw23.forEach(z => { const k = roadKey(z.road); f23[k] = (f23[k] || 0) + z.fatal; t23 += z.fatal; });
  const top3 = ['RING ROAD', 'OUTER RING ROAD', 'GTK ROAD'];
  const tier12 = aud.filter(z => z.evidence_tier <= 2), fat = list => list.reduce((a, z) => a + (z.fatal_crashes_2024 || 0), 0);
  const ped = aud.filter(z => z.pedestrian_crash_prone_2024);
  const roads = {
    placesInFiveOrMoreLists: persistent.length, placesInSevenOrMoreLists: rec.filter(p => p.reports_listed_of_9 >= 7).length, totalPlaces: rec.length,
    byRoad: byRoadList,
    fatal2023: { total: t23, top3: top3.reduce((a, k) => a + (f23[k] || 0), 0), byRoad: top3.map(k => ({ road: prettyRoad[k], fatal: f23[k] || 0 })), note: '2023 list of 107 zones; fatal crashes within the zones, not on the whole road.' },
    firstAreas: aud.filter(z => z.evidence_tier === 1).sort((a, b) => b.reports_listed_of_9 - a.reports_listed_of_9 || (b.fatal_crashes_2024 || 0) - (a.fatal_crashes_2024 || 0) || (a.zone < b.zone ? -1 : 1)).slice(0, 8)
      .map(z => ({ zone: z.zone, road: z.road_printed, ward: String(z.ward_name || '').replace(/\s+/g, ' ').trim() || null, lists: z.reports_listed_of_9, fatal2024: z.fatal_crashes_2024, accuracyM: z.position_accuracy_m })),
    areas2024: { zones: aud.length, tier1or2: tier12.length, fatalAll: fat(aud), fatalTier1or2: fat(tier12), pedestrianZones: ped.length, pedestrianFatal: ped.reduce((a, z) => a + (z.pedestrian_fatal_crashes_2024 || 0), 0), sparselyMapped: aud.filter(z => z.sparsely_mapped_surroundings).length }
  };
  return { crime, districts, roads };
}

// One-page planner brief (HTML, printable). Every figure comes from build(); the wording states what the data can and cannot say.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = v => Math.round(v).toLocaleString('en-IN');
function briefBody(p) {
  const A = p.roads.areas2024, F = p.roads.fatal2023, d = p.districts.ranked;
  const rows = p.roads.firstAreas.map(z => '<tr><td>' + esc(z.zone) + '</td><td>' + esc(z.road || '—') + '</td><td>' + esc(z.ward || '—') + '</td><td class="n">' + z.lists + ' of 9</td><td class="n">' + (z.fatal2024 == null ? '—' : z.fatal2024) + '</td><td class="n">' + (z.accuracyM == null ? '—' : '~' + z.accuracyM + ' m') + '</td></tr>').join('');
  return '<main id="main" class="brief">\n'
    + '<p class="muted" style="margin:0"><a href="patterns.html">Trends and patterns</a> · <a href="planning.html">Planning mode</a></p>\n'
    + '<h1>Delhi road safety: where to look first</h1>\n'
    + '<p class="lead">A one-page brief for planners. It points to places the Traffic Police crash reports keep naming, so a field audit can start there. It does not say why a crash happens or what should be built.</p>\n'
    + '<h2>What the reports show</h2>\n<ul>'
    + '<li>' + p.roads.placesInFiveOrMoreLists + ' of ' + p.roads.totalPlaces + ' named crash-prone places appear in five or more of the nine annual lists (2016 to 2024); ' + p.roads.placesInSevenOrMoreLists + ' appear in seven or more.</li>'
    + '<li>Ring Road, Outer Ring Road and GTK Road carry the most: ' + n(F.top3) + ' of ' + n(F.total) + ' fatal crashes counted in the 2023 zone list were on these three roads (' + F.byRoad.map(r => esc(r.road) + ' ' + r.fatal).join(', ') + ').</li>'
    + '<li>In 2024, ' + A.tier1or2 + ' of the ' + A.zones + ' named zones are in evidence tiers 1 and 2 and hold ' + n(A.fatalTier1or2) + ' of the ' + n(A.fatalAll) + ' fatal crashes counted in the zones. ' + A.pedestrianZones + ' zones are pedestrian crash-prone, with ' + A.pedestrianFatal + ' pedestrian fatal crashes counted in them.</li></ul>\n'
    + '<h2>First eight areas to audit</h2>\n<p class="muted">Tier 1: pedestrian crash-prone in 2024 and named in five or more annual lists. Sorted by number of lists, then 2024 fatal crashes.</p>\n'
    + '<table class="tbl"><thead><tr><th>Area</th><th>Road</th><th>Ward (legacy)</th><th class="n">Listed</th><th class="n">Fatal 2024</th><th class="n">Position</th></tr></thead><tbody>' + rows + '</tbody></table>\n'
    + '<h2>On the ground</h2>\n<ol><li>Agree the exact location with the Traffic Police first; positions are hand-placed estimates.</li><li>Record where people actually cross, whether crossings and signals exist and work, speeds, lighting, sight lines and bus-stop placement.</li><li>Note what the data cannot show: traffic volume, signal timing, enforcement, informal crossings.</li><li>Repeat the same observations after any change, at the same places.</li></ol>\n'
    + '<h2>What this does not tell you</h2>\n<ul><li>Why a place has crashes, who is responsible, or what to build.</li><li>Risk: there are no traffic or pedestrian counts, so counts cannot become rates.</li><li>Whether a missing crossing or signal is absent or just not mapped: for ' + A.sparselyMapped + ' of ' + A.zones + ' zones nothing is mapped nearby.</li><li>A change over time: each year selects its own zones, so a changing count is not a trend at fixed places. A repeated name is not a proven identical footprint.</li></ul>\n'
    + '<p class="muted" style="font-size:12.5px">Sources: Delhi Traffic Police annual Road Crash Reports 2016 to 2024; OpenStreetMap (ODbL) for mapped crossings and signals; DataMeet ward boundaries (legacy 290 wards). Wards are not the current 250. Compiled by the Delhi Urban Safety Observatory; cite the agency report for any figure. Evidence packs for each ward: <a href="planning.html">Planning mode</a>. Crime context for the districts is on <a href="patterns.html">Trends and patterns</a> (highest registered rate in 2024: ' + esc(d[0].district) + ', ' + n(d[0].perLakh) + ' cases per lakh residents; this may reflect registration practice and daytime population as well as crime).</p>\n</main>';
}

module.exports = { build, spearman, briefBody };
