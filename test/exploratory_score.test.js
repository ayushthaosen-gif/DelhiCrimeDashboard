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
