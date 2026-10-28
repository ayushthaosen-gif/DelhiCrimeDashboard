// Infrastructure and recorded crime: every district-level metric against every infrastructure density, computed once at build time with the
// tested statistics in ./stats.js, so the Patterns page shows numbers that cannot drift from the audited code.
// 2024 view, 15 police districts. Two bases: per km2 (both sides divided by district area) and per 100k residents.
const fs = require('fs');
const path = require('path');
const S = require('./stats.js');

// year: the data year of the metric; road metrics from the 2022 Traffic Police report keep their own year.
const METRICS = [
  { key: 'theft2024', label: 'Theft', group: 'Crime (NCRB)' },
  { key: 'robbery2024', label: 'Robbery', group: 'Crime (NCRB)' },
  { key: 'burglary2024', label: 'Burglary', group: 'Crime (NCRB)' },
  { key: 'totalIPC2024', label: 'All IPC/BNS', group: 'Crime (NCRB)' },
  { key: 'crimeAgainstWomen2024', label: 'Crimes against women', group: 'Crime (NCRB)' },
  { key: 'totalSLL2024', label: 'Special and local laws', group: 'Crime (NCRB)' },
  { key: 'fatalRoadCrashes2022', label: 'Fatal crashes (2022)', group: 'Road safety' },
  { key: 'hitAndRunCrashes2022', label: 'Hit-and-run fatal crashes (2022)', group: 'Road safety' },
  { key: 'crashProneZones2024', label: 'Crash-prone zones', group: 'Road safety' },
  { key: 'fatalCrashes2024', label: 'Fatal crashes in zones', group: 'Road safety' },
  { key: 'totalCrashes2024', label: 'All crashes in zones', group: 'Road safety' },
  { key: 'personsKilled2024', label: 'Persons killed in zones', group: 'Road safety' },
  { key: 'personsInjured2024', label: 'Persons injured in zones', group: 'Road safety' }
];

const SURVEYED = new Set(['Central', 'East', 'New Delhi', 'North', 'Shahdara', 'South', 'South-East', 'South-West', 'West']);
const INFRA = [
  { key: 'streetlight', label: 'Streetlights', count: 'totalLights', dens: 'lightDensityPerKm2', mapped: false, partial: true },
  { key: 'underpass', label: 'Underpasses', count: 'underpasses', dens: 'underpassDensity', mapped: false, partial: true },
  { key: 'pedestrianOverpass', label: 'Pedestrian overbridges', count: 'pedestrianOverpasses', dens: 'pedestrianOverpassDensity', mapped: true },
  { key: 'metroGate', label: 'Metro gates (mapped)', count: 'metroGates', dens: 'metroGateDensity', mapped: true },
  { key: 'policeInfra', label: 'Police posts', count: 'policeInfraCount', dens: 'policeInfraDensity', mapped: false },
  { key: 'busStop', label: 'Bus stops', count: 'busStops', dens: 'busStopDensity', mapped: true },
  { key: 'atm', label: 'ATMs', count: 'atms', dens: 'atmDensity', mapped: true },
  { key: 'alcoholShop', label: 'Liquor shops', count: 'alcoholShops', dens: 'alcoholShopDensity', mapped: true },
  { key: 'surveillance', label: 'CCTV and guards', count: 'surveillanceCameras', dens: 'surveillanceDensity', mapped: true }
];

function covered(d, inf) {
  if (['metroGate', 'busStop', 'atm', 'alcoholShop', 'surveillance', 'pedestrianOverpass'].includes(inf.key)) return true;
  if (inf.key === 'policeInfra') return d.chowkiPosts > 0;
  return SURVEYED.has(d.district) && d[inf.key === 'streetlight' ? 'surveyPoints' : 'underpasses'] >= 10;
}

const r1 = v => Math.round(v * 10) / 10;
function rate(raw, d, mode) { return raw == null ? null : mode === 'perCapita' ? r1(raw / d.population * 1e5) : r1(raw / d.areaSqKm); }
function infraVal(d, inf, mode) {
  const c = d[inf.count];
  if (c == null) return null;
  return mode === 'perCapita' ? r1(c / d.population * 1e5) : d[inf.dens];
}
const rnd = (v, k) => Math.round(v * k) / k;

function build(root) {
  const districts = JSON.parse(fs.readFileSync(path.join(root, 'data/dashboard_final.json'), 'utf8')).districts;
  const names = districts.map(d => d.name || d.district);
  const out = { year: 2024, districts: names, metrics: METRICS.map(({ key, label, group }) => ({ key, label, group })), infra: INFRA.map(({ key, label, mapped }) => ({ key, label, mapped })), modes: {} };
  for (const mode of ['density', 'perCapita']) {
    const cells = METRICS.map(m => INFRA.map(inf => {
      const idx = [], xs = [], ys = [];
      districts.forEach((d, i) => {
        if (!covered(d, inf) || d[m.key] == null) return;
        const x = infraVal(d, inf, mode), y = rate(d[m.key], d, mode);
        if (x == null || y == null) return;
        idx.push(i); xs.push(x); ys.push(y);
      });
      const n = idx.length;
      if (n < 3) return { n, idx, x: xs, y: ys, pearson: null, spearman: null };
      const zs = idx.map(i => districts[i].population / districts[i].areaSqKm);
      const one = (r, ranked) => {
        const t = S.statsPFromR(r, n);
        return { r: rnd(r, 1000), p: t.p, t: rnd(t.t, 100), df: t.df, partial: n >= 5 ? rnd(ranked ? S.statsPartial(S.statsRanks(xs), S.statsRanks(ys), S.statsRanks(zs)) : S.statsPartial(xs, ys, zs), 1000) : null };
      };
      return { n, idx, x: xs, y: ys, pearson: one(S.statsPearson(xs, ys), false), spearman: one(S.statsSpearman(xs, ys), true) };
    }));
    // adjust each coefficient family across the whole grid
    const flat = [].concat(...cells);
    for (const k of ['pearson', 'spearman']) {
      const q = S.statsBH(flat.map(c => (c[k] ? c[k].p : null)));
      flat.forEach((c, i) => { if (c[k]) { c[k].q = q[i]; c[k].p = Math.round(c[k].p * 1e5) / 1e5; c[k].q = Math.round(q[i] * 1e5) / 1e5; } });
    }
    const tests = flat.filter(c => c.pearson).length;
    out.modes[mode] = {
      cells, tests,
      raw: { pearson: flat.filter(c => c.pearson && c.pearson.p < 0.05).length, spearman: flat.filter(c => c.spearman && c.spearman.p < 0.05).length },
      adjusted: { pearson: flat.filter(c => c.pearson && c.pearson.q < 0.05).length, spearman: flat.filter(c => c.spearman && c.spearman.q < 0.05).length }
    };
  }
  return out;
}

module.exports = { build, METRICS, INFRA };
