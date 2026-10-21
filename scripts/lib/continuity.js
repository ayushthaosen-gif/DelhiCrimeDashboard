// Year-to-year comparability, read from data/continuity.json. The functions are plain and self-contained on purpose:
// build.js injects their source into the dashboard, and the tests run the very same source in Node.
//
// A state is one of: comparable, caution, not_comparable, unavailable. Reasons are the sentences to show next to a chart.

function compareYears(c, key, from, to, district) {
  var order = { comparable: 0, caution: 1, not_comparable: 2, unavailable: 3 };
  var out = { state: 'comparable', reasons: [], from: from, to: to };
  var byState = { comparable: [], caution: [], not_comparable: [], unavailable: [] };
  function add(state, reason) {
    if (order[state] > order[out.state]) out.state = state;
    if (reason && byState[state].indexOf(reason) < 0) byState[state].push(reason);
    out.reasons = byState[out.state];
  }
  function inRange(y, r) { return y >= r[0] && y <= r[1]; }
  if (from > to) { var t = from; from = to; to = t; out.from = from; out.to = to; }
  var isCrime = c.crimeMeasures.indexOf(key) >= 0;
  if (!isCrime) {
    var rd = c.roadDistrict;
    if (from <= 2022 && to > 2022) add('not_comparable', rd.reason2022);
    if (rd.cautionMeasures.indexOf(key) >= 0) add('caution', rd.cautionReason);
    return out;
  }
  var utScope = district === c.utSeries.scopeName;
  if (utScope) {
    [from, to].forEach(function (y) {
      if (c.utSeries.printedYears.indexOf(y) < 0) add('unavailable', c.utSeries.gapReason);
    });
    var hu = c.utSeries.headsUnavailable;
    if (hu && hu.measures.indexOf(key) >= 0 && (inRange(from, hu.years) || inRange(to, hu.years))) add('unavailable', hu.reason);
  }
  // 1. values that do not exist
  c.availability.forEach(function (a) {
    if (utScope && a.districtsOnly) return;
    if (a.measures.indexOf(key) >= 0 && (inRange(from, a.years) || inRange(to, a.years))) add('unavailable', a.reason);
  });
  // 1b. a district that did not yet exist
  var born = district && c.geography.firstYear ? c.geography.firstYear[district] : null;
  if (born && from < born) add('unavailable', district + ' did not exist as a district before ' + born + '.');
  // 2. changes in definition or compilation
  c.definitionBreaks.forEach(function (b) {
    if (utScope && b.districtsOnly) return;
    if (b.measures.indexOf(key) >= 0 && from <= b.between[0] && b.between[1] <= to) add(b.state, b.reason);
  });
  // 3. changes in geography, district by district when a district is named (Delhi-wide totals ignore district boundaries)
  if (utScope) return out;
  c.geography.breaks.forEach(function (g) {
    if (!(from <= g.between[0] && g.between[1] <= to)) return;
    if (!district) {
      add('not_comparable', g.reason + ' Affected: ' + g.affected.join(', ') + (g.newDistricts.length ? '. New: ' + g.newDistricts.join(', ') : '') + '.');
    } else if (g.newDistricts.indexOf(district) >= 0) {
      add('unavailable', district + ' did not exist as a district before ' + g.between[1] + '.');
    } else if (g.affected.indexOf(district) >= 0) {
      add('not_comparable', g.reason);
    } else if (g.unaffected.indexOf(district) >= 0) {
      add('comparable', '');
    } else if (g.othersState) {
      add(g.othersState, g.othersReason);
    }
  });
  // 4. the district list is inferred inside an epoch
  c.geography.epochs.forEach(function (e) {
    if (inRange(from, e.years) && inRange(to, e.years)) add(e.state, e.reason);
  });
  return out;
}

// The years around `year` that may share one colour scale: split wherever the measure is not comparable for the map as a whole.
function segmentOf(c, key, year) {
  var cuts = [];
  var isCrime = c.crimeMeasures.indexOf(key) >= 0;
  if (!isCrime) return year >= 2023 ? [2023, 2024] : [year, year];
  c.definitionBreaks.forEach(function (b) { if (b.measures.indexOf(key) >= 0 && b.state === 'not_comparable') cuts.push(b.between[1]); });
  c.geography.breaks.forEach(function (g) { cuts.push(g.between[1]); });
  var start = c.yearRange[0], end = c.yearRange[1];
  cuts.forEach(function (cut) {
    if (cut <= year && cut > start) start = cut;
    if (cut > year && cut - 1 < end) end = cut - 1;
  });
  return [start, end];
}

// Percentage change, or null when the pair must not be turned into a change.
function changeBetween(cmp, fromValue, toValue) {
  if (cmp.state === 'not_comparable' || cmp.state === 'unavailable') return null;
  if (fromValue == null || toValue == null || fromValue === 0) return null;
  return (toValue - fromValue) / fromValue * 100;
}

module.exports = { compareYears: compareYears, segmentOf: segmentOf, changeBetween: changeBetween };
