// Validates the shared, weight-normalized, NaN-safe exploratory-scoring helper used by both the
// district "unsafe areas" composite and the new ward liquor-crash exploratory index in
// build_interactive_map.js. Rather than duplicating the implementation (which could silently
// drift from what actually ships), this pulls percentileScale/normalizeExploratoryWeights/
// computeExploratoryScore's exact source text out of build_interactive_map.js at test time and
// evaluates it directly -- the same technique node --check already uses elsewhere in this repo
// to catch template-literal escaping bugs against the real shipped code, not a copy of it.
//
//   node --test test/exploratory_score.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build_interactive_map.js'), 'utf8');
function extractFn(name) {
  const start = src.indexOf('function ' + name);
  assert.ok(start !== -1, 'function not found in scripts/build_interactive_map.js: ' + name);
  let i = src.indexOf('{', start);
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const fnSource = [extractFn('percentileScale'), extractFn('normalizeExploratoryWeights'), extractFn('computeExploratoryScore')].join('\n');
const { normalizeExploratoryWeights, computeExploratoryScore } = new Function(
  fnSource + '\nreturn { normalizeExploratoryWeights, computeExploratoryScore };'
)();

test('normalizeExploratoryWeights: falls back to equal weighting when no weights given', () => {
  const w = normalizeExploratoryWeights(['a', 'b', 'c'], null);
  assert.equal(w.a, w.b);
  assert.equal(w.b, w.c);
  assert.ok(Math.abs(w.a + w.b + w.c - 1) < 1e-9);
});

test('normalizeExploratoryWeights: normalizes weights that do not sum to 1', () => {
  const w = normalizeExploratoryWeights(['a', 'b'], { a: 2, b: 6 });
  assert.ok(Math.abs(w.a - 0.25) < 1e-9);
  assert.ok(Math.abs(w.b - 0.75) < 1e-9);
  assert.ok(Math.abs(w.a + w.b - 1) < 1e-9);
});

test('normalizeExploratoryWeights: falls back to equal weighting on invalid/negative/missing weight entries', () => {
  for (const bad of [{ a: -1, b: 2 }, { a: 'x', b: 2 }, { a: NaN, b: 2 }, { a: 1 }, { a: 0, b: 0 }]) {
    const w = normalizeExploratoryWeights(['a', 'b'], bad);
    assert.equal(w.a, w.b, 'expected equal-weight fallback for ' + JSON.stringify(bad));
  }
});

test('computeExploratoryScore: every score is finite and within [0, 100]', () => {
  const items = Array.from({ length: 30 }, (_, i) => ({ x: i % 5 === 0 ? null : i, y: Math.random() * 100 }));
  const factors = [
    { key: 'x', label: 'X', invert: false, get: d => d.x },
    { key: 'y', label: 'Y', invert: true, get: d => d.y },
  ];
  const { scores } = computeExploratoryScore(items, factors, { x: 0.7, y: 0.3 });
  items.forEach(item => {
    const s = scores.get(item);
    if (s.score != null) {
      assert.ok(Number.isFinite(s.score), 'score must be finite');
      assert.ok(s.score >= 0 && s.score <= 100, 'score out of [0,100]: ' + s.score);
    }
  });
});

test('computeExploratoryScore: missing factor values never produce NaN and are excluded, not zeroed', () => {
  const items = [{ a: null, b: null }, { a: 5, b: null }, { a: null, b: 10 }, { a: 5, b: 10 }];
  const factors = [
    { key: 'a', label: 'A', invert: false, get: d => d.a },
    { key: 'b', label: 'B', invert: false, get: d => d.b },
  ];
  const { scores } = computeExploratoryScore(items, factors, null);
  const allNullItem = items[0];
  const s0 = scores.get(allNullItem);
  assert.equal(s0.score, null, 'an item with zero covered factors must score null, not 0 or NaN');
  assert.equal(s0.coveredFactors, 0);

  const partialItem = items[1]; // only factor a covered
  const s1 = scores.get(partialItem);
  assert.ok(s1.score == null || Number.isFinite(s1.score));
  assert.equal(s1.coveredFactors, 1);
  items.forEach(item => {
    const s = scores.get(item);
    assert.ok(s.score === null || !Number.isNaN(s.score));
  });
});

test('computeExploratoryScore: a factor never appears with weight 0 due to bad weight input (equal-weight fallback engages)', () => {
  const items = [{ a: 1, b: 2 }, { a: 3, b: 4 }];
  const factors = [
    { key: 'a', label: 'A', invert: false, get: d => d.a },
    { key: 'b', label: 'B', invert: false, get: d => d.b },
  ];
  const { weights } = computeExploratoryScore(items, factors, { a: -5, b: 10 });
  assert.equal(weights.a, weights.b);
});

test('computeExploratoryScore: does not infer or attach any camera/infrastructure count from the score', () => {
  const items = [{ a: 1, b: 2 }];
  const factors = [{ key: 'a', label: 'A', invert: false, get: d => d.a }, { key: 'b', label: 'B', invert: false, get: d => d.b }];
  const { scores } = computeExploratoryScore(items, factors, null);
  const s = scores.get(items[0]);
  const keys = Object.keys(s);
  assert.deepEqual(keys.sort(), ['contributions', 'coveredFactors', 'score', 'totalFactors']);
  s.contributions.forEach(c => {
    assert.deepEqual(Object.keys(c).sort(), ['key', 'label', 'percentile', 'value', 'weight']);
  });
});

// ---- district "unsafe areas" composite: denominators, crash factor, weights and rank stability ----
const unsafeSrc = [extractFn('percentileScale'), extractFn('normalizeExploratoryWeights'), extractFn('computeExploratoryScore'),
  extractFn('unsafeRate'), extractFn('unsafeFactors'), extractFn('unsafeRankStability')].join('\n');
const U = new Function("const SURVEYED = new Set(['A', 'B', 'C']); const UNSAFE_BASIS_LABEL = { perLakh: 'per 100,000 residents', perKm2: 'per km2', perRoadKm: 'per 100 km of main road' };\n" +
  unsafeSrc + '\nreturn { unsafeRate, unsafeFactors, unsafeRankStability, computeExploratoryScore };')();

test('unsafe score: rates are calculated unrounded from counts and the chosen denominator; missing denominators give null, not zero', () => {
  const d = { population: 1500000, areaSqKm: 87.5, mainRoadKm: 43.3 };
  assert.equal(U.unsafeRate(1234, d, 'perLakh'), 1234 / 1500000 * 100000);
  assert.equal(U.unsafeRate(1234, d, 'perKm2'), 1234 / 87.5);
  assert.equal(U.unsafeRate(12, d, 'perRoadKm'), 12 / 43.3 * 100);
  assert.equal(U.unsafeRate(null, d, 'perKm2'), null);
  assert.equal(U.unsafeRate(5, { population: 0, areaSqKm: 1 }, 'perLakh'), null);
  assert.equal(U.unsafeRate(5, { population: 10, areaSqKm: 1 }, 'perRoadKm'), null);
});

test('unsafe score: the choice of denominator changes the ranking of a dense centre against a sparse, populous district', () => {
  const items = [
    { district: 'A', totalIPC: 500, crimeAgainstWomen: 50, personsKilled2024: 10, population: 100000, areaSqKm: 10, policeInfraDensity: 1, lightDensityPerKm2: 1 },
    { district: 'B', totalIPC: 400, crimeAgainstWomen: 40, personsKilled2024: 8, population: 400000, areaSqKm: 40, policeInfraDensity: 1, lightDensityPerKm2: 1 },
    { district: 'C', totalIPC: 100, crimeAgainstWomen: 10, personsKilled2024: 2, population: 50000, areaSqKm: 400, policeInfraDensity: 1, lightDensityPerKm2: 1 },
  ];
  const rank = cfg => {
    const { scores } = U.computeExploratoryScore(items, U.unsafeFactors(cfg), null);
    return items.map(i => scores.get(i).score);
  };
  const km2 = rank({ rate: 'perKm2', crash: 'perKm2' }), lakh = rank({ rate: 'perLakh', crash: 'perLakh' });
  assert.notDeepEqual(km2, lakh);
  assert.ok(km2[0] > km2[2], 'per km2: the compact district scores worse than the large one');
  assert.ok(lakh[2] > lakh[1], 'per resident: the sparsely populated district scores worse than the populous one');
});

test('unsafe score: the road factor is persons killed in 2024 for the whole district, not zone-limited fatal crashes, and no per-vehicle rate is offered', () => {
  const f = U.unsafeFactors({ rate: 'perLakh', crash: 'perRoadKm' });
  assert.equal(f.length, 5);
  const killed = f.find(x => x.key === 'killedRate');
  assert.ok(/2024/.test(killed.label) && /main road/.test(killed.label));
  assert.equal(killed.get({ personsKilled2024: 20, fatalCrashes2023: 999, mainRoadKm: 50 }), 40);
  assert.ok(!/fatalCrashes2023/.test(unsafeSrc), 'the zone-limited 2023 figure is not used');
  assert.ok(!/vehicle/i.test(f.map(x => x.label).join(' ')));
  const page = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'build_interactive_map.js'), 'utf8');
  assert.match(page, /no vehicle count by police district/);
});

test('unsafe score: rank stability is reproducible, a district that leads on every factor never moves, and trade-offs give a wide range', () => {
  const dom = [{ a: 9, b: 9 }, { a: 5, b: 5 }, { a: 1, b: 1 }];
  const factors = [{ key: 'a', label: 'A', invert: false, get: d => d.a }, { key: 'b', label: 'B', invert: false, get: d => d.b }];
  const s1 = U.unsafeRankStability(dom, factors, 200, 7), s2 = U.unsafeRankStability(dom, factors, 200, 7);
  assert.deepEqual(s1, s2);
  assert.deepEqual([s1[0].min, s1[0].max, s1[2].min, s1[2].max], [1, 1, 3, 3]);
  const trade = [{ a: 9, b: 1 }, { a: 1, b: 9 }, { a: 5, b: 5 }];
  const s3 = U.unsafeRankStability(trade, factors, 500, 7);
  assert.ok(s3[0].max - s3[0].min >= 1 && s3[1].max - s3[1].min >= 1, 'opposite trade-offs move across the weights');
  s3.forEach(r => { assert.ok(r.lo >= r.min && r.hi <= r.max && r.lo <= r.median && r.median <= r.hi); });
});
