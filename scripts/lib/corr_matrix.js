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

// Rates are calculated from the full-precision counts and denominators; rounding is for display only, because it can change ranks and signs.
function rate(raw, d, mode) { return raw == null ? null : mode === 'perCapita' ? raw / d.population * 1e5 : raw / d.areaSqKm; }
function infraVal(d, inf, mode) { return rate(d[inf.count], d, mode); }

// Spearman p-value by permutation: the rank vector of y is shuffled PERMS times (seeded, so the build is reproducible) and the share of
// shuffles with |rho| at least as large as observed is the p-value, with the observed arrangement counted once (Phipson and Smyth).
const PERMS = 100000;
function permutationP(xs, ys, seed) {
  const n = xs.length, rx = S.statsRanks(xs), ry = S.statsRanks(ys);
  const mx = rx.reduce((a, v) => a + v, 0) / n, my = ry.reduce((a, v) => a + v, 0) / n;
  const cx = rx.map(v => v - mx), cy = ry.map(v => v - my);
  const den = Math.sqrt(cx.reduce((a, v) => a + v * v, 0) * cy.reduce((a, v) => a + v * v, 0));
  if (den === 0) return 1;
  const dot = a => { let t = 0; for (let i = 0; i < n; i++) t += cx[i] * a[i]; return t; };
  const obs = Math.abs(dot(cy)) / den - 1e-9;
  let state = seed >>> 0;
  const rnd = () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = cy.slice();
  let hit = 0;
  for (let k = 0; k < PERMS; k++) {
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    if (Math.abs(dot(a)) / den >= obs) hit++;
  }
  return (hit + 1) / (PERMS + 1);
}
const rnd = (v, k) => Math.round(v * k) / k;

function buildUncached(root) {
  const districts = JSON.parse(fs.readFileSync(path.join(root, 'data/dashboard_final.json'), 'utf8')).districts;
  const names = districts.map(d => d.name || d.district);
  const out = { year: 2024, districts: names, metrics: METRICS.map(({ key, label, group }) => ({ key, label, group })), infra: INFRA.map(({ key, label, mapped }) => ({ key, label, mapped })), modes: {} };
  for (const mode of ['density', 'perCapita']) {
    const cells = METRICS.map((m, mi) => INFRA.map((inf, ii) => {
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
        return { r: rnd(r, 1000), p: ranked ? permutationP(xs, ys, 20261029 + (mode === 'perCapita' ? 1000 : 0) + mi * 20 + ii) : t.p, method: ranked ? 'permutation' : 't', t: rnd(t.t, 100), df: t.df, partial: n >= 5 ? rnd(ranked ? S.statsPartial(S.statsRanks(xs), S.statsRanks(ys), S.statsRanks(zs)) : S.statsPartial(xs, ys, zs), 1000) : null };
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

// the permutation tests take a few seconds, and several builds and tests ask for the same matrix in one process
const cache = new Map();
function build(root) { if (!cache.has(root)) cache.set(root, buildUncached(root)); return JSON.parse(JSON.stringify(cache.get(root))); }

module.exports = { build, METRICS, INFRA };
