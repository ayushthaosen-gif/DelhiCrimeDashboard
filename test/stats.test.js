// Guards the correlation statistics behind the dashboard's significance stars: p-values must be the real Student's t values
// (the first version used a hand-made curve that was wrong in both directions), and the page must adjust for many tests.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const S = require('../scripts/lib/stats.js');

test('p-values match published Student t critical values', () => {
  // two-tailed 0.05 critical values: df 13 = 2.160, df 7 = 2.365, df 12 = 2.179
  assert.ok(Math.abs(S.statsPFromT(2.160, 13) - 0.05) < 0.001);
  assert.ok(Math.abs(S.statsPFromT(2.365, 7) - 0.05) < 0.001);
  assert.ok(Math.abs(S.statsPFromT(2.179, 12) - 0.05) < 0.001);
  // two-tailed 0.01: df 13 = 3.012
  assert.ok(Math.abs(S.statsPFromT(3.012, 13) - 0.01) < 0.0005);
  assert.ok(Math.abs(S.statsPFromT(0, 10) - 1) < 1e-9);
});

test('r = 0.5 over 15 districts is NOT significant at 0.05 (the old curve said p = 0.037)', () => {
  const o = S.statsPFromR(0.5, 15);
  assert.strictEqual(o.df, 13);
  assert.ok(o.p > 0.05 && o.p < 0.065, 'p was ' + o.p);
  assert.strictEqual(o.isSig, false);
});

test('r = 0.55 over 14 districts IS significant (the old curve said p = 0.16)', () => {
  const o = S.statsPFromR(0.55, 14);
  assert.ok(o.p < 0.05, 'p was ' + o.p);
});

test('Spearman handles ties and perfect monotone relations', () => {
  assert.strictEqual(S.statsSpearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.strictEqual(S.statsSpearman([1, 2, 3, 4], [4, 3, 2, 1]), -1);
  const withTies = S.statsSpearman([1, 1, 2, 3], [1, 2, 2, 3]);
  assert.ok(withTies > 0.8 && withTies < 1);
});

test('partial correlation removes a shared driver', () => {
  const z = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = z.map((v, i) => v + (i % 2 ? 0.1 : -0.1));
  const y = z.map((v, i) => 2 * v + (i % 3 ? 0.1 : -0.1));
  assert.ok(S.statsPearson(x, y) > 0.99);
  assert.ok(Math.abs(S.statsPartial(x, y, z)) < 0.9);
});

test('Benjamini-Hochberg adjusts upward, keeps order, ignores nulls', () => {
  const q = S.statsBH([0.01, 0.04, 0.03, null, 0.5]);
  assert.ok(Math.abs(q[0] - 0.04) < 1e-9);
  assert.ok(Math.abs(q[1] - 0.0533333) < 1e-5);
  assert.ok(Math.abs(q[2] - 0.0533333) < 1e-5);
  assert.strictEqual(q[3], null);
  assert.ok(Math.abs(q[4] - 0.5) < 1e-9);
  q.forEach((v, i) => { if (v != null) assert.ok(v >= [0.01, 0.04, 0.03, 0, 0.5][i]); });
});

test('the module is safe to paste into a template literal', () => {
  const src = fs.readFileSync(path.join(__dirname, '../scripts/lib/stats.js'), 'utf8');
  assert.ok(!src.includes('`') && !src.includes('$' + '{'));
});

test('the built dashboard uses the exact test, adjusts for multiple tests, and has no hand-made p curve', () => {
  const html = fs.readFileSync(path.join(__dirname, '../delhi_safety_dashboard.html'), 'utf8');
  assert.ok(html.includes('statsPFromR'));
  assert.ok(html.includes('statsBH'));
  assert.ok(!html.includes('-0.717 * t'));
  assert.ok(/Benjamini/.test(html));
  assert.ok(/not causation|do not establish causation/i.test(html));
});
