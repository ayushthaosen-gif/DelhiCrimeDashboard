// Keeps the citation metadata honest: CITATION.cff and .zenodo.json agree, and no DOI appears unless it has the shape of a real one.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const cff = fs.readFileSync(path.join(ROOT, 'CITATION.cff'), 'utf8');
const zen = JSON.parse(fs.readFileSync(path.join(ROOT, '.zenodo.json'), 'utf8'));
const field = k => { const m = cff.match(new RegExp('^' + k + ':\\s*"?([^"\\n]+)"?\\s*$', 'm')); return m ? m[1].trim() : null; };

test('CITATION.cff and .zenodo.json describe the same work', () => {
  assert.equal(zen.title, field('title'));
  assert.equal(zen.license, field('license').toLowerCase());
  assert.ok(zen.related_identifiers.some(r => r.identifier === field('repository-code')));
  assert.equal(zen.upload_type, field('type'));
  assert.ok(zen.creators.length >= 1 && zen.creators.every(c => c.name));
  for (const k of ['delhi', 'ncrb', 'road-safety']) assert.ok(zen.keywords.includes(k), k);
});

test('no DOI is stated unless it has the shape of one, and the citing guide exists', () => {
  for (const text of [cff, JSON.stringify(zen), fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8')]) {
    for (const m of text.matchAll(/\bdoi[:\s"]+([^\s",)]+)/gi)) assert.match(m[1], /^10\.\d{4,9}\/\S+$/, 'DOI-like text must be a real DOI: ' + m[1]);
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'docs/CITING.md')));
});
