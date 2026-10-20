// Guards the dashboard while a 2011-2018 year is showing: exports that join the selected crime year to today's 15 districts
// (correlation, current comparison, Excel) must not run, the historical counts export must carry only counts as printed,
// and the road downloads stay available.
//
//   node --test test/historical_dashboard_exports.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));

function handler(id) {
  const start = script.indexOf("document.getElementById('" + id + "').addEventListener(");
  assert.ok(start >= 0, id + ' handler not found');
  return script.slice(start, script.indexOf('\n});\n', start) + 4);
}

test('correlation, comparison and Excel exports do nothing while a historical year is showing', () => {
  for (const id of ['dlCorrDownload', 'dlVersusDownload', 'dlExcelDownload']) {
    const downloads = [];
    // Any modern-geography identifier (DATA, INFRA, METRICS, areaSqKm, ...) is deliberately undefined here:
    // reaching one throws, so the guard has to return first.
    vm.runInNewContext(handler(id), {
      isHistoryView: () => true,
      document: { getElementById: () => ({ addEventListener: (_, fn) => fn() }) },
      triggerDownload: (...args) => downloads.push(args),
      toCSV: () => { throw new Error('toCSV reached'); }
    });
    assert.equal(downloads.length, 0, id);
  }
});

test('the download tabs hide the modern-geography exports in historical mode and offer a counts-only one', () => {
  const tabs = vm.runInNewContext(script.slice(script.indexOf('const DOWNLOAD_TABS'), script.indexOf('];', script.indexOf('const DOWNLOAD_TABS')) + 2) + '\nDOWNLOAD_TABS');
  const visible = hist => Array.from(tabs).filter(t => hist ? !t.modernOnly : !t.historyOnly).map(t => t.key);
  assert.deepEqual(visible(true), ['all', 'history']);
  assert.deepEqual(visible(false), ['all', 'corr', 'versus', 'excel']);
});

test('the historical export is the selected year as printed: original units, printed Delhi total, blanks not zeros, no modern fields', () => {
  const hist = script.slice(script.indexOf('const HIST = '), script.indexOf('\n', script.indexOf('const HIST = ')));
  const fns = script.slice(script.indexOf('const HIST_KEYS'), script.indexOf('function histSelect('));
  const cut = (startMarker, endMarker) => script.slice(script.indexOf(startMarker), script.indexOf(endMarker, script.indexOf(startMarker)));
  const continuity = cut('const CONTINUITY = ', '\n') + '\n' + cut('const compareYears = ', 'const segmentOf = ') + '\n' + cut('const segmentOf = ', 'const changeBetween = ') + '\n' + cut('const changeBetween = ', 'const GRID = ') + '\n' +
    script.slice(script.indexOf('// ---- Can I compare these years?'), script.indexOf('\nfunction render() {')) + '\n' +
    script.slice(script.indexOf('function histDefinition('), script.indexOf('\n}\n', script.indexOf('function histDefinition(')) + 3);
  const context = vm.createContext({ currentMetric: () => ({}), Math, DATA: [], METRICS: [{ key: 'theft', prevKey: 'theft2022' }], esc: s => String(s), yearFieldKey: () => '', getRateVal: v => v, percentileScale: () => () => 0 });
  vm.runInContext(hist + '\n' + fns + '\n' + continuity + '\nglobalThis.out = year => histExport(year);', context);
  const out = year => context.out(year);

  const y2014 = out(2014);
  assert.equal(y2014.rows.filter(r => r[2] === 'Territorial district').length, 11);
  assert.equal(y2014.rows.length, 19 + 1, '19 printed reporting units plus the printed Delhi total');
  const central = y2014.rows.find(r => r[1] === 'Central');
  assert.deepEqual([central[0], central[2], central[3], central[5]], [2014, 'Territorial district', 4124, 'Criminal trespass/burglary (revised 2014-2015 head)']);
  const total = y2014.rows[y2014.rows.length - 1];
  assert.equal(total[1], 'Delhi UT total');
  assert.match(total[12], /not the sum/);

  const y2012 = out(2012);
  assert.ok(y2012.rows.every(r => r[9] === null), '2012 SLL is not reported and must stay blank, not zero');
  assert.equal(y2012.rows[0][5], 'Burglary (original 2011-2013 head)');

  const y2017 = out(2017);
  assert.equal(y2017.rows.filter(r => r[2] === 'Territorial district').length, 14);
  assert.ok(y2017.rows.some(r => r[1] === 'Dwarka'));
  for (const o of [y2012, y2014, y2017]) {
    const text = JSON.stringify(o);
    assert.ok(!/areaSqKm|density|perCapita|population|infrastructure/i.test(text), 'a modern field leaked into the export');
  }
});

test('the road downloads are untouched by historical mode', () => {
  for (const id of ['dlTrendsDownload', 'dlVictimsDownload', 'dlZonesDownload', 'dlRoadsDownload']) {
    const start = script.indexOf("document.getElementById('" + id + "')");
    assert.ok(start >= 0, id);
    assert.ok(!/isHistoryView/.test(script.slice(start, script.indexOf('\n});\n', start))), id + ' must not depend on the historical mode');
  }
});
