// Generates the logo and favicon SVGs into assets/ and the HTML pages the PNG sizes are rendered from (see docs/BRAND.md). The mark is Delhi's own street plan: Connaught Place's two rings with seven radial roads, and one
// marked point on the outer ring (the thing being observed). Run: node scripts/make_brand.js
const fs = require('fs');
const path = require('path');
const os = require('os');
const R = path.join(__dirname, '..', 'assets') + path.sep;
const SP = path.join(os.tmpdir(), 'dso-brand') + path.sep; // HTML pages to screenshot into the PNG sizes (see docs/BRAND.md)
fs.mkdirSync(SP, { recursive: true });

const NAVY = '#1c2331', AMBER = '#e3a13b', IVORY = '#f2f3f5', RUST_DK = '#d9654a', RUST_LT = '#b14a34';
const f = n => Math.round(n * 100) / 100;
const pt = (r, deg) => [f(32 + r * Math.cos(deg * Math.PI / 180)), f(32 + r * Math.sin(deg * Math.PI / 180))];

// pal: ring, spokes, dot, halo (colour that separates the dot from the ring), centre fill
function mark(pal, scale) {
  let spokes = '';
  [[-104, 30], [-52, 25], [-8, 30], [40, 25], [96, 30], [148, 25], [206, 30]].forEach(([a, end]) => {
    const [x1, y1] = pt(9, a), [x2, y2] = pt(end, a);
    spokes += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
  });
  const [dx, dy] = pt(19, -30);
  const inner = '<g stroke="' + pal.spokes + '" stroke-width="2.4" stroke-linecap="round">' + spokes + '</g>'
    + '<circle cx="32" cy="32" r="19" fill="none" stroke="' + pal.ring + '" stroke-width="4.5"/>'
    + '<circle cx="32" cy="32" r="9" fill="' + pal.centre + '" stroke="' + pal.spokes + '" stroke-width="3"/>'
    + '<circle cx="' + dx + '" cy="' + dy + '" r="5.2" fill="' + pal.dot + '" stroke="' + pal.halo + '" stroke-width="1.6"/>';
  return scale && scale !== 1 ? '<g transform="translate(32 32) scale(' + scale + ') translate(-32 -32)">' + inner + '</g>' : inner;
}
const DARK = { ring: AMBER, spokes: IVORY, dot: RUST_DK, halo: IVORY, centre: NAVY };            // on navy
const LIGHT = { ring: NAVY, spokes: NAVY, dot: RUST_LT, halo: '#ffffff', centre: '#ffffff' };    // on white
const svg = (w, h, vb, body, title) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="' + vb + '" role="img" aria-label="' + title + '"><title>' + title + '</title>' + body + '</svg>\n';
const T = 'Delhi Urban Safety Observatory';

const files = {
  'favicon.svg': svg(64, 64, '0 0 64 64', '<rect width="64" height="64" rx="14" fill="' + NAVY + '"/>' + mark(DARK), T),
  'logo-mark.svg': svg(64, 64, '0 0 64 64', mark(DARK), T),           // transparent, for dark backgrounds
  'logo-mark-light.svg': svg(64, 64, '0 0 64 64', mark(LIGHT), T),    // transparent, for light backgrounds
  'logo.svg': svg(340, 64, '0 0 340 64',
    '<rect width="64" height="64" rx="14" fill="' + NAVY + '"/>' + mark(DARK)
    + '<g font-family="\'IBM Plex Sans\', \'Segoe UI\', Arial, sans-serif" fill="' + NAVY + '">'
    + '<text x="80" y="30" font-size="23" font-weight="700" letter-spacing="1.6">DELHI URBAN</text>'
    + '<text x="80" y="53" font-size="16.5" font-weight="600" letter-spacing="2.3">SAFETY OBSERVATORY</text></g>', T)
};
for (const [n, s] of Object.entries(files)) fs.writeFileSync(R + n, s);

// pages for rendering PNGs with headless Edge
const page = (w, h, bg, body, extra) => '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:' + bg + ';}svg{display:block}' + (extra || '') + '</style><body>' + body;
const tile = (size, radius, scale) => '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 64 64"><rect width="64" height="64" rx="' + radius + '" fill="' + NAVY + '"/>' + mark(DARK, scale) + '</svg>';
const pages = {
  'favicon-16.html': [16, 16, page(16, 16, 'transparent', tile(16, 14, 1))],
  'favicon-32.html': [32, 32, page(32, 32, 'transparent', tile(32, 14, 1))],
  'favicon-48.html': [48, 48, page(48, 48, 'transparent', tile(48, 14, 1))],
  'apple-touch-icon.html': [180, 180, page(180, 180, NAVY, tile(180, 0, 0.86))],     // iOS rounds the corners itself
  'icon-192.html': [192, 192, page(192, 192, NAVY, tile(192, 0, 0.78))],             // full bleed, mark inside the maskable safe zone
  'icon-512.html': [512, 512, page(512, 512, NAVY, tile(512, 0, 0.78))],
  'logo.html': [1360, 256, page(1360, 256, 'transparent',
    '<div style="display:flex;align-items:center;gap:32px;height:256px;font-family:\'IBM Plex Sans\',\'Segoe UI\',Arial,sans-serif;color:' + NAVY + '">'
    + tile(256, 14, 1)
    + '<div style="line-height:1.05"><div style="font-weight:700;font-size:92px;letter-spacing:6.4px">DELHI URBAN</div><div style="font-weight:600;font-size:66px;letter-spacing:9.2px;margin-top:12px">SAFETY OBSERVATORY</div></div></div>',
    '')],
  'logo-mark.html': [512, 512, page(512, 512, 'transparent', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 64 64">' + mark(LIGHT) + '</svg>')]
};
const fontLink = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@600;700&display=swap">';
for (const [n, [w, h, html]] of Object.entries(pages)) fs.writeFileSync(SP + n, html.replace('<style>', fontLink + '<style>'));
fs.writeFileSync(SP + 'sizes.json', JSON.stringify(Object.fromEntries(Object.entries(pages).map(([n, [w, h]]) => [n, [w, h]]))));
console.log('wrote', Object.keys(files).join(', '));
