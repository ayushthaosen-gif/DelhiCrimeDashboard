// Guards the Overview / Explore / Data & methods structure of the dashboard: three sections, one topic at a time,
// counts by default, an explainer under every visual, a plain-language glossary, and share links that keep the view.
//
//   node --test test/dashboard_redesign.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const body = html.slice(0, html.lastIndexOf('<script>'));

function functionSource(name) {
  const start = script.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' not found');
  return script.slice(start, script.indexOf('\n}\n', start) + 3);
}

test('three sections in order inside main, each with a heading, and the nav offers exactly those three', () => {
  const nav = body.slice(body.indexOf('<nav class="topnav"'), body.indexOf('</nav>'));
  assert.deepEqual([...nav.matchAll(/<div class="topnav-links">([\s\S]*?)<\/div>/g)][0][1].match(/href="#[^"]+"/g), ['href="#overview"', 'href="#explore"', 'href="#data-methods"']);
  const order = ['id="overview"', 'id="explore"', 'id="data-methods"'].map(m => body.indexOf(m));
  assert.ok(order.every((n, i) => n > body.indexOf('<main') && (i === 0 || n > order[i - 1])), 'sections out of order');
  assert.ok(body.indexOf('id="data-methods"') < body.indexOf('</main>'));
  for (const id of ['mapSection', 'detail', 'scatterSection', 'roadSection']) assert.ok(body.indexOf('id="' + id + '"') > body.indexOf('id="explore"') && body.indexOf('id="' + id + '"') < body.indexOf('id="data-methods"'), id + ' belongs in Explore');
  for (const id of ['coverage', 'about', 'methodSection', 'downloadSection', 'glossary']) assert.ok(body.indexOf('id="' + id + '"') > body.indexOf('id="data-methods"'), id + ' belongs in Data & methods');
});

test('the other pages are still reachable from one More pages menu', () => {
  const menu = body.slice(body.indexOf('id="navMore"'), body.indexOf('</details>', body.indexOf('id="navMore"')));
  for (const f of ['interactive_map.html', 'historical_crime.html', 'for_reporters.html', 'irad_stations.html', 'map_3d.html']) assert.ok(menu.includes('href="' + f + '"'), f);
});

test('crime and road crashes are separate topics and the metric list holds one topic at a time', () => {
  assert.match(body, /id="topicCrime"[^>]*data-topic="crime"/);
  assert.match(body, /id="topicRoad"[^>]*data-topic="road"/);
  assert.ok(!/<optgroup label="Road safety">/.test(script), 'the mixed Crime / Road safety dropdown must be gone');
  assert.match(script, /options\(topicOf\(currentMetric\(\)\) === 'crime' \? crime : road\)/);
  const topicOf = vm.runInNewContext(functionSource('topicOf') + '\ntopicOf');
  assert.equal(topicOf({ prevKey: 'theft2022' }), 'crime');
  assert.equal(topicOf({}), 'road');
});

test('counts are the default calculation and rates are opt-in', () => {
  assert.match(script, /let rateMode = 'counts'/);
  assert.match(script, /\[\['counts', 'Count'\], \['density', 'Per km²'\], \['perCapita', 'Per 100k'\]\]/);
  const getRateVal = vm.runInNewContext('let rateMode = "counts";\n' + functionSource('getRateVal') + '\n({ get: (c, d) => getRateVal(c, d), set: m => { rateMode = m; } })');
  const district = { areaSqKm: 10, population: 200000 };
  assert.equal(getRateVal.get(500, district), 500);
  getRateVal.set('density'); assert.equal(getRateVal.get(500, district), 50);
  getRateVal.set('perCapita'); assert.equal(getRateVal.get(500, district), 250);
  assert.equal(getRateVal.get(null, district), null);
});

test('every visual has an explainer container answering the four questions, and the map one is rebuilt for every view', () => {
  for (const id of ['mapExplainer', 'scatterExplainer', 'trendsExplainer', 'victimsExplainer', 'zonesExplainer', 'zones2024Explainer', 'enforcementExplainer', 'roadsExplainer']) {
    assert.ok(body.includes('id="' + id + '"'), id);
  }
  for (const heading of ['What am I seeing?', 'How do I read it?', 'What are the limits?', 'Where did it come from?']) assert.ok(script.includes(heading), heading);
  for (const label of ['View table', 'Download data', 'Copy link to this view', 'Source &amp; definitions']) assert.ok(script.includes(label), label);
  const render = functionSource('render');
  assert.ok(render.includes('renderMapExplainer();') && render.includes('syncUrl();') && render.includes('renderTopicControls();'));
  const statics = vm.runInNewContext(script.slice(script.indexOf('const STATIC_EXPLAINERS'), script.indexOf('function renderStaticExplainers')) + '\nSTATIC_EXPLAINERS');
  for (const [id, spec] of Object.entries(statics)) for (const k of ['what', 'how', 'limits', 'source']) assert.ok(spec[k] && spec[k].length > 20, id + '.' + k);
});

test('the glossary explains IPC, SLL, BNS, fatal crashes and persons killed, and terms are matched by keyword', () => {
  const ctx = vm.runInNewContext(script.slice(script.indexOf('const GLOSSARY'), script.indexOf('const CRIME_NOUN')) + '\n' + functionSource('termsFor') + '\n({ GLOSSARY, termsFor })');
  const names = Array.from(ctx.GLOSSARY).map(g => g[0]);
  for (const t of ['IPC', 'BNS', 'SLL', 'NCRB', 'Fatal crash', 'Persons killed', 'Hit-and-run', 'iRAD']) assert.ok(names.includes(t), t);
  assert.deepEqual(Array.from(ctx.termsFor('Registered cases under the IPC and SLL')).map(g => g[0]), ['IPC', 'SLL', 'Registered case']);
  assert.deepEqual(Array.from(ctx.termsFor('Fatal crashes and persons killed')).map(g => g[0]), ['Fatal crash', 'Persons killed']);
});

test('a shared link restores topic, measure, year, calculation and district, and ignores values it does not know', () => {
  const metrics = [{ key: 'theft', prevKey: 'theft2022' }, { key: 'robbery', prevKey: 'robbery2022' }, { key: 'totalCrashes2023', yearVariants: { 2023: 'a', 2024: 'b' }, year: '2023' }];
  const run = search => {
    const ctx = vm.createContext({
      URLSearchParams, METRICS: metrics, DATA: [{ name: 'Dwarka' }, { name: 'Rohini' }], location: { search },
      currentMetric: () => metrics.find(m => m.key === ctx.activeMetric),
      metricSupportsYear: (m, y) => m.yearVariants ? !!m.yearVariants[y] : ['2017', '2022', '2023', '2024'].includes(String(y))
    });
    vm.runInContext("var activeMetric = 'robbery', activeYear = '2024', rateMode = 'counts', selected = null, histSelected = null;\n" + functionSource('applyUrlState') + '\napplyUrlState();', ctx);
    return ctx;
  };
  const ok = run('?topic=crime&metric=theft&year=2017&calc=perCapita&district=Dwarka');
  assert.deepEqual([ok.activeMetric, ok.activeYear, ok.rateMode, ok.selected, ok.histSelected], ['theft', '2017', 'perCapita', 'Dwarka', 'Dwarka']);
  const road = run('?metric=totalCrashes2023&year=2024');
  assert.deepEqual([road.activeMetric, road.activeYear], ['totalCrashes2023', '2024']);
  const junk = run('?metric=nope&year=1999&calc=weird&district=Atlantis');
  assert.deepEqual([junk.activeMetric, junk.activeYear, junk.rateMode, junk.selected], ['robbery', '2024', 'counts', null]);
});

test('downloads from a view name the dataset version, geography and calculation', () => {
  const src = functionSource('viewCsv');
  for (const col of ['Dataset', 'Geography', 'Measure', 'Year', 'Calculation', 'District', 'Value', 'Source', 'Dataset version']) assert.ok(src.includes("'" + col + "'"), col);
  assert.match(body, /<main id="main" data-version="\d{4}-\d{2}-\d{2}">/);
});

test('in-page links that open collapsed notes are handled, and nothing is hidden behind a hover', () => {
  assert.match(script, /target\.tagName === 'DETAILS'\) target\.open = true/);
  assert.match(body, /<button type="button" class="dl-mini-btn" id="copyViewLink">/);
});
