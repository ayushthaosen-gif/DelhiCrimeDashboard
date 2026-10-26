// Small, dependency-free statistics shared by scripts/build.js (injected into the dashboard page as plain text) and test/stats.test.js.
// No backticks and no dollar-brace sequences in this file: it is pasted inside a template literal.

function statsLogGamma(z) {
  var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  var y = z, x = z, t = x + 5.5;
  t -= (x + 0.5) * Math.log(t);
  var s = 1.000000000190015;
  for (var i = 0; i < c.length; i++) s += c[i] / ++y;
  return -t + Math.log(2.5066282746310005 * s / x);
}

function statsBetaCf(a, b, x) {
  var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  var h = d;
  for (var m = 1; m <= 200; m++) {
    var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c; if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    var del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}

// Regularised incomplete beta function I_x(a, b).
function statsIncBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  var bt = Math.exp(statsLogGamma(a + b) - statsLogGamma(a) - statsLogGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * statsBetaCf(a, b, x) / a : 1 - bt * statsBetaCf(b, a, 1 - x) / b;
}

// Two-tailed p-value of Student's t with df degrees of freedom.
function statsPFromT(t, df) {
  if (!isFinite(t)) return 0;
  return statsIncBeta(df / (df + t * t), df / 2, 0.5);
}

// Two-tailed p-value for a correlation r over n observations (t test with n - 2 degrees of freedom).
function statsPFromR(r, n, extraControls) {
  var df = n - 2 - (extraControls || 0);
  if (df < 1) return { p: null, t: null, df: df, isSig: false };
  if (Math.abs(r) >= 1) return { p: 0, t: Infinity, df: df, isSig: true };
  var t = Math.abs(r) * Math.sqrt(df) / Math.sqrt(1 - r * r);
  var p = statsPFromT(t, df);
  return { p: p, t: t, df: df, isSig: p < 0.05 };
}

function statsPearson(xs, ys) {
  var n = xs.length;
  if (n < 2) return 0;
  var mx = 0, my = 0, i;
  for (i = 0; i < n; i++) { mx += xs[i]; my += ys[i]; }
  mx /= n; my /= n;
  var num = 0, dx2 = 0, dy2 = 0;
  for (i = 0; i < n; i++) { var dx = xs[i] - mx, dy = ys[i] - my; num += dx * dy; dx2 += dx * dx; dy2 += dy * dy; }
  return dx2 && dy2 ? num / Math.sqrt(dx2 * dy2) : 0;
}

// Average ranks (ties share the mean rank).
function statsRanks(arr) {
  var sorted = arr.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return a.v - b.v; });
  var ranks = new Array(arr.length), i = 0;
  while (i < sorted.length) {
    var j = i;
    while (j < sorted.length && sorted[j].v === sorted[i].v) j++;
    var rank = (i + 1 + j) / 2;
    for (var k = i; k < j; k++) ranks[sorted[k].i] = rank;
    i = j;
  }
  return ranks;
}

// Spearman rho as Pearson on average ranks: correct with ties (the 1 - 6 sum d^2 formula is not).
function statsSpearman(xs, ys) {
  if (xs.length < 2) return 0;
  return statsPearson(statsRanks(xs), statsRanks(ys));
}

// First-order partial correlation of x and y controlling for z.
function statsPartial(xs, ys, zs) {
  var rxy = statsPearson(xs, ys), rxz = statsPearson(xs, zs), ryz = statsPearson(ys, zs);
  var den = Math.sqrt((1 - rxz * rxz) * (1 - ryz * ryz));
  return den ? (rxy - rxz * ryz) / den : 0;
}

// Benjamini-Hochberg adjusted p-values (q-values). Entries that are null stay null and are not counted.
function statsBH(ps) {
  var idx = [];
  ps.forEach(function (p, i) { if (p != null) idx.push(i); });
  idx.sort(function (a, b) { return ps[a] - ps[b]; });
  var m = idx.length, q = new Array(ps.length), prev = 1;
  for (var i = 0; i < ps.length; i++) q[i] = null;
  for (var k = m - 1; k >= 0; k--) {
    var v = Math.min(prev, ps[idx[k]] * m / (k + 1));
    q[idx[k]] = v; prev = v;
  }
  return q;
}

if (typeof module !== 'undefined') module.exports = { statsPFromT: statsPFromT, statsPFromR: statsPFromR, statsPearson: statsPearson, statsSpearman: statsSpearman, statsRanks: statsRanks, statsPartial: statsPartial, statsBH: statsBH };
