// Guards Planning mode and the "Why this place?" panel: the browser data files come from the profile bundle, every layer reads a described field,
// the panel states observed issue / infrastructure / year and source / uncertainty / limits, the evidence-pack ZIP is a valid archive with the
// right files, and the page keeps its honesty labels (legacy 290 wards, approximate positions, OpenStreetMap lower bounds).
//
//   node --test test/planning.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n/g, '\n');
const json = f => JSON.parse(read(f));
const { render } = require('../scripts/build_site');
const files = render();

function load(file, name) { const ctx = vm.createContext({ window: {} }); vm.runInContext(files[file], ctx); return ctx.window[name]; }
const PROFILES = JSON.parse(JSON.stringify(load('assets/profiles-data.js', 'DSO_PROFILES')));
const PLAN = JSON.parse(JSON.stringify(load('assets/planning-data.js', 'DSO_PLAN')));
const schema = json('data/profiles/schema.json'), wards = json('data/profiles/ward_profiles.json');

// a browser-like context that runs the real site.js and why.js, with a DOM stub that is enough for the pure builders
function whyApi() {
  const noop = () => {};
  const el = () => ({ setAttribute: noop, appendChild: noop, addEventListener: noop, classList: { toggle: noop }, style: {} });
  const document = { addEventListener: noop, getElementById: () => null, createElement: el, createElementNS: el, createTextNode: () => ({}), documentElement: { getAttribute: () => 'light' }, querySelector: () => null };
  const ctx = vm.createContext({ window: { DSO_PROFILES: PROFILES }, document, localStorage: { getItem: () => null }, CustomEvent: function () {}, Blob: function () {}, TextEncoder, URL: { createObjectURL: () => '' }, setTimeout });
  ctx.window.window = ctx.window;
  vm.runInContext(read('assets/site.js'), ctx);
  vm.runInContext(read('assets/why.js'), ctx);
  return ctx.window.DSO;
}
const D = whyApi();
const ctxFor = no => { const r = wards.rows.find(x => x.ward_no === no); return { row: r, zones: r.zones, rank: null }; };

test('the browser data files come from the profile bundle: contract, 15 districts, 290 ward outlines in the same order, zone positions', () => {
  assert.deepEqual(PLAN.cols, schema.wardFields.map(f => f.id));
  assert.equal(PLAN.wards.length, 290);
  PLAN.wards.forEach((w, i) => { assert.equal(w.no, wards.rows[i].ward_no); assert.match(w.path, /^M[\d. -]+/); assert.equal(w.v.length, PLAN.cols.length); assert.equal(w.zones.length, wards.rows[i].crash_zones_2024); });
  assert.equal(PLAN.zonePoints.length, 93);
  assert.equal(PROFILES.districtRows.length, 15);
  for (const f of schema.wardFields) assert.ok(PROFILES.schema.ward[f.id], f.id);
  for (const f of schema.districtFields) assert.ok(PROFILES.schema.district[f.id], f.id);
  assert.ok(files['assets/planning-data.js'].length < 400 * 1024, 'the ward data stays small enough to load on a phone');
  assert.match(PLAN.viewBox, /^0 0 1000 \d+$/);
});

test('every layer reads a described ward field, and a rate exists only where a per-km² field exists', () => {
  const src = read('assets/page-planning.js');
  const fields = [...src.matchAll(/field: '([a-z0-9_]+)'/g)].map(m => m[1]), rates = [...src.matchAll(/rate: '([a-z0-9_]+)'/g)].map(m => m[1]);
  assert.ok(fields.length >= 15);
  for (const f of fields.concat(rates)) assert.ok(PROFILES.schema.ward[f], 'layer field ' + f + ' is in the contract');
  for (const g of ['Crash severity', 'Pedestrian infrastructure', 'Transit', 'Street lighting', 'Services', 'Land use']) assert.ok(src.includes("g: '" + g + "'"), g);
  for (const needle of ['crash_zone_fatal_crashes_2024', 'footway_km', 'pedestrian_crossings', 'traffic_signals', 'bus_stops', 'street_lamps_mapped', 'hospitals', 'police_stations', 'residential_pct']) assert.ok(fields.includes(needle), needle + ' is a planning layer');
  assert.match(src, /the streetlight survey is published by district only/);
});

test('Why this place?: a ward with a zone states the issue, ranks, position accuracy and lower bounds; a ward without one says that is not "no crashes"', () => {
  const withZone = wards.rows.find(r => r.crash_zones_2024 >= 1 && r.crash_zone_fatal_crashes_2024 > 0);
  const w = D.why.buildWard({ row: withZone, zones: withZone.zones, rank: { fatal: [3, 66] } });
  assert.ok(w.issue.some(s => /crash-prone zone/.test(s) && s.includes(withZone.zones[0].name)));
  assert.ok(w.issue.some(s => /ranks 3rd of 66/.test(s)));
  assert.ok(w.flags.some(s => /placed by hand/.test(s) && /m\./.test(s)), 'zone position accuracy is stated');
  assert.ok(w.flags.some(s => /same for every ward/.test(s)), 'the inherited district crime is flagged');
  const none = wards.rows.find(r => r.crash_zones_2024 === 0);
  const n = D.why.buildWard(ctxFor(none.ward_no));
  assert.ok(n.issue.some(s => /does not mean no crashes happened/.test(s)));
  assert.ok(n.subtitle.includes('not the current 250 wards'));
  const low = wards.rows.find(r => r.low_landuse_coverage), sparse = wards.rows.find(r => r.no_mapped_infrastructure);
  assert.ok(D.why.buildWard(ctxFor(low.ward_no)).flags.some(s => /under a quarter/.test(s)));
  assert.ok(D.why.buildWard(ctxFor(sparse.ward_no)).flags.some(s => /unmapped area/.test(s)));
});

test('the panel always carries year and source for each figure, the uncertainty classes used, and the fixed limits; a blank is never shown as zero', () => {
  const r = wards.rows.find(x => x.crash_zones_without_printed_counts_2024 > 0 && x.crash_zone_total_crashes_2024 === null) || wards.rows.find(x => x.crash_zones_2024 > 0);
  const w = D.why.buildWard(ctxFor(r.ward_no));
  assert.ok(w.provenance.length >= 10);
  for (const p of w.provenance) { assert.ok(p.year && p.source && p.cls, p.id); assert.ok(PROFILES.uncertaintyClasses[p.cls], p.cls); }
  assert.deepEqual(w.cannot.slice(0, 7), PROFILES.cannotEstablish.general);
  assert.ok(w.cannot.some(s => /unmapped|mapped infrastructure/i.test(s)) && w.cannot.some(s => /Where exactly crashes happened/.test(s)));
  const md = D.why.markdown(w);
  for (const h of ['## Observed issue', '## Infrastructure', '## Uncertainty', '## Data year and source of each figure', '## What this data cannot establish']) assert.ok(md.includes(h), h);
  assert.ok(!/\bnull\b|undefined|NaN/.test(md), 'no raw null, undefined or NaN reaches the text');
  const dist = D.why.buildDistrict(PROFILES.districtRows.find(x => x.district === 'Dwarka'));
  assert.ok(dist.nearby.some(n => n.value === 'not surveyed'), 'an unsurveyed district says not surveyed, not zero');
  assert.ok(dist.issue.some(s => /registered cases/.test(s)) && dist.issue.some(s => /No change figure/.test(s)));
  assert.ok(dist.flags.some(s => /did not cover this district/.test(s)));
});

test('the evidence-pack ZIP writer produces a valid archive (checked against Node\'s own CRC-32), with names and contents intact', async () => {
  const blobs = [];
  const ctx = vm.createContext({ window: {}, document: { addEventListener() {}, getElementById: () => null, documentElement: { getAttribute: () => 'light' } }, localStorage: { getItem: () => null }, CustomEvent: function () {}, Blob: function (parts) { blobs.push(parts); this.parts = parts; }, TextEncoder, URL: { createObjectURL: () => '' }, setTimeout });
  ctx.window.window = ctx.window;
  vm.runInContext(read('assets/site.js'), ctx);
  const items = [{ name: 'why_this_place.md', text: '# Ward\n\nÅ ward — evidence' }, { name: 'ward_profile.csv', text: 'a,b\n1,\n' }];
  const blob = ctx.window.DSO.zip(items);
  const buf = Buffer.concat(blob.parts.map(p => Buffer.from(p)));
  assert.equal(buf.readUInt32LE(0), 0x04034b50, 'starts with a local file header');
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 5, 6]));
  assert.equal(buf.readUInt16LE(eocd + 10), 2, 'two entries');
  let off = buf.readUInt32LE(eocd + 16), seen = [];
  for (let i = 0; i < 2; i++) {
    assert.equal(buf.readUInt32LE(off), 0x02014b50);
    const crc = buf.readUInt32LE(off + 16), size = buf.readUInt32LE(off + 24), nl = buf.readUInt16LE(off + 28), lho = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nl).toString('utf8');
    const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const data = buf.slice(dataStart, dataStart + size);
    assert.equal(zlib.crc32(data), crc, name + ' CRC-32 matches');
    assert.equal(data.toString('utf8'), items[i].text);
    seen.push(name); off += 46 + nl;
  }
  assert.deepEqual(seen, items.map(i => i.name));
});

test('the Planning page: shared shell, six pages in the nav, scripts in order, legacy-ward and approximate-position labels, no innerHTML, evidence-pack contents', () => {
  const html = files['planning.html'];
  assert.ok(html.includes('id="plToolbar"') && html.includes('id="plWork"') && html.includes('id="main"'));
  const order = ['assets/site.js', 'assets/site-data.js', 'assets/profiles-data.js', 'assets/planning-data.js', 'assets/why.js', 'assets/page-planning.js'].map(s => html.indexOf(s));
  assert.ok(order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])), 'script order');
  assert.ok(/aria-current="page">Planning</.test(html));
  assert.match(html, /Nothing here says what caused a crash or what should be built/);
  const src = read('assets/page-planning.js'), why = read('assets/why.js');
  for (const s of [src, why]) assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(/.test(s));
  assert.match(src, /Legacy ward geography \(290 wards, before the 2022 delimitation\), not the current 250 MCD wards/);
  assert.match(src, /placed by hand \(accurate to 150 m up to 5 km\)/);
  assert.match(src, /often means the area is not mapped/);
  for (const f of ['README.txt', 'why_this_place.md', 'ward_profile.csv', 'ward_profile.json', 'ward_boundary.geojson', 'field_contract.json', 'provenance_manifest.json']) assert.ok(src.includes(f), 'evidence pack includes ' + f);
  assert.match(src, /evidence for a field audit, not a finding/i);
  assert.ok(src.includes("delhi_ward_' + w.no + '_evidence_pack.zip"));
  assert.ok(read('assets/page-explore.js').includes('Why this place? Sources, uncertainty and limits'), 'Explore shows the panel for a district');
  assert.ok(read('assets/page-3d.js').includes('Open in Planning mode'), 'the 3D ward card links to Planning mode');
  assert.ok(html.includes('class="lead"') && html.includes('class="pl-sub"'), 'intro: first sentence is the lead, the rest is smaller');
  assert.ok(!src.includes('mousemove') && src.includes('pl-cau') && why.includes('pl-cau'), 'hover card is fixed in the map corner; warnings use the yellow callout');
  assert.ok(src.includes('window.scrollTo') && /Open ward/.test(src), 'Open ward scrolls with an offset for the sticky toolbar');
  const css = read('assets/site.css');
  assert.ok(css.includes('@media (min-width: 1140px) {\n  #plWork > .panel.detail { position: sticky; top: var(--pl-sticky-top, 110px); max-height: calc(100vh - var(--pl-sticky-top, 110px) - 16px); overflow-y: auto; overscroll-behavior: contain; }'), 'the ward panel is sticky beside the map and scrolls inside itself');
  assert.ok(src.includes('--pl-sticky-top') && src.includes('syncStickyTop'), 'the sticky offset follows the real toolbar height');
  assert.ok(files['explore.html'].includes('assets/profiles-data.js') && files['explore.html'].includes('assets/why.js'));
});
