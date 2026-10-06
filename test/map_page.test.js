// Structural guard for the interactive map page. The page is one generated file whose script looks
// controls up by id, so the failure mode this protects against is silent: rearranging the markup
// (as the 2026-10-07 control-panel redesign did) leaves a getElementById('x') pointing at nothing, and
// the page breaks at runtime in a way node --check cannot see. These read the built interactive_map.html.
//
//   node --test test/map_page.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'interactive_map.html'), 'utf8');
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));

test('every element the script looks up by id exists in the page', () => {
  const ids = [...new Set([...script.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]))];
  assert.ok(ids.length > 30, 'expected to find the script\'s id lookups, found ' + ids.length);
  const missing = ids.filter(id => !html.includes('id="' + id + '"'));
  assert.deepEqual(missing, [], 'script references ids that are not in the markup: ' + missing.join(', '));
});

test('the old top-bar layout is gone and nothing still points at it', () => {
  for (const gone of ['topbar', 'analysisBar']) {
    assert.ok(!html.includes('id="' + gone + '"'), gone + ' markup should have been removed');
    assert.ok(!script.includes("'" + gone + "'"), gone + ' is still referenced by the script');
  }
});

test('page shell: app bar, control panel and map are laid out in order, with landmarks', () => {
  const order = ['id="appbar"', 'id="appBody"', 'id="panel"', 'id="mapRegion"', 'id="methodOverlay"'].map(s => html.indexOf(s));
  assert.ok(order.every(i => i > 0), 'a shell element is missing');
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'shell elements are out of order');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<header id="appbar" role="banner">/);
  assert.match(html, /<aside id="panel" aria-label="Map controls">/);
  assert.match(html, /id="map" role="region" aria-label="[^"]+"/);
});

test('every layer checkbox sits inside a layer group and has a visible label', () => {
  const layersStart = html.indexOf('id="pointLayerToggles"');
  const layersEnd = html.indexOf('</aside>', layersStart);
  const section = html.slice(layersStart, layersEnd);
  const boxes = [...section.matchAll(/<input type="checkbox" id="(chk[A-Za-z0-9]+)"/g)].map(m => m[1]);
  assert.ok(boxes.length >= 15, 'expected the layer checkboxes, found ' + boxes.length);
  for (const id of boxes) {
    const at = section.indexOf('id="' + id + '"');
    const openLabel = section.lastIndexOf('<label', at);
    const closeLabel = section.indexOf('</label>', at);
    assert.ok(openLabel > -1 && closeLabel > at, id + ' is not wrapped in a label');
  }
  assert.ok(!/<details class="layer-group" open>/.test(html), 'layer groups are meant to start collapsed');
});

test('each quick view card has a handler, and each handler has a card', () => {
  const cards = [...html.matchAll(/class="guided-view" type="button" data-view="([a-z-]+)"/g)].map(m => m[1]).sort();
  assert.equal(cards.length, 3);
  const handled = [...script.matchAll(/view === '([a-z-]+)'/g)].map(m => m[1]);
  for (const c of cards) assert.ok(handled.includes(c), 'quick view "' + c + '" has no handler');
  for (const h of new Set(handled)) assert.ok(cards.includes(h), 'handler "' + h + '" has no quick-view card');
});

test('the district click is a tooltip plus the drawer, not a duplicate popup', () => {
  assert.ok(!script.includes('layer.openPopup();'), 'district selection should not open a popup next to the drawer');
  assert.match(script, /layer\.bindTooltip\(tip, \{ sticky: true \}\)/);
});

test('no text smaller than 11px in the page stylesheet', () => {
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const small = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => Number(m[1])).filter(n => n < 11);
  assert.deepEqual(small, [], 'font sizes under 11px found: ' + small.join(', '));
});
