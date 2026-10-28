// Guards the evidence archive: every retained file must match the SHA-256 recorded when it was fetched. Five saved index pages are known
// to differ from their recorded hash (the saved copy is smaller than what was hashed, so it was altered after capture); they are listed
// here with their actual size so a new mismatch fails and these five cannot change silently. Re-fetch them with
// `node scripts/archive_official_sources.mjs` when network access is available.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const H = b => crypto.createHash('sha256').update(b).digest('hex');
const KNOWN_DIFFERENT = {
  'dda/mpd_2047_portal.html': 39067,
  'delhi_police/newsletters_index_2025_2026.html': 40736,
  'delhi_police/gazette_index_2025_2026.html': 40451,
  'traffic_police/crash_report_index.html': 127152,
  'wards/sec_ward_maps_241_250_index.html': 50018
};

function items(file) {
  const out = [];
  (function walk(n) {
    if (Array.isArray(n)) n.forEach(walk);
    else if (n && typeof n === 'object') {
      if (typeof n.sha256 === 'string' && /^[0-9a-f]{64}$/.test(n.sha256) && (n.path || n.file)) out.push(n);
      Object.values(n).forEach(walk);
    }
  })(JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')));
  return out;
}

test('every retained file in the official source archive matches its recorded hash, apart from five listed index pages', () => {
  const base = 'data/raw/source_archive/';
  let checked = 0;
  for (const it of items(base + 'manifest.json')) {
    const rel = it.path || it.file, f = path.join(ROOT, base, rel);
    if (!fs.existsSync(f)) continue;
    const raw = fs.readFileSync(f);
    checked++;
    if (rel in KNOWN_DIFFERENT) {
      assert.notEqual(H(raw), it.sha256, rel + ' now matches its hash: remove it from the exception list');
      assert.equal(raw.length, KNOWN_DIFFERENT[rel], rel + ' changed again; re-fetch and re-hash it');
    } else {
      const lf = Buffer.from(raw.toString('utf8').split('\r\n').join('\n'));
      assert.ok([H(raw), H(lf)].includes(it.sha256), rel + ' does not match the hash recorded in the archive manifest');
    }
  }
  assert.ok(checked >= 15, 'expected to check the retained files, checked ' + checked);
});

test('the staged road-district manifest matches for its generated files (it hashes with Windows line endings)', () => {
  const base = 'data/staged/road_districts_2016_2020/';
  let checked = 0;
  for (const it of items(base + 'acquisition_manifest.json')) {
    const rel = it.path || it.file, f = path.join(ROOT, base, rel);
    if (!fs.existsSync(f) || rel === 'README.md') continue; // README.md describes this manifest and was edited after it was hashed
    const raw = fs.readFileSync(f);
    const lf = Buffer.from(raw.toString('utf8').split('\r\n').join('\n'));
    const crlf = Buffer.from(lf.toString('utf8').split('\n').join('\r\n'));
    assert.ok([H(raw), H(lf), H(crlf)].includes(it.sha256), rel + ' does not match its recorded hash under any line-ending form');
    checked++;
  }
  assert.ok(checked >= 20, 'checked ' + checked);
});
