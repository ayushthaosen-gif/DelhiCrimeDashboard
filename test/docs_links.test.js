// Every relative link in the README and the docs must point at a file that exists, so moving text between documents cannot leave dead links.
//
//   node --test test/docs_links.test.js

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const files = ['README.md', ...fs.readdirSync(path.join(ROOT, 'docs')).filter(f => f.endsWith('.md')).map(f => 'docs/' + f)];

test('relative links in the README and docs resolve', () => {
  const broken = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const t = m[1];
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      if (!fs.existsSync(path.join(ROOT, path.dirname(f), t.split('#')[0]))) broken.push(f + ' -> ' + t);
    }
  }
  assert.deepEqual(broken, []);
});

test('the README stays a short landing page', () => {
  assert.ok(fs.statSync(path.join(ROOT, 'README.md')).size < 12000, 'README grew past 12 KB: move detail into docs/');
});

test('the README opens with what the project is and no longer claims to be a single-file dashboard or to hold real coordinates', () => {
  const r = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(/open-data observatory/i.test(r.split('\n').slice(0, 8).join('\n')));
  assert.ok(!/single-file dashboard/i.test(r) && !/real 2023 severity counts/i.test(r) && !/real public\s+infrastructure/i.test(r));
});
