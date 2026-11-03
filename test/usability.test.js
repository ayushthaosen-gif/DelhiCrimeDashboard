// Guards the usability work: plain-language lines under charts, the reading guide, and the accessibility sizes found in the audit.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const count = f => (read(f).match(/D\.plain\(/g) || []).length;

test('every chart section on Road safety and Patterns has a plain-language line, and the helper exists', () => {
  assert.match(read('assets/site.js'), /D\.plain = function/);
  assert.ok(count('assets/page-road.js') >= 7, 'road: trend, modes, enforcement, zones, roads, stretches, districts');
  assert.ok(count('assets/page-patterns.js') >= 5, 'patterns: crime trend, districts, matrix, places, change');
  assert.ok(count('assets/page-explore.js') >= 2 && count('assets/page-planning.js') >= 1);
  const helper = read('assets/site.js').split('D.plain = function')[1].slice(0, 220);
  assert.ok(!/innerHTML/.test(helper), 'plain lines are built as text, not HTML');
});

test('the reading guide exists, is linked from the overview, explore and patterns pages, and states what registered crime does not measure', () => {
  const g = read('reading-guide.html');
  assert.match(g, /<h1>How to read registered crime<\/h1>/);
  for (const id of ['what', 'not', 'rates', 'years', 'roads', 'words']) assert.ok(g.includes('id="' + id + '"'), id);
  assert.match(g, /never reported or never registered/);
  assert.match(g, /not a primary source/);
  assert.match(g, /142,000/);
  for (const f of ['index.html', 'patterns.html']) assert.ok(read(f).includes('href="reading-guide.html"'), f + ' links to the guide');
  assert.ok(read('assets/page-explore.js').includes("href: 'reading-guide.html'"), 'Explore links to the guide from its About text');
});

test('accessibility sizes from the audit: 24 px help buttons, 24 px bar targets on phones, a way past the 290-ward map', () => {
  const css = read('assets/site.css');
  assert.match(css, /\.info \{ width: 24px; height: 24px;/);
  assert.match(css, /\.trend button, \.bars button \{ min-width: 24px;/);
  assert.match(css, /select \{ min-height: 28px; \}/);
  const pl = read('assets/page-planning.js');
  assert.match(pl, /skip-map/);
  assert.match(pl, /id: 'plDetail'/);
});
