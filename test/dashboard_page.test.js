// Structural and quality guard for the main dashboard page (delhi_safety_dashboard.html). It is one
// generated file whose script looks controls up by id, so a markup change can silently break it at
// runtime. These checks read the built page; they do not run a browser.
//
//   node --test test/dashboard_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'delhi_safety_dashboard.html'), 'utf8');
const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const idsInMarkup = new Set([...html.slice(0, html.lastIndexOf('<script>')).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

test('document is well formed: doctype, lang, head, body, viewport', () => {
  assert.match(html, /^<!doctype html><html lang="en"><head>/);
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(html, /<meta name="description" content="[^"]{40,}">/);
  assert.ok(html.indexOf('</head>') < html.indexOf('<body>'), 'style/head content must close before <body>');
  assert.ok(html.trimEnd().endsWith('</body>\n</html>'), 'page must close body and html');
  assert.ok(css.length > 1000 && html.indexOf('<style>') < html.indexOf('</head>'), 'stylesheet must live inside <head>');
});

test('every element the script looks up by id exists in the markup', () => {
  const wanted = [...new Set([...script.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(wanted.length > 60, 'expected the script id lookups, found ' + wanted.length);
  // ids created by the script itself at runtime (rendered into containers) are not in the static markup
  const created = new Set([...script.matchAll(/\bid="([A-Za-z0-9_-]+)"/g)].map(m => m[1]).concat([...script.matchAll(/\.id = '([^']+)'/g)].map(m => m[1])));
  const missing = wanted.filter(id => !idsInMarkup.has(id) && !created.has(id));
  assert.deepEqual(missing, [], 'script references ids that are not in the page: ' + missing.join(', '));
});

test('ids are unique', () => {
  const all = [...html.slice(0, html.lastIndexOf('<script>')).matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dupes = all.filter((id, i) => all.indexOf(id) !== i);
  assert.deepEqual([...new Set(dupes)], []);
});

test('landmarks: skip link, nav, one h1, main, footer; every in-page link has a target', () => {
  assert.match(html, /<a class="skip-link" href="#main">/);
  assert.match(html, /<nav class="topnav" aria-label="Page sections">/);
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.equal((html.match(/<main[ >]/g) || []).length, 1);
  assert.equal((html.match(/<footer[ >]/g) || []).length, 1);
  assert.ok(html.indexOf('<main') < html.indexOf('id="mapSection"') && html.indexOf('id="downloadSection"') < html.indexOf('</main>'));
  const links = [...html.slice(0, html.lastIndexOf('<script>')).matchAll(/href="#([^"]+)"/g)].map(m => m[1]);
  assert.ok(links.length >= 8);
  const broken = links.filter(id => !idsInMarkup.has(id));
  assert.deepEqual(broken, [], 'in-page links with no target: ' + broken.join(', '));
});

test('nothing is smaller than 11px (stylesheet, inline styles, canvas fonts)', () => {
  const sizes = [...html.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1]))
    .concat([...html.matchAll(/ctx\.font = '(?:bold )?(\d+)px/g)].map(m => Number(m[1])));
  const small = sizes.filter(n => n < 11);
  assert.deepEqual(small, [], 'font sizes under 11px: ' + small.join(', '));
});

test('accent colour is never used as small text on the light background', () => {
  assert.match(css, /--accent-text: #8a5800/);
  assert.ok(!/\.eyebrow \{[^}]*color: var\(--amber-dim\)/.test(css), 'eyebrow must use --accent-text');
  assert.ok(!/\.street-view-btn \{[^}]*color: var\(--amber\)/.test(css.replace(/\n/g, ' ')), 'street view button must use --accent-text');
});

test('every interactive control is a real control or has a role and tabindex', () => {
  const switches = [...html.matchAll(/<div class="toggle-row"[^>]*>/g)].map(m => m[0]);
  assert.ok(switches.length >= 8);
  for (const s of switches) {
    assert.match(s, /role="switch"/); assert.match(s, /tabindex="0"/); assert.match(s, /aria-checked=/); assert.match(s, /aria-label=/);
  }
  const markup = html.slice(0, html.lastIndexOf('<script>'));
  const buttons = [...markup.matchAll(/<button\b[^>]*>/g)].map(m => m[0]).filter(b => !b.includes('type='));
  assert.deepEqual(buttons, [], 'static buttons should declare type="button"');
});

test('the hero image is small, lazy, sized, and has alt text', () => {
  const img = html.match(/<img class="hero-image"[^>]*>/)[0];
  assert.match(img, /\.webp"/); assert.match(img, /loading="lazy"/); assert.match(img, /width="\d+" height="\d+"/); assert.match(img, /alt="[^"]{20,}"/);
  const file = img.match(/src="([^"]+)"/)[1];
  assert.ok(fs.statSync(path.join(ROOT, file)).size < 250 * 1024, file + ' should stay under 250 KB');
});

test('colour theme is switchable, remembered safely, and honours reduced motion', () => {
  assert.match(html, /localStorage\.getItem\("ds-theme"\)/);
  assert.match(script, /localStorage\.setItem\('ds-theme'/);
  assert.ok(/try \{ localStorage\.setItem/.test(script));
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:root\[data-theme="dark"\]/);
  assert.match(css, /:root\[data-theme="light"\]/);
});

test('sources are a list with a link or citation each, and the licence note is kept', () => {
  const block = html.slice(html.indexOf('<details class="sources">'), html.indexOf('</details>', html.indexOf('<details class="sources">')));
  const items = [...block.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(m => m[1]);
  assert.ok(items.length >= 15, 'expected the source list, found ' + items.length);
  assert.ok(items.every(t => t.trim().length > 15));
  assert.ok(/ODbL/.test(block), 'OpenStreetMap licence note must stay in the sources');
  assert.match(html, /District boundary polygons simplified for display/);
});
