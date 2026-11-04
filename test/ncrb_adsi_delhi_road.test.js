// Guards the staged NCRB road tables for Delhi (UT), 2014 to 2022: every year is present, each row's parts add to its printed totals, and the four tables agree with one another.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'staged', 'ncrb_adsi_delhi_road', 'delhi_ut_road_time_class_place_2014_2022.json'), 'utf8'));
const years = Object.keys(doc.years);
const sum = a => a.reduce((x, y) => x + y, 0);

test('one entry for each year 2014 to 2022, each table with a source and hash', () => {
  assert.deepEqual(years.map(Number), [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022]);
  for (const y of years) {
    for (const t of ['1A.2', '1A.6', '1A.7', '1A.11']) {
      const s = doc.years[y].sources[t];
      assert.match(s.url, /^https:\/\/www\.ncrb\.gov\.in\/uploads\/.*\.pdf$/, y + ' ' + t);
      assert.match(s.sha256, /^[0-9a-f]{64}$/, y + ' ' + t);
    }
  }
});

test('the eight time bands add to the printed total', () => {
  for (const y of years) {
    const t = doc.years[y].timeOfDay;
    assert.equal(t.accidents.length, 8, y);
    assert.equal(sum(t.accidents), t.total, y);
  }
});

test('road classes add to the printed total for cases, injured and died', () => {
  for (const y of years) {
    const rc = doc.years[y].roadClassification;
    for (const k of ['cases', 'injured', 'died']) {
      assert.equal(rc.national_highway[k] + rc.state_highway[k] + rc.expressway[k] + rc.other_roads[k], rc.total[k], y + ' ' + k);
    }
  }
});

test('the four tables agree: crashes and deaths are the same figure wherever they appear', () => {
  for (const y of years) {
    const r = doc.years[y];
    assert.equal(r.timeOfDay.total, r.roadClassification.total.cases, y + ' time vs road class');
    assert.deepEqual({ cases: r.roadAccidents.cases, injured: r.roadAccidents.injured, died: r.roadAccidents.died }, r.roadClassification.total, y + ' 1A.2 vs 1A.7');
    assert.equal(r.placeOfDeath.grand_total.total, r.roadClassification.total.died, y + ' place vs road class');
  }
});

test('place categories add to the rural and urban subtotals and the grand total, and sexes add to each total', () => {
  for (const y of years) {
    const p = doc.years[y].placeOfDeath;
    const rural = ['rural_school_college', 'rural_residential', 'rural_religious', 'rural_recreation', 'rural_factory', 'rural_others'];
    const urban = ['urban_school_college', 'urban_residential', 'urban_religious', 'urban_recreation', 'urban_factory_industrial', 'urban_pedestrian_crossing', 'urban_others'];
    assert.equal(sum(rural.map(k => p[k].total)), p.rural_subtotal.total, y + ' rural');
    assert.equal(sum(urban.map(k => p[k].total)), p.urban_subtotal.total, y + ' urban');
    assert.equal(p.rural_subtotal.total + p.urban_subtotal.total, p.grand_total.total, y + ' grand');
    for (const k of Object.keys(p)) assert.equal(p[k].male + p[k].female + p[k].transgender, p[k].total, y + ' ' + k);
  }
});

test('the yearly change in crashes stays in a plausible band, so a column slip would show', () => {
  for (let i = 1; i < years.length; i++) {
    const c = doc.years[years[i]].roadAccidents.cases / doc.years[years[i - 1]].roadAccidents.cases - 1;
    assert.ok(Math.abs(c) < 0.3, years[i] + ' changed by ' + (c * 100).toFixed(1) + '%');
  }
});
