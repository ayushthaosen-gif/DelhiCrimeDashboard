// Guards the evidence archive: every retained file must match the SHA-256 recorded when it was fetched. Five saved index pages differ from
// that capture hash (the saved copy is smaller than what was hashed); manifest.json keeps the capture record and retained_hashes.json records
// the hash of the copy actually kept, so each file is checked against a recorded hash and none can change silently. A missing file fails.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const H = b => crypto.createHash('sha256').update(b).digest('hex');
const RETAINED = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/raw/source_archive/retained_hashes.json'), 'utf8')).files;

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

test('every retained file in the official source archive matches a recorded hash: the captured one, or for five altered index pages the retained one', () => {
  const base = 'data/raw/source_archive/';
  const retained = new Map(RETAINED.map(r => [r.path, r]));
  let checked = 0;
  for (const it of items(base + 'manifest.json')) {
    const rel = it.path || it.file, f = path.join(ROOT, base, rel);
    assert.ok(fs.existsSync(f), rel + ' is recorded in the manifest with a hash but the file is missing');
    const raw = fs.readFileSync(f);
    checked++;
    const lf = Buffer.from(raw.toString('utf8').split('\r\n').join('\n'));
    if (retained.has(rel)) {
      const r = retained.get(rel);
      assert.equal(r.captured_sha256, it.sha256, rel + ': the capture record in retained_hashes.json must equal the manifest');
      assert.notEqual(r.retained_sha256, it.sha256);
      assert.ok([H(raw), H(lf)].includes(r.retained_sha256) && raw.length === r.retained_bytes, rel + ' does not match its retained hash; re-fetch and re-hash it');
    } else {
      assert.ok([H(raw), H(lf)].includes(it.sha256), rel + ' does not match the hash recorded in the archive manifest');
    }
  }
  assert.equal(retained.size, 5);
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
