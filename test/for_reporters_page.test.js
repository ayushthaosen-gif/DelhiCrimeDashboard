// Guard for for_reporters.html: it must link to files that exist, keep the grading and key warnings, and be reachable from the dashboard.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'for_reporters.html'), 'utf8');

test('relative links resolve to files in the repo', () => {
  const links = [...html.matchAll(/href="([^"#:]+)"/g)].map(m => m[1]);
  assert.ok(links.length >= 4);
  assert.deepEqual(links.filter(l => !fs.existsSync(path.join(ROOT, l))), []);
});

test('the three grades and the key warnings are present', () => {
  const needed = ['Solid: cite the original report', 'Leads only', 'Do not publish as findings', 'never &ldquo;at this spot&rdquo;', 'not evidence of illegal construction', 'no district-wise 2025 data'];
  for (const s of needed) assert.ok(html.includes(s), s);
});

test('the site build and its output link to the page', () => {
  assert.ok(fs.readFileSync(path.join(ROOT, 'scripts', 'build_site.js'), 'utf8').includes('href="for_reporters.html"'));
  assert.ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('href="for_reporters.html"'));
});

test('the site and the map link to the iRAD page, which exists', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'irad_stations.html')));
  for (const f of ['index.html', 'interactive_map.html']) assert.ok(fs.readFileSync(path.join(ROOT, f), 'utf8').includes('href="irad_stations.html"'), f);
  for (const f of ['build_site.js', 'build_interactive_map.js']) assert.ok(fs.readFileSync(path.join(ROOT, 'scripts', f), 'utf8').includes('href="irad_stations.html"'), f + ' would lose the link on rebuild');
});
