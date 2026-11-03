// Guards the staged Delhi UT 2001 to 2010 totals: every year is present once, and each row's printed rate follows from its incidence and population.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'staged', 'delhi_ut_total_2001_2010', 'delhi_ut_total_ipc_2001_2010.json'), 'utf8'));

test('one row for each year 2001 to 2010, each with a source and hash', () => {
  assert.deepEqual(data.rows.map(r => r.year), [2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 2010]);
  for (const r of data.rows) {
    assert.match(r.source_url, /^https:\/\/www\.ncrb\.gov\.in\/uploads\/.*\.pdf$/, String(r.year));
    assert.match(r.sha256, /^[0-9a-f]{64}$/, String(r.year));
  }
});

test('the printed rate is incidence per lakh of the printed population, to one decimal', () => {
  for (const r of data.rows) {
    const computed = r.incidence / r.population_lakh;
    assert.ok(Math.abs(computed - r.rate) <= 0.06, r.year + ': ' + computed.toFixed(2) + ' vs printed ' + r.rate);
  }
});

test('the yearly change stays within a plausible band, so a column slip would show', () => {
  for (let i = 1; i < data.rows.length; i++) {
    const change = data.rows[i].incidence / data.rows[i - 1].incidence - 1;
    assert.ok(Math.abs(change) < 0.15, data.rows[i].year + ' changed by ' + (change * 100).toFixed(1) + '%');
  }
});
