// Guards the logo and favicon: the files exist at the sizes they claim, the icon links reach every page, and the header mark comes from the one source file.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const buf = f => fs.readFileSync(path.join(ROOT, f));
const pngSize = f => { const b = buf(f); assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', f + ' is a PNG'); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

test('SVG logo files are valid, self-contained and share one 64 px design grid', () => {
  for (const f of ['assets/favicon.svg', 'assets/logo-mark.svg', 'assets/logo-mark-light.svg', 'assets/logo.svg']) {
    const s = read(f);
    assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, f);
    assert.match(s, /<title>Delhi Urban Safety Observatory<\/title>/, f + ' has an accessible name');
    assert.ok(!/<script|<image|href=|url\(/.test(s), f + ' is self-contained');
  }
  for (const f of ['assets/favicon.svg', 'assets/logo-mark.svg', 'assets/logo-mark-light.svg']) assert.match(read(f), /viewBox="0 0 64 64"/, f);
  assert.match(read('assets/logo.svg'), /viewBox="0 0 340 64"/);
});

test('PNG icons have the sizes the pages and manifest declare', () => {
  assert.deepEqual(pngSize('assets/favicon-32.png'), [32, 32]);
  assert.deepEqual(pngSize('assets/apple-touch-icon.png'), [180, 180]);
  assert.deepEqual(pngSize('assets/icon-192.png'), [192, 192]);
  assert.deepEqual(pngSize('assets/icon-512.png'), [512, 512]);
  assert.deepEqual(pngSize('assets/logo-mark.png'), [512, 512]);
  const [w, h] = pngSize('assets/logo.png');
  assert.ok(w / h > 5 && w >= 1000, 'the horizontal logo is wide and large enough to print');
});

test('favicon.ico holds 16, 32 and 48 px PNG images, and the root copy equals the assets copy', () => {
  const b = buf('assets/favicon.ico');
  assert.equal(b.readUInt16LE(0), 0); assert.equal(b.readUInt16LE(2), 1);
  const n = b.readUInt16LE(4);
  assert.equal(n, 3);
  const sizes = [];
  for (let i = 0; i < n; i++) {
    const e = 6 + 16 * i, len = b.readUInt32LE(e + 8), off = b.readUInt32LE(e + 12);
    sizes.push(b.readUInt8(e));
    assert.equal(b.subarray(off, off + 8).toString('hex'), '89504e470d0a1a0a', 'entry ' + i + ' is a PNG');
    assert.equal(b.readUInt32BE(off + 16), b.readUInt8(e), 'entry width matches its image');
    assert.ok(off + len <= b.length);
  }
  assert.deepEqual(sizes, [16, 32, 48]);
  assert.ok(buf('favicon.ico').equals(b));
});

test('the web manifest is valid and its icons exist', () => {
  const m = JSON.parse(read('assets/site.webmanifest'));
  assert.equal(m.name, 'Delhi Urban Safety Observatory');
  assert.equal(m.theme_color, '#1c2331');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(ROOT, 'assets', i.src)), i.src);
  assert.ok(m.icons.some(i => i.sizes === '192x192') && m.icons.some(i => i.sizes === '512x512'));
});

test('every page carries the icon set and theme colour, and the site header mark is the one in assets/logo-mark.svg', () => {
  const pages = fs.readdirSync(ROOT).filter(f => /\.html$/.test(f) && f !== 'delhi_safety_dashboard.html');
  assert.ok(pages.length >= 14);
  for (const f of pages) {
    const h = read(f);
    for (const needle of ['assets/favicon.svg', 'favicon.ico', 'assets/apple-touch-icon.png', 'assets/site.webmanifest', 'name="theme-color"']) assert.ok(h.includes(needle), f + ' lacks ' + needle);
  }
  const ring = read('assets/logo-mark.svg').match(/<circle cx="32" cy="32" r="19"[^>]*\/>/)[0];
  for (const f of ['index.html', 'explore.html', 'road-safety.html', 'reading-guide.html']) {
    const h = read(f);
    assert.ok(h.includes('class="brand-mark"') && h.includes('aria-hidden="true"') && h.includes(ring), f + ' header mark');
    assert.ok(!h.includes('<span class="brand-mark"><i></i></span>'), f + ' no longer uses the old placeholder');
  }
});
