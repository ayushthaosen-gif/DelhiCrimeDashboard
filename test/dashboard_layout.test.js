// Guards the dashboard's report-style layout: headline cards that respect comparability, accessible tabs (Map / Table / Download / About and
// the Delhi-wide Chart / Table / Download / About), the Delhi-wide chart's lines, breaks and gaps, and the page furniture (last updated, beta
// banner, contents, topic cards, fullscreen).
//
//   node --test test/dashboard_layout.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const body = html.slice(0, html.lastIndexOf('<script>'));
const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/series_status.json'), 'utf8')).updated;

const line = marker => script.slice(script.indexOf(marker), script.indexOf('\n', script.indexOf(marker)));
const between = (a, b) => script.slice(script.indexOf(a), script.indexOf(b, script.indexOf(a)));
const lib = () => [line('const CONTINUITY = '), line('const UT_SERIES = '), between('const compareYears = ', 'const segmentOf = '), between('const changeBetween = ', 'const GRID = ')].join('\n');

function context(extra) {
  const ctx = vm.createContext(Object.assign({ fmtNum: n => n == null ? '—' : String(n), esc: s => String(s), contBadge: c => '[' + c.state + ']', currentMetric: () => ({}), yearSuffix: () => '2024', Math }, extra));
  vm.runInContext(lib() + '\n' + between('const UT_FIELDS = ', 'function hcard(') + '\n' + between('function utChartHtml(', 'function utTableHtml('), ctx);
  return ctx;
}

test('page furniture: last updated, beta banner, contents, topic cards, fullscreen and a headline-card area', () => {
  const date = new Date(updated + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  assert.ok(body.includes('Last updated on <time datetime="' + updated + '">' + date + '</time>'));
  assert.match(body, /<span class="beta-tag">Beta<\/span>/);
  const contents = body.slice(body.indexOf('<nav class="contents"'), body.indexOf('</nav>', body.indexOf('<nav class="contents"')));
  const targets = [...contents.matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
  assert.ok(targets.length >= 6);
  for (const id of targets) assert.ok(body.includes('id="' + id + '"'), 'contents link with no target: ' + id);
  assert.equal((body.match(/class="topic-card topic-start"/g) || []).length, 2);
  assert.match(body, /id="headlineCards"/);
  assert.match(body, /id="mapFullscreen"[^>]*hidden/);
  assert.match(script, /requestFullscreen/);
});

test('tabs are accessible: tablist/tab/tabpanel, aria-controls point at real panels, one tab is focusable, arrow keys move between tabs', () => {
  for (const group of ['map', 'ut']) {
    const tabs = [...body.matchAll(new RegExp('<button[^>]*role="tab"[^>]*data-tabgroup="' + group + '"[^>]*>', 'g'))].map(m => m[0]);
    assert.equal(tabs.length, 4, group);
    assert.equal(tabs.filter(t => /aria-selected="true"/.test(t)).length, 1);
    for (const t of tabs) {
      const controls = t.match(/aria-controls="([^"]+)"/)[1];
      const panel = body.match(new RegExp('<div[^>]*id="' + controls + '"[^>]*>'))[0];
      assert.match(panel, /role="tabpanel"/);
      assert.match(panel, new RegExp('data-tabgroup="' + group + '"'));
      assert.ok(panel.includes('aria-labelledby="' + t.match(/id="([^"]+)"/)[1] + '"'));
    }
    assert.equal(tabs.filter(t => !/tabindex="-1"/.test(t)).length, 1, 'exactly one tab is in the tab order');
  }
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) assert.ok(script.includes("'" + key + "'"), key);
  assert.deepEqual(['Map', 'Table', 'Download', 'About'].map(l => body.includes('>' + l + '</button>')), [true, true, true, true]);
});

test('headline numbers carry the comparability of the pair: comparable with a change, a caution, a break, or no figure', () => {
  const c = context({});
  const info = (key, a, b) => vm.runInContext('utCompare("' + key + '", ' + a + ', ' + b + ')', c);
  const sentence = (key, a, b, short) => vm.runInContext('changeSentence(utCompare("' + key + '", ' + a + ', ' + b + '), ' + a + ', ' + short + ')', c);
  assert.equal(info('totalIPC', 2022, 2023).cmp.state, 'comparable');
  assert.equal(sentence('totalIPC', 2022, 2023, true), '▲ Up 7.9% (+23828) compared with 2022.');
  assert.equal(info('totalIPC', 2023, 2024).cmp.state, 'caution');
  assert.match(sentence('totalIPC', 2023, 2024, true), /^▼ Down 15\.1% \(-48855\) compared with 2023\.$/);
  assert.match(sentence('totalIPC', 2023, 2024, false), /Compare with caution: The Bharatiya Nyaya Sanhita/);
  assert.equal(info('totalIPC', 2013, 2014).change, null);
  assert.match(sentence('totalIPC', 2013, 2014, true), /^Not comparable with 2013\.$/);
  assert.match(sentence('totalSLL', 2012, 2013, true), /^No comparison with 2012: /);
  assert.equal(info('totalIPC', 2015, 2016).cmp.state, 'comparable', 'totals are printed for 2016');
  assert.equal(vm.runInContext('utValue(utRow(2018), "totalIPC")', c), 249012);
  assert.equal(vm.runInContext('utValue(utRow(2018), "theft")', c), null, 'head-wise 2016-2020 figures are blank, not zero');
  assert.equal(info('theft', 2020, 2021).cmp.state, 'unavailable');
  assert.equal(vm.runInContext('utValue(utRow(2013), "totalSLL")', c), null, 'a blank source figure stays null');
  assert.equal(vm.runInContext('utValue(utRow(2024), "burglary")', c), 8968);
  assert.equal(vm.runInContext('utHead(utRow(2014), "burglary")', c), 'revised criminal trespass/burglary head');
});

test('the Delhi-wide chart joins only years that can be compared, marks breaks, and leaves blank head-wise years empty', () => {
  const c = context({});
  const draw = key => vm.runInContext('utChartHtml("' + key + '")', c);
  const count = (svg, re) => (svg.match(re) || []).length;
  const total = draw('totalIPC');
  assert.equal(count(total, /<circle /g), 14, 'one point per year: totals are printed for every year');
  assert.equal(count(total, /class="ut-line comparable"/g), 11, 'every pair except the break and the BNS caution');
  assert.equal(count(total, /class="ut-line caution"/g), 1, '2023-24 is a caution (BNS)');
  assert.equal(count(total, /<line class="ut-break"/g), 1, 'the 2013 to 2014 reporting-format break');
  assert.equal(count(total, /class="ut-gap"/g), 0);
  const theft = draw('theft');
  assert.equal(count(theft, /<circle /g), 9, 'theft is blank for 2016 to 2020');
  assert.equal(count(theft, /class="ut-gap"/g), 5);
  assert.ok(theft.includes('head-wise figures not extracted yet'));
  const sll = draw('totalSLL');
  assert.equal(count(sll, /<circle /g), 11, 'SLL has no 2011-2013 figures');
  assert.equal(count(sll, /class="ut-line comparable"/g), 9);
  assert.equal(count(sll, /class="ut-line caution"/g), 1);
  assert.equal(count(sll, /<line class="ut-break"/g), 0, 'no break is drawn where one side has no value');
  assert.ok(sll.includes('not reported in the source tables'));
  const burglary = draw('burglary');
  assert.equal(count(burglary, /<circle /g), 9);
  assert.equal(count(burglary, /class="ut-line caution"/g), 2, '2021-22 (unexplained jump) and 2023-24 (BNS)');
  assert.equal(count(burglary, /<line class="ut-break"/g), 1, 'the old and revised burglary heads are separated by a break');
  assert.ok(/aria-label="Delhi-wide burglary by year/.test(burglary));
});

test('the Delhi-wide table and download state the status, definition and reason for every year', () => {
  const c = context({ document: { getElementById: () => ({ dataset: { version: updated } }) } });
  vm.runInContext(between('function utTableHtml(', 'function renderUtBlock('), c);
  const out = vm.runInContext('utCsv("theft")', c);
  assert.deepEqual(Array.from(out.headers), ['Dataset', 'Geography', 'Measure', 'Year', 'Reporting period', 'Registered cases', 'Offence definition', 'Status', 'Comparability with previous year', 'Reason for any break', 'Source', 'Dataset version']);
  assert.equal(out.rows.length, 14);
  const byYear = Object.fromEntries(Array.from(out.rows).map(r => [r[3], r]));
  assert.equal(byYear[2016][5], null, 'theft for 2016 is blank, not zero');
  assert.equal(byYear[2016][7], 'totals printed; head-wise figure not extracted');
  assert.equal(byYear[2014][8], 'Not comparable');
  assert.match(byYear[2014][9], /reporting format/);
  assert.equal(byYear[2011][8], 'First year');
  assert.equal(byYear[2024][11], updated);
  const table = vm.runInContext('utTableHtml("theft")', c);
  assert.equal((table.match(/<tr><th scope="row">/g) || []).length, 14);
  assert.ok(table.includes('Head-wise figure not extracted yet'));
});
